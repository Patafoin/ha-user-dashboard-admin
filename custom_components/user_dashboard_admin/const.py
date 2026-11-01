"""Constants for User Dashboard Admin."""

from __future__ import annotations

DOMAIN = "user_dashboard_admin"

STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1

MODE_INITIAL = "initial"
MODE_ENFORCED = "enforced"
MODE_UNMANAGED = "unmanaged"
MODES = (MODE_INITIAL, MODE_ENFORCED, MODE_UNMANAGED)

# Panels an admin must always keep: HA settings and this integration's console.
PROTECTED_ADMIN_PANELS = ("config", DOMAIN)

KIOSK_JS_URL = f"/{DOMAIN}/kiosk.js"
PANEL_JS_URL = f"/{DOMAIN}/panel.js"
PANEL_ELEMENT = "user-dashboard-admin-panel"

SIGNAL_RULES_UPDATED = f"{DOMAIN}_rules_updated"

# Delay before re-imposing an enforced rule, so a user dragging panels in
# "Edit sidebar" does not trigger a write per move.
ENFORCE_DEBOUNCE = 1.0
