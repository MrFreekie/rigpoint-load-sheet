import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'reference/', 'coverage/', 'test-results/', 'playwright-report/'] },
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
    // The engine must stay pure: values in, values out. No DOM, storage, network, clock,
    // randomness, framework or other-layer code. Node globals stay declared (flat config
    // merges globals), so the restricted lists below are what keeps them out.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'globalThis', 'self', 'window', 'document', 'navigator', 'location', 'history',
          'caches', 'localStorage', 'sessionStorage', 'indexedDB',
          'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
          'process', 'global', 'Buffer', 'require', 'module', '__dirname', '__filename',
          'crypto', 'performance', 'setTimeout', 'setInterval',
        ].map((name) => ({ name, message: 'The engine must stay pure: no environment, storage or network access.' })),
        { name: 'Date', message: 'The engine must stay pure: no clock (Date.now, new Date).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The engine must stay pure: no randomness.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: 'The engine must stay pure: no dynamic imports.' },
      ],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-imports': [
        'error',
        {
          // Only modules inside src/engine: a path that starts with "./" and never goes up.
          // This blocks packages (zod, react, node:*), other layers and deep relative paths.
          patterns: [
            {
              regex: String.raw`^(?!\./)|\.\.`,
              message: 'The engine must stay pure: import only from inside src/engine.',
            },
          ],
        },
      ],
    },
  },
  {
    // Engine tests drive the engine with fixtures, the schema, Node and Python.
    files: ['src/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Tests may read fixtures from disk.
    files: ['src/**/*.test.ts', 'e2e/**/*.ts'],
    rules: { 'no-restricted-imports': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
