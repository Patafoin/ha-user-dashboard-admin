"""Per-user rules, written into the frontend's own per-user data.

The official frontend reads the sidebar layout (`sidebar` key) and the default
dashboard (`core.default_panel`) from `frontend.user_data_<user_id>`. Writing
those keys server-side is enough: the frontend applies them itself, and open
tabs are notified through `frontend/subscribe_user_data`.

The kiosk flag has no server-side counterpart in the frontend; it is served to
the browser by `kiosk/subscribe` and relayed by `www/kiosk.js`.
"""

from __future__ import annotations

from collections.abc import Callable
from functools import partial
import logging
from typing import Any

from homeassistant.auth.models import User
from homeassistant.components.frontend.storage import async_user_store
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    ENFORCE_DEBOUNCE,
    MODE_ENFORCED,
    MODE_INITIAL,
    MODE_UNMANAGED,
    PROTECTED_ADMIN_PANELS,
    SIGNAL_RULES_UPDATED,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)


class RuleRejected(Exception):
    """A rule breaks a safeguard; `code` doubles as the translation key."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def default_rule() -> dict[str, Any]:
    return {"mode": MODE_INITIAL, "sidebar": None, "default_panel": None, "kiosk": False}


def is_managed_user(user: User) -> bool:
    """Real people only: no system accounts (Supervisor, content user…)."""
    return not user.system_generated


class UserRulesManager:
    """Store rules, apply them, re-impose enforced ones, serve the kiosk flag."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.rules: dict[str, dict[str, Any]] = {}
        self._enforce_unsubs: dict[str, list[CALLBACK_TYPE]] = {}
        self._pending: dict[str, CALLBACK_TYPE] = {}
        self._kiosk_listeners: dict[str, list[Callable[[bool], None]]] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.rules = data.get("users", {})

        known = {user.id for user in await self.hass.auth.async_get_users()}
        if stale := [user_id for user_id in self.rules if user_id not in known]:
            for user_id in stale:
                del self.rules[user_id]
            self._save()

        for user_id, rule in self.rules.items():
            if rule["mode"] == MODE_ENFORCED:
                await self.async_apply(user_id)
                await self._async_start_enforcing(user_id)

    @callback
    def async_unload(self) -> None:
        for user_id in list(self._enforce_unsubs):
            self._stop_enforcing(user_id)
        self._kiosk_listeners.clear()

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"users": self.rules}, 1.0)

    async def _async_get_user(self, user_id: str) -> User:
        user = await self.hass.auth.async_get_user(user_id)
        if user is None or not is_managed_user(user):
            raise RuleRejected("unknown_user", f"Unknown user: {user_id}")
        return user

    @staticmethod
    def _check_safeguards(user: User, rule: dict[str, Any]) -> None:
        if not user.is_admin:
            return
        if rule["kiosk"]:
            raise RuleRejected(
                "admin_kiosk",
                f"{user.name} is an admin: kiosk mode would lock them out of the settings",
            )
        hidden = (rule["sidebar"] or {}).get("hidden", [])
        if protected := [panel for panel in PROTECTED_ADMIN_PANELS if panel in hidden]:
            raise RuleRejected(
                "admin_protected_panel",
                f"{user.name} is an admin: {', '.join(protected)} cannot be hidden",
            )

    # --- rules -------------------------------------------------------------

    async def async_set_rule(self, user_id: str, rule: dict[str, Any]) -> None:
        user = await self._async_get_user(user_id)
        rule = {**default_rule(), **rule}
        self._check_safeguards(user, rule)

        self._stop_enforcing(user_id)
        self.rules[user_id] = rule
        if rule["mode"] != MODE_UNMANAGED:
            await self.async_apply(user_id)
        if rule["mode"] == MODE_ENFORCED:
            await self._async_start_enforcing(user_id)
        self._save()
        await self._async_notify(user_id)

    async def async_delete_rule(self, user_id: str) -> None:
        self._stop_enforcing(user_id)
        if self.rules.pop(user_id, None) is not None:
            self._save()
        await self._async_notify(user_id)

    async def async_set_kiosk(self, user_id: str, enable: bool) -> None:
        """Toggle kiosk only: the rest of the rule is left as is, not re-applied."""
        user = await self._async_get_user(user_id)
        rule = {**self.rules.get(user_id, default_rule()), "kiosk": enable}
        self._check_safeguards(user, rule)
        self.rules[user_id] = rule
        self._save()
        await self._async_notify(user_id)

    async def async_apply(self, user_id: str) -> None:
        """Write the rule into the user's frontend data, only where it differs."""
        rule = self.rules.get(user_id)
        if rule is None or rule["mode"] == MODE_UNMANAGED:
            return
        user = await self.hass.auth.async_get_user(user_id)
        if user is None:
            return
        store = await async_user_store(self.hass, user_id)
        written = False

        if rule["sidebar"] is not None:
            # Safety net if the user became admin after the rule was saved.
            hidden = [
                panel
                for panel in rule["sidebar"].get("hidden", [])
                if not (user.is_admin and panel in PROTECTED_ADMIN_PANELS)
            ]
            sidebar = {"panelOrder": list(rule["sidebar"].get("order", [])), "hiddenPanels": hidden}
            if store.data.get("sidebar") != sidebar:
                await store.async_set_item("sidebar", sidebar)
                written = True

        if rule["default_panel"]:
            # `core` holds other preferences too (showAdvanced…): merge, never replace.
            core = store.data.get("core") or {}
            if core.get("default_panel") != rule["default_panel"]:
                await store.async_set_item("core", {**core, "default_panel": rule["default_panel"]})
                written = True

        if written:
            rule["applied_at"] = dt_util.now().isoformat()
            self._save()
            _LOGGER.info("Applied rule for %s", user.name)

    # --- enforced mode -----------------------------------------------------

    async def _async_start_enforcing(self, user_id: str) -> None:
        store = await async_user_store(self.hass, user_id)
        check = partial(self._schedule_enforce, user_id)
        self._enforce_unsubs[user_id] = [
            store.async_subscribe("sidebar", check),
            store.async_subscribe("core", check),
        ]

    def _stop_enforcing(self, user_id: str) -> None:
        for unsub in self._enforce_unsubs.pop(user_id, []):
            unsub()
        if (cancel := self._pending.pop(user_id, None)) is not None:
            cancel()

    @callback
    def _schedule_enforce(self, user_id: str) -> None:
        # Our own writes land here too; async_apply compares before writing,
        # so they end as a no-op instead of a loop.
        if (cancel := self._pending.pop(user_id, None)) is not None:
            cancel()
        self._pending[user_id] = async_call_later(
            self.hass, ENFORCE_DEBOUNCE, partial(self._async_enforce, user_id)
        )

    async def _async_enforce(self, user_id: str, _now: Any) -> None:
        self._pending.pop(user_id, None)
        await self.async_apply(user_id)

    @callback
    def async_handle_user_updated(self, event: Event) -> None:
        """Admin status may have changed: safeguards and kiosk depend on it."""
        if (user_id := event.data["user_id"]) in self.rules:
            self.hass.async_create_task(self._async_user_updated(user_id))

    async def _async_user_updated(self, user_id: str) -> None:
        if self.rules[user_id]["mode"] == MODE_ENFORCED:
            await self.async_apply(user_id)
        await self._async_notify(user_id)

    # --- kiosk -------------------------------------------------------------

    def kiosk_enabled(self, user: User) -> bool:
        rule = self.rules.get(user.id)
        return bool(rule and rule["kiosk"]) and not user.is_admin

    @callback
    def async_subscribe_kiosk(
        self, user_id: str, listener: Callable[[bool], None]
    ) -> CALLBACK_TYPE:
        self._kiosk_listeners.setdefault(user_id, []).append(listener)

        @callback
        def unsubscribe() -> None:
            listeners = self._kiosk_listeners.get(user_id, [])
            if listener in listeners:
                listeners.remove(listener)

        return unsubscribe

    async def _async_notify(self, user_id: str) -> None:
        if (user := await self.hass.auth.async_get_user(user_id)) is not None:
            enabled = self.kiosk_enabled(user)
            for listener in list(self._kiosk_listeners.get(user_id, [])):
                listener(enabled)
        async_dispatcher_send(self.hass, SIGNAL_RULES_UPDATED, user_id)
