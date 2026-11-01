/**
 * User Dashboard Admin — admin console. Thin UI over the user_dashboard_admin/*
 * WebSocket commands: rules, safeguards and their application all live on the
 * server; this panel only edits a draft and sends it.
 */

const DOMAIN = "user_dashboard_admin";
// Panels an admin must always keep (mirror of const.PROTECTED_ADMIN_PANELS, the server enforces it).
const PROTECTED_ADMIN_PANELS = ["config", DOMAIN];
// Registered panels that are not sidebar entries.
const NOT_IN_SIDEBAR = ["profile", "notfound", "_my_redirect"];

// --- Traduction ---------------------------------------------------------------------------------
// Le texte français sert de clé ; allemand et espagnol ont leur dictionnaire, les autres langues reçoivent l'anglais.
// « {nom} » est remplacé par vars.nom.
let LANG = "fr";
const I18N_EN = {
  "Le dashboard par défaut reste toujours affiché": "The default dashboard is always shown",
  "initial": "initial",
  "imposé": "enforced",
  "Utilisateurs": "Users",
  "Chargement…": "Loading…",
  "administrateur": "administrator",
  "inactif": "inactive",
  "non géré": "not managed",
  "kiosque": "kiosk",
  "Choisis un utilisateur.": "Pick a user.",
  "Mode d'application": "How the rule applies",
  "Initial : appliqué une fois, l'utilisateur garde la main": "Initial: applied once, the user keeps control",
  "Imposé : réappliqué si l'utilisateur le modifie": "Enforced: re-applied if the user changes it",
  "Non géré : l'intégration ne touche à rien": "Not managed: the integration changes nothing",
  "Mode kiosque": "Kiosk mode",
  "Masque la barre latérale, le bouton menu et les boutons Rechercher et Modifier. L'en-tête reste affiché.":
    "Hides the sidebar, the menu button and the Search and Edit buttons. The header stays.",
  "Interdit pour un administrateur : il perdrait l'accès aux paramètres.": "Not allowed for an administrator: they would lose access to the settings.",
  "Dashboard par défaut": "Default dashboard",
  "(ne pas toucher)": "(leave as is)",
  "Barre latérale": "Sidebar",
  "Gérer la barre latérale de cet utilisateur": "Manage this user's sidebar",
  "Non gérée : l'utilisateur garde sa propre barre.": "Not managed: the user keeps their own sidebar.",
  "Monter": "Move up",
  "Descendre": "Move down",
  "Toujours visible pour un administrateur": "Always visible for an administrator",
  "Sécurité": "Security",
  "Compte administrateur : {value}": "Administrator account: {value}",
  "oui": "yes",
  "non": "no",
  "Réservés aux administrateurs (vrai verrou) : {list}": "Admin only (a real lock): {list}",
  "Accessibles par leur URL même masqués : {list}": "Reachable by URL even when hidden: {list}",
  "Masquer n'est pas interdire : une page masquée reste accessible par son URL, et un utilisateur peut lancer des actions par l'API. Les seuls vrais verrous sont le statut administrateur et l'option « admin uniquement » d'un dashboard.":
    "Hiding is not forbidding: a hidden page stays reachable by its URL, and a user can run actions through the API. The only real locks are the administrator status and a dashboard's \"admin only\" option.",
  "État actuel": "Current state",
  "dashboard par défaut : {value}": "default dashboard: {value}",
  "barre latérale : {value}": "sidebar: {value}",
  "personnalisée ({n} masqués)": "customised ({n} hidden)",
  "par défaut": "default",
  "aucun": "none",
  "Panneaux disparus, ignorés : {list}": "Panels that no longer exist, ignored: {list}",
  "Enregistrer": "Save",
  "Réappliquer maintenant": "Re-apply now",
  "Copier depuis…": "Copy from…",
  "Ne plus gérer": "Stop managing",
  "Ne plus gérer {name} ? Ses réglages actuels restent en place.": "Stop managing {name}? Their current settings stay as they are.",
  "Règle enregistrée.": "Rule saved.",
  "Règle réappliquée.": "Rule re-applied.",
  "Règle supprimée.": "Rule removed.",
  "Réglages de {name} copiés : vérifie puis enregistre.": "Settings of {name} copied: check, then save.",
  "Modifications non enregistrées": "Unsaved changes",
  "{name} est administrateur : le mode kiosque lui couperait l'accès aux paramètres.": "{name} is an administrator: kiosk mode would lock them out of the settings.",
  "{name} est administrateur : Paramètres et User Dashboard Admin ne peuvent pas être masqués.": "{name} is an administrator: Settings and User Dashboard Admin cannot be hidden.",
};
const I18N_DE = {
  "Le dashboard par défaut reste toujours affiché": "Das Standard-Dashboard wird immer angezeigt",
  "initial": "einmalig",
  "imposé": "erzwungen",
  "Utilisateurs": "Benutzer",
  "Chargement…": "Wird geladen…",
  "administrateur": "Administrator",
  "inactif": "inaktiv",
  "non géré": "nicht verwaltet",
  "kiosque": "Kiosk",
  "Choisis un utilisateur.": "Wähle einen Benutzer.",
  "Mode d'application": "Anwendungsmodus",
  "Initial : appliqué une fois, l'utilisateur garde la main": "Einmalig: einmal angewendet, der Benutzer behält die Kontrolle",
  "Imposé : réappliqué si l'utilisateur le modifie": "Erzwungen: wird erneut angewendet, wenn der Benutzer es ändert",
  "Non géré : l'intégration ne touche à rien": "Nicht verwaltet: die Integration ändert nichts",
  "Mode kiosque": "Kioskmodus",
  "Masque la barre latérale, le bouton menu et les boutons Rechercher et Modifier. L'en-tête reste affiché.": "Blendet die Seitenleiste, die Menütaste sowie die Schaltflächen Suchen und Bearbeiten aus. Die Kopfzeile bleibt sichtbar.",
  "Interdit pour un administrateur : il perdrait l'accès aux paramètres.": "Für Administratoren nicht erlaubt: Sie würden den Zugang zu den Einstellungen verlieren.",
  "Dashboard par défaut": "Standard-Dashboard",
  "(ne pas toucher)": "(unverändert lassen)",
  "Barre latérale": "Seitenleiste",
  "Gérer la barre latérale de cet utilisateur": "Seitenleiste dieses Benutzers verwalten",
  "Non gérée : l'utilisateur garde sa propre barre.": "Nicht verwaltet: der Benutzer behält seine eigene Seitenleiste.",
  "Monter": "Nach oben",
  "Descendre": "Nach unten",
  "Toujours visible pour un administrateur": "Für Administratoren immer sichtbar",
  "Sécurité": "Sicherheit",
  "Compte administrateur : {value}": "Administratorkonto: {value}",
  "oui": "ja",
  "non": "nein",
  "Réservés aux administrateurs (vrai verrou) : {list}": "Nur für Administratoren (echte Sperre): {list}",
  "Accessibles par leur URL même masqués : {list}": "Auch ausgeblendet über ihre URL erreichbar: {list}",
  "Masquer n'est pas interdire : une page masquée reste accessible par son URL, et un utilisateur peut lancer des actions par l'API. Les seuls vrais verrous sont le statut administrateur et l'option « admin uniquement » d'un dashboard.": "Ausblenden ist kein Verbot: Eine ausgeblendete Seite bleibt über ihre URL erreichbar, und ein Benutzer kann über die API Aktionen ausführen. Die einzigen echten Sperren sind der Administratorstatus und die Option „Nur Administratoren“ eines Dashboards.",
  "État actuel": "Aktueller Stand",
  "dashboard par défaut : {value}": "Standard-Dashboard: {value}",
  "barre latérale : {value}": "Seitenleiste: {value}",
  "personnalisée ({n} masqués)": "angepasst ({n} ausgeblendet)",
  "par défaut": "Standard",
  "aucun": "keines",
  "Panneaux disparus, ignorés : {list}": "Nicht mehr vorhandene Panels, ignoriert: {list}",
  "Enregistrer": "Speichern",
  "Réappliquer maintenant": "Jetzt erneut anwenden",
  "Copier depuis…": "Kopieren von…",
  "Ne plus gérer": "Nicht mehr verwalten",
  "Ne plus gérer {name} ? Ses réglages actuels restent en place.": "{name} nicht mehr verwalten? Die aktuellen Einstellungen bleiben bestehen.",
  "Règle enregistrée.": "Regel gespeichert.",
  "Règle réappliquée.": "Regel erneut angewendet.",
  "Règle supprimée.": "Regel entfernt.",
  "Réglages de {name} copiés : vérifie puis enregistre.": "Einstellungen von {name} kopiert: prüfen, dann speichern.",
  "Modifications non enregistrées": "Ungespeicherte Änderungen",
  "{name} est administrateur : le mode kiosque lui couperait l'accès aux paramètres.": "{name} ist Administrator: Der Kioskmodus würde den Zugang zu den Einstellungen sperren.",
  "{name} est administrateur : Paramètres et User Dashboard Admin ne peuvent pas être masqués.": "{name} ist Administrator: Einstellungen und User Dashboard Admin können nicht ausgeblendet werden.",
};
const I18N_ES = {
  "Le dashboard par défaut reste toujours affiché": "El panel predeterminado siempre se muestra",
  "initial": "inicial",
  "imposé": "forzado",
  "Utilisateurs": "Usuarios",
  "Chargement…": "Cargando…",
  "administrateur": "administrador",
  "inactif": "inactivo",
  "non géré": "no gestionado",
  "kiosque": "quiosco",
  "Choisis un utilisateur.": "Elige un usuario.",
  "Mode d'application": "Modo de aplicación",
  "Initial : appliqué une fois, l'utilisateur garde la main": "Inicial: se aplica una vez, el usuario mantiene el control",
  "Imposé : réappliqué si l'utilisateur le modifie": "Forzado: se vuelve a aplicar si el usuario lo cambia",
  "Non géré : l'intégration ne touche à rien": "No gestionado: la integración no cambia nada",
  "Mode kiosque": "Modo quiosco",
  "Masque la barre latérale, le bouton menu et les boutons Rechercher et Modifier. L'en-tête reste affiché.": "Oculta la barra lateral, el botón de menú y los botones Buscar y Editar. La cabecera sigue visible.",
  "Interdit pour un administrateur : il perdrait l'accès aux paramètres.": "No permitido para un administrador: perdería el acceso a los ajustes.",
  "Dashboard par défaut": "Panel predeterminado",
  "(ne pas toucher)": "(no cambiar)",
  "Barre latérale": "Barra lateral",
  "Gérer la barre latérale de cet utilisateur": "Gestionar la barra lateral de este usuario",
  "Non gérée : l'utilisateur garde sa propre barre.": "No gestionada: el usuario conserva su propia barra.",
  "Monter": "Subir",
  "Descendre": "Bajar",
  "Toujours visible pour un administrateur": "Siempre visible para un administrador",
  "Sécurité": "Seguridad",
  "Compte administrateur : {value}": "Cuenta de administrador: {value}",
  "oui": "sí",
  "non": "no",
  "Réservés aux administrateurs (vrai verrou) : {list}": "Solo para administradores (bloqueo real): {list}",
  "Accessibles par leur URL même masqués : {list}": "Accesibles por su URL aunque estén ocultos: {list}",
  "Masquer n'est pas interdire : une page masquée reste accessible par son URL, et un utilisateur peut lancer des actions par l'API. Les seuls vrais verrous sont le statut administrateur et l'option « admin uniquement » d'un dashboard.": "Ocultar no es prohibir: una página oculta sigue siendo accesible por su URL, y un usuario puede ejecutar acciones a través de la API. Los únicos bloqueos reales son el estado de administrador y la opción «solo administradores» de un panel.",
  "État actuel": "Estado actual",
  "dashboard par défaut : {value}": "panel predeterminado: {value}",
  "barre latérale : {value}": "barra lateral: {value}",
  "personnalisée ({n} masqués)": "personalizada ({n} ocultos)",
  "par défaut": "predeterminada",
  "aucun": "ninguno",
  "Panneaux disparus, ignorés : {list}": "Paneles que ya no existen, ignorados: {list}",
  "Enregistrer": "Guardar",
  "Réappliquer maintenant": "Volver a aplicar ahora",
  "Copier depuis…": "Copiar de…",
  "Ne plus gérer": "Dejar de gestionar",
  "Ne plus gérer {name} ? Ses réglages actuels restent en place.": "¿Dejar de gestionar a {name}? Sus ajustes actuales se mantienen.",
  "Règle enregistrée.": "Regla guardada.",
  "Règle réappliquée.": "Regla aplicada de nuevo.",
  "Règle supprimée.": "Regla eliminada.",
  "Réglages de {name} copiés : vérifie puis enregistre.": "Ajustes de {name} copiados: revisa y guarda.",
  "Modifications non enregistrées": "Cambios sin guardar",
  "{name} est administrateur : le mode kiosque lui couperait l'accès aux paramètres.": "{name} es administrador: el modo quiosco le bloquearía el acceso a los ajustes.",
  "{name} est administrateur : Paramètres et User Dashboard Admin ne peuvent pas être masqués.": "{name} es administrador: Ajustes y User Dashboard Admin no se pueden ocultar.",
};
const I18N = { en: I18N_EN, de: I18N_DE, es: I18N_ES };
const t = (text, vars = {}) =>
  (LANG === "fr" ? text : (I18N[LANG] ?? I18N_EN)[text] ?? text).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const clone = (value) => JSON.parse(JSON.stringify(value));

const emptyRule = () => ({ mode: "initial", sidebar: null, default_panel: null, kiosk: false });

const STYLE = `
  :host { display: block; height: 100%; overflow-y: auto; background: var(--primary-background-color); color: var(--primary-text-color); }
  .toolbar { display: flex; align-items: center; gap: 8px; height: var(--header-height, 56px); padding: 0 12px;
    background: var(--app-header-background-color, var(--primary-color)); color: var(--app-header-text-color, white);
    font-size: 20px; box-sizing: border-box; }
  .layout { display: flex; gap: 16px; padding: 16px; align-items: flex-start; box-sizing: border-box; }
  :host([narrow]) .layout { flex-direction: column; padding: 8px; }
  .users { flex: 0 0 260px; }
  :host([narrow]) .users { flex: none; width: 100%; }
  .detail { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; width: 100%; }
  .card { background: var(--card-background-color); border-radius: var(--ha-card-border-radius, 12px);
    border: 1px solid var(--divider-color); padding: 16px; }
  .card h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
  .user { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px; cursor: pointer; }
  .user:hover { background: var(--secondary-background-color); }
  .user.selected { background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15); }
  .user .name { font-weight: 500; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: var(--secondary-background-color); color: var(--secondary-text-color); }
  .tag.admin { background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.2); color: var(--primary-text-color); }
  .tag.kiosk { background: rgba(255, 152, 0, 0.2); color: var(--primary-text-color); }
  label.option { display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; cursor: pointer; }
  .hint { color: var(--secondary-text-color); font-size: 13px; }
  .warn { color: var(--warning-color, #ff9800); font-size: 13px; }
  select { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--divider-color);
    background: var(--card-background-color); color: var(--primary-text-color); max-width: 100%; }
  .panels { display: flex; flex-direction: column; margin-top: 8px; }
  .panel-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--divider-color); }
  .panel-row:last-child { border-bottom: none; }
  .panel-row .label { flex: 1; }
  .panel-row.hidden .label { color: var(--secondary-text-color); text-decoration: line-through; }
  .panel-row code { color: var(--secondary-text-color); font-size: 12px; }
  button { font: inherit; cursor: pointer; border-radius: 6px; padding: 6px 12px; border: 1px solid var(--divider-color);
    background: var(--card-background-color); color: var(--primary-text-color); }
  button.primary { background: var(--primary-color); color: var(--text-primary-color, white); border-color: var(--primary-color); }
  button.small { padding: 2px 8px; }
  button:disabled { opacity: 0.4; cursor: default; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .message { padding: 8px 12px; border-radius: 6px; }
  .message.ok { background: rgba(76, 175, 80, 0.15); }
  .message.error { background: rgba(244, 67, 54, 0.15); color: var(--error-color, #f44336); }
  ul { margin: 4px 0; padding-left: 20px; }
`;

class UserDashboardAdminPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._users = null;
    this._panels = [];
    this._selectedId = null;
    this._draft = null;
    this._dirty = false;
    this._message = null;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    this.shadowRoot.addEventListener("change", (ev) => this._onChange(ev));
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    LANG = (hass.locale?.language || hass.language || "fr").slice(0, 2);
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.hass = hass;
    if (first) {
      this._render();
      this._load();
    }
  }

  set narrow(narrow) {
    this._narrow = narrow;
    this.toggleAttribute("narrow", !!narrow);
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.narrow = narrow;
  }

  async _load() {
    try {
      [this._users, this._panels] = await Promise.all([
        this._hass.callWS({ type: `${DOMAIN}/users/list` }),
        this._hass.callWS({ type: `${DOMAIN}/panels/list` }),
      ]);
    } catch (err) {
      this._message = { error: true, text: err.message || String(err) };
      this._users = [];
    }
    if (this._selectedId && !this._dirty) this._resetDraft();
    this._render();
  }

  // --- données ----------------------------------------------------------------------------------

  get _user() {
    return this._users?.find((u) => u.id === this._selectedId);
  }

  _panelLabel(panel) {
    const key = panel.title || panel.url_path;
    // Untitled dashboards: show the URL, which is how they are reached.
    return this._hass.localize(`panel.${key}`) || panel.title || `/${panel.url_path}`;
  }

  _labelOf(urlPath) {
    const panel = this._panels.find((p) => p.url_path === urlPath);
    return panel ? this._panelLabel(panel) : urlPath;
  }

  /** Sidebar entries this user can see at all. */
  _panelsFor(user) {
    return this._panels.filter(
      // Same rule as the frontend sidebar: untitled panels are never listed.
      (p) => p.show_in_sidebar && p.title && !NOT_IN_SIDEBAR.includes(p.url_path) && (!p.require_admin || user.is_admin),
    );
  }

  _isProtected(user, urlPath) {
    return user.is_admin && PROTECTED_ADMIN_PANELS.includes(urlPath);
  }

  /** Panels in the order the draft gives them; unlisted ones follow in their natural order. */
  _orderedPanels(user) {
    const panels = this._panelsFor(user);
    const order = this._draft.sidebar?.order ?? [];
    const rank = (p, i) => (order.includes(p.url_path) ? order.indexOf(p.url_path) : order.length + i);
    return panels.map((p, i) => [rank(p, i), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  }

  _resetDraft() {
    const user = this._user;
    this._draft = user ? clone(user.rule ?? emptyRule()) : null;
    this._dirty = false;
  }

  /** Sidebar to start from when the admin turns sidebar management on. */
  _sidebarFromCurrent(user) {
    const current = user.current.sidebar;
    const order = [...(current?.panelOrder ?? [])];
    const hidden = new Set(current?.hiddenPanels ?? []);
    // As the frontend does: a panel not visible by default stays hidden unless the user ordered it.
    for (const p of this._panelsFor(user)) {
      if (p.default_visible === false && !order.includes(p.url_path)) hidden.add(p.url_path);
    }
    return { hidden: [...hidden].filter((p) => !this._isProtected(user, p)), order };
  }

  // --- événements -------------------------------------------------------------------------------

  _onClick(ev) {
    const target = ev.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === "select") {
      if (this._dirty && id !== this._selectedId && !confirm(`${t("Modifications non enregistrées")} ?`)) return;
      this._selectedId = id;
      this._message = null;
      this._resetDraft();
      this._render();
    } else if (action === "up" || action === "down") {
      this._move(id, action === "up" ? -1 : 1);
    } else if (action === "save") {
      this._save();
    } else if (action === "apply") {
      this._apply();
    } else if (action === "delete") {
      this._delete();
    }
  }

  _onChange(ev) {
    const el = ev.target;
    const user = this._user;
    const field = el.dataset.field;
    if (!field || !user) return;
    if (field === "mode") this._draft.mode = el.value;
    else if (field === "kiosk") this._draft.kiosk = el.checked;
    else if (field === "default_panel") this._draft.default_panel = el.value || null;
    else if (field === "manage_sidebar") this._draft.sidebar = el.checked ? this._sidebarFromCurrent(user) : null;
    else if (field === "visible") {
      const hidden = new Set(this._draft.sidebar.hidden);
      if (el.checked) hidden.delete(el.dataset.id);
      else hidden.add(el.dataset.id);
      this._draft.sidebar.hidden = [...hidden];
    } else if (field === "copy_from") {
      this._copyFrom(el.value);
    }
    if (field !== "copy_from") this._dirty = true;
    this._render();
  }

  _move(urlPath, delta) {
    const order = this._orderedPanels(this._user).map((p) => p.url_path);
    const i = order.indexOf(urlPath);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this._draft.sidebar.order = order;
    this._dirty = true;
    this._render();
  }

  _copyFrom(sourceId) {
    const source = this._users.find((u) => u.id === sourceId);
    const user = this._user;
    if (!source || !user) return;
    const rule = source.rule ?? {
      ...emptyRule(),
      default_panel: source.current.default_panel,
      sidebar: source.current.sidebar
        ? { hidden: source.current.sidebar.hiddenPanels ?? [], order: source.current.sidebar.panelOrder ?? [] }
        : null,
    };
    this._draft = {
      ...clone(rule),
      kiosk: rule.kiosk && !user.is_admin,
      sidebar: rule.sidebar
        ? { ...clone(rule.sidebar), hidden: rule.sidebar.hidden.filter((p) => !this._isProtected(user, p)) }
        : null,
    };
    this._dirty = true;
    this._message = { text: t("Réglages de {name} copiés : vérifie puis enregistre.", { name: source.name }) };
  }

  _errorText(err) {
    const name = this._user?.name ?? "";
    if (err.code === "admin_kiosk") return t("{name} est administrateur : le mode kiosque lui couperait l'accès aux paramètres.", { name });
    if (err.code === "admin_protected_panel")
      return t("{name} est administrateur : Paramètres et User Dashboard Admin ne peuvent pas être masqués.", { name });
    return err.message || String(err);
  }

  async _run(call, okText) {
    try {
      await call();
      this._dirty = false;
      this._message = { text: okText };
      await this._load();
    } catch (err) {
      this._message = { error: true, text: this._errorText(err) };
      this._render();
    }
  }

  _save() {
    // Only the editable fields: the stored rule also carries server-side ones (applied_at).
    const { mode, sidebar, default_panel, kiosk } = clone(this._draft);
    const rule = { mode, sidebar, default_panel, kiosk };
    if (rule.sidebar) rule.sidebar.order = this._orderedPanels(this._user).map((p) => p.url_path);
    return this._run(
      () => this._hass.callWS({ type: `${DOMAIN}/rule/set`, user_id: this._selectedId, rule }),
      t("Règle enregistrée."),
    );
  }

  _apply() {
    return this._run(() => this._hass.callWS({ type: `${DOMAIN}/rule/apply`, user_id: this._selectedId }), t("Règle réappliquée."));
  }

  _delete() {
    if (!confirm(t("Ne plus gérer {name} ? Ses réglages actuels restent en place.", { name: this._user.name }))) return;
    return this._run(
      () => this._hass.callWS({ type: `${DOMAIN}/rule/delete`, user_id: this._selectedId }),
      t("Règle supprimée."),
    );
  }

  // --- rendu ------------------------------------------------------------------------------------

  _render() {
    // Full re-render on each change: keep the scroll position.
    const scrollTop = this.scrollTop;
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <div class="toolbar"><ha-menu-button></ha-menu-button><div>User Dashboard Admin</div></div>
      <div class="layout">
        <div class="card users"><h2>${t("Utilisateurs")}</h2>${this._renderUsers()}</div>
        <div class="detail">${this._renderDetail()}</div>
      </div>`;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    menu.hass = this._hass;
    menu.narrow = this._narrow;
    this.scrollTop = scrollTop;
  }

  _renderUsers() {
    if (!this._users) return `<div class="hint">${t("Chargement…")}</div>`;
    return this._users
      .map((u) => {
        const tags = [
          u.is_admin ? `<span class="tag admin">${t("administrateur")}</span>` : "",
          u.is_active ? "" : `<span class="tag">${t("inactif")}</span>`,
          `<span class="tag">${esc(u.rule ? this._modeLabel(u.rule.mode) : t("non géré"))}</span>`,
          u.kiosk_effective ? `<span class="tag kiosk">${t("kiosque")}</span>` : "",
        ].join("");
        return `<div class="user ${u.id === this._selectedId ? "selected" : ""}" data-action="select" data-id="${esc(u.id)}">
          <span class="name">${esc(u.name)}</span><span class="tags">${tags}</span></div>`;
      })
      .join("");
  }

  _modeLabel(mode) {
    return { initial: t("initial"), enforced: t("imposé"), unmanaged: t("non géré") }[mode] ?? mode;
  }

  _renderDetail() {
    const message = this._message
      ? `<div class="message ${this._message.error ? "error" : "ok"}">${esc(this._message.text)}</div>`
      : "";
    const user = this._user;
    if (!user || !this._draft) return `${message}<div class="card hint">${t("Choisis un utilisateur.")}</div>`;
    return `${message}
      ${this._renderMode()}
      ${this._renderKiosk(user)}
      ${this._renderDefaultPanel(user)}
      ${this._renderSidebar(user)}
      ${this._renderCurrent(user)}
      ${this._renderSecurity(user)}
      ${this._renderActions(user)}`;
  }

  _renderMode() {
    const options = [
      ["initial", t("Initial : appliqué une fois, l'utilisateur garde la main")],
      ["enforced", t("Imposé : réappliqué si l'utilisateur le modifie")],
      ["unmanaged", t("Non géré : l'intégration ne touche à rien")],
    ];
    return `<div class="card"><h2>${t("Mode d'application")}</h2>${options
      .map(
        ([value, label]) => `<label class="option"><input type="radio" name="mode" data-field="mode" value="${value}"
          ${this._draft.mode === value ? "checked" : ""}><span>${label}</span></label>`,
      )
      .join("")}</div>`;
  }

  _renderKiosk(user) {
    return `<div class="card"><h2>${t("Mode kiosque")}</h2>
      <label class="option"><input type="checkbox" data-field="kiosk" ${this._draft.kiosk ? "checked" : ""}
        ${user.is_admin ? "disabled" : ""}><span>${t("Mode kiosque")}</span></label>
      <div class="hint">${t("Masque la barre latérale, le bouton menu et les boutons Rechercher et Modifier. L'en-tête reste affiché.")}</div>
      ${user.is_admin ? `<div class="warn">${t("Interdit pour un administrateur : il perdrait l'accès aux paramètres.")}</div>` : ""}
    </div>`;
  }

  _renderDefaultPanel(user) {
    // Untitled dashboards are not in the sidebar but can still be the default one (new "home" overview).
    const untitled = this._panels.filter(
      (p) => !p.title && ["home", "lovelace"].includes(p.url_path) && (!p.require_admin || user.is_admin),
    );
    const options = [...untitled, ...this._panelsFor(user)]
      .filter((p) => !PROTECTED_ADMIN_PANELS.includes(p.url_path))
      .map(
        (p) =>
          `<option value="${esc(p.url_path)}" ${this._draft.default_panel === p.url_path ? "selected" : ""}>${esc(this._panelLabel(p))}</option>`,
      )
      .join("");
    return `<div class="card"><h2>${t("Dashboard par défaut")}</h2>
      <select data-field="default_panel"><option value="">${t("(ne pas toucher)")}</option>${options}</select></div>`;
  }

  _renderSidebar(user) {
    const managed = !!this._draft.sidebar;
    let body = `<div class="hint">${t("Non gérée : l'utilisateur garde sa propre barre.")}</div>`;
    if (managed) {
      const hidden = new Set(this._draft.sidebar.hidden);
      const panels = this._orderedPanels(user);
      body = `<div class="panels">${panels
        .map((p, i) => {
          const isDefault = p.url_path === this._draft.default_panel;
          const locked = this._isProtected(user, p.url_path) || isDefault;
          const isHidden = hidden.has(p.url_path) && !locked;
          const lockReason = isDefault ? t("Le dashboard par défaut reste toujours affiché") : t("Toujours visible pour un administrateur");
          return `<div class="panel-row ${isHidden ? "hidden" : ""}">
            <input type="checkbox" data-field="visible" data-id="${esc(p.url_path)}" ${isHidden ? "" : "checked"}
              ${locked ? `disabled title="${lockReason}"` : ""}>
            <span class="label">${esc(this._panelLabel(p))} <code>${esc(p.url_path)}</code></span>
            <button class="small" data-action="up" data-id="${esc(p.url_path)}" title="${t("Monter")}" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="small" data-action="down" data-id="${esc(p.url_path)}" title="${t("Descendre")}" ${i === panels.length - 1 ? "disabled" : ""}>↓</button>
          </div>`;
        })
        .join("")}</div>`;
      const known = new Set(this._panels.map((p) => p.url_path));
      const gone = [...this._draft.sidebar.hidden, ...this._draft.sidebar.order].filter((p) => !known.has(p));
      if (gone.length) body += `<div class="warn">${t("Panneaux disparus, ignorés : {list}", { list: esc([...new Set(gone)].join(", ")) })}</div>`;
    }
    return `<div class="card"><h2>${t("Barre latérale")}</h2>
      <label class="option"><input type="checkbox" data-field="manage_sidebar" ${managed ? "checked" : ""}>
        <span>${t("Gérer la barre latérale de cet utilisateur")}</span></label>${body}</div>`;
  }

  _renderCurrent(user) {
    const sidebar = user.current.sidebar;
    const sidebarText = sidebar
      ? t("personnalisée ({n} masqués)", { n: (sidebar.hiddenPanels ?? []).length })
      : t("par défaut");
    const defaultPanel = user.current.default_panel ? this._labelOf(user.current.default_panel) : t("aucun");
    return `<div class="card"><h2>${t("État actuel")}</h2><ul>
      <li>${t("dashboard par défaut : {value}", { value: esc(defaultPanel) })}</li>
      <li>${t("barre latérale : {value}", { value: esc(sidebarText) })}</li></ul></div>`;
  }

  _renderSecurity(user) {
    const dashboards = this._panels.filter((p) => p.component_name === "lovelace" && p.show_in_sidebar);
    const adminOnly = dashboards.filter((p) => p.require_admin).map((p) => this._panelLabel(p));
    const hidden = new Set(this._draft.sidebar?.hidden ?? []);
    const reachable = dashboards.filter((p) => !p.require_admin && hidden.has(p.url_path)).map((p) => this._panelLabel(p));
    const lines = [`<li>${t("Compte administrateur : {value}", { value: user.is_admin ? t("oui") : t("non") })}</li>`];
    if (!user.is_admin && adminOnly.length) lines.push(`<li>${t("Réservés aux administrateurs (vrai verrou) : {list}", { list: esc(adminOnly.join(", ")) })}</li>`);
    if (!user.is_admin && reachable.length) lines.push(`<li class="warn">${t("Accessibles par leur URL même masqués : {list}", { list: esc(reachable.join(", ")) })}</li>`);
    return `<div class="card"><h2>${t("Sécurité")}</h2><ul>${lines.join("")}</ul>
      <div class="hint">${t("Masquer n'est pas interdire : une page masquée reste accessible par son URL, et un utilisateur peut lancer des actions par l'API. Les seuls vrais verrous sont le statut administrateur et l'option « admin uniquement » d'un dashboard.")}</div></div>`;
  }

  _renderActions(user) {
    const others = this._users
      .filter((u) => u.id !== user.id)
      .map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`)
      .join("");
    return `<div class="card actions">
      <button class="primary" data-action="save">${t("Enregistrer")}</button>
      <button data-action="apply" ${user.rule && user.rule.mode !== "unmanaged" ? "" : "disabled"}>${t("Réappliquer maintenant")}</button>
      <select data-field="copy_from"><option value="" selected>${t("Copier depuis…")}</option>${others}</select>
      <button data-action="delete" ${user.rule ? "" : "disabled"}>${t("Ne plus gérer")}</button>
      ${this._dirty ? `<span class="warn">${t("Modifications non enregistrées")}</span>` : ""}
    </div>`;
  }
}

customElements.define("user-dashboard-admin-panel", UserDashboardAdminPanel);
