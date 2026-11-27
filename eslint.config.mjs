import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Every TypeScript source in the repository, CLI and plugins alike. Each
// file is type-checked through the tsconfig nearest to it.
const sources = ['cli/src/**/*.ts', 'plugins/*/src/**/*.ts'];
// Tests and what they share, such as the helpers under `__tests__/helpers/`.
const tests = ['**/src/**/__tests__/**/*.ts'];

export default [
  js.configs.recommended,
  {
    files: sources,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        projectService: { tsconfigRootDir: __dirname },
      },
      // The plugins run in a WebView; the CLI in Node.
      globals: { ...globals.node, ...globals.browser, ...globals.es2020 },
    },
    plugins: {
      '@typescript-eslint': ts,
      prettier: prettier,
    },
    rules: {
      ...ts.configs.recommended.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    // The only places that print to the terminal on purpose.
    files: ['cli/src/utils/logger.ts', 'cli/src/commands/devices.ts', 'cli/src/commands/config.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // test-utils hands out jest mocks to the app that tests against the bridge.
    files: ['plugins/test-utils/src/**/*.ts'],
    ignores: tests,
    languageOptions: { globals: { jest: 'readonly' } },
  },
  {
    files: tests,
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    ignores: ['**/dist/', '**/node_modules/', 'cli/templates/', '**/*.js', '**/*.cjs', 'cli/e2e/'],
  },
  eslintConfigPrettier,
];
