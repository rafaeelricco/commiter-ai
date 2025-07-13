import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Base configuration for all files
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      },
      ecmaVersion: 2022,
      sourceType: 'module'
    }
  },

  // JavaScript recommended rules
  pluginJs.configs.recommended,

  // TypeScript configuration
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },

  // VSCode extension specific configuration
  {
    files: ['src/extension.ts', 'src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        vscode: 'readonly'
      }
    }
  },

  // Test files configuration
  {
    files: ['src/test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha
      }
    },
    rules: {
      'no-console': 'off' // Allow console in test files
    }
  },

  // Development and configuration files
  {
    files: ['*.config.{js,mjs}', 'development/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  // Global rule overrides
  {
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'warn',
      'prefer-const': 'error'
    }
  }
]