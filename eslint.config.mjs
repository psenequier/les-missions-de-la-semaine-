// Analyse du JavaScript : erreurs courantes et règles de sécurité
// (injection dans innerHTML, eval, expressions régulières dangereuses…).
import js from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";
import nounsanitized from "eslint-plugin-no-unsanitized";

export default [
  { ignores: ["node_modules/**", "tests/ui/mock.js"] },
  js.configs.recommended,
  security.configs.recommended,
  nounsanitized.configs.recommended,
  {
    files: ["*.js"],
    
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, supabase: "readonly" }
    },
    rules: {
      // Trop de fausses alertes sur obj[clé] ; les vraies injections passent par innerHTML (règle ci-dessus).
      "security/detect-object-injection": "off",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error"
    }
  },
  {
    files: ["eslint.config.mjs", "scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    // Outils lancés par la CI sur le dépôt lui-même : lire des chemins calculés est voulu.
    rules: { "security/detect-non-literal-fs-filename": "off" }
  }
];
