// Storybook main config: Vue 3 + Vite framework with story locations
import type { StorybookConfig } from '@storybook/vue3-vite';
import { fileURLToPath, URL } from 'node:url';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  docs: {},
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('../src', import.meta.url)),
        },
      },
      define: {
        'import.meta.env.VITE_TEST_MODE': JSON.stringify(process.env.VITE_TEST_MODE || 'false'),
      },
    });
  },
};

export default config;
