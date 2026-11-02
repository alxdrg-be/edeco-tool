import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Start with correctness checks that can run across the existing codebase.
// Formatting, type-aware rules and unused declarations can be introduced separately.
const correctness = {
  "constructor-super": "error",
  "no-async-promise-executor": "error",
  "no-constant-condition": ["error", { checkLoops: false }],
  "no-debugger": "error",
  "no-dupe-args": "error",
  "no-dupe-else-if": "error",
  "no-duplicate-case": "error",
  "no-invalid-regexp": "error",
  "no-irregular-whitespace": "error",
  "no-unexpected-multiline": "error",
  "no-unreachable": "error",
  "no-unsafe-finally": "error",
};

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  // Keep existing directives for opt-in rules until that part of the baseline is enabled.
  { linterOptions: { reportUnusedDisableDirectives: false } },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "@typescript-eslint": tseslint.plugin, "react-hooks": reactHooks },
    rules: correctness,
  },
  { files: ["**/*.mjs"], rules: correctness },
];
