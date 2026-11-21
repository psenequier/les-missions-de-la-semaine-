// Test des écrans avec un faux Supabase (tests/ui/mock.js) :
// connexion, famille, enfant, points, super admin, et aucune injection de code exécutée.
// Lancement : node tests/ui/interface.mjs (depuis la racine du dépôt)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

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
const p = await navigateur.newPage({ viewport: { width: 1000, height: 1300 } });
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
verifier(await p.inputValue("#rate") === "0.1143", "par défaut, 70 points valent 8 € (0,1143 € par point)");
await vue("#points");
await p.click('[data-earn$="|t:0"]'); await attendre(300);
verifier((await p.textContent(".kid .total b")).trim() === "2", "« Chambre rangée » donne 2 points");
verifier(await p.isDisabled('[data-earn$="|t:0"]'), "« Chambre rangée » ne se donne qu'une fois par jour");
await p.click('[data-earn$="|r:soir"]'); await attendre(300);
verifier(await p.isVisible("#todo-kids"), "les missions du soir se gagnent sur la page des missions");
const cases = await p.locator('.kid [data-item^="soir:"]').count();
for (let i = 0; i < cases; i++) { await p.locator('.kid [data-item^="soir:"]:not(.done)').first().click(); await attendre(1200); }
await p.click('[data-bonus$="|soir"]'); await attendre(300);
await vue("#points");
verifier((await p.textContent(".kid .total b")).trim() === "5", "les missions du soir cochées donnent 3 points de plus");
verifier(await p.isDisabled('[data-earn$="|r:soir"]'), "les missions du soir sont marquées « fait aujourd'hui » sur Mes points");
await vue("#a-faire");
await p.click('[data-unbonus$="|soir"]'); await attendre(200);
verifier(await p.isVisible('[data-unbonus$="|soir"].confirm'), "annuler les missions du soir demande une confirmation");
await p.click('[data-unbonus$="|soir"]'); await attendre(300);
verifier(await p.isVisible('[data-bonus$="|soir"]'), "après annulation, le bouton pour prendre les points revient");
await vue("#points");
verifier((await p.textContent(".kid .total b")).trim() === "2", "annuler les missions du soir retire les 3 points");

await p.click("#super-btn"); await attendre(400);
verifier(await p.locator("#super-list tbody tr").count() === 2, "le super admin voit les 2 familles");
await p.click('[data-visit="fx"]'); await attendre(500);
verifier(await p.isVisible("#visit"), "le bandeau « mode super admin » s'affiche");
for (const h of ["#points", "#a-faire", "#catalogue", "#semaines", "#admin"]) await vue(h);
await p.click("#visit-leave"); await attendre(500);
verifier((await p.textContent("#title")) === "Famille Test" && await p.isHidden("#visit"), "retour à sa propre famille");

await p.click("#salon-btn"); await attendre(200);
verifier(await p.evaluate(() => document.body.classList.contains("salon")), "le mode salon s'allume");
await p.click("#salon-btn"); await attendre(200);
verifier(await p.evaluate(() => !document.body.classList.contains("salon")), "le mode salon s'éteint");

verifier(await p.evaluate(() => window.__xss) === undefined, "aucun texte piégé n'a exécuté de code");
verifier(await p.locator("img").count() === 0, "aucune balise injectée dans la page");
verifier(erreurs.length === 0, "aucune erreur JavaScript" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));

await navigateur.close(); serveur.close();
if (echecs.length) { console.log(`::error title=Interface::${echecs.join(" ; ")}`); process.exit(1); }
