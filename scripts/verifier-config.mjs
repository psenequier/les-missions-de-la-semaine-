// Vérifie qu'aucune clé secrète Supabase n'est dans le site.
// Le site est public : seule la clé « publishable » (ou l'ancienne clé « anon ») peut y être.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const erreurs = [];
const fichiers = [];
(function parcourir(dossier) {
  for (const nom of readdirSync(dossier)) {
    if ([".git", "node_modules"].includes(nom)) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (/\.(js|mjs|html|json|sql|md|yml|yaml|toml)$/.test(nom)) fichiers.push(chemin);
  }
})(".");

for (const f of fichiers) {
  if (f.endsWith("verifier-config.mjs")) continue;
  const texte = readFileSync(f, "utf8");
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(texte)) erreurs.push(`${f} : clé secrète Supabase (sb_secret_…)`);
  // Anciennes clés JWT : on lit le rôle inscrit dedans.
  for (const jwt of texte.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try {
      const role = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).role;
      if (role !== "anon") erreurs.push(`${f} : jeton Supabase avec le rôle « ${role} »`);
    } catch { /* pas un jeton Supabase */ }
  }
}

const config = readFileSync("config.js", "utf8");
if (/service_role\s*[:=]|serviceRole/i.test(config.replace(/\/\/.*$/gm, ""))) erreurs.push("config.js : une clé service_role est déclarée");
const cle = (config.match(/supabaseAnonKey:\s*"([^"]*)"/) || [])[1] || "";
if (cle && !/^(sb_publishable_|eyJ|COLLER)/.test(cle)) erreurs.push("config.js : la clé n'est pas une clé publique Supabase");
const url = (config.match(/supabaseUrl:\s*"([^"]*)"/) || [])[1] || "";
if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co$|^COLLER/.test(url)) erreurs.push("config.js : l'adresse Supabase doit être en https://<projet>.supabase.co");

const kofi = (config.match(/kofi:\s*"([^"]*)"/) || [])[1] || "";
if (kofi && !/^https:\/\/ko-fi\.com\/[A-Za-z0-9_]{1,64}\/?$/.test(kofi)) erreurs.push("config.js : le lien de dons doit être en https://ko-fi.com/<pseudo>");

if (erreurs.length) {
  for (const e of erreurs) console.log(`::error title=Clé Supabase::${e}`);
  process.exit(1);
}
console.log(`Aucune clé secrète dans ${fichiers.length} fichiers ; config.js ne contient que la clé publique.`);
