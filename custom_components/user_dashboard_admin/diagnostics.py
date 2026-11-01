"""Diagnostics: rules, and what each managed user currently has."""

from __future__ import annotations

from typing import Any

from homeassistant.components.frontend.storage import async_user_store
from homeassistant.core import HomeAssistant

from . import UserDashboardAdminConfigEntry
from .manager import is_managed_user


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: UserDashboardAdminConfigEntry
) -> dict[str, Any]:
    manager = entry.runtime_data
    users = []
    for user in await hass.auth.async_get_users():
        if not is_managed_user(user):
            continue
        store = await async_user_store(hass, user.id)
        users.append(
            {
                # No names: user ids are enough to read a report.
                "id": user.id,
                "is_admin": user.is_admin,
                "is_active": user.is_active,
                "rule": manager.rules.get(user.id),
                "kiosk_effective": manager.kiosk_enabled(user),
                "current_sidebar": store.data.get("sidebar"),
                "current_default_panel": (store.data.get("core") or {}).get("default_panel"),
            }
        )
    return {"users": users}
