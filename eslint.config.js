import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'reference/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/**/*.tsx', 'src/ui/**/*.ts', 'src/main.tsx'],
    ...reactHooks.configs.flat['recommended-latest'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // The engine must stay pure: no DOM, storage or framework code.
    files: ['src/engine/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'fetch',
        'navigator',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'idb-keyval', 'node:*'], message: 'The engine must stay pure.' },
            { group: ['../schema/*', '../files/*', '../ui/*', '../print/*'], message: 'The engine must not depend on other layers.' },
          ],
        },
      ],
    },
  },
  {
    // Tests may read fixtures from disk.
    files: ['src/**/*.test.ts', 'e2e/**/*.ts'],
    rules: { 'no-restricted-imports': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
