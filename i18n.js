// Langues du site : français et anglais.
// Par défaut, la langue du système (français si l'appareil est en français, anglais sinon) ;
// les drapeaux 🇫🇷 / 🇬🇧 en haut de la page changent la langue, et le choix reste sur l'appareil.
// Les textes du site sont écrits en français ; EN donne leur traduction anglaise.
// Ce que les familles écrivent (prénoms, missions, récompenses) n'est jamais traduit,
// sauf les missions et récompenses de départ proposées par le site (DEFAUTS).
(function () {
  "use strict";
  const KEY = "points-lang";
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* stockage indisponible */ }
  const sys = String((navigator.languages && navigator.languages[0]) || navigator.language || "fr");
  const lang = saved === "fr" || saved === "en" ? saved : /^fr\b/i.test(sys) ? "fr" : "en";

  const EN = {
    // ───── Écrans fixes (index.html) ─────
    "Points en famille": "Family points",
    "Le tableau de points de la famille : missions, récompenses et semaines.": "The family points board: missions, rewards and weeks.",
    "Gagne des points, regarde ta barre monter, et choisis ta récompense !": "Earn points, watch your bar grow, and pick your reward!",
    "Langue": "Language",
    "Changer de famille": "Switch family",
    "Se déconnecter": "Log out",
    "Se connecter": "Log in",
    "Créer un compte": "Create an account",
    "Adresse e-mail": "Email address",
    "Mot de passe": "Password",
    "Au moins 8 caractères.": "At least 8 characters.",
    "Mot de passe oublié ?": "Forgot your password?",
    "Choisis un nouveau mot de passe": "Choose a new password",
    "Nouveau mot de passe": "New password",
    "Enregistrer": "Save",
    "Créer ma famille": "Create my family",
    "Tu seras l'administrateur : tu ajoutes les enfants, les missions et les récompenses.": "You will be the admin: you add the children, the missions and the rewards.",
    "Nom de la famille": "Family name",
    "Ex. : Famille Martin": "e.g. The Smiths",
    "Créer la famille": "Create the family",
    "Rejoindre une famille": "Join a family",
    "Un parent t'a donné un code d'invitation ? Écris-le ici.": "Did a parent give you an invite code? Type it here.",
    "Code d'invitation": "Invite code",
    "Ex. : 4F7A2C9B": "e.g. 4F7A2C9B",
    "Rejoindre": "Join",
    "🛡️ Super admin : toutes les familles": "🛡️ Super admin: all families",
    "Tu vois ici chaque famille du site. « Ouvrir » te fait entrer dans la famille avec les droits d'administrateur. Les familles, elles, restent séparées entre elles.":
      "Here you can see every family on the site. “Open” takes you into a family with admin rights. The families themselves stay separate from each other.",
    "↩︎ Retour": "↩︎ Back",
    "Revenir à ma famille": "Back to my family",
    "Mes points": "My points",
    "À LA RECHERCHE DES POINTS": "ON THE HUNT FOR POINTS",
    "Catalogue": "Shop",
    "Mes semaines": "My weeks",
    "Semaines": "Weeks",
    "Administration": "Admin",
    "Déjà achetés": "Already bought",
    "Cette semaine": "This week",
    "mission faite": "mission done",
    "pas faite": "not done",
    "1er rond = matin, 2e rond = soir": "1st dot = morning, 2nd dot = evening",
    "Points gagnés chaque semaine": "Points earned each week",
    "Toute l'année": "The whole year",
    "Année d'avant": "Previous year",
    "Année d'après": "Next year",
    "Les semaines passées": "Past weeks",
    "La plus récente en haut": "Most recent at the top",
    "Mon compte et cet écran": "My account and this screen",
    "Connecté avec": "Signed in as",
    "📺 Mode salon": "📺 Living-room mode",
    "Le mode salon garde l'écran allumé, pour une tablette posée dans le salon. Il revient tout seul sur « Mes points » après 3 minutes sans toucher l'écran.":
      "Living-room mode keeps the screen on, for a tablet left in the living room. It goes back to “My points” by itself after 3 minutes without a touch.",
    "Rapport de la semaine": "Weekly report",
    "Budget maximum par semaine par enfant (€)": "Maximum budget per week per child (€)",
    "Indique la somme maximale qu'un enfant peut gagner en une semaine s'il fait toutes ses missions. La valeur d'un point est calculée automatiquement, et elle s'ajuste si tu ajoutes ou retires des missions. Par défaut : 8 € par semaine.":
      "Enter the most a child can earn in one week by doing all their missions. The value of a point is worked out automatically, and it adjusts if you add or remove missions. Default: €8 per week.",
    "Ma famille": "My family",
    "Donne ce code à un autre adulte de la famille. Il crée son compte, puis choisit « Rejoindre une famille ».":
      "Give this code to another adult in the family. They create their account, then choose “Join a family”.",
    "Copier": "Copy",
    "Nouveau code": "New code",
    "Les enfants": "The children",
    "Ajouter un enfant": "Add a child",
    "Prénom": "First name",
    "Personnage": "Character",
    "Ajouter l'enfant": "Add the child",
    "Annuler": "Cancel",
    "Les missions": "The missions",
    "Tu ne choisis pas les points : donne à chaque mission un poids de 1 à 10 (plus il est grand, plus la mission rapporte). Le site répartit environ 100 points par semaine et par enfant selon ces poids, puis calcule la valeur d'un point avec le budget de la semaine (voir le rapport plus haut).":
      "You don't pick the points: give each mission a weight from 1 to 10 (the bigger it is, the more the mission earns). The site shares out about 100 points per week per child according to these weights, then works out the value of a point from the weekly budget (see the report above).",
    "🌅 Missions du matin": "🌅 Morning missions",
    "🌙 Missions du soir": "🌙 Evening missions",
    "Poids (1 à 10)": "Weight (1 to 10)",
    "Une mission par ligne": "One mission per line",
    "Autres boutons pour gagner des points": "Other buttons to earn points",
    "➕ Ajouter un bouton": "➕ Add a button",
    "Enregistrer les missions": "Save the missions",
    "Les récompenses": "The rewards",
    "Ajouter une récompense": "Add a reward",
    "Nom": "Name",
    "Ex. : Une glace": "e.g. An ice cream",
    "Pour qui ?": "For whom?",
    "Image": "Picture",
    "➕ Ajouter au catalogue": "➕ Add to the shop",
    "💛 Soutenir le site": "💛 Support the site",
    "💛 Soutenir Basile": "💛 Support Basile",
    "Le site est gratuit et sans publicité. Si tu veux aider à le faire vivre, tu peux faire un petit don. Ce n'est pas obligatoire.":
      "The site is free and has no ads. If you'd like to help keep it going, you can make a small donation. It's completely optional.",
    "💛 Faire un don sur Ko-fi": "💛 Donate on Ko-fi",
    "Remettre la semaine à zéro": "Reset this week",
    "Quitter la famille": "Leave the family",
    "Prix (€)": "Price (€)",
    "Ex. : 2,50": "e.g. 2.50",
    "Écris le prix en euros : le site calcule le nombre de points avec la valeur d'un point.": "Type the price in euros: the site works out the number of points from the value of a point.",
    "Soit {n} points (1 point ≈ {value}).": "That is {n} points (1 point ≈ {value}).",
    "{n} points (≈ {eur}) · {who}": "{n} points (≈ {eur}) · {who}",
    "Mets un prix entre 0,01 et 1000 €.": "Enter a price between €0.01 and €1000.",
    "Ajoute d'abord des missions : le site en a besoin pour calculer la valeur d'un point.": "Add some missions first: the site needs them to work out the value of a point.",
    "Ce prix fait plus de 9999 points. Augmente le budget de la semaine ou baisse le prix.": "This price is more than 9999 points. Raise the weekly budget or lower the price.",
    "Supprimer la famille": "Delete the family",
    "Quitter ou supprimer la famille": "Leave or delete the family",
    "Quitter : tu ne fais plus partie de cette famille, les autres adultes la gardent. Si tu étais le seul administrateur, l'adulte arrivé le plus tôt le devient. Si tu es le seul adulte, la famille est supprimée.": "Leave: you are no longer part of this family, the other adults keep it. If you were the only admin, the adult who joined first becomes admin. If you are the only adult, the family is deleted.",
    "Supprimer : efface la famille, ses enfants, ses points et ses récompenses, pour tous les adultes. On ne peut pas revenir en arrière.": "Delete: erases the family, its children, points and rewards, for every adult. This cannot be undone.",
    "Sûr ? Appuie encore pour quitter": "Sure? Tap again to leave",
    "Sûr ? Tout sera effacé pour tout le monde": "Sure? Everything will be erased for everyone",
    "Tu as quitté la famille.": "You left the family.",
    "La famille a été supprimée.": "The family has been deleted.",
    "Efface les points et les achats de la semaine en cours. Les semaines terminées ne changent plus : elles restent, comme les enfants, missions et récompenses.":
      "Erases this week's points and purchases. Finished weeks can no longer change: they stay, along with the children, missions and rewards.",

    // ───── Messages (app.js) ─────
    "Le site n'est pas encore relié à sa base de données. Il faut remplir le fichier config.js.": "The site isn't connected to its database yet. The config.js file needs to be filled in.",
    "Oups, ce n'est pas enregistré. Vérifie la connexion et réessaie.": "Oops, that wasn't saved. Check the connection and try again.",
    "Créer mon compte": "Create my account",
    "Écris une adresse e-mail valide.": "Enter a valid email address.",
    "Le mot de passe doit avoir au moins 8 caractères.": "The password must have at least 8 characters.",
    "Ton adresse n'est pas encore confirmée. Ouvre l'e-mail reçu et clique sur le lien.": "Your address isn't confirmed yet. Open the email you received and click the link.",
    "E-mail ou mot de passe incorrect.": "Wrong email or password.",
    "Un compte existe déjà avec cette adresse. Connecte-toi.": "An account already exists with this address. Log in instead.",
    "Le compte n'a pas pu être créé : {msg}": "The account couldn't be created: {msg}",
    "Compte créé ! Ouvre l'e-mail que tu viens de recevoir et clique sur le lien pour le confirmer, puis connecte-toi.": "Account created! Open the email you just received and click the link to confirm it, then log in.",
    "Pas de connexion au serveur. Réessaie dans un instant.": "Can't reach the server. Try again in a moment.",
    "Écris d'abord ton adresse e-mail, puis clique sur « Mot de passe oublié ? ».": "First enter your email address, then click “Forgot your password?”.",
    "L'e-mail n'a pas pu être envoyé. Réessaie plus tard.": "The email couldn't be sent. Try again later.",
    "Si un compte existe avec cette adresse, un e-mail pour changer le mot de passe vient d'être envoyé.": "If an account exists with this address, an email to change the password has just been sent.",
    "Le mot de passe n'a pas pu être changé : {msg}": "The password couldn't be changed: {msg}",
    "Mot de passe changé ✓": "Password changed ✓",
    "Chargement…": "Loading…",
    "Impossible de lire tes familles. Recharge la page.": "Couldn't read your families. Reload the page.",
    "🛡️ Mode super admin : tu es dans la famille « {name} ».": "🛡️ Super admin mode: you are in the “{name}” family.",
    "📺 Quitter le mode salon": "📺 Leave living-room mode",
    "Mode salon : l'écran reste allumé 📺": "Living-room mode: the screen stays on 📺",
    "Ce navigateur ne peut pas garder l'écran allumé : mets la mise en veille de la tablette sur « Jamais ».": "This browser can't keep the screen on: set the tablet's sleep setting to “Never”.",
    "Impossible de lire la liste des familles.": "Couldn't read the list of families.",
    "Ouvrir": "Open",
    "Famille": "Family",
    "Adultes": "Adults",
    "Enfants": "Children",
    "Points notés": "Points logged",
    "Dernière activité": "Last activity",
    "Aucune famille pour l'instant.": "No families yet.",
    "Cette famille n'a pas pu être ouverte.": "This family couldn't be opened.",
    "Donne un nom à ta famille.": "Give your family a name.",
    "La famille n'a pas pu être créée. Réessaie.": "The family couldn't be created. Try again.",
    "Famille créée ! Ajoute maintenant les enfants.": "Family created! Now add the children.",
    "Le code a 8 lettres et chiffres.": "The code has 8 letters and numbers.",
    "Ce code n'existe pas. Vérifie-le avec le parent qui te l'a donné.": "This code doesn't exist. Check it with the parent who gave it to you.",
    "Impossible de rejoindre la famille. Réessaie.": "Couldn't join the family. Try again.",
    "Bienvenue dans la famille !": "Welcome to the family!",
    "Chargement des points…": "Loading points…",
    "Impossible de lire les points pour l'instant. Recharge la page.": "Couldn't read the points right now. Reload the page.",
    "Déjà fait aujourd'hui ✓ Reviens demain !": "Already done today ✓ Come back tomorrow!",
    "Annulé": "Undone",
    "Aucun enfant pour l'instant.": "No children yet.",
    "Aucun enfant pour l'instant. Commence par ajouter ton enfant : c'est lui qui gagnera les points.": "No children yet. Start by adding your child: they are the one who will earn the points.",
    "➕ Ajouter un enfant": "➕ Add a child",
    // ───── Guide de démarrage ─────
    "👋 Bienvenue ! On démarre en 4 étapes": "👋 Welcome! Let's get started in 4 steps",
    "Masquer le guide": "Hide the guide",
    "Ajoute ton premier enfant": "Add your first child",
    "C'est lui qui gagnera les points. Tu pourras changer son personnage et ajouter ses frères et sœurs dans Administration.": "They are the one who will earn the points. You can change their character and add brothers and sisters in Admin.",
    "Ajouter": "Add",
    "Regarde les missions": "Check the missions",
    "Elles sont déjà prêtes : le matin, le soir, la chambre et les devoirs. Tu peux les changer quand tu veux.": "They are already set up: morning, evening, bedroom and homework. You can change them whenever you like.",
    "Voir les missions": "See the missions",
    "Choisis les récompenses": "Choose the rewards",
    "Le catalogue a déjà 3 idées. Ajoute ce qui fait plaisir à tes enfants, avec le prix en euros : le site calcule les points.": "The shop already has 3 ideas. Add what your children love, with the price in euros: the site works out the points.",
    "Voir les récompenses": "See the rewards",
    "Montre le site à ton enfant": "Show the site to your child",
    "Chaque jour, il coche ses missions dans « À LA RECHERCHE DES POINTS ». Ses points montent, et il les échange contre une récompense dans le Catalogue.": "Every day, they tick their missions in “ON THE HUNT FOR POINTS”. Their points go up, and they swap them for a reward in the Shop.",
    "Astuce : ajoute le site à l'écran d'accueil de la tablette ou du téléphone, comme une application.": "Tip: add the site to the home screen of the tablet or phone, like an app.",
    "C'est compris": "Got it",
    "Bravo, tout est prêt ! 🎉": "Well done, everything is ready! 🎉",
    "👋 Guide de démarrage": "👋 Getting started guide",
    "{names} : c'est fait ! Tu peux ajouter d'autres enfants dans Administration.": "{names}: done! You can add more children in Admin.",
    "Guide masqué. Tu peux le revoir dans Administration.": "Guide hidden. You can see it again in Admin.",
    "⚙️ Administration": "⚙️ Admin",
    " Un parent administrateur peut les ajouter.": " An admin parent can add them.",
    "points": "points",
    "Gagner des points": "Earn points",
    "✓ fait aujourd'hui": "✓ done today",
    "Cocher mes missions →": "Tick my missions →",
    "Derniers points": "Latest points",
    "Pas encore de points. Appuie sur un bouton au-dessus !": "No points yet. Press a button above!",
    "↩︎ Annuler le dernier": "↩︎ Undo the last one",
    "Les règles, une fois par jour :": "The rules, once a day:",
    "Aujourd'hui : {date}": "Today: {date}",
    "{n} points · {done} / {all} cases": "{n} points · {done} / {all} boxes",
    "+{n} points gagnés ce matin ! 🎉": "+{n} points earned this morning! 🎉",
    "+{n} points gagnés ce soir ! 🎉": "+{n} points earned this evening! 🎉",
    "Sûr ? Touche encore pour annuler": "Sure? Tap again to undo",
    "↩︎ Annuler ces {n} points": "↩︎ Undo these {n} points",
    "Tout est fait ! Prendre mes {n} points": "All done! Take my {n} points",
    "Encore {n} à faire": "{n} more to do",
    "{n} points": "{n} points",
    "Sûr ? Oui !": "Sure? Yes!",
    "Acheter pour {name}": "Buy for {name}",
    "{name} : encore {n}": "{name}: {n} more",
    "Le catalogue est vide.": "The shop is empty.",
    " Ajoute des récompenses dans {link}.": " Add rewards in {link}.",
    "Rien acheté pour l'instant.": "Nothing bought yet.",
    "Du {from} au {to}": "From {from} to {to}",
    "missions faites": "missions done",
    "meilleur jour": "best day",
    "acheté": "bought",
    "Points gagnés par semaine": "Points earned per week",
    "{name} : {n} points": "{name}: {n} points",
    "Semaine": "Week",
    "points cette semaine": "points this week",
    "Rien acheté": "Nothing bought",
    "Pas encore de semaine terminée. La première apparaîtra ici lundi prochain.": "No finished week yet. The first one will show up here next Monday.",
    "Points de {name} jour par jour en {year}": "{name}'s points day by day in {year}",
    "{date} : {n} points": "{date}: {n} points",
    "{n} points en {year}": "{n} points in {year}",
    "Chaque petit carré est un jour. Plus il est foncé, plus il y a eu de points ce jour-là.": "Each little square is a day. The darker it is, the more points were earned that day.",
    "Soit {max} points au maximum par semaine et par enfant : 1 point vaut environ {value}. Par jour : {list}.": "That's at most {max} points per week per child: 1 point is worth about {value}. Per day: {list}.",
    "Ajoute des missions pour calculer la valeur d'un point.": "Add missions to work out the value of a point.",
    "Enfant": "Child",
    "Gagnés": "Earned",
    "Dépensés": "Spent",
    "Valeur gagnée": "Value earned",
    "Solde": "Balance",
    "Valeur du solde": "Balance value",
    "Pas encore d'enfant.": "No children yet.",
    "Total famille": "Family total",
    "Mets une somme entre 0 et 1000 €.": "Enter an amount between €0 and €1000.",
    "Budget de la semaine enregistré ✓": "Weekly budget saved ✓",
    "Modifier": "Edit",
    "Sûr ? Ses points seront effacés": "Sure? Their points will be erased",
    "Supprimer": "Delete",
    "Pas encore d'enfant. Ajoute le premier avec le formulaire ci-dessous.": "No children yet. Add the first one with the form below.",
    "Pour tous": "For everyone",
    "Pour {names}": "For {names}",
    "Sûr ? Enlever": "Sure? Remove",
    "Enlever": "Remove",
    "Aucune récompense pour l'instant.": "No rewards yet.",
    "Tous les enfants": "All the children",
    "Sûr ? Les points de cette semaine seront effacés": "Sure? This week's points will be erased",
    "Ex. : Mettre la table": "e.g. Set the table",
    "Écris le prénom de l'enfant.": "Enter the child's first name.",
    "Fiche modifiée ✓": "Details updated ✓",
    "{name} est dans la famille ! 🎉": "{name} has joined the family! 🎉",
    "Le nom ne peut pas être vide.": "The name can't be empty.",
    "Nom enregistré ✓": "Name saved ✓",
    "Code copié ✓": "Code copied ✓",
    "Code sélectionné : fais Copier.": "Code selected: now copy it.",
    "Nouveau code créé. L'ancien ne marche plus.": "New code created. The old one no longer works.",
    "Le poids doit être entre 1 et 10.": "The weight must be between 1 and 10.",
    "Écris au moins une mission du matin.": "Enter at least one morning mission.",
    "Écris au moins une mission du soir.": "Enter at least one evening mission.",
    "Le poids de « {label} » doit être entre 1 et 10.": "The weight of “{label}” must be between 1 and 10.",
    "Missions enregistrées ✓": "Missions saved ✓",
    "Écris le nom de la récompense.": "Enter the name of the reward.",
    "{title} est dans le catalogue ! 🎁": "{title} is in the shop! 🎁",
    "Les points de la semaine sont remis à zéro.": "This week's points have been reset.",
    "Cette semaine est terminée 🔒 Ses points ne changent plus.": "This week is over 🔒 Its points can no longer change.",
    "🔒 Semaine terminée, plus rien à annuler": "🔒 Week over, nothing left to undo",
    "Semaine terminée : ses points ne changent plus": "Week over: its points can no longer change",
    "Bravo {name} ! +{n} points": "Well done {name}! +{n} points",
    "Super ! {title} pour {name} 🎁": "Great! {title} for {name} 🎁",
    "Modifier {name}": "Edit {name}",
    "Enfant supprimé": "Child deleted",
    "Récompense enlevée": "Reward removed",
    "1 adulte dans la famille": "1 adult in the family",
    "{n} adultes dans la famille": "{n} adults in the family",
    ", dont 1 administrateur.": ", including 1 admin.",
    ", dont {n} administrateurs.": ", including {n} admins.",
    ", dont 0 administrateur.": ", including 0 admins."
  };

  // Missions et récompenses de départ proposées par le site : enregistrées en français dans la base
  // (elles servent à reconnaître les points déjà gagnés), affichées dans la langue choisie.
  const DEFAUTS = {
    "Missions du matin": "Morning missions",
    "Missions du soir": "Evening missions",
    "M'habiller": "Get dressed",
    "Faire mes tartines": "Make my toast",
    "Débarrasser": "Clear the table",
    "Me brosser les dents": "Brush my teeth",
    "Prendre mon cartable": "Grab my school bag",
    "Prendre ma douche": "Have a shower",
    "Mettre mon pyjama": "Put on my pyjamas",
    "Ranger mes affaires": "Put my things away",
    "Préparer mes habits pour demain": "Lay out my clothes for tomorrow",
    "Chambre rangée": "Tidy bedroom",
    "Devoirs tout seul": "Homework on my own",
    "Un Legami": "A Legami",
    "Un livre": "A book",
    "Un grand livre": "A big book"
  };
  const RETOUR = {};
  Object.keys(DEFAUTS).forEach(k => { RETOUR[DEFAUTS[k]] = k; });

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const en = lang === "en";
  // t("Bravo {name} !", { name }) : le texte dans la langue choisie, avec les valeurs mises à leur place.
  function t(s, v) {
    const r = en && has(EN, s) ? EN[s] : s;
    return v ? r.replace(/\{(\w+)\}/g, (m, k) => (has(v, k) ? String(v[k]) : m)) : r;
  }
  // Affichage d'un texte de la famille : seules les valeurs de départ du site sont traduites.
  const shown = s => (en && typeof s === "string" && has(DEFAUTS, s) ? DEFAUTS[s] : s);
  // Pour l'enregistrement : une valeur de départ affichée en anglais redevient l'originale.
  const raw = s => (en && typeof s === "string" && has(RETOUR, s) ? RETOUR[s] : s);

  // Traduit les textes fixes de la page (index.html), une seule fois au chargement.
  function translatePage() {
    document.documentElement.lang = lang;
    document.title = t(document.title);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t(desc.getAttribute("content")));
    if (!en) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.nodeValue.trim();
      if (s && has(EN, s)) n.nodeValue = n.nodeValue.replace(s, EN[s]);
    }
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => {
      ["placeholder", "aria-label", "title"].forEach(a => { const v = el.getAttribute(a); if (v && has(EN, v)) el.setAttribute(a, EN[v]); });
    });
  }

  // Drapeaux : la langue choisie est gardée sur l'appareil, puis la page se recharge dans cette langue.
  function wireFlags() {
    document.querySelectorAll("[data-lang]").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
      b.addEventListener("click", () => {
        if (b.dataset.lang === lang) return;
        try { localStorage.setItem(KEY, b.dataset.lang); } catch { /* stockage indisponible */ }
        location.reload();
      });
    });
  }

  window.I18N = {
    lang, t, shown, raw,
    locale: en ? "en-GB" : "fr-FR",
    months: en ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."],
    days: en ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    // Personnage dans la langue choisie (nom, pouvoir, mots qui s'affichent).
    char: c => (en && c && c.en ? Object.assign({}, c, c.en) : c)
  };
  translatePage();
  wireFlags();
})();
