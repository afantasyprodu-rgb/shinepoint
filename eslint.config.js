import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// First lint config this repo has had. Kept deliberately lean: the goal is
// catching real bugs (hook misuse, unused vars), not style policing —
// Prettier/Biome can come later if wanted.
//
// `npm run lint`. react-hooks/exhaustive-deps is 'warn' so existing code
// passes while still surfacing suspect effects in output; promote it to
// 'error' once the backlog is triaged.
export default [
  { ignores: ['dist', 'node_modules', 'android', 'ios', 'my-video', 'marketing', 'supabase'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Set explicitly rather than via a plugin preset — stays correct across
      // eslint-plugin-react-hooks major versions and their config shapes.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
    },
  },
]
