// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "aida",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "aida",
          style: "kebab-case",
        },
      ],
      // Modern JavaScript/TypeScript patterns
      "@typescript-eslint/prefer-optional-chain": "warn", // foo && foo.bar → foo?.bar
      "@typescript-eslint/prefer-nullish-coalescing": ["warn", { // value || default → value ?? default
        ignoreConditionalTests: true,
        ignorePrimitives: { string: true }
      }],
      "@typescript-eslint/prefer-for-of": "warn", // for (i=0...) → for (const item of array)
      "@typescript-eslint/prefer-includes": "warn", // indexOf() !== -1 → includes()
      "@typescript-eslint/prefer-string-starts-ends-with": "warn", // indexOf() === 0 → startsWith()

      // Angular modern patterns
      "@angular-eslint/prefer-standalone": "warn", // Encourage standalone components
      "@angular-eslint/prefer-on-push-component-change-detection": "off", // Performance boost, add it later
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Modern Angular template syntax
      "@angular-eslint/template/prefer-control-flow": "warn", // *ngIf → @if
      "@angular-eslint/template/prefer-self-closing-tags": "warn", // <div></div> → <div />

      // Performance hints
      "@angular-eslint/template/use-track-by-function": "warn", // ngFor trackBy
    },
  }
);
