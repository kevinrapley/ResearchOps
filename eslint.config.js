// eslint.config.js (ESM, compatible with "type":"module")
import globals from "globals";

export default [
  // Ignore build output or other generated folders if you have them
  {
    ignores: ["dist/**", "build/**", "node_modules/**"]
  },

  // Base JS config for the repo
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser, // window, document, etc.
        ...globals.node     // process, __dirname, etc.
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  }
];