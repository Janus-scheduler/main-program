import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import globals from "globals";

export default [
  // Base JS recommended rules
  js.configs.recommended,

  // Global environment variables (node + browser)
  // This fixes "console is not defined" and similar no-undef errors
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  // Test file globals (Jest/Vitest)
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "**/*.spec.tsx", "**/*.test.tsx"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // TypeScript syntax support WITHOUT type-aware parsing.
  // In a monorepo, each package has its own tsconfig.json.
  // Using `projectService` or `project:true` at the root causes
  // "multiple candidate TSConfigRootDirs" errors. We intentionally
  // set `project: false` here — if you need type-aware rules,
  // add a per-package eslint config with projectService enabled.
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: false,
      },
    },
    rules: {
      // Disable base rule — @typescript-eslint/no-unused-vars handles this for TS
      "no-unused-vars": "off",
      "no-duplicate-imports": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },

  // Prettier formatting
  {
    plugins: {
      prettier,
    },
    rules: {
      // "auto" handles CRLF vs LF line-ending differences on Windows
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },

  // Ignore build outputs and dependencies across all workspaces
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/build/**",
      "**/.angular/**",
      "**/coverage/**",
      "reference/**",
      "fix.cjs",
    ],
  },
];
