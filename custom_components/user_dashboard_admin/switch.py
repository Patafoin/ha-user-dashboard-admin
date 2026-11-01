"""One kiosk switch per user, so automations can toggle it."""

from __future__ import annotations

from typing import Any

from homeassistant.auth.models import User
from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import UserDashboardAdminConfigEntry
from .const import DOMAIN, SIGNAL_RULES_UPDATED
from .manager import RuleRejected, UserRulesManager, is_managed_user


async def async_setup_entry(
    hass: HomeAssistant,
    entry: UserDashboardAdminConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    # Users created later get their switch at the next reload of the entry.
    async_add_entities(
        KioskSwitch(entry, user)
        for user in await hass.auth.async_get_users()
        if is_managed_user(user)
    )


class KioskSwitch(SwitchEntity):
    """Kiosk mode of one user. Refuses to turn on for an admin."""

    _attr_has_entity_name = True
    _attr_translation_key = "kiosk"
    _attr_should_poll = False

    def __init__(self, entry: UserDashboardAdminConfigEntry, user: User) -> None:
        self._manager: UserRulesManager = entry.runtime_data
        self._user_id = user.id
        self._attr_unique_id = f"kiosk_{user.id}"
        self._attr_translation_placeholders = {"user": user.name or user.id}
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="User Dashboard Admin",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def is_on(self) -> bool:
        rule = self._manager.rules.get(self._user_id)
        return bool(rule and rule["kiosk"])

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_RULES_UPDATED, self._handle_update)
        )

    @callback
    def _handle_update(self, user_id: str) -> None:
        if user_id == self._user_id:
            self.async_write_ha_state()

    async def _async_set(self, enable: bool) -> None:
        try:
            await self._manager.async_set_kiosk(self._user_id, enable)
        except RuleRejected as err:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key=err.code,
                translation_placeholders={"user": self._attr_translation_placeholders["user"]},
            ) from err

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set(False)
