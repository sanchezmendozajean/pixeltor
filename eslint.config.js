import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['node_modules', 'out', 'dist', 'release', 'design', 'specs', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  },
  {
    files: ['src/renderer/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', '*.config.{ts,js}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node }
  },
  {
    // Regla de arquitectura: src/core es TS puro, sin DOM, Vue ni Electron.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'vue',
            'vue/*',
            'pinia',
            'electron',
            'node:*',
            '@/*',
            '**/renderer/**',
            '**/main/**'
          ]
        }
      ]
    }
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  prettier
)
