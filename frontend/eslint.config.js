// ESLint flat config (ESLint 9). Equivalent of the former .eslintrc.cjs:
// eslint:recommended + vue3-essential + @vue/eslint-config-typescript recommended + storybook recommended.
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import storybook from 'eslint-plugin-storybook';
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default withVueTs(
  {
    // The old `eslint . --ext .ts,.vue` only linted .ts and .vue files.
    ignores: ['dist/**', 'storybook-static/**', 'playwright-report/**', 'test-results/**', '**/*.js', '**/*.mjs', '**/*.cjs'],
  },
  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  storybook.configs['flat/recommended'],
);
