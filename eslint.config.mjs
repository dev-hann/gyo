import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectConfigs = [
  { files: 'cli/src/**/*.ts', tsconfig: 'cli/tsconfig.json' },
  { files: 'plugins/bridge/src/**/*.ts', tsconfig: 'plugins/bridge/tsconfig.json' },
  { files: 'plugins/test-utils/src/**/*.ts', tsconfig: 'plugins/test-utils/tsconfig.json' },
  { files: 'plugins/app-launcher/src/**/*.ts', tsconfig: 'plugins/app-launcher/tsconfig.json' },
];

export default [
  js.configs.recommended,

  ...projectConfigs.map(({ files, tsconfig }) => ({
    files: [files],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: path.join(__dirname, tsconfig),
      },
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
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
  })),

  {
    files: ['cli/src/commands/devices.ts', 'cli/src/commands/config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['cli/src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/src/**/__tests__/**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        fail: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['plugins/bridge/src/**/*.ts', 'plugins/test-utils/src/**/*.ts', 'plugins/app-launcher/src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['plugins/test-utils/src/**/*.ts'],
    ignores: ['**/__tests__/**'],
    languageOptions: {
      globals: {
        ...globals.browser,
        jest: 'readonly',
      },
    },
  },
  {
    ignores: ['**/dist/', '**/node_modules/', 'cli/templates/', '**/*.js', '**/*.cjs'],
  },
  eslintConfigPrettier,
];
