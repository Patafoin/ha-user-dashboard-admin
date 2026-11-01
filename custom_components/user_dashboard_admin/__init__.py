"""User Dashboard Admin: per-user sidebar, default dashboard and kiosk mode."""

from __future__ import annotations

from pathlib import Path

from homeassistant.auth import EVENT_USER_ADDED, EVENT_USER_REMOVED, EVENT_USER_UPDATED
from homeassistant.components import panel_custom
from homeassistant.components.frontend import (
    add_extra_js_url,
    async_remove_panel,
    remove_extra_js_url,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import DOMAIN, KIOSK_JS_URL, PANEL_ELEMENT, PANEL_JS_URL
from .manager import UserRulesManager
from .websocket import async_register_commands

PLATFORMS = [Platform.SWITCH]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type UserDashboardAdminConfigEntry = ConfigEntry[UserRulesManager]

_STATIC_REGISTERED = f"{DOMAIN}_static_registered"
_KIOSK_URL_KEY = f"{DOMAIN}_kiosk_url"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    async_register_commands(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: UserDashboardAdminConfigEntry) -> bool:
    manager = UserRulesManager(hass)
    await manager.async_load()
    entry.runtime_data = manager
    hass.data[DOMAIN] = manager

    version = (await async_get_integration(hass, DOMAIN)).version
    await _async_register_static_files(hass)
    _register_kiosk_module(hass, version)
    await _async_register_panel(hass, version)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    @callback
    def _users_changed(event: Event) -> None:
        # One kiosk switch per user, stale rules purged on load: a reload covers both.
        hass.config_entries.async_schedule_reload(entry.entry_id)

    entry.async_on_unload(hass.bus.async_listen(EVENT_USER_ADDED, _users_changed))
    entry.async_on_unload(hass.bus.async_listen(EVENT_USER_REMOVED, _users_changed))
    entry.async_on_unload(
        hass.bus.async_listen(EVENT_USER_UPDATED, manager.async_handle_user_updated)
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: UserDashboardAdminConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    entry.runtime_data.async_unload()
    hass.data.pop(DOMAIN, None)
    async_remove_panel(hass, DOMAIN, warn_if_unknown=False)
    if (url := hass.data.pop(_KIOSK_URL_KEY, None)) is not None:
        remove_extra_js_url(hass, url)
    return True


async def _async_register_static_files(hass: HomeAssistant) -> None:
    if hass.data.get(_STATIC_REGISTERED):
        # Static paths cannot be unregistered: once per HA process.
        return
    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(KIOSK_JS_URL, str(www / "kiosk.js"), False),
            StaticPathConfig(PANEL_JS_URL, str(www / "panel.js"), False),
        ]
    )
    hass.data[_STATIC_REGISTERED] = True


def _register_kiosk_module(hass: HomeAssistant, version: str | None) -> None:
    """Load kiosk.js in every page.

    add_extra_js_url rather than a Lovelace resource: the kiosk must also hold
    outside dashboards. The module defines no custom element, so the double
    customElements.define issue met on my_music_library does not apply.
    """
    url = f"{KIOSK_JS_URL}?v={version}"
    add_extra_js_url(hass, url)
    hass.data[_KIOSK_URL_KEY] = url


async def _async_register_panel(hass: HomeAssistant, version: str | None) -> None:
    """The admin console, in the sidebar of admins only."""
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=DOMAIN,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title="User Dashboard Admin",
        sidebar_icon="mdi:account-cog",
        module_url=f"{PANEL_JS_URL}?v={version}",
        require_admin=True,
    )
