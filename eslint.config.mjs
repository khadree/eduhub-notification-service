import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  // 1. Core recommended base rulesets applied first
  pluginJs.configs.recommended,

  // 2. Custom project overrides applied last
  {
    files: ["src/**/*.js", "*.js", "*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "prefer-const": "warn",
      "no-unused-vars": "warn",
      "no-undef": "off"
    },
  },
];

