import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/build/**',
      '.sst/**',
      '.next/**',
    ],
  }
);
