// Storybook preview config: Mobile viewport default (390x844), Pinia decorator, Tailwind styles
import type { Preview } from '@storybook/vue3';
import { setup } from '@storybook/vue3';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import '../src/assets/tailwind.css';

// Create a mock router with basic routes for stories
const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/rooms', component: { template: '<div />' } },
    { path: '/rooms/:code', component: { template: '<div />' } },
    { path: '/rooms/:code/song-pairs', component: { template: '<div />' } },
    { path: '/rooms/:code/play', component: { template: '<div />' } },
    { path: '/rooms/:code/guess', component: { template: '<div />' } },
    { path: '/rooms/:code/assignment', component: { template: '<div />' } },
    { path: '/rooms/:code/results', component: { template: '<div />' } },
    { path: '/test', component: { template: '<div />' } },
    { path: '/test/errors', component: { template: '<div />' } },
    { path: '/test/server-disconnected', component: { template: '<div />' } },
    { path: '/test/exception', component: { template: '<div />' } },
  ],
});

// Navigate to a room by default for stories that need route params
mockRouter.push('/rooms/456');

// Setup Pinia and Router for all stories
setup((app) => {
  const pinia = createPinia();
  app.use(pinia);
  app.use(mockRouter);
});

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile (390×844)',
          styles: {
            width: '390px',
            height: '844px',
          },
        },
        tablet: {
          name: 'Tablet (768×1024)',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop (1280×720)',
          styles: {
            width: '1280px',
            height: '720px',
          },
        },
      },
      defaultViewport: 'mobile',
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#09090b' }, // zinc-950
        { name: 'light', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
