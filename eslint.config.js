// eslint.config.js
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "charts/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".wrangler/**",
      ".lighthouseci/**"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  }
];
