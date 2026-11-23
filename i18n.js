// Langues du site : français, anglais, espagnol, italien, allemand, vietnamien, chinois, japonais et arabe.
// Par défaut, la langue de l'appareil (anglais si elle n'est pas proposée) ;
// le menu des langues en haut de la page la change, et le choix reste sur l'appareil.
// Les textes du site sont écrits en français ; chaque fichier langues/<code>.js donne leur traduction.
// Ce que les familles écrivent (prénoms, missions, récompenses) n'est jamais traduit,
// sauf les missions et récompenses de départ proposées par le site (defauts).
(function () {
  "use strict";
  const KEY = "points-lang";
  const LANGUES = window.LANGUES || {};
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const connue = c => c === "fr" || has(LANGUES, c);

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* stockage indisponible */ }
  // Langue de l'appareil : la première de ses langues que le site connaît (« es-MX » → « es »).
  const systeme = () => {
    const liste = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "fr"];
    for (const l of liste) { const c = String(l).slice(0, 2).toLowerCase(); if (connue(c)) return c; }
    return "en";
  };
  const lang = saved && connue(saved) ? saved : systeme();

  // fr : pas de traduction (les textes sont déjà en français).
  const D = lang === "fr" ? null : LANGUES[lang];
  const TEXTES = D ? D.textes : {}, DEFAUTS = D ? D.defauts : {}, PERSOS = D ? D.personnages : {};
  const RETOUR = {};
  Object.keys(DEFAUTS).forEach(k => { RETOUR[DEFAUTS[k]] = k; });
  const rtl = Boolean(D && D.dir === "rtl");

  // t("Bravo {name} !", { name }) : le texte dans la langue choisie, avec les valeurs mises à leur place.
  function t(s, v) {
    const r = has(TEXTES, s) ? TEXTES[s] : s;
    return v ? r.replace(/\{(\w+)\}/g, (m, k) => (has(v, k) ? String(v[k]) : m)) : r;
  }
  // Affichage d'un texte de la famille : seules les valeurs de départ du site sont traduites.
  const shown = s => (typeof s === "string" && has(DEFAUTS, s) ? DEFAUTS[s] : s);
  // Pour l'enregistrement : une valeur de départ affichée traduite redevient l'originale (en français).
  const raw = s => (typeof s === "string" && has(RETOUR, s) ? RETOUR[s] : s);

  // Traduit les textes fixes de la page (index.html), une seule fois au chargement.
  function translatePage() {
    const html = document.documentElement;
    html.lang = D ? D.htmlLang || lang : "fr";
    html.dir = rtl ? "rtl" : "ltr";
    document.title = t(document.title);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t(desc.getAttribute("content")));
    if (!D) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.nodeValue.trim();
      if (s && has(TEXTES, s)) n.nodeValue = n.nodeValue.replace(s, TEXTES[s]);
    }
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => {
      ["placeholder", "aria-label", "title"].forEach(a => { const v = el.getAttribute(a); if (v && has(TEXTES, v)) el.setAttribute(a, TEXTES[v]); });
    });
  }

  // Menu des langues : un bouton (drapeau de la langue choisie) qui ouvre la liste des langues.
  // La langue choisie est gardée sur l'appareil, puis la page se recharge dans cette langue.
  function wireMenu() {
    const btn = document.getElementById("lang-btn"), menu = document.getElementById("lang-menu");
    if (!btn || !menu) return;
    const items = Array.from(menu.querySelectorAll("[data-lang]"));
    const actuel = items.find(b => b.dataset.lang === lang) || items[0];
    const cur = document.getElementById("lang-cur");
    cur.replaceChildren(actuel.querySelector("svg").cloneNode(true));
    const code = document.createElement("b");
    code.textContent = lang.toUpperCase();
    cur.appendChild(code);
    const nom = t("Langue") + " : " + actuel.textContent.trim();
    btn.setAttribute("aria-label", nom);
    btn.title = nom;
    const ouvrir = oui => {
      menu.hidden = !oui;
      btn.setAttribute("aria-expanded", String(oui));
      if (oui) actuel.focus();
    };
    btn.addEventListener("click", () => ouvrir(menu.hidden));
    document.addEventListener("click", e => { if (!menu.hidden && !e.target.closest(".lang")) ouvrir(false); });
    menu.addEventListener("keydown", e => {
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { ouvrir(false); btn.focus(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      } else if (e.key === "Tab") ouvrir(false);
    });
    items.forEach(b => {
      b.setAttribute("aria-checked", String(b === actuel));
      b.addEventListener("click", () => {
        if (b === actuel) { ouvrir(false); return; }
        try { localStorage.setItem(KEY, b.dataset.lang); } catch { /* stockage indisponible */ }
        location.reload();
      });
    });
  }

  window.I18N = {
    lang, t, shown, raw,
    dir: rtl ? "rtl" : "ltr",
    locale: D ? D.locale : "fr-FR",
    months: D ? D.mois : ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."],
    days: D ? D.jours : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    // Personnage dans la langue choisie (nom, pouvoir, mots qui s'affichent).
    char: c => (c && has(PERSOS, c.id) ? Object.assign({}, c, PERSOS[c.id]) : c)
  };
  translatePage();
  wireMenu();
})();
