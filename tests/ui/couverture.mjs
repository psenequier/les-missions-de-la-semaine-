// Couverture du code du site pendant les tests d'interface (pour SonarCloud).
// Chromium compte combien de fois chaque bloc de code a tourné ; on en déduit, ligne par ligne,
// si la ligne a été exécutée, et on écrit coverage/lcov.info (format lu par SonarCloud).
import { mkdir, writeFile } from "node:fs/promises";

const FICHIERS = ["app.js", "characters.js", "i18n.js"]; // le code du site (config.js n'a que des réglages)
const releves = [];

// À appeler juste après la création d'une page : le relevé est récupéré avant sa fermeture.
export async function suivre(page) {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  const fermer = page.close.bind(page);
  let fini = false;
  const arreter = async () => { if (!fini) { fini = true; releves.push(...await page.coverage.stopJSCoverage()); } };
  page.close = async opts => { await arreter(); return fermer(opts); };
  return arreter;
}

// Compte d'exécution de la ligne : celui du plus petit bloc qui contient son premier caractère.
function comptesParLigne(source, fonctions) {
  const blocs = fonctions.flatMap(f => f.ranges).sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
  const comptes = new Map();
  let debut = 0;
  source.split("\n").forEach((ligne, i) => {
    const texte = ligne.trim();
    if (texte && !texte.startsWith("//")) {
      const pos = debut + ligne.indexOf(texte[0]);
      let n = 0;
      for (const b of blocs) if (b.startOffset <= pos && pos < b.endOffset) n = b.count; // les plus petits blocs en dernier
      comptes.set(i + 1, n);
    }
    debut += ligne.length + 1;
  });
  return comptes;
}

export async function ecrire(chemin = "coverage/lcov.info") {
  const total = new Map(FICHIERS.map(f => [f, new Map()]));
  for (const r of releves) {
    const nom = new URL(r.url, "http://x").pathname.replace(/^\//, "");
    if (!total.has(nom) || !r.source) continue;
    const t = total.get(nom);
    for (const [ligne, n] of comptesParLigne(r.source, r.functions)) t.set(ligne, (t.get(ligne) || 0) + n);
  }
  let lcov = "";
  for (const [nom, lignes] of total) {
    if (!lignes.size) continue;
    const da = [...lignes].sort((a, b) => a[0] - b[0]);
    lcov += `SF:${nom}\n${da.map(([l, n]) => `DA:${l},${n}`).join("\n")}\nLF:${da.length}\nLH:${da.filter(([, n]) => n > 0).length}\nend_of_record\n`;
  }
  await mkdir(chemin.replace(/\/[^/]*$/, ""), { recursive: true });
  await writeFile(chemin, lcov);
  return [...total].map(([nom, l]) => {
    const vus = [...l.values()].filter(n => n > 0).length;
    return `${nom} : ${l.size ? Math.round(100 * vus / l.size) : 0} % des lignes exécutées`;
  });
}
