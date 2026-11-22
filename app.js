// Points en famille — logique du site.
// Toutes les données passent par Supabase ; la base refuse tout accès aux données d'une autre famille.
(function () {
  "use strict";

  // ───────── Outils ─────────
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const show = (el, on) => { if (typeof el === "string") el = $(el); if (el) el.hidden = !on; };
  const msg = (sel, text) => { const el = $(sel); if (!el) return; el.textContent = text || ""; el.hidden = !text; };
  function toast(text) { const t = $("#toast"); t.textContent = text; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2600); }
  const pad = n => String(n).padStart(2, "0");
  const dayKey = ms => { const d = new Date(ms == null ? Date.now() : ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const shortDate = d => { try { return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); } catch { return dayKey(d); } };
  const monday = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* sans effet */ } } };
  const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const OOPS = "Oups, ce n'est pas enregistré. Vérifie la connexion et réessaie.";

  // Par défaut, un enfant peut gagner au maximum 8 € par semaine s'il fait toutes ses missions.
  const DEFAULT_WEEKLY_BUDGET = 8;
  const DEFAULT_SETTINGS = {
    routines: {
      matin: { label: "Missions du matin", icon: "🌅", points: 2, items: ["M'habiller", "Faire mes tartines", "Débarrasser", "Me brosser les dents", "Prendre mon cartable"] },
      soir: { label: "Missions du soir", icon: "🌙", points: 3, items: ["Prendre ma douche", "Mettre mon pyjama", "Me brosser les dents", "Ranger mes affaires", "Préparer mes habits pour demain"] }
    },
    tasks: [{ label: "Chambre rangée", icon: "🧸", points: 2 }, { label: "Devoirs tout seul", icon: "✏️", points: 3 }]
  };
  const REWARD_ICONS = ["🎁", "🖍️", "📘", "📕", "🧸", "🍫", "🍦", "🎮", "📺", "🎨", "⚽", "🎬", "🍕", "🛝", "⭐", "🎟️"];
  const TASK_ICONS = ["🧸", "✏️", "🚿", "🧹", "🍽️", "🐶", "🌱", "📚", "🎹", "🚲", "🛏️", "🧺", "⭐"];
  const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
  const DAYN = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  // ───────── Connexion à Supabase ─────────
  const CFG = window.POINTS_CONFIG || {};
  if (!window.supabase || !CFG.supabaseUrl || /VOTRE-PROJET/.test(CFG.supabaseUrl) || /VOTRE-CLE/.test(CFG.supabaseAnonKey || "")) {
    msg("#status", "Le site n'est pas encore relié à sa base de données. Il faut remplir le fichier config.js.");
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  // Bouton de don (facultatif, pour les parents administrateurs) : un simple lien vers une page Ko-fi,
  // sans script extérieur. Toute autre adresse est ignorée et le bouton reste caché.
  const kofi = typeof CFG.kofi === "string" ? CFG.kofi.trim() : "";
  if (/^https:\/\/ko-fi\.com\/[A-Za-z0-9_]{1,64}\/?$/.test(kofi)) {
    $("#don-link").href = kofi;
    show("#don-card", true);
  }

  // ───────── État ─────────
  const S = {
    user: null, memberships: [], family: null, role: "member",
    children: [], rewards: [], events: [], checks: new Set(), checksDay: "",
    channel: null, confirmKey: null, confirmTimer: null, busy: false,
    yearShown: new Date().getFullYear(), editingKid: null, pickedChar: "pirate", adminFilled: false, resetArmed: false
  };
  // Les réglages viennent de la base (jsonb libre) : on force les types pour qu'aucune
  // valeur inattendue n'arrive dans le HTML (nombres pour les points, texte pour le reste).
  // Poids d'une mission, de 1 à 10. Les anciennes familles avaient des points : ils servent de poids.
  const wgt = (o, d) => { const n = Math.round(Number(o && (o.weight !== undefined ? o.weight : o.points))); return n >= 1 ? Math.min(n, 10) : d; };
  // Chaque enfant peut gagner environ 100 points par semaine en faisant toutes ses missions.
  const POINTS_PER_WEEK = 100;
  const txt = (v, d) => (typeof v === "string" && v.trim() ? v.slice(0, 80) : d);
  const routine = (r, d) => ({
    label: txt(r && r.label, d.label), icon: txt(r && r.icon, d.icon), weight: wgt(r, d.points),
    items: Array.isArray(r && r.items) ? r.items.filter(i => typeof i === "string").map(i => i.slice(0, 80)) : d.items
  });
  const settings = () => {
    const s = (S.family && S.family.settings) || {};
    const r = s.routines || {}, D = DEFAULT_SETTINGS;
    const routines = { matin: routine(r.matin, D.routines.matin), soir: routine(r.soir, D.routines.soir) };
    const tasks = (Array.isArray(s.tasks) ? s.tasks : D.tasks).filter(t => t && typeof t === "object")
      .map(t => ({ label: txt(t.label, "?"), icon: txt(t.icon, "⭐"), weight: wgt(t, 1) }));
    // Les parents donnent un poids à chaque mission ; le site répartit les 100 points de la semaine selon ces poids.
    // Chaque mission se fait une fois par jour, donc 7 fois par semaine. Les points restent entiers (au moins 1).
    const all = [routines.matin, routines.soir, ...tasks], sumW = all.reduce((a, m) => a + m.weight, 0);
    all.forEach(m => { m.points = Math.max(1, Math.round(POINTS_PER_WEEK / 7 * m.weight / sumW)); });
    const maxWeek = 7 * all.reduce((a, m) => a + m.points, 0);
    const oldMax = 7 * sumW; // ancien calcul, quand le poids était le nombre de points
    const okNum = (v, max) => typeof v === "number" && v >= 0 && v <= max;
    // Ancien réglage (valeur d'un point) : on le convertit en budget pour ne rien changer aux familles existantes.
    const weeklyBudget = okNum(s.weeklyBudget, 1000) ? s.weeklyBudget
      : okNum(s.euroPerPoint, 100) ? Math.round(s.euroPerPoint * oldMax * 100) / 100 : DEFAULT_WEEKLY_BUDGET;
    return { routines, tasks, maxWeek, weeklyBudget, euroPerPoint: maxWeek > 0 ? weeklyBudget / maxWeek : 0 };
  };
  const isAdmin = () => S.role === "admin";
  const kidById = id => S.children.find(k => k.id === id);
  const charOf = kid => window.characterById(kid && kid.character);
  const total = kidId => S.events.reduce((a, e) => a + (e.child_id === kidId ? e.points : 0), 0);
  const kidStyle = kid => `--c:${charOf(kid).color}`;

  // ───────── Écrans ─────────
  function screen(name) {
    ["auth", "recover", "onboard", "app", "super"].forEach(n => show("#" + n, n === name));
    show("#who", !!S.user && name !== "auth");
    S.screen = name; showTopLogout();
  }
  // Les boutons du compte sont dans l'onglet Administration ; sans cet onglet, on garde « Se déconnecter » en haut.
  function showTopLogout() { show("#logout-top", !!S.user && S.screen !== "auth" && !(S.screen === "app" && S.family && isAdmin())); }

  // ───────── Comptes ─────────
  let authMode = "login";
  function setAuthMode(m) {
    authMode = m;
    $("#tab-login").setAttribute("aria-selected", m === "login");
    $("#tab-signup").setAttribute("aria-selected", m === "signup");
    $("#auth-submit").textContent = m === "login" ? "Se connecter" : "Créer mon compte";
    $("#auth-password").autocomplete = m === "login" ? "current-password" : "new-password";
    show("#auth-hint", m === "signup"); show("#auth-forgot", m === "login");
    msg("#auth-err"); msg("#auth-ok");
  }
  $("#tab-login").addEventListener("click", () => setAuthMode("login"));
  $("#tab-signup").addEventListener("click", () => setAuthMode("signup"));
  const backUrl = () => location.origin + location.pathname;

  $("#auth-form").addEventListener("submit", async e => {
    e.preventDefault(); msg("#auth-err"); msg("#auth-ok");
    const email = $("#auth-email").value.trim(), password = $("#auth-password").value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg("#auth-err", "Écris une adresse e-mail valide.");
    if (password.length < 8) return msg("#auth-err", "Le mot de passe doit avoir au moins 8 caractères.");
    const btn = $("#auth-submit"); btn.disabled = true;
    try {
      if (authMode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) msg("#auth-err", /confirm/i.test(error.message) ? "Ton adresse n'est pas encore confirmée. Ouvre l'e-mail reçu et clique sur le lien." : "E-mail ou mot de passe incorrect.");
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: backUrl() } });
        if (error) msg("#auth-err", /registered|exists/i.test(error.message) ? "Un compte existe déjà avec cette adresse. Connecte-toi." : "Le compte n'a pas pu être créé : " + error.message);
        else if (!data.session) { msg("#auth-ok", "Compte créé ! Ouvre l'e-mail que tu viens de recevoir et clique sur le lien pour le confirmer, puis connecte-toi."); setAuthMode("login"); msg("#auth-ok", "Compte créé ! Ouvre l'e-mail que tu viens de recevoir et clique sur le lien pour le confirmer, puis connecte-toi."); }
      }
    } catch { msg("#auth-err", "Pas de connexion au serveur. Réessaie dans un instant."); }
    btn.disabled = false;
  });
  $("#auth-forgot").addEventListener("click", async () => {
    msg("#auth-err"); msg("#auth-ok");
    const email = $("#auth-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg("#auth-err", "Écris d'abord ton adresse e-mail, puis clique sur « Mot de passe oublié ? ».");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: backUrl() });
    if (error) msg("#auth-err", "L'e-mail n'a pas pu être envoyé. Réessaie plus tard.");
    else msg("#auth-ok", "Si un compte existe avec cette adresse, un e-mail pour changer le mot de passe vient d'être envoyé.");
  });
  $("#recover-form").addEventListener("submit", async e => {
    e.preventDefault();
    const password = $("#recover-password").value;
    if (password.length < 8) return msg("#recover-err", "Au moins 8 caractères.");
    const { error } = await sb.auth.updateUser({ password });
    if (error) return msg("#recover-err", "Le mot de passe n'a pas pu être changé : " + error.message);
    toast("Mot de passe changé ✓"); S.recovering = false;
    const { data } = await sb.auth.getSession(); handleSession(data.session, true);
  });
  $("#logout").addEventListener("click", async () => { await sb.auth.signOut(); });
  $("#logout-top").addEventListener("click", async () => { await sb.auth.signOut(); });

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { S.recovering = true; S.user = session && session.user; screen("recover"); return; }
    if (S.recovering) return;
    setTimeout(() => handleSession(session), 0);
  });

  async function handleSession(session, force) {
    const uid = session && session.user && session.user.id;
    if (!uid) {
      stopRealtime();
      Object.assign(S, { superAdmin: false, visiting: false, user: null, family: null, memberships: [], children: [], rewards: [], events: [], checks: new Set() });
      msg("#status"); screen("auth"); setAuthMode(authMode); return;
    }
    if (!force && S.user && S.user.id === uid) return;
    S.user = session.user;
    $("#who-email").textContent = S.user.email || "";
    // Le rôle super admin est donné dans la base (table super_admins), jamais par le site.
    const sup = await sb.rpc("is_super_admin");
    S.superAdmin = !sup.error && sup.data === true;
    show("#super-btn", S.superAdmin);
    await loadFamilies();
  }

  // ───────── Familles ─────────
  async function loadFamilies(preferId) {
    msg("#status", "Chargement…");
    const { data, error } = await sb.from("family_members").select("family_id, role, families(id, name, invite_code, settings)").eq("user_id", S.user.id);
    if (error) { msg("#status", "Impossible de lire tes familles. Recharge la page."); return; }
    S.memberships = (data || []).filter(m => m.families);
    msg("#status");
    if (!S.memberships.length) { stopRealtime(); S.family = null; screen("onboard"); return; }
    const sel = $("#family-switch");
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    sel.innerHTML = S.memberships.map(m => `<option value="${m.family_id}">${esc(m.families.name)}</option>`).join("");
    show(sel, S.memberships.length > 1);
    const saved = preferId || store.get("points-family");
    const m = S.memberships.find(x => x.family_id === saved) || S.memberships[0];
    await openFamily(m.family_id);
  }
  $("#family-switch").addEventListener("change", e => openFamily(e.target.value));

  async function openFamily(fid) {
    const m = S.memberships.find(x => x.family_id === fid); if (!m) return;
    store.set("points-family", fid);
    $("#family-switch").value = fid;
    await enterFamily(m.families, m.role, false);
  }
  async function enterFamily(fam, role, visiting) {
    S.family = fam; S.role = role; S.visiting = visiting; S.adminFilled = false; S.editingKid = null;
    $("#title").textContent = S.family.name;
    $("#visit-text").textContent = visiting ? `🛡️ Mode super admin : tu es dans la famille « ${fam.name} ».` : "";
    show("#visit", visiting);
    await loadAll();
    startRealtime();
    screen("app"); render(); showView();
  }

  // ───────── Mode salon : écran toujours allumé ─────────
  // Pour une tablette posée dans le salon : l'écran ne se met pas en veille et,
  // après 3 minutes sans toucher, on revient sur « Mes points ».
  const salon = { lock: null, idle: null };
  const salonOn = () => document.body.classList.contains("salon");
  async function keepAwake() {
    if (!salonOn() || salon.lock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try { salon.lock = await navigator.wakeLock.request("screen"); salon.lock.addEventListener("release", () => (salon.lock = null)); }
    catch { /* refusé par le navigateur (batterie faible…) : on réessaiera */ }
  }
  function armIdle() {
    clearTimeout(salon.idle);
    if (!salonOn()) return;
    salon.idle = setTimeout(() => {
      const v = VIEWS[location.hash] || "points";
      if (!$("#app").hidden && v !== "points" && v !== "admin") location.hash = "#points";
    }, 3 * 60 * 1000);
  }
  function setSalon(on, byClick) {
    document.body.classList.toggle("salon", on);
    $("#salon-btn").setAttribute("aria-pressed", String(on));
    $("#salon-btn").textContent = on ? "📺 Quitter le mode salon" : "📺 Mode salon";
    store.set("points-salon", on ? "1" : "");
    if (on) {
      keepAwake(); armIdle();
      if (byClick && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      if (byClick) toast("wakeLock" in navigator ? "Mode salon : l'écran reste allumé 📺" : "Ce navigateur ne peut pas garder l'écran allumé : mets la mise en veille de la tablette sur « Jamais ».");
    } else {
      clearTimeout(salon.idle);
      if (salon.lock) salon.lock.release().catch(() => {});
      salon.lock = null;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }
  $("#salon-btn").addEventListener("click", () => setSalon(!salonOn(), true));
  ["pointerdown", "keydown"].forEach(t => document.addEventListener(t, () => { if (salonOn()) { armIdle(); keepAwake(); } }, { passive: true }));
  document.addEventListener("visibilitychange", keepAwake);
  if (store.get("points-salon") === "1") setSalon(true, false);

  // ───────── Super admin ─────────
  async function openSuper() {
    if (!S.superAdmin) return;
    screen("super"); msg("#super-err");
    const { data, error } = await sb.rpc("all_families");
    if (error) { $("#super-list").textContent = ""; return msg("#super-err", "Impossible de lire la liste des familles."); }
    const rows = (data || []).map(f => `<tr><td>${esc(f.name)}</td><td>${Number(f.adults)}</td><td>${Number(f.kids)}</td><td>${Number(f.events)}</td>
      <td>${f.last_event ? shortDate(Date.parse(f.last_event)) : "—"}</td><td><button type="button" class="btn small" data-visit="${esc(f.id)}">Ouvrir</button></td></tr>`).join("");
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#super-list").innerHTML = `<thead><tr><th>Famille</th><th>Adultes</th><th>Enfants</th><th>Points notés</th><th>Dernière activité</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">Aucune famille pour l'instant.</td></tr>`}</tbody>`;
  }
  async function visitFamily(fid) {
    const mine = S.memberships.find(x => x.family_id === fid);
    if (mine) return openFamily(fid);
    const { data, error } = await sb.from("families").select("id, name, invite_code, settings").eq("id", fid).single();
    if (error || !data) return msg("#super-err", "Cette famille n'a pas pu être ouverte.");
    await enterFamily(data, "admin", true);
  }
  $("#super-btn").addEventListener("click", openSuper);
  $("#super-list").addEventListener("click", e => { const b = e.target.closest("[data-visit]"); if (b) visitFamily(b.dataset.visit); });
  $("#super-close").addEventListener("click", () => (S.family ? screen("app") : loadFamilies()));
  $("#visit-leave").addEventListener("click", () => loadFamilies());

  $("#create-form").addEventListener("submit", async e => {
    e.preventDefault(); msg("#create-err");
    const name = $("#create-name").value.trim();
    if (!name) return msg("#create-err", "Donne un nom à ta famille.");
    const { data, error } = await sb.rpc("create_family", { fname: name.slice(0, 60) });
    if (error) return msg("#create-err", "La famille n'a pas pu être créée. Réessaie.");
    toast("Famille créée ! Ajoute maintenant les enfants.");
    await loadFamilies(data);
    location.hash = "#admin";
  });
  $("#join-form").addEventListener("submit", async e => {
    e.preventDefault(); msg("#join-err");
    const code = $("#join-code").value.trim().toUpperCase();
    if (code.length < 6) return msg("#join-err", "Le code a 8 lettres et chiffres.");
    const { data, error } = await sb.rpc("join_family", { code });
    if (error) return msg("#join-err", /bad_code/.test(error.message) ? "Ce code n'existe pas. Vérifie-le avec le parent qui te l'a donné." : "Impossible de rejoindre la famille. Réessaie.");
    toast("Bienvenue dans la famille !");
    await loadFamilies(data);
  });

  // ───────── Chargement des données ─────────
  async function fetchEvents() {
    const fid = S.family.id, all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("events").select("id, child_id, points, label, created_at").eq("family_id", fid).order("created_at").range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    S.events = all.map(e => Object.assign(e, { at: Date.parse(e.created_at) }));
  }
  async function fetchChildren() {
    const { data, error } = await sb.from("children").select("*").eq("family_id", S.family.id).order("position").order("created_at");
    if (error) throw error; S.children = data;
  }
  async function fetchRewards() {
    const { data, error } = await sb.from("rewards").select("*").eq("family_id", S.family.id).order("cost").order("created_at");
    if (error) throw error; S.rewards = data;
  }
  async function fetchChecks() {
    const day = dayKey();
    const { data, error } = await sb.from("checks").select("child_id, item").eq("family_id", S.family.id).eq("day", day);
    if (error) throw error; S.checksDay = day; S.checks = new Set(data.map(c => c.child_id + "|" + c.item));
  }
  async function fetchFamily() {
    const { data, error } = await sb.from("families").select("id, name, invite_code, settings").eq("id", S.family.id).single();
    if (error) throw error; Object.assign(S.family, data); $("#title").textContent = S.family.name;
  }
  async function loadAll() {
    msg("#status", "Chargement des points…");
    try { await Promise.all([fetchChildren(), fetchRewards(), fetchEvents(), fetchChecks()]); msg("#status"); }
    catch { msg("#status", "Impossible de lire les points pour l'instant. Recharge la page."); }
  }
  const FETCHERS = { events: fetchEvents, checks: fetchChecks, children: fetchChildren, rewards: fetchRewards, families: fetchFamily };
  const pending = new Set(); let reloadTimer = null;
  function reload(...tables) {
    tables.forEach(t => pending.add(t));
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      if (!S.family) return;
      const list = [...pending]; pending.clear();
      try { await Promise.all(list.map(t => FETCHERS[t]())); } catch { /* sans effet */ }
      render();
    }, 250);
  }
  function startRealtime() {
    stopRealtime();
    const fid = S.family.id, ch = sb.channel("famille-" + fid);
    ["events", "checks", "children", "rewards"].forEach(t =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: "family_id=eq." + fid }, () => reload(t)));
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "families", filter: "id=eq." + fid }, () => reload("families"));
    ch.subscribe();
    S.channel = ch;
  }
  function stopRealtime() { if (S.channel) { sb.removeChannel(S.channel); S.channel = null; } }
  // Les suppressions faites sur un autre appareil n'arrivent pas toujours en direct : on relit régulièrement.
  setInterval(() => { if (S.family && document.visibilityState === "visible") reload("events", "checks"); }, 60000);
  document.addEventListener("visibilitychange", () => { if (S.family && document.visibilityState === "visible") reload("events", "checks", "children", "rewards", "families"); });

  // ───────── Écritures ─────────
  async function addEvent(childId, points, label) {
    if (S.busy) return false; S.busy = true;
    const { error } = await sb.from("events").insert({ family_id: S.family.id, child_id: childId, points, label: String(label).slice(0, 60) });
    S.busy = false;
    if (error) {
      if (/deja_fait/.test(error.message || "")) { toast("Déjà fait aujourd'hui ✓ Reviens demain !"); await fetchEvents(); render(); }
      else toast(OOPS);
      return false;
    }
    await fetchEvents(); render(); return true;
  }
  async function removeEvent(id) {
    if (S.busy) return; S.busy = true;
    const { error } = await sb.from("events").delete().eq("id", id);
    S.busy = false;
    if (error) return toast(OOPS);
    await fetchEvents(); render(); toast("Annulé");
  }
  async function toggleCheck(childId, item) {
    if (S.busy) return; S.busy = true;
    const key = childId + "|" + item, on = S.checks.has(key), day = dayKey();
    // affichage immédiat, puis enregistrement
    on ? S.checks.delete(key) : S.checks.add(key); renderTodo();
    const q = on
      ? sb.from("checks").delete().eq("child_id", childId).eq("day", day).eq("item", item)
      : sb.from("checks").insert({ family_id: S.family.id, child_id: childId, day, item });
    const { error } = await q;
    S.busy = false;
    if (error) { toast(OOPS); await fetchChecks(); renderTodo(); }
  }
  function armConfirm(key) {
    S.confirmKey = key; clearTimeout(S.confirmTimer);
    S.confirmTimer = setTimeout(() => { S.confirmKey = null; render(); }, 4000);
    render();
  }

  // ───────── Rendu ─────────
  function render() {
    if (!S.family) return;
    if (S.checksDay && S.checksDay !== dayKey()) reload("checks");
    show("#tab-admin", isAdmin()); showTopLogout();
    renderPoints(); renderTodo(); renderShop(); renderWeeks();
    if (isAdmin()) renderAdminLists();
  }
  function emptyKids() {
    return `<div class="empty">Aucun enfant pour l'instant.${isAdmin() ? ` Ajoute-les dans <a href="#admin">⚙️ Administration</a>.` : " Un parent administrateur peut les ajouter."}</div>`;
  }
  function kidHead(kid, right) {
    const c = charOf(kid);
    return `<div class="top"><div class="ident"><span class="avatar" aria-hidden="true">${c.icon}</span><h2 class="name">${esc(kid.name)}</h2></div>${right}</div>`;
  }

  // Chaque mission rapporte des points une seule fois par jour et par enfant
  // (la base le vérifie aussi, voir le déclencheur une_fois_par_jour dans schema.sql).
  const doneToday = (kidId, label) => { const day = dayKey(); return S.events.some(e => e.child_id === kidId && e.label === label && e.points > 0 && dayKey(e.at) === day); };

  function renderPoints() {
    const st = settings();
    const buttons = [
      ...["matin", "soir"].map(p => ({ key: "r:" + p, icon: st.routines[p].icon, label: st.routines[p].label, pts: st.routines[p].points })),
      ...st.tasks.map((t, i) => ({ key: "t:" + i, icon: t.icon, label: t.label, pts: t.points }))
    ];
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#kids").innerHTML = S.children.length ? S.children.map(k => {
      const hist = S.events.filter(e => e.child_id === k.id).sort((a, b) => b.at - a.at).slice(0, 5);
      return `<article class="kid" style="${kidStyle(k)}">
        ${kidHead(k, `<div class="total"><b>${total(k.id)}</b><span>points</span></div>`)}
        <div><h3>Gagner des points</h3><div class="earn" style="margin-top:8px">
          ${buttons.map(b => {
            const fait = doneToday(k.id, b.label), routine = b.key.startsWith("r:");
            const bas = fait ? "✓ fait aujourd'hui" : routine ? "Cocher mes missions →" : "+" + b.pts;
            return `<button class="btn-earn ${fait ? "fait" : ""} ${routine && !fait ? "aller" : ""}" data-earn="${k.id}|${b.key}" ${fait ? "disabled" : ""}><span class="ico" aria-hidden="true">${esc(b.icon)}</span>${esc(b.label)}<span class="pts">${bas}</span></button>`;
          }).join("")}
        </div></div>
        <div><h3>Derniers points</h3>${hist.length ? `<ul class="history" style="margin-top:8px">${hist.map(e => `<li><span>${esc(e.label)} <span class="when">${shortDate(e.at)}</span></span><span class="${e.points > 0 ? "plus" : "minus"}">${e.points > 0 ? "+" : ""}${e.points}</span></li>`).join("")}</ul>` : `<p class="hint" style="margin-top:8px">Pas encore de points. Appuie sur un bouton au-dessus !</p>`}</div>
        <button class="btn-undo" data-undo="${k.id}" ${hist.length ? "" : "disabled"}>↩︎ Annuler le dernier</button>
      </article>`;
    }).join("") : emptyKids();
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#rules").innerHTML = `<b>Les règles, une fois par jour :</b> ${buttons.map(b => `${esc(b.label.toLowerCase())} = <b>${b.pts} point${b.pts > 1 ? "s" : ""}</b>`).join(" · ")}`;
  }

  function renderTodo() {
    const st = settings();
    try { $("#today").textContent = "Aujourd'hui : " + new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); } catch { /* sans effet */ }
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#todo-kids").innerHTML = S.children.length ? S.children.map(k => `<article class="kid" style="${kidStyle(k)}">
      ${kidHead(k, "")}
      ${["matin", "soir"].map(part => {
        const r = st.routines[part], items = (r.items || []).filter(Boolean);
        const keyOf = i => part + ":" + i + ":" + items[i];
        const done = items.filter((_, i) => S.checks.has(k.id + "|" + keyOf(i))).length;
        const all = items.length > 0 && done === items.length;
        const given = doneToday(k.id, r.label);
        return `<div class="block"><div class="block-h"><b>${esc(r.icon)} ${esc(r.label)}</b><span class="p">${r.points} points · ${done} / ${items.length} cases</span></div>
          ${items.map((lbl, i) => { const on = S.checks.has(k.id + "|" + keyOf(i));
            return `<button class="check ${on ? "done" : ""}" data-check="${k.id}" data-item="${esc(keyOf(i))}" aria-pressed="${on}"><span class="box">${on ? "✓" : ""}</span><span class="lbl">${esc(lbl)}</span></button>`; }).join("")}
          ${given ? `<p class="given">+${r.points} points gagnés ce ${part === "matin" ? "matin" : "soir"} ! 🎉</p>${(() => { const ck = "unbonus|" + k.id + "|" + part, conf = S.confirmKey === ck;
              return `<button class="btn-undo ${conf ? "confirm" : ""}" data-unbonus="${k.id}|${part}">${conf ? "Sûr ? Touche encore pour annuler" : `↩︎ Annuler ces ${r.points} points`}</button>`; })()}`
            : `<button class="btn-bonus" data-bonus="${k.id}|${part}" ${all ? "" : "disabled"}>${all ? `Tout est fait ! Prendre mes ${r.points} points` : `Encore ${items.length - done} à faire`}</button>`}
        </div>`;
      }).join("")}
    </article>`).join("") : emptyKids();
  }

  function renderShop() {
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#shop-wallets").innerHTML = S.children.map(k => `<div class="wallet" style="${kidStyle(k)}"><span class="wi" aria-hidden="true">${charOf(k).icon}</span><span>${esc(k.name)}</span><b>${total(k.id)}</b></div>`).join("");
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#shop-items").innerHTML = S.rewards.length ? S.rewards.map(r => {
      const kids = S.children.filter(k => !r.child_ids || !r.child_ids.length || r.child_ids.includes(k.id));
      return `<article class="item"><div class="item-ico" aria-hidden="true">${esc(r.icon)}</div>
        <h3 class="item-t">${esc(r.title)}</h3><p class="price">${r.cost} points</p>
        <div class="buy-row">${kids.map(k => { const tot = total(k.id), ok = tot >= r.cost, key = "shop|" + k.id + "|" + r.id, conf = S.confirmKey === key;
          return `<button class="btn-buy ${conf ? "confirm" : ""}" style="${kidStyle(k)}" data-buy="${k.id}|${r.id}" ${ok ? "" : "disabled"}>${conf ? "Sûr ? Oui !" : ok ? "Acheter pour " + esc(k.name) : esc(k.name) + " : encore " + (r.cost - tot)}</button>`; }).join("")}</div></article>`;
    }).join("") : `<div class="empty">Le catalogue est vide.${isAdmin() ? ` Ajoute des récompenses dans <a href="#admin">⚙️ Administration</a>.` : ""}</div>`;
    const bought = S.events.filter(e => e.points < 0).sort((a, b) => b.at - a.at).slice(0, 10);
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#shop-history").innerHTML = bought.length ? bought.map(e => `<li><span>${esc((kidById(e.child_id) || {}).name || "?")} : ${esc(e.label)} <span class="when">${shortDate(e.at)}</span></span><span class="minus">${e.points}</span></li>`).join("") : `<li><span>Rien acheté pour l'instant.</span></li>`;
  }

  // ───── Semaines et année ─────
  function weekStats() {
    const st = settings(), earned = {}, miss = {}, buys = {};
    S.children.forEach(k => { earned[k.id] = {}; miss[k.id] = {}; buys[k.id] = {}; });
    S.events.forEach(e => {
      if (!earned[e.child_id]) return;
      const dk = dayKey(e.at);
      if (e.points > 0) {
        earned[e.child_id][dk] = (earned[e.child_id][dk] || 0) + e.points;
        if (e.label === st.routines.matin.label) (miss[e.child_id][dk] = miss[e.child_id][dk] || {}).m = 1;
        if (e.label === st.routines.soir.label) (miss[e.child_id][dk] = miss[e.child_id][dk] || {}).s = 1;
      } else { const wk = dayKey(monday(e.at)); (buys[e.child_id][wk] = buys[e.child_id][wk] || []).push(e.label); }
    });
    return { earned, miss, buys };
  }
  const weekTotal = (st, kid, mon) => { let t = 0; for (let i = 0; i < 7; i++) t += st.earned[kid][dayKey(addDays(mon, i))] || 0; return t; };

  function renderWeeks() {
    const st = weekStats(), todayK = dayKey(), mon = monday(Date.now());
    $("#wk-range").textContent = `Du ${shortDate(mon)} au ${shortDate(addDays(mon, 6))}`;
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#wk-now").innerHTML = S.children.length ? S.children.map(k => {
      const goal = k.weekly_goal || 25, tot = weekTotal(st, k.id, mon), pct = Math.min(100, Math.round(tot / goal * 100));
      let done = 0, poss = 0, best = 0;
      const days = DAYN.map((n, i) => { const dk = dayKey(addDays(mon, i)), fut = dk > todayK, p = st.earned[k.id][dk] || 0, m = st.miss[k.id][dk] || {};
        if (!fut) { poss += 2; done += (m.m ? 1 : 0) + (m.s ? 1 : 0); best = Math.max(best, p); }
        return `<div class="w-day ${dk === todayK ? "today" : ""} ${fut ? "future" : ""}">${n}<div class="w-dots"><i class="w-dot ${m.m ? "ok" : ""}"></i><i class="w-dot ${m.s ? "ok" : ""}"></i></div><span class="w-pts">${fut ? "·" : p ? "+" + p : "0"}</span></div>`; }).join("");
      const b = st.buys[k.id][dayKey(mon)];
      return `<article class="kid" style="${kidStyle(k)}">
        ${kidHead(k, `<div class="w-goal"><b>${tot} / ${goal}</b>cette semaine</div>`)}
        <div><div class="w-bar"><i style="width:${pct}%"></i></div><div class="w-barlbl"><span>${tot >= goal ? "Objectif atteint ! 🎉" : "Encore " + (goal - tot) + " points"}</span><span>${pct} %</span></div></div>
        <div class="w-days">${days}</div>
        <div class="w-stats"><div class="w-stat"><b>${done}/${poss}</b><span>missions faites</span></div><div class="w-stat"><b>${best}</b><span>meilleur jour</span></div><div class="w-stat"><b>${b ? esc(b.join(", ")) : "—"}</b><span>acheté</span></div></div>
      </article>`;
    }).join("") : emptyKids();

    const firstAt = S.events.length ? Math.min(...S.events.map(e => e.at)) : Date.now();
    const weeks = []; for (let w = monday(firstAt); w <= mon; w = addDays(w, 7)) weeks.push(w);
    // Graphique des 8 dernières semaines
    const kids = S.children, cw = weeks.slice(-8), W = 640, H = 250, pl = 34, pb = 34, pt = 30, iw = W - pl - 10, ih = H - pt - pb;
    const gw = iw / Math.max(cw.length, 1), bw = Math.max(6, Math.min(26, gw / (kids.length + 1.2)));
    const vals = cw.map(w => kids.map(k => weekTotal(st, k.id, w)));
    const max = Math.max(40, Math.ceil(Math.max(0, ...vals.flat()) / 10) * 10), y = v => pt + ih - v / max * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Points gagnés par semaine">`;
    for (let v = 0; v <= max; v += max > 80 ? 20 : 10) s += `<line x1="${pl}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--soft)">${v}</text>`;
    cw.forEach((w, i) => { const cx = pl + gw * i + gw / 2, last = i === cw.length - 1, x0 = cx - (kids.length * (bw + 4)) / 2;
      kids.forEach((k, j) => { const v = vals[i][j], x = x0 + j * (bw + 4); s += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" rx="5" fill="${charOf(k).color}"><title>${esc(k.name)} : ${v} points</title></rect>${bw >= 14 ? `<text x="${x + bw / 2}" y="${y(v) - 5}" text-anchor="middle" font-size="11" font-weight="800" fill="var(--ink)">${v}</text>` : ""}`; });
      s += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="11" font-weight="${last ? 800 : 600}" fill="var(--soft)">${last ? "Cette semaine" : shortDate(w)}</text>`; });
    let lx = pl; kids.forEach(k => { s += `<rect x="${lx}" y="4" width="10" height="10" rx="3" fill="${charOf(k).color}"/><text x="${lx + 14}" y="13" font-size="11" font-weight="800" fill="var(--ink)">${esc(k.name)}</text>`; lx += 24 + k.name.length * 7; });
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#wk-chart").innerHTML = s + "</svg>";

    const past = weeks.slice(0, -1).reverse();
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#wk-past").innerHTML = past.length && kids.length ? past.map(w => `<article class="w-week"><div class="w-when">Semaine<small>${shortDate(w)} – ${shortDate(addDays(w, 6))}</small></div><div class="w-week-kids">
      ${kids.map(k => { const goal = k.weekly_goal || 25, p = weekTotal(st, k.id, w), ok = p >= goal, b = st.buys[k.id][dayKey(w)];
        return `<div class="w-wk" style="${kidStyle(k)}"><div class="w-row"><span class="w-n">${esc(k.name)}</span><span>${p} pts <span class="pill ${ok ? "yes" : "no"}">${ok ? "objectif ✓" : "pas atteint"}</span></span></div>
        <div class="w-bar"><i style="width:${Math.min(100, p / goal * 100)}%"></i></div><span class="w-note">${b ? "🎁 " + esc(b.join(", ")) : "Rien acheté"}</span></div>`; }).join("")}</div></article>`).join("")
      : `<p class="w-empty">Pas encore de semaine terminée. La première apparaîtra ici lundi prochain.</p>`;
    renderYear(st);
  }

  function renderYear(st) {
    const yr = S.yearShown, jan1 = new Date(yr, 0, 1), start = monday(jan1), cell = 12, gap = 2, pl = 34, ptop = 18, todayK = dayKey();
    $("#year-lbl").textContent = yr;
    const nWeeks = Math.floor((monday(new Date(yr, 11, 31)) - start) / 864e5 / 7 + 0.01) + 1;
    const W = pl + nWeeks * (cell + gap) + 4, H = ptop + 7 * (cell + gap) + 2;
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#year").innerHTML = S.children.length ? S.children.map(k => {
      const col = charOf(k).color;
      let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Points de ${esc(k.name)} jour par jour en ${yr}">`;
      MONTHS.forEach((m, i) => { const c = Math.floor((monday(new Date(yr, i, 1)) - start) / 864e5 / 7 + 0.01); svg += `<text x="${pl + c * (cell + gap)}" y="11" font-size="10" font-weight="700" fill="var(--soft)">${m}</text>`; });
      ["Lun", "", "Mer", "", "Ven", "", "Dim"].forEach((n, r) => { if (n) svg += `<text x="${pl - 6}" y="${ptop + r * (cell + gap) + 10}" text-anchor="end" font-size="9" fill="var(--soft)">${n}</text>`; });
      let yearTot = 0; const mt = Array(12).fill(0);
      for (let d = new Date(jan1); d.getFullYear() === yr; d = addDays(d, 1)) {
        const dk = dayKey(d), p = st.earned[k.id][dk] || 0, c = Math.floor((monday(d) - start) / 864e5 / 7 + 0.01), r = (d.getDay() + 6) % 7, x = pl + c * (cell + gap), yy = ptop + r * (cell + gap);
        yearTot += p; mt[d.getMonth()] += p;
        svg += `<rect x="${x}" y="${yy}" width="${cell}" height="${cell}" rx="3" fill="var(--line)" ${dk > todayK ? 'opacity=".45"' : ""}><title>${shortDate(d)} : ${p} points</title></rect>`;
        if (p) svg += `<rect x="${x}" y="${yy}" width="${cell}" height="${cell}" rx="3" fill="${col}" opacity="${p < 4 ? .35 : p < 7 ? .65 : 1}"><title>${shortDate(d)} : ${p} points</title></rect>`;
        if (dk === todayK) svg += `<rect x="${x - 1}" y="${yy - 1}" width="${cell + 2}" height="${cell + 2}" rx="4" fill="none" stroke="var(--gold)" stroke-width="2"/>`;
      }
      return `<div class="year-kid"><div class="year-name"><span style="color:${col}">${charOf(k).icon} ${esc(k.name)}</span><span>${yearTot} points en ${yr}</span></div>
        <div class="year-scroll">${svg}</svg></div>
        <div class="months">${MONTHS.map((m, i) => `<div class="month">${m}<b>${mt[i]}</b></div>`).join("")}</div></div>`;
    }).join("") + `<p class="w-empty" style="font-size:13px">Chaque petit carré est un jour. Plus il est foncé, plus il y a eu de points ce jour-là.</p>` : emptyKids();
  }

  // ───── Administration ─────
  const euro = n => { try { return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); } catch { return n.toFixed(2) + " €"; } };
  function renderReport() {
    const st = settings();
    $("#rate-info").textContent = st.maxWeek > 0
      ? `Soit ${st.maxWeek} points au maximum par semaine et par enfant : 1 point vaut environ ${euro(st.euroPerPoint)}. Par jour : ${[st.routines.matin, st.routines.soir, ...st.tasks].map(m => `${m.label.toLowerCase()} ${m.points} pt${m.points > 1 ? "s" : ""}`).join(", ")}.`
      : "Ajoute des missions pour calculer la valeur d'un point.";
    const rate = st.euroPerPoint, mon = monday(Date.now()), end = addDays(mon, 7);
    $("#rp-range").textContent = `Du ${shortDate(mon)} au ${shortDate(addDays(mon, 6))}`;
    const rows = S.children.map(k => {
      const wk = S.events.filter(e => e.child_id === k.id && e.at >= mon && e.at < end);
      const won = wk.filter(e => e.points > 0).reduce((a, e) => a + e.points, 0), spent = -wk.filter(e => e.points < 0).reduce((a, e) => a + e.points, 0);
      return { k, won, spent, bal: total(k.id), goal: k.weekly_goal || 25 };
    });
    const sum = f => rows.reduce((a, r) => a + r[f], 0);
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#report").innerHTML = `<thead><tr><th>Enfant</th><th>Gagnés</th><th>Objectif</th><th>Dépensés</th><th>Valeur gagnée</th><th>Solde</th><th>Valeur du solde</th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr><td style="color:${charOf(r.k).color}">${charOf(r.k).icon} ${esc(r.k.name)}</td><td>${r.won} pts</td><td>${r.won >= r.goal ? '<span class="pill yes">atteint ✓</span>' : `${r.won} / ${r.goal}`}</td><td>${r.spent} pts</td><td>${euro(r.won * rate)}</td><td>${r.bal} pts</td><td>${euro(r.bal * rate)}</td></tr>`).join("") : `<tr><td colspan="7">Pas encore d'enfant.</td></tr>`}</tbody>
      ${rows.length ? `<tfoot><tr><td>Total famille</td><td>${sum("won")} pts</td><td></td><td>${sum("spent")} pts</td><td>${euro(sum("won") * rate)}</td><td>${sum("bal")} pts</td><td>${euro(sum("bal") * rate)}</td></tr></tfoot>` : ""}`;
  }
  $("#rate-form").addEventListener("submit", async e => {
    e.preventDefault();
    const v = Number(String($("#rate").value).replace(",", "."));
    if (!(v >= 0 && v <= 1000)) return toast("Mets une somme entre 0 et 1000 €.");
    const next = Object.assign({}, S.family.settings || {}, { weeklyBudget: Math.round(v * 100) / 100 });
    delete next.euroPerPoint;
    const { error } = await sb.from("families").update({ settings: next }).eq("id", S.family.id);
    if (error) return toast(OOPS);
    S.family.settings = next; render(); toast("Budget de la semaine enregistré ✓");
  });
  function renderAdminLists() {
    renderReport();
    $("#invite-code").textContent = S.family.invite_code || "";
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#admin-kids").innerHTML = S.children.length ? S.children.map(k => { const c = charOf(k), delKey = "delkid|" + k.id;
      return `<div class="akid" style="${kidStyle(k)}"><span class="avatar" aria-hidden="true">${c.icon}</span><div class="grow"><b>${esc(k.name)}</b><small>${esc(c.name)} · objectif ${k.weekly_goal} points par semaine</small></div>
        <button class="btn ghost small" data-editkid="${k.id}">Modifier</button><button class="btn ghost small" data-delkid="${k.id}">${S.confirmKey === delKey ? "Sûr ? Ses points seront effacés" : "Supprimer"}</button></div>`; }).join("")
      : `<p class="hint">Pas encore d'enfant. Ajoute le premier avec le formulaire ci-dessous.</p>`;
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#admin-rewards").innerHTML = S.rewards.length ? S.rewards.map(r => { const who = !r.child_ids || !r.child_ids.length ? "Pour tous" : "Pour " + r.child_ids.map(id => (kidById(id) || {}).name).filter(Boolean).map(esc).join(", "), key = "delrw|" + r.id;
      return `<div class="akid"><span class="avatar" aria-hidden="true" style="border-color:var(--gold)">${esc(r.icon)}</span><div class="grow"><b style="color:var(--ink)">${esc(r.title)}</b><small>${r.cost} points · ${who}</small></div><button class="btn ghost small" data-delrw="${r.id}">${S.confirmKey === key ? "Sûr ? Enlever" : "Enlever"}</button></div>`; }).join("")
      : `<p class="hint">Aucune récompense pour l'instant.</p>`;
    const forSel = $("#rw-for"), cur = forSel.value;
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    forSel.innerHTML = `<option value="">Tous les enfants</option>` + S.children.map(k => `<option value="${k.id}">${esc(k.name)}</option>`).join("");
    if ([...forSel.options].some(o => o.value === cur)) forSel.value = cur;
    $("#reset-btn").textContent = S.resetArmed ? "Sûr ? Tous les points seront effacés" : "Tout remettre à zéro";
    $("#reset-btn").classList.toggle("confirm", S.resetArmed);
  }
  function fillAdminForms() {
    const st = settings();
    $("#fam-name").value = S.family.name;
    $("#rate").value = st.weeklyBudget;
    ["matin", "soir"].forEach(p => { $("#m-" + p + "-pts").value = st.routines[p].weight; $("#m-" + p + "-items").value = (st.routines[p].items || []).join("\n"); });
    $("#task-rows").innerHTML = ""; st.tasks.forEach(t => addTaskRow(t));
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#rw-icon").innerHTML = REWARD_ICONS.map(i => `<option value="${i}">${i}</option>`).join("");
    resetKidForm();
    S.adminFilled = true;
  }
  function addTaskRow(t) {
    t = t || { label: "", icon: "⭐", weight: 1 };
    const row = document.createElement("div"); row.className = "task-row";
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    row.innerHTML = `<label>Image<select class="t-icon">${TASK_ICONS.concat(TASK_ICONS.includes(t.icon) ? [] : [t.icon]).map(i => `<option ${i === t.icon ? "selected" : ""}>${esc(i)}</option>`).join("")}</select></label>
      <label>Nom<input class="t-label" type="text" maxlength="30" value="${esc(t.label)}" placeholder="Ex. : Mettre la table"></label>
      <label>Poids (1 à 10)<input class="t-pts" type="number" min="1" max="10" value="${Number(t.weight) || 1}"></label>
      <button class="btn ghost small" type="button" data-rmtask>Enlever</button>`;
    $("#task-rows").appendChild(row);
  }
  $("#add-task").addEventListener("click", () => addTaskRow());
  $("#task-rows").addEventListener("click", e => { const b = e.target.closest("[data-rmtask]"); if (b) b.closest(".task-row").remove(); });

  function renderCharPicker() {
    // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
    $("#char-picker").innerHTML = window.CHARACTERS.map(c => `<button type="button" class="char" style="--c:${c.color}" data-char="${c.id}" aria-pressed="${c.id === S.pickedChar}"><span class="ci" aria-hidden="true">${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.powerName)}</small></button>`).join("");
  }
  function resetKidForm() {
    S.editingKid = null; S.pickedChar = window.CHARACTERS[S.children.length % window.CHARACTERS.length].id;
    $("#kid-name").value = ""; $("#kid-goal").value = 25;
    $("#kid-form-title").textContent = "Ajouter un enfant"; $("#kid-submit").textContent = "Ajouter l'enfant";
    show("#kid-cancel", false); msg("#kid-err"); renderCharPicker();
  }
  $("#char-picker").addEventListener("click", e => { const b = e.target.closest("[data-char]"); if (!b) return; S.pickedChar = b.dataset.char; renderCharPicker(); });
  $("#kid-cancel").addEventListener("click", resetKidForm);
  $("#kid-form").addEventListener("submit", async e => {
    e.preventDefault(); msg("#kid-err");
    const name = $("#kid-name").value.trim(), goal = Math.round(Number($("#kid-goal").value));
    if (!name) return msg("#kid-err", "Écris le prénom de l'enfant.");
    if (!(goal >= 1 && goal <= 999)) return msg("#kid-err", "L'objectif doit être entre 1 et 999 points.");
    const row = { name: name.slice(0, 30), weekly_goal: goal, character: S.pickedChar };
    const { error } = S.editingKid
      ? await sb.from("children").update(row).eq("id", S.editingKid)
      : await sb.from("children").insert(Object.assign(row, { family_id: S.family.id, position: S.children.length }));
    if (error) return msg("#kid-err", OOPS);
    toast(S.editingKid ? "Fiche modifiée ✓" : `${name} est dans la famille ! 🎉`);
    await fetchChildren(); resetKidForm(); render();
  });
  $("#fam-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#fam-name").value.trim(); if (!name) return toast("Le nom ne peut pas être vide.");
    const { error } = await sb.from("families").update({ name: name.slice(0, 60) }).eq("id", S.family.id);
    if (error) return toast(OOPS);
    S.family.name = name; $("#title").textContent = name;
    const o = $(`#family-switch option[value="${S.family.id}"]`); if (o) o.textContent = name;
    toast("Nom enregistré ✓");
  });
  $("#copy-code").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(S.family.invite_code); toast("Code copié ✓"); }
    catch { const r = document.createRange(); r.selectNodeContents($("#invite-code")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Code sélectionné : fais Copier."); }
  });
  $("#new-code").addEventListener("click", async () => {
    const { data, error } = await sb.rpc("new_invite_code", { fid: S.family.id });
    if (error) return toast(OOPS);
    S.family.invite_code = data; renderAdminLists(); toast("Nouveau code créé. L'ancien ne marche plus.");
  });
  $("#missions-form").addEventListener("submit", async e => {
    e.preventDefault(); msg("#missions-err");
    const cur = settings(), routines = {};
    for (const p of ["matin", "soir"]) {
      const pts = Math.round(Number($("#m-" + p + "-pts").value));
      const items = $("#m-" + p + "-items").value.split("\n").map(s => s.trim()).filter(Boolean).map(s => s.slice(0, 60)).slice(0, 15);
      if (!(pts >= 1 && pts <= 10)) return msg("#missions-err", "Le poids doit être entre 1 et 10.");
      if (!items.length) return msg("#missions-err", "Écris au moins une mission du " + p + ".");
      routines[p] = { label: cur.routines[p].label, icon: cur.routines[p].icon, weight: pts, items };
    }
    const tasks = [];
    for (const row of $$("#task-rows .task-row")) {
      const label = row.querySelector(".t-label").value.trim().slice(0, 30), pts = Math.round(Number(row.querySelector(".t-pts").value));
      if (!label) continue;
      if (!(pts >= 1 && pts <= 10)) return msg("#missions-err", `Le poids de « ${label} » doit être entre 1 et 10.`);
      tasks.push({ label, icon: row.querySelector(".t-icon").value, weight: pts });
    }
    // Le budget de la semaine reste le même : la valeur d'un point s'ajuste aux nouvelles missions.
    const next = { routines, tasks, weeklyBudget: cur.weeklyBudget };
    const { error } = await sb.from("families").update({ settings: next }).eq("id", S.family.id);
    if (error) return msg("#missions-err", OOPS);
    S.family.settings = next; render(); toast("Missions enregistrées ✓");
  });
  $("#reward-form").addEventListener("submit", async e => {
    e.preventDefault(); msg("#rw-err");
    const title = $("#rw-title").value.trim(), cost = Math.round(Number($("#rw-cost").value)), forId = $("#rw-for").value;
    if (!title) return msg("#rw-err", "Écris le nom de la récompense.");
    if (!(cost >= 1 && cost <= 9999)) return msg("#rw-err", "Mets un nombre de points entre 1 et 9999.");
    const { error } = await sb.from("rewards").insert({ family_id: S.family.id, title: title.slice(0, 40), cost, icon: $("#rw-icon").value, child_ids: forId ? [forId] : null });
    if (error) return msg("#rw-err", OOPS);
    $("#rw-title").value = ""; $("#rw-cost").value = "";
    await fetchRewards(); render(); toast(`${title} est dans le catalogue ! 🎁`);
  });
  $("#reset-btn").addEventListener("click", async () => {
    if (!S.resetArmed) { S.resetArmed = true; setTimeout(() => { S.resetArmed = false; renderAdminLists(); }, 5000); return renderAdminLists(); }
    S.resetArmed = false;
    const [a, b] = await Promise.all([
      sb.from("events").delete().eq("family_id", S.family.id),
      sb.from("checks").delete().eq("family_id", S.family.id)
    ]);
    if (a.error || b.error) toast(OOPS); else toast("Tous les points sont remis à zéro.");
    await Promise.all([fetchEvents(), fetchChecks()]); render();
  });

  // ───────── Clics ─────────
  document.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b || b.disabled || !S.family) return;
    const d = b.dataset;
    if (d.earn) {
      const [kid, key] = d.earn.split("|"), st = settings(); let item;
      if (key.startsWith("r:")) item = st.routines[key.slice(2)]; else item = st.tasks[Number(key.slice(2))];
      if (!item) return;
      // Les missions du matin et du soir se gagnent en cochant les cases, sur la page des missions
      if (key.startsWith("r:")) { location.hash = "#a-faire"; return; }
      if (doneToday(kid, item.label)) return toast("Déjà fait aujourd'hui ✓ Reviens demain !");
      if (await addEvent(kid, item.points, item.label)) toast(`Bravo ${(kidById(kid) || {}).name} ! +${item.points} points`);
    } else if (d.undo) {
      const last = S.events.filter(x => x.child_id === d.undo).sort((x, y) => y.at - x.at)[0];
      if (last) removeEvent(last.id);
    } else if (d.check) {
      const kid = kidById(d.check);
      if (!b.classList.contains("done") && kid) playPower(b, kid);
      toggleCheck(d.check, d.item);
    } else if (d.bonus) {
      const [kid, part] = d.bonus.split("|"), r = settings().routines[part];
      if (doneToday(kid, r.label)) return toast("Déjà fait aujourd'hui ✓ Reviens demain !");
      if (await addEvent(kid, r.points, r.label)) toast(`Bravo ${(kidById(kid) || {}).name} ! +${r.points} points`);
    } else if (d.unbonus) {
      const [kid, part] = d.unbonus.split("|"), r = settings().routines[part], key = "unbonus|" + kid + "|" + part;
      if (!r) return;
      if (S.confirmKey !== key) return armConfirm(key);
      S.confirmKey = null; clearTimeout(S.confirmTimer);
      const day = dayKey();
      const ev = S.events.filter(x => x.child_id === kid && x.label === r.label && x.points > 0 && dayKey(x.at) === day).sort((x, y) => y.at - x.at)[0];
      if (ev) removeEvent(ev.id); else render();
    } else if (d.buy) {
      const [kid, rid] = d.buy.split("|"), key = "shop|" + kid + "|" + rid;
      if (S.confirmKey !== key) return armConfirm(key);
      S.confirmKey = null;
      const r = S.rewards.find(x => x.id === rid);
      if (!r || total(kid) < r.cost) return render();
      if (await addEvent(kid, -r.cost, r.title)) toast(`Super ! ${r.title} pour ${(kidById(kid) || {}).name} 🎁`);
    } else if (d.year) {
      S.yearShown += Number(d.year); renderWeeks();
    } else if (d.editkid) {
      const k = kidById(d.editkid); if (!k) return;
      S.editingKid = k.id; S.pickedChar = k.character;
      $("#kid-name").value = k.name; $("#kid-goal").value = k.weekly_goal;
      $("#kid-form-title").textContent = "Modifier " + k.name; $("#kid-submit").textContent = "Enregistrer";
      show("#kid-cancel", true); renderCharPicker();
      $("#kid-form").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    } else if (d.delkid) {
      const key = "delkid|" + d.delkid;
      if (S.confirmKey !== key) return armConfirm(key);
      S.confirmKey = null;
      const { error } = await sb.from("children").delete().eq("id", d.delkid);
      if (error) return toast(OOPS);
      await Promise.all([fetchChildren(), fetchEvents()]); render(); toast("Enfant supprimé");
    } else if (d.delrw) {
      const key = "delrw|" + d.delrw;
      if (S.confirmKey !== key) return armConfirm(key);
      S.confirmKey = null;
      const { error } = await sb.from("rewards").delete().eq("id", d.delrw);
      if (error) return toast(OOPS);
      await fetchRewards(); render(); toast("Récompense enlevée");
    }
  });

  // ───────── Onglets ─────────
  const VIEWS = { "#a-faire": "todo", "#catalogue": "shop", "#semaines": "weeks", "#admin": "admin" };
  function showView() {
    let v = VIEWS[location.hash] || "points";
    if (v === "admin" && !isAdmin()) v = "points";
    $$(".view").forEach(el => (el.hidden = el.dataset.view !== v));
    $$(".tab").forEach(t => t.setAttribute("aria-current", t.dataset.view === v ? "page" : "false"));
    if (v === "admin" && S.family && !S.adminFilled) fillAdminForms();
    if (v === "admin" && S.family) sb.from("family_members").select("user_id, role", { count: "exact" }).eq("family_id", S.family.id).then(({ data }) => {
      if (!data) return; const n = data.length, a = data.filter(m => m.role === "admin").length;
      $("#members").textContent = `${n} adulte${n > 1 ? "s" : ""} dans la famille, dont ${a} administrateur${a > 1 ? "s" : ""}.`;
    });
  }
  window.addEventListener("hashchange", showView);

  // ───────── Pouvoirs des personnages ─────────
  const FIST = '<svg class="fist" viewBox="0 0 96 84" aria-hidden="true"><defs><linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9d9b1"/><stop offset=".55" stop-color="#efbd89"/><stop offset="1" stop-color="#c9824b"/></linearGradient></defs>'
    + '<path d="M4 28 C14 20 30 14 46 13 C56 6 72 6 80 14 C92 16 95 30 90 38 C96 46 94 60 84 64 C82 74 68 80 54 76 C40 80 20 74 4 60 Z" fill="url(#skin)" stroke="#5a3520" stroke-width="3.5" stroke-linejoin="round"/>'
    + '<path d="M62 12 C66 22 66 30 62 38 M80 15 C84 24 84 32 80 38 M62 38 C70 40 80 40 90 38 M64 40 C68 48 68 56 64 64 M64 64 C72 66 78 66 84 64" fill="none" stroke="#5a3520" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="M22 54 C34 44 48 44 58 52 C52 60 40 62 30 60" fill="#f3c796" stroke="#5a3520" stroke-width="3" stroke-linejoin="round"/>'
    + '<path d="M50 20 C58 18 66 18 72 20" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" fill="none"/></svg>';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // eslint-disable-next-line no-unsanitized/property -- relu : texte échappé par esc(), nombres, ou catalogue du site
  function overlay(cls, color, html) { const el = document.createElement("div"); el.className = cls; el.style.setProperty("--c", color); if (html != null) el.innerHTML = html; document.body.appendChild(el); return el; }
  function boxCenter(btn) { const r = btn.querySelector(".box").getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
  function sparkBurst(cx, cy, icons, color, els) {
    for (let i = 0; i < 14; i++) {
      const s = overlay("spark", color); s.textContent = icons[i % icons.length]; s.style.left = cx + "px"; s.style.top = cy + "px"; els.push(s);
      const a = Math.PI * 2 * i / 14 + Math.random() * .4, dd = 60 + Math.random() * 70;
      if (s.animate) s.animate([{ transform: "translate(0,0) scale(.4)", opacity: 1 }, { transform: `translate(${Math.cos(a) * dd}px,${Math.sin(a) * dd}px) scale(1.2) rotate(${Math.random() * 360}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" });
    }
  }
  function playPower(btn, kid) {
    if (reduceMotion()) return;
    const c = charOf(kid), { cx, cy } = boxCenter(btn), els = [];
    if (c.power === "arm") {
      const arm = overlay("arm", c.color, '<span class="speed s1"></span><span class="speed s2"></span><span class="speed s3"></span><span class="limb"></span>' + FIST);
      arm.style.top = cy + "px"; arm.style.setProperty("--w", Math.max(60, document.documentElement.clientWidth - cx - 24) + "px");
      const pow = overlay("pow", c.color); pow.textContent = pick(c.words); pow.style.left = cx + "px"; pow.style.top = (cy - 80) + "px";
      els.push(arm, pow);
      return setTimeout(() => els.forEach(x => x.remove()), 2500);
    }
    const sx = Math.min(innerWidth - 70, btn.getBoundingClientRect().right - 60), sy = cy - 70;
    if (c.power === "spell") {
      const wand = overlay("wand", c.color); wand.textContent = "🪄"; wand.style.left = sx + "px"; wand.style.top = sy + "px"; els.push(wand);
      const orb = overlay("orb", c.color); orb.style.left = "0"; orb.style.top = "0"; els.push(orb);
      if (orb.animate) orb.animate([{ transform: `translate(${sx + 8}px,${sy + 8}px) scale(.3)`, opacity: 0 }, { transform: `translate(${sx + 8}px,${sy + 8}px) scale(1)`, opacity: 1, offset: .3 }, { transform: `translate(${(sx + cx) / 2}px,${Math.min(sy, cy) - 60}px) scale(1.2)`, offset: .5 }, { transform: `translate(${cx}px,${cy}px) scale(1.6)`, opacity: 1, offset: .65 }, { transform: `translate(${cx}px,${cy}px) scale(3)`, opacity: 0 }], { duration: 1100, easing: "ease-in-out", fill: "forwards" });
    } else {
      const p = overlay("projectile", c.color); p.textContent = c.fly || c.icon; els.push(p);
      const fromX = innerWidth + 40, fromY = cy - 120;
      if (p.animate) p.animate([{ transform: `translate(${fromX}px,${fromY}px) rotate(0) scale(.8)` }, { transform: `translate(${(fromX + cx) / 2}px,${Math.min(fromY, cy) - 60}px) rotate(${c.spin ? 540 : -15}deg) scale(1.1)`, offset: .45 }, { transform: `translate(${cx}px,${cy}px) rotate(${c.spin ? 1080 : 0}deg) scale(1.3)`, offset: .7 }, { transform: `translate(${cx}px,${cy}px) scale(0)`, opacity: 0 }], { duration: 1100, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
    }
    setTimeout(() => sparkBurst(cx, cy, c.sparks || ["✨", "⭐"], c.color, els), 700);
    const w = overlay("spell", c.color); w.textContent = pick(c.words); w.style.left = Math.min(innerWidth - 80, cx + 60) + "px"; w.style.top = cy + "px"; els.push(w);
    setTimeout(() => els.forEach(x => x.remove()), 2100);
  }

  // ───────── Démarrage ─────────
  setAuthMode("login");
  sb.auth.getSession().then(({ data }) => { if (!S.recovering) handleSession(data.session); });
})();
