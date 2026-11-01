// User Dashboard Admin — turns the frontend's native kiosk mode on for users
// whose rule asks for it. The server decides (kiosk/subscribe answers for the
// connection's own user); this module only relays the answer to the frontend
// through its `hass-kiosk-mode` event. No DOM is touched.

const DOMAIN = "user_dashboard_admin";

const setKiosk = (enable) =>
  window.dispatchEvent(new CustomEvent("hass-kiosk-mode", { detail: { enable } }));

async function start() {
  await customElements.whenDefined("home-assistant");
  const root = document.querySelector("home-assistant");
  // The frontend starts listening for hass-kiosk-mode in its first update.
  if (root?.updateComplete) await root.updateComplete;
  if (!window.hassConnection) return;

  const { conn } = await window.hassConnection;
  let enabled = false;
  await conn.subscribeMessage(
    (event) => {
      // Only ever switch off what this module switched on (add-on panels
      // drive the same flag).
      if (event.kiosk || enabled) setKiosk(event.kiosk);
      enabled = event.kiosk;
    },
    { type: `${DOMAIN}/kiosk/subscribe` },
  );
}

start().catch((err) => console.warn(`[${DOMAIN}] kiosk disabled:`, err));
