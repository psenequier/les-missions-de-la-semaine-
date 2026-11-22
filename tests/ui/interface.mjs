// Test des écrans avec un faux Supabase (tests/ui/mock.js) :
// connexion, famille, enfant, points, super admin, et aucune injection de code exécutée.
// Lancement : node tests/ui/interface.mjs (depuis la racine du dépôt)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { suivre, ecrire } from "./couverture.mjs";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const racine = process.cwd();
const serveur = createServer(async (req, res) => {
  const chemin = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (chemin.startsWith("..")) { res.writeHead(403).end(); return; }
  try {
    let corps = await readFile(join(racine, chemin || "index.html"));
    if (chemin === "index.html" || chemin === "") {
      corps = corps.toString().replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]*><\/script>/, '<script src="tests/ui/mock.js"></script>');
    }
    res.writeHead(200, { "content-type": TYPES[extname(chemin || ".html")] || "application/octet-stream" }).end(corps);
  } catch { res.writeHead(404).end(); }
}).listen(0, "127.0.0.1");
await new Promise(r => serveur.once("listening", r));
const U = `http://127.0.0.1:${serveur.address().port}/index.html`;

const echecs = [];
const verifier = (ok, quoi) => { console.log(`${ok ? "OK" : "ÉCHEC"} : ${quoi}`); if (!ok) echecs.push(quoi); };

const navigateur = await chromium.launch();
// Appareil réglé en français : le site s'affiche en français (la version anglaise est testée plus bas).
const p = await navigateur.newPage({ viewport: { width: 1000, height: 1300 }, locale: "fr-FR" });
const finP = await suivre(p);
const erreurs = [];
p.on("pageerror", e => erreurs.push(e.message));
p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erreurs.push(m.text()); });
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const attendre = ms => p.waitForTimeout(ms);
const vue = async h => { await p.evaluate(x => (location.hash = x), h); await attendre(250); };

await p.goto(U); await attendre(300);
verifier(await p.isVisible("#auth"), "l'écran de connexion s'affiche d'abord");
await p.fill("#auth-email", "parent@exemple.test"); await p.fill("#auth-password", "motdepasse"); await p.click("#auth-submit"); await attendre(400);
verifier(await p.isVisible("#onboard"), "après connexion : créer ou rejoindre une famille");
await p.fill("#create-name", "Famille Test"); await p.click("#create-form button"); await attendre(600);
await p.fill("#kid-name", "Enfant 1"); await p.click('[data-char="pirate"]'); await p.click("#kid-submit"); await attendre(300);
await vue("#catalogue");
verifier(await p.locator("#shop-items .item").count() === 3, "une nouvelle famille a le catalogue de départ (3 récompenses)");
await vue("#admin");
verifier(await p.inputValue("#rate") === "8", "par défaut, le budget maximum est de 8 € par semaine et par enfant");
verifier((await p.textContent("#rate-info")).includes("98 points"), "avec les poids 2, 3, 2 et 3, le site calcule 98 points par semaine (environ 100)");
verifier((await p.textContent("#rate-info")).includes("0,08"), "8 € pour 98 points : 1 point vaut environ 0,08 €");
await p.fill("#rw-title", "Une glace"); await p.fill("#rw-price", "3"); await attendre(100);
verifier((await p.textContent("#rw-points")).includes("37 points"), "une récompense à 3 € vaut 37 points (3 € ÷ 0,08 €)");
await p.click("#reward-form button[type=submit]"); await attendre(400);
verifier(await p.evaluate(() => window.__db.rewards.some(r => r.title === "Une glace" && r.cost === 37)), "la récompense est enregistrée à 37 points");
verifier((await p.textContent("#admin-rewards")).includes("37 points (≈ 3,00"), "la liste montre les points et leur prix en euros");
await p.fill("#rate", "16"); await p.click("#rate-form button[type=submit]"); await attendre(400);
verifier((await p.textContent("#admin-rewards")).includes("18 points (≈ 3,00"), "budget doublé : la glace à 3 € passe à 18 points");
await vue("#catalogue");
verifier((await p.textContent("#shop-items")).includes("18 points"), "le catalogue des enfants suit le nouveau prix en points");
await vue("#admin");
await p.fill("#rate", "8"); await p.click("#rate-form button[type=submit]"); await attendre(400);
await vue("#points");
await p.click('[data-earn$="|t:0"]'); await attendre(300);
verifier((await p.textContent(".kid .total b")).trim() === "3", "« Chambre rangée » (poids 2) donne 3 points");
verifier(await p.isDisabled('[data-earn$="|t:0"]'), "« Chambre rangée » ne se donne qu'une fois par jour");
await p.click('[data-earn$="|r:soir"]'); await attendre(300);
verifier(await p.isVisible("#todo-kids"), "les missions du soir se gagnent sur la page des missions");
const cases = await p.locator('.kid [data-item^="soir:"]').count();
for (let i = 0; i < cases; i++) { await p.locator('.kid [data-item^="soir:"]:not(.done)').first().click(); await attendre(1200); }
await p.click('[data-bonus$="|soir"]'); await attendre(300);
await vue("#points");
verifier((await p.textContent(".kid .total b")).trim() === "7", "les missions du soir cochées (poids 3) donnent 4 points de plus");
verifier(await p.isDisabled('[data-earn$="|r:soir"]'), "les missions du soir sont marquées « fait aujourd'hui » sur Mes points");
await vue("#a-faire");
await p.click('[data-unbonus$="|soir"]'); await attendre(200);
verifier(await p.isVisible('[data-unbonus$="|soir"].confirm'), "annuler les missions du soir demande une confirmation");
await p.click('[data-unbonus$="|soir"]'); await attendre(300);
verifier(await p.isVisible('[data-bonus$="|soir"]'), "après annulation, le bouton pour prendre les points revient");
await vue("#points");
verifier((await p.textContent(".kid .total b")).trim() === "3", "annuler les missions du soir retire les 4 points");

// Semaines terminées : leurs points et leur résultat ne changent plus
await vue("#admin");
await p.fill("#kid-name", "Enfant 2"); await p.click('[data-char="pirate"]'); await p.click("#kid-submit"); await attendre(300);
await p.evaluate(() => {
  const db = window.__db, k = db.children.find(c => c.name === "Enfant 2"), d = new Date();
  d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 3);  // jeudi de la semaine dernière
  db.events.push({ id: "vieux", family_id: k.family_id, child_id: k.id, points: 6, label: "Chambre rangée", created_at: d.toISOString() });
});
await p.click("#reset-btn"); await attendre(100);
verifier((await p.textContent("#reset-btn")).includes("cette semaine"), "remettre à zéro demande une confirmation et parle de la semaine en cours");
await p.click("#reset-btn"); await attendre(400);
const k2 = await p.evaluate(() => window.__db.children.find(c => c.name === "Enfant 2").id);
await vue("#points");
verifier((await p.locator("#kids .kid .total b").nth(0).textContent()).trim() === "0", "la remise à zéro efface les points de la semaine en cours");
verifier((await p.locator("#kids .kid .total b").nth(1).textContent()).trim() === "6", "la remise à zéro garde les points des semaines terminées");
verifier(await p.isDisabled(`[data-undo="${k2}"]`) && (await p.textContent(`[data-undo="${k2}"]`)).includes("🔒"), "« Annuler le dernier » ne touche pas une semaine terminée");
await vue("#semaines");
verifier((await p.textContent("#wk-past")).includes("6 pts"), "les semaines terminées gardent leurs points");
verifier(!/objectif/i.test(await p.textContent("#app")), "plus d'objectif de la semaine nulle part");
await vue("#admin");
verifier(await p.locator("#kid-goal").count() === 0 && !(await p.textContent("#report thead")).includes("Objectif"), "plus de case ni de colonne « Objectif » dans l'administration");
await vue("#points");

verifier(await p.isHidden("#super-btn") && await p.isHidden("#logout") && await p.isHidden("#logout-top"), "en haut, plus de boutons super admin, salon ni déconnexion pour un administrateur");
await vue("#admin");
verifier(await p.isVisible("#super-btn") && await p.isVisible("#salon-btn") && await p.isVisible("#logout"), "les boutons du compte sont dans l'onglet Administration");
await p.click("#super-btn"); await attendre(400);
verifier(await p.locator("#super-list tbody tr").count() === 2, "le super admin voit les 2 familles");
await p.click('[data-visit="fx"]'); await attendre(500);
verifier(await p.isVisible("#visit"), "le bandeau « mode super admin » s'affiche");
await vue("#admin");
verifier(await p.isHidden("#family-out") && await p.isHidden("#leave-top"), "en visite, le super admin ne peut ni quitter ni supprimer la famille");
for (const h of ["#points", "#a-faire", "#catalogue", "#semaines", "#admin"]) await vue(h);
await p.click("#visit-leave"); await attendre(500);
verifier((await p.textContent("#title")) === "Famille Test" && await p.isHidden("#visit"), "retour à sa propre famille");

await vue("#admin");
await p.click("#salon-btn"); await attendre(200);
verifier(await p.evaluate(() => document.body.classList.contains("salon")), "le mode salon s'allume");
await p.click("#salon-btn"); await attendre(200);
verifier(await p.evaluate(() => !document.body.classList.contains("salon")), "le mode salon s'éteint");

verifier(await p.isVisible("#don-card"), "le lien Ko-fi de config.js affiche le bouton « Soutenir le site »");

// Bouton de don : on change le lien Ko-fi de config.js pour cette page seulement.
async function pageDon(lien) {
  const q = await navigateur.newPage({ viewport: { width: 1000, height: 1300 }, locale: "fr-FR" });
  await suivre(q);
  await q.route(u => ["fonts.googleapis.com", "fonts.gstatic.com"].includes(u.hostname), r => r.abort());
  await q.route(u => u.origin === new URL(U).origin && u.pathname === "/config.js", async r => {
    const corps = await readFile(join(racine, "config.js"), "utf8");
    await r.fulfill({ contentType: "text/javascript", body: corps.replace(/kofi:\s*"[^"]*"/, `kofi: ${JSON.stringify(lien)}`) });
  });
  await q.goto(U); await q.waitForTimeout(300);
  await q.fill("#auth-email", "parent@exemple.test"); await q.fill("#auth-password", "motdepasse"); await q.click("#auth-submit"); await q.waitForTimeout(400);
  await q.fill("#create-name", "Famille Don"); await q.click("#create-form button"); await q.waitForTimeout(600);
  await q.evaluate(() => (location.hash = "#admin")); await q.waitForTimeout(250);
  return q;
}
let q = await pageDon("https://ko-fi.com/essai_1");
verifier(await q.isVisible("#don-card"), "avec un lien Ko-fi, le bouton « Soutenir le site » s'affiche dans l'administration");
verifier(await q.getAttribute("#don-link", "href") === "https://ko-fi.com/essai_1", "le bouton mène à la page Ko-fi");
verifier(await q.getAttribute("#don-link", "rel") === "noopener noreferrer" && await q.getAttribute("#don-link", "target") === "_blank", "la page Ko-fi s'ouvre à part, sans accès au site");
await q.evaluate(() => (location.hash = "#points")); await q.waitForTimeout(250);
verifier(await q.isHidden("#don-card"), "la carte de don de l'administration n'est pas sur « Mes points »");
verifier(await q.isVisible("#don-pill") && await q.getAttribute("#don-pill", "href") === "https://ko-fi.com/essai_1", "« Soutenir Basile » est en haut de « Mes points » et mène à Ko-fi");
const boite = await q.locator("#don-pill").boundingBox();
verifier(boite && boite.x > 600, "« Soutenir Basile » est à droite");
const place = await q.evaluate(() => {
  const pill = document.querySelector("#don-pill").getBoundingClientRect(), tabs = document.querySelector(".tabs").getBoundingClientRect();
  return { enTete: !!document.querySelector("#don-pill").closest(".head"), auDessus: pill.bottom <= tabs.top };
});
verifier(place.enTete && place.auDessus, "« Soutenir Basile » est dans l'en-tête, au-dessus des onglets, sans chevaucher les cartes");
await q.evaluate(() => (location.hash = "#catalogue")); await q.waitForTimeout(250);
verifier(await q.isHidden("#don-pill"), "« Soutenir Basile » n'est que sur « Mes points »");
await q.close();
// Quitter / supprimer la famille : deux appuis, puis retour au choix « Créer » ou « Rejoindre »
q = await pageDon("");
verifier(await q.isVisible("#family-out") && await q.isHidden("#leave-top"), "l'administrateur quitte ou supprime la famille depuis l'administration");
await q.click("#delete-fam-btn"); await q.waitForTimeout(200);
verifier(await q.isVisible("#app") && (await q.textContent("#delete-fam-btn")).includes("Sûr"), "supprimer la famille demande une confirmation");
await q.click("#delete-fam-btn"); await q.waitForTimeout(600);
verifier(await q.isVisible("#onboard") && await q.evaluate(() => !window.__db.families.some(f => f.name === "Famille Don")), "après suppression, retour au choix créer ou rejoindre");
await q.fill("#create-name", "Famille Bis"); await q.click("#create-form button"); await q.waitForTimeout(600);
await q.evaluate(() => (location.hash = "#admin")); await q.waitForTimeout(250);
await q.click("#leave-btn"); await q.waitForTimeout(200); await q.click("#leave-btn"); await q.waitForTimeout(600);
verifier(await q.isVisible("#onboard"), "le seul adulte qui quitte la famille revient au choix créer ou rejoindre");
await q.close();
q = await pageDon("");
verifier(await q.isHidden("#don-card") && await q.isHidden("#don-pill"), "sans lien Ko-fi dans config.js, pas de bouton de don");
await q.close();
for (const mauvais of ["javascript:alert(1)", "https://ko-fi.com.exemple.test/x", "http://ko-fi.com/x"]) {
  q = await pageDon(mauvais);
  verifier(await q.isHidden("#don-card"), `un lien qui n'est pas une page Ko-fi est refusé (${mauvais})`);
  await q.close();
}

// Langue : par défaut celle de l'appareil, puis les drapeaux, et le choix reste sur l'appareil.
verifier(await p.evaluate(() => document.documentElement.lang) === "fr" && await p.getAttribute('[data-lang="fr"]', "aria-pressed") === "true", "appareil en français : site en français, drapeau 🇫🇷 choisi");
const ctxEn = await navigateur.newContext({ viewport: { width: 1000, height: 1300 }, locale: "en-US" });
const e = await ctxEn.newPage();
const finE = await suivre(e);
e.on("pageerror", x => erreurs.push(x.message));
await e.route(u => ["fonts.googleapis.com", "fonts.gstatic.com"].includes(u.hostname), r => r.abort());
await e.goto(U); await e.waitForTimeout(300);
verifier(await e.evaluate(() => document.documentElement.lang) === "en" && (await e.textContent("#auth-submit")).trim() === "Log in", "appareil en anglais : site en anglais par défaut");
await e.fill("#auth-email", "parent@exemple.test"); await e.fill("#auth-password", "motdepasse"); await e.click("#auth-submit"); await e.waitForTimeout(400);
await e.fill("#create-name", "The Smiths"); await e.click("#create-form button"); await e.waitForTimeout(600);
await e.fill("#kid-name", "Sam"); await e.click('[data-char="dragon"]'); await e.click("#kid-submit"); await e.waitForTimeout(300);
verifier((await e.textContent("#admin-kids")).includes("Little dragon"), "les personnages ont leur nom en anglais");
verifier((await e.textContent("#rate-info")).includes("€0.08"), "les sommes sont écrites à l'anglaise (€0.08)");
verifier((await e.inputValue("#m-matin-items")).startsWith("Get dressed"), "les missions de départ du site s'affichent en anglais");
await e.click("#missions-form > .btn"); await e.waitForTimeout(300);
verifier(await e.evaluate(() => window.__db.families.at(-1).settings.routines.matin.items[0]) === "M'habiller", "enregistrées depuis l'anglais, les missions de départ restent les mêmes dans la base");
await e.evaluate(() => (location.hash = "#points")); await e.waitForTimeout(250);
verifier((await e.textContent(".kid")).includes("Tidy bedroom") && (await e.textContent(".tabs")).includes("ON THE HUNT FOR POINTS"), "page des points en anglais");
verifier((await e.textContent("#don-pill")).trim() === "💛 Support Basile", "« Soutenir Basile » est traduit en anglais");
await e.click('[data-earn$="|t:0"]'); await e.waitForTimeout(300);
verifier((await e.textContent(".kid .total b")).trim() === "3" && await e.isDisabled('[data-earn$="|t:0"]'), "en anglais, les points se gagnent pareil, une fois par jour");
await e.evaluate(() => (location.hash = "#catalogue")); await e.waitForTimeout(250);
verifier((await e.textContent("#shop-items")).includes("A big book"), "le catalogue de départ s'affiche en anglais");
for (const h of ["#a-faire", "#semaines", "#admin"]) { await e.evaluate(x => (location.hash = x), h); await e.waitForTimeout(250); }
// Aucun texte du site resté en français sur les pages en anglais (les textes des familles mis à part).
const francais = await e.evaluate(() => {
  const restes = [], mots = /\b(Ajouter|Enregistrer|enfants?|semaine|Annuler|récompense|famille|Gagner|aujourd'hui|Supprimer|Modifier|Pas encore|Mon compte|Se connecter|Rien)\b/i;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.nodeValue.trim(); if (s && mots.test(s) && !/Smiths/.test(s)) restes.push(s); }
  document.querySelectorAll("[placeholder],[aria-label]").forEach(el => ["placeholder", "aria-label"].forEach(a => { const v = el.getAttribute(a); if (v && mots.test(v)) restes.push(v); }));
  return restes;
});
verifier(francais.length === 0, "aucun texte resté en français" + (francais.length ? " : " + francais.join(" | ") : ""));
await e.click('[data-lang="fr"]'); await e.waitForTimeout(600);
verifier(await e.evaluate(() => document.documentElement.lang) === "fr" && (await e.textContent("#tab-admin")).includes("Administration"), "le drapeau 🇫🇷 remet le site en français");
await e.reload(); await e.waitForTimeout(600);
verifier(await e.evaluate(() => document.documentElement.lang) === "fr" && await e.evaluate(() => localStorage.getItem("points-lang")) === "fr", "le choix de la langue reste sur l'appareil, même si l'appareil est en anglais");
await finE(); await ctxEn.close();

verifier(await p.evaluate(() => window.__xss) === undefined, "aucun texte piégé n'a exécuté de code");
verifier(await p.locator("img").count() === 0, "aucune balise injectée dans la page");
await p.evaluate(() => (location.hash = "#points")); await p.waitForTimeout(250);
verifier(await p.evaluate(() => !document.querySelector("[data-style]")), "tous les styles des cartes sont posés par JavaScript (la CSP refuse les attributs style)");
verifier(await p.evaluate(() => document.querySelectorAll(".kid").length > 0 && [...document.querySelectorAll(".kid")].every(k => k.style.getPropertyValue("--c"))), "chaque carte d'enfant a la couleur de son personnage");
verifier(erreurs.length === 0, "aucune erreur JavaScript" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));

await finP();
for (const ligne of await ecrire()) console.log(`Couverture : ${ligne}`);
await navigateur.close(); serveur.close();
if (echecs.length) { console.log(`::error title=Interface::${echecs.join(" ; ")}`); process.exit(1); }
