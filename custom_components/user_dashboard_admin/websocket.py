"""WebSocket API. Everything is admin-only except `kiosk/subscribe`."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import DATA_PANELS
from homeassistant.components.frontend.storage import async_user_store
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN, MODE_INITIAL, MODES
from .manager import RuleRejected, UserRulesManager, is_managed_user

RULE_SCHEMA = vol.Schema(
    {
        vol.Optional("mode", default=MODE_INITIAL): vol.In(MODES),
        vol.Optional("sidebar", default=None): vol.Any(
            None,
            {
                vol.Optional("hidden", default=list): [str],
                vol.Optional("order", default=list): [str],
            },
        ),
        vol.Optional("default_panel", default=None): vol.Any(None, str),
        vol.Optional("kiosk", default=False): bool,
    }
)


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    for command in (
        ws_users_list,
        ws_panels_list,
        ws_rule_get,
        ws_rule_set,
        ws_rule_delete,
        ws_rule_apply,
        ws_kiosk_subscribe,
    ):
        websocket_api.async_register_command(hass, command)


def _manager(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> UserRulesManager | None:
    if (manager := hass.data.get(DOMAIN)) is None:
        connection.send_error(msg["id"], "not_loaded", "User Dashboard Admin is not set up")
    return manager


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/users/list"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_users_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    if (manager := _manager(hass, connection, msg)) is None:
        return
    users: list[dict[str, Any]] = []
    for user in await hass.auth.async_get_users():
        if not is_managed_user(user):
            continue
        store = await async_user_store(hass, user.id)
        users.append(
            {
                "id": user.id,
                "name": user.name,
                "is_admin": user.is_admin,
                "is_active": user.is_active,
                "rule": manager.rules.get(user.id),
                "current": {
                    "sidebar": store.data.get("sidebar"),
                    "default_panel": (store.data.get("core") or {}).get("default_panel"),
                },
                "kiosk_effective": manager.kiosk_enabled(user),
            }
        )
    connection.send_result(msg["id"], users)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/panels/list"})
@websocket_api.require_admin
@callback
def ws_panels_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    connection.send_result(
        msg["id"],
        [
            {
                "url_path": panel.frontend_url_path,
                "component_name": panel.component_name,
                "title": panel.sidebar_title,
                "icon": panel.sidebar_icon,
                "require_admin": panel.require_admin,
                # Attribute added to Panel in 2026.x; older cores hide panels by giving no title.
                "show_in_sidebar": getattr(panel, "show_in_sidebar", True),
                "default_visible": getattr(panel, "sidebar_default_visible", True),
            }
            for panel in hass.data.get(DATA_PANELS, {}).values()
        ],
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/rule/get", vol.Required("user_id"): str}
)
@websocket_api.require_admin
@callback
def ws_rule_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if (manager := _manager(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], manager.rules.get(msg["user_id"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rule/set",
        vol.Required("user_id"): str,
        vol.Required("rule"): RULE_SCHEMA,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rule_set(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    if (manager := _manager(hass, connection, msg)) is None:
        return
    try:
        await manager.async_set_rule(msg["user_id"], msg["rule"])
    except RuleRejected as err:
        connection.send_error(msg["id"], err.code, str(err))
        return
    connection.send_result(msg["id"], manager.rules[msg["user_id"]])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/rule/delete", vol.Required("user_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rule_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    if (manager := _manager(hass, connection, msg)) is None:
        return
    await manager.async_delete_rule(msg["user_id"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/rule/apply", vol.Required("user_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rule_apply(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    if (manager := _manager(hass, connection, msg)) is None:
        return
    await manager.async_apply(msg["user_id"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/kiosk/subscribe"})
@callback
def ws_kiosk_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Kiosk flag of the connection's own user. Takes no user id on purpose."""
    if (manager := _manager(hass, connection, msg)) is None:
        return
    user = connection.user

    @callback
    def forward(enabled: bool) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"kiosk": enabled}))

    connection.subscriptions[msg["id"]] = manager.async_subscribe_kiosk(user.id, forward)
    connection.send_result(msg["id"])
    forward(manager.kiosk_enabled(user))
