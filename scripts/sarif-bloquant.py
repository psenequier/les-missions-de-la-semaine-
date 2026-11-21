"""Lit les fichiers SARIF d'un dossier (résultats CodeQL) et les affiche en annotations GitHub.
Échoue s'il y a au moins un résultat de niveau « error ». Les autres niveaux sont signalés sans bloquer."""
import json
import pathlib
import sys

dossier = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "codeql-resultats")
fichiers = sorted(dossier.glob("*.sarif"))
if not fichiers:
    print(f"::error title=CodeQL::aucun résultat SARIF dans {dossier} : l'analyse n'a pas tourné")
    sys.exit(1)

bloquants = 0
for f in fichiers:
    for run in json.loads(f.read_text()).get("runs", []):
        regles = {r["id"]: r for r in run.get("tool", {}).get("driver", {}).get("rules", [])}
        for res in run.get("results", []):
            niveau = res.get("level") or regles.get(res.get("ruleId"), {}).get("defaultConfiguration", {}).get("level", "warning")
            loc = (res.get("locations") or [{}])[0].get("physicalLocation", {})
            chemin = loc.get("artifactLocation", {}).get("uri", "?")
            ligne = loc.get("region", {}).get("startLine", 1)
            texte = res.get("message", {}).get("text", "").replace("\n", " ")[:300]
            commande = "error" if niveau == "error" else "warning"
            bloquants += niveau == "error"
            print(f"::{commande} file={chemin},line={ligne},title=CodeQL {res.get('ruleId')}::{texte}")

print(f"{len(fichiers)} fichier(s) SARIF lus, {bloquants} résultat(s) bloquant(s).")
sys.exit(1 if bloquants else 0)
