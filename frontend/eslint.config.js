// ESLint flat config (ESLint 9). Same rule sets as the former .eslintrc.cjs:
// eslint:recommended + vue3-essential + typescript-eslint recommended + storybook recommended.
// typescript-eslint and vue-eslint-parser are configured directly (this used to go through
// @vue/eslint-config-typescript, whose fast-glob/micromatch/braces dependency carries
// GHSA-vfj7-8cjw-p6xm with no fixed release).
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import storybook from 'eslint-plugin-storybook';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'];

export default tseslint.config(
  {
    // The old `eslint . --ext .ts,.vue` only linted .ts and .vue files.
    ignores: ['dist/**', 'storybook-static/**', 'playwright-report/**', 'test-results/**', '**/*.js', '**/*.mjs', '**/*.cjs'],
  },
  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  // typescript-eslint recommended, applied to .vue files as well as TypeScript files
  // (its eslint-recommended override, e.g. no-undef off, only targets .ts by default).
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: tsFiles })),
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // Previously added by @vue/eslint-config-typescript: <script> blocks must be TypeScript.
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
    },
  },
  storybook.configs['flat/recommended'],
);
