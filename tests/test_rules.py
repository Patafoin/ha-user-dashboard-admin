"""Rules written into the frontend's per-user data, safeguards, enforced mode, kiosk."""

from __future__ import annotations

from datetime import timedelta

import pytest
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.user_dashboard_admin.const import DOMAIN
from custom_components.user_dashboard_admin.manager import RuleRejected
from homeassistant.components.frontend.storage import async_user_store
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util

EMMA_RULE = {
    "mode": "enforced",
    "kiosk": True,
    "default_panel": "dashboard-kids",
    "sidebar": {"hidden": ["energy", "map"], "order": ["dashboard-kids"]},
}


@pytest.fixture
async def emma(hass: HomeAssistant, hass_owner_user):
    # The owner fixture comes first: HA makes the first user created the owner (admin).
    return await hass.auth.async_create_user("Emma", group_ids=["system-users"])


@pytest.fixture
async def admin(hass: HomeAssistant):
    return await hass.auth.async_create_user("Alex", group_ids=["system-admin"])


async def test_rule_writes_sidebar_and_merges_core(hass: HomeAssistant, emma, entry) -> None:
    store = await async_user_store(hass, emma.id)
    await store.async_set_item("core", {"showAdvanced": True, "default_panel": "lovelace"})

    await hass.data[DOMAIN].async_set_rule(emma.id, EMMA_RULE)

    assert store.data["sidebar"] == {
        "panelOrder": ["dashboard-kids"],
        "hiddenPanels": ["energy", "map"],
    }
    assert store.data["core"] == {"showAdvanced": True, "default_panel": "dashboard-kids"}


async def test_null_fields_are_left_alone(hass: HomeAssistant, emma, entry) -> None:
    store = await async_user_store(hass, emma.id)
    await store.async_set_item("core", {"default_panel": "lovelace"})

    await hass.data[DOMAIN].async_set_rule(
        emma.id, {"mode": "initial", "sidebar": None, "default_panel": None}
    )

    assert "sidebar" not in store.data
    assert store.data["core"] == {"default_panel": "lovelace"}


async def test_admin_safeguards(hass: HomeAssistant, admin, entry) -> None:
    manager = hass.data[DOMAIN]
    with pytest.raises(RuleRejected) as err:
        await manager.async_set_rule(admin.id, {"kiosk": True})
    assert err.value.code == "admin_kiosk"
    with pytest.raises(RuleRejected) as err:
        await manager.async_set_rule(admin.id, {"sidebar": {"hidden": ["config"]}})
    assert err.value.code == "admin_protected_panel"

    await manager.async_set_rule(admin.id, {"sidebar": {"hidden": ["energy"]}})
    assert admin.id in manager.rules


async def test_user_promoted_to_admin_keeps_settings(hass: HomeAssistant, emma, entry) -> None:
    manager = hass.data[DOMAIN]
    await manager.async_set_rule(emma.id, {"sidebar": {"hidden": ["config", "map"]}})
    await hass.auth.async_update_user(emma, group_ids=["system-admin"])
    store = await async_user_store(hass, emma.id)
    await store.async_set_item("sidebar", {})

    await manager.async_apply(emma.id)

    assert store.data["sidebar"]["hiddenPanels"] == ["map"]
    assert not manager.kiosk_enabled(emma)


async def test_enforced_rule_is_reimposed(hass: HomeAssistant, emma, entry) -> None:
    await hass.data[DOMAIN].async_set_rule(emma.id, EMMA_RULE)
    store = await async_user_store(hass, emma.id)

    await store.async_set_item("sidebar", {"panelOrder": [], "hiddenPanels": []})
    await store.async_set_item("core", {"showAdvanced": True, "default_panel": "lovelace"})
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=2))
    await hass.async_block_till_done()

    assert store.data["sidebar"]["hiddenPanels"] == ["energy", "map"]
    assert store.data["core"] == {"showAdvanced": True, "default_panel": "dashboard-kids"}


async def test_initial_rule_is_not_reimposed(hass: HomeAssistant, emma, entry) -> None:
    await hass.data[DOMAIN].async_set_rule(emma.id, {**EMMA_RULE, "mode": "initial"})
    store = await async_user_store(hass, emma.id)

    await store.async_set_item("sidebar", {"panelOrder": [], "hiddenPanels": []})
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=2))
    await hass.async_block_till_done()

    assert store.data["sidebar"] == {"panelOrder": [], "hiddenPanels": []}


async def test_kiosk_subscription_follows_own_user(
    hass: HomeAssistant, hass_ws_client, hass_admin_user, entry
) -> None:
    await hass.auth.async_update_user(hass_admin_user, group_ids=["system-users"])
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/kiosk/subscribe"})
    assert (await client.receive_json())["success"]
    assert (await client.receive_json())["event"] == {"kiosk": False}

    await hass.data[DOMAIN].async_set_kiosk(hass_admin_user.id, True)
    assert (await client.receive_json())["event"] == {"kiosk": True}


async def test_rule_set_requires_admin(
    hass: HomeAssistant, hass_ws_client, hass_admin_user, emma, entry
) -> None:
    await hass.auth.async_update_user(hass_admin_user, group_ids=["system-users"])
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": f"{DOMAIN}/rule/set", "user_id": emma.id, "rule": {"kiosk": True}}
    )
    response = await client.receive_json()
    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


async def test_kiosk_switch(hass: HomeAssistant, emma, admin, entry) -> None:
    switches = {
        state.attributes["friendly_name"]: state.entity_id
        for state in hass.states.async_all("switch")
    }
    emma_switch = switches["User Dashboard Admin Kiosk Emma"]
    admin_switch = switches["User Dashboard Admin Kiosk Alex"]

    await hass.services.async_call("switch", "turn_on", {"entity_id": emma_switch}, blocking=True)
    assert hass.states.get(emma_switch).state == "on"
    assert hass.data[DOMAIN].kiosk_enabled(emma)

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            "switch", "turn_on", {"entity_id": admin_switch}, blocking=True
        )
    assert hass.states.get(admin_switch).state == "off"


async def test_admin_panel_registered(hass: HomeAssistant, entry) -> None:
    from homeassistant.components.frontend import DATA_PANELS

    panel = hass.data[DATA_PANELS][DOMAIN]
    assert panel.require_admin
    assert panel.config["_panel_custom"]["name"] == "user-dashboard-admin-panel"

    await hass.config_entries.async_unload(entry.entry_id)
    assert DOMAIN not in hass.data[DATA_PANELS]


async def test_panels_list(hass: HomeAssistant, hass_ws_client, entry) -> None:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/panels/list"})
    panels = {p["url_path"]: p for p in (await client.receive_json())["result"]}
    assert panels[DOMAIN]["require_admin"]
    assert panels[DOMAIN]["component_name"] == "custom"


async def test_promotion_to_admin_turns_kiosk_off(
    hass: HomeAssistant, hass_ws_client, hass_admin_user, entry
) -> None:
    await hass.auth.async_update_user(hass_admin_user, group_ids=["system-users"])
    await hass.data[DOMAIN].async_set_kiosk(hass_admin_user.id, True)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/kiosk/subscribe"})
    assert (await client.receive_json())["success"]
    assert (await client.receive_json())["event"] == {"kiosk": True}

    await hass.auth.async_update_user(hass_admin_user, group_ids=["system-admin"])
    await hass.async_block_till_done()
    assert (await client.receive_json())["event"] == {"kiosk": False}


async def test_new_user_gets_a_switch(hass: HomeAssistant, emma, entry) -> None:
    await hass.auth.async_create_user("Léo", group_ids=["system-users"])
    await hass.async_block_till_done()
    names = {state.attributes["friendly_name"] for state in hass.states.async_all("switch")}
    assert "User Dashboard Admin Kiosk Léo" in names


async def test_removed_user_loses_rule(hass: HomeAssistant, emma, entry) -> None:
    await hass.data[DOMAIN].async_set_rule(emma.id, EMMA_RULE)
    await hass.auth.async_remove_user(emma)
    await hass.async_block_till_done()
    assert emma.id not in hass.data[DOMAIN].rules


async def test_diagnostics(hass: HomeAssistant, emma, entry) -> None:
    from custom_components.user_dashboard_admin.diagnostics import (
        async_get_config_entry_diagnostics,
    )

    await hass.data[DOMAIN].async_set_rule(emma.id, EMMA_RULE)
    data = await async_get_config_entry_diagnostics(hass, entry)
    row = next(u for u in data["users"] if u["id"] == emma.id)
    assert row["kiosk_effective"]
    assert "name" not in row
