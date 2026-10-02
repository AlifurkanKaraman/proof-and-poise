// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/cdk.out/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.kiro/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Logging goes through the allowlisted logger (Req 15.3).
      'no-console': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Req 14.1: hex colors live only in the token file.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/design/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Hard-coded hex color. Use a token from src/design/tokens.ts.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Hard-coded hex color. Use a token from src/design/tokens.ts.',
        },
      ],
    },
  },
  prettier,
);
