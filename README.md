# Points en famille

Site où chaque famille suit les points de ses enfants : missions du matin et du soir, récompenses, semaines et année.
Chaque famille a ses propres données : la base refuse à une famille de lire ou de modifier celles d'une autre.

- Site statique (HTML, CSS, JavaScript), publié avec GitHub Pages.
- Comptes et base de données : Supabase (offre gratuite).

## Mise en route

1. **Supabase** : créer un projet sur https://supabase.com.
2. **Base de données** : dans Supabase, *SQL Editor* → *New query*, coller tout le contenu de `supabase/schema.sql`, puis *Run*.
3. **Adresse du site** : dans Supabase, *Authentication* → *URL Configuration*, mettre l'adresse GitHub Pages du site
   (par exemple `https://psenequier.github.io/les-missions-de-la-semaine-/`) dans *Site URL* et dans *Redirect URLs*.
   Sinon, les liens de confirmation et de mot de passe oublié ne ramènent pas au site.
4. **Clés** : dans `config.js`, remplacer l'URL du projet et la clé *anon public* (Supabase → *Project Settings* → *API*).
   Ne jamais y mettre la clé *service_role*.
5. **Publication** : sur GitHub, *Settings* → *Pages* → *Deploy from a branch* → `main`, dossier `/ (root)`.

6. **Super admin** (facultatif) : pour qu'un compte voie toutes les familles, dans *SQL Editor* :
   ```sql
   insert into public.super_admins (user_id)
   select id from auth.users where email = 'ton.adresse@exemple.fr'
   on conflict do nothing;
   ```
   Le compte doit déjà exister (créé sur le site). Le bouton « 🛡️ Super admin » apparaît dans ⚙️ Administration à la connexion suivante.
   Si `schema.sql` a été lancé avant l'ajout du super admin, lancer d'abord `supabase/super-admin.sql`.

## Utilisation

1. Créer un compte (e-mail et mot de passe), puis confirmer l'adresse avec le lien reçu.
2. Créer sa famille : on en devient l'administrateur.
3. Dans **⚙️ Administration** : ajouter les enfants et leur personnage, régler les missions et leur poids (le site répartit environ 100 points par semaine et par enfant), les récompenses et le budget maximum par semaine et par enfant (8 € par défaut).
4. Un autre adulte peut rejoindre la famille avec le **code d'invitation** affiché dans l'administration.

## Sur téléphone et tablette

- Sur téléphone, les pages sont dans une barre en bas de l'écran.
- **Ajouter à l'écran d'accueil** (menu Partager sur iPhone et iPad, menu ⋮ sur Android) : le site s'ouvre alors comme une application, en plein écran.
- **📺 Mode salon** (dans ⚙️ Administration, carte « Mon compte et cet écran ») : pour une tablette posée dans le salon. L'écran reste allumé, et après 3 minutes sans toucher, la page revient sur « Mes points ». Le mode reste activé après un rechargement. Les points notés sur un autre appareil arrivent tout seuls, et la page des missions repart à zéro à minuit.
- La tablette doit rester branchée. Si son navigateur ne sait pas garder l'écran allumé (vieux iPad), régler sa mise en veille sur « Jamais ».

## Langues (français et anglais)

Le site existe en français et en anglais. Par défaut, il prend la langue de l'appareil : français si le téléphone, la tablette ou l'ordinateur est réglé en français, anglais sinon.
Les drapeaux 🇫🇷 et 🇬🇧 en haut de la page changent la langue ; le choix reste sur cet appareil.

Les textes du site sont dans `i18n.js`. Ce que les familles écrivent (prénoms, missions, récompenses) n'est pas traduit, sauf les missions et le catalogue de départ proposés par le site, qui s'affichent dans la langue choisie.

## Dons (Ko-fi)

Le site est gratuit. Pour recevoir des dons, créer une page sur [ko-fi.com](https://ko-fi.com), puis mettre son adresse dans `config.js` :

```js
kofi: "https://ko-fi.com/monpseudo"
```

Un bouton « 💛 Soutenir le site » apparaît alors dans l'onglet Administration (les parents seulement, jamais sur les pages des enfants). C'est un simple lien : aucun script de Ko-fi n'est chargé sur le site. Laisser `kofi: ""` cache le bouton.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | les écrans |
| `style.css` | l'apparence |
| `app.js` | la logique (connexion, familles, points, rapport) |
| `manifest.webmanifest`, `icone-*.png` | installation sur l'écran d'accueil |
| `characters.js` | le catalogue des personnages et leurs pouvoirs |
| `i18n.js` | les langues : textes en anglais, choix de la langue, drapeaux |
| `config.js` | l'adresse et la clé publique Supabase, et le lien Ko-fi (facultatif) |
| `supabase/schema.sql` | tables et règles de séparation des familles |
| `supabase/catalogue-depart.sql` | catalogue de départ des nouvelles familles (copie des récompenses de la famille du super admin), pour une base déjà créée |
| `supabase/une-fois-par-jour.sql` | chaque mission ne rapporte des points qu'une fois par jour, pour une base déjà créée |
| `supabase/droits.sql` | ajoute les droits d'accès aux tables à une base déjà créée |
| `supabase/super-admin.sql` | ajoute le super admin à une base déjà créée |
| `supabase/tests/` | tests de séparation des familles (lancés par la CI) |
| `tests/ui/` | test des écrans avec un faux Supabase et des textes piégés |

## Chaîne de sécurité (GitHub Actions)

Sur le modèle de La Narbonnaise. À chaque pull request et sur `main` (`.github/workflows/ci.yml`) :

| Job | Ce qu'il vérifie |
|---|---|
| `verification` | ESLint avec règles de sécurité (innerHTML, eval…), html-validate (empreintes SRI), aucune clé secrète Supabase |
| `base` | `schema.sql` sur un vrai Postgres : aucune famille ne lit ni n'écrit chez une autre, super admin impossible à obtenir depuis le site ; plus un témoin (règle cassée exprès) qui doit être détecté |
| `interface` | parcours complet dans Chromium avec une famille piégée : aucun code injecté ne s'exécute |
| `sast` | CodeQL (JavaScript et workflows) et Semgrep (OWASP Top 10, JavaScript, secrets), résultats dans l'onglet Security |
| `dependances` | `npm audit`, aucun `.env`, Gitleaks sur tout l'historique |
| `sonar` | SonarCloud, seulement si le secret `SONAR_TOKEN` existe |

Chaque lundi (`hebdo.yml`) : scan ZAP actif de la copie du site servie dans la CI (jamais le site en ligne) et audit des dépendances.
Dependabot propose les mises à jour des actions et des outils chaque lundi.

Côté navigateur, `index.html` pose une politique CSP (scripts du site et de jsDelivr seulement, connexions vers Supabase seulement)
et une empreinte SRI sur supabase-js : si le CDN servait un autre fichier, le navigateur le refuserait.
Vérifier en local : `npm ci && npm run lint && npm run test:interface`.
