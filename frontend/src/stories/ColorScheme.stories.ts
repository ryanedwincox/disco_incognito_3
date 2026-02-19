// Design system documentation: Disco Incognito color scheme
// Primary: disco-pink (#D6006F) with white text - WCAG AA compliant (5.14:1)
// Secondary: zinc-700 (#3f3f46) with white text and zinc-500 border
// Cards: zinc-500 (#71717a) border for visibility against dark backgrounds
import type { Meta, StoryObj } from '@storybook/vue3';
import { defineComponent, h } from 'vue';

// Primary button component - disco-pink with white text
const PrimaryButtonDisplay = defineComponent({
  name: 'PrimaryButtonDisplay',
  setup() {
    return () =>
      h('div', { class: 'min-h-screen bg-zinc-950 text-white px-6 py-8 flex flex-col items-center justify-center' }, [
        h('div', { class: 'mb-6' }, [
          h('h1', { class: 'text-xl font-bold mb-2 text-center' }, 'Primary Button'),
          h('p', { class: 'text-zinc-400 text-sm text-center' }, 'disco-pink (#D6006F) with white text'),
          h('p', { class: 'text-green-400 text-sm text-center' }, 'Contrast: 5.14:1 ✓ WCAG AA'),
        ]),
        h('div', { class: 'space-y-4' }, [
          h(
            'button',
            {
              class: 'w-64 bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg',
              type: 'button',
            },
            'Primary Action'
          ),
          h(
            'button',
            {
              class: 'w-64 bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg',
              type: 'button',
            },
            'Login'
          ),
        ]),
      ]);
  },
});

// Secondary button component - zinc-700 with white text and border
const SecondaryButtonDisplay = defineComponent({
  name: 'SecondaryButtonDisplay',
  setup() {
    return () =>
      h('div', { class: 'min-h-screen bg-zinc-950 text-white px-6 py-8 flex flex-col items-center justify-center' }, [
        h('div', { class: 'mb-6' }, [
          h('h1', { class: 'text-xl font-bold mb-2 text-center' }, 'Secondary Button'),
          h('p', { class: 'text-zinc-400 text-sm text-center' }, 'zinc-700 (#3f3f46) with white text'),
          h('p', { class: 'text-zinc-400 text-sm text-center' }, '1px zinc-500 border for visibility'),
        ]),
        h('div', { class: 'space-y-4' }, [
          h(
            'button',
            {
              class: 'w-64 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-8 py-3 rounded-full transition-colors border border-zinc-500',
              type: 'button',
            },
            'Back to Lobby'
          ),
          h(
            'button',
            {
              class: 'w-64 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-8 py-3 rounded-full transition-colors border border-zinc-500',
              type: 'button',
            },
            'Leave Room'
          ),
        ]),
      ]);
  },
});

// Card with border component
const CardWithBorderDisplay = defineComponent({
  name: 'CardWithBorderDisplay',
  setup() {
    return () =>
      h('div', { class: 'min-h-screen bg-zinc-950 text-white px-6 py-8 flex flex-col items-center justify-center' }, [
        h('div', { class: 'mb-6' }, [
          h('h1', { class: 'text-xl font-bold mb-2 text-center' }, 'Card with Border'),
          h('p', { class: 'text-zinc-400 text-sm text-center' }, 'Dark card with 1px zinc-500 border'),
          h('p', { class: 'text-zinc-400 text-sm text-center' }, 'Border: zinc-500 (#71717a)'),
        ]),
        h('div', { class: 'space-y-4 w-full max-w-sm' }, [
          h('div', { class: 'bg-zinc-900 border border-zinc-500 rounded-3xl p-6' }, [
            h('h3', { class: 'text-lg font-semibold mb-2' }, 'Players Card'),
            h('p', { class: 'text-zinc-400 text-sm' }, 'Example player list container'),
          ]),
          h('div', { class: 'bg-zinc-900 border border-zinc-500 rounded-3xl p-6' }, [
            h('h3', { class: 'text-lg font-semibold mb-2' }, 'Song Pairs Card'),
            h('p', { class: 'text-zinc-400 text-sm' }, 'Example song pairs container'),
          ]),
        ]),
      ]);
  },
});

// Combined view showing all elements together
const CombinedSchemeDisplay = defineComponent({
  name: 'CombinedSchemeDisplay',
  setup() {
    return () =>
      h('div', { class: 'min-h-screen bg-zinc-950 text-white px-6 py-8 flex flex-col' }, [
        h('div', { class: 'mb-6 text-center' }, [
          h('h1', { class: 'text-2xl font-bold mb-2' }, 'Disco Incognito Color Scheme'),
          h('p', { class: 'text-zinc-400 text-sm' }, 'Design system documentation'),
        ]),

        // Primary button section
        h('div', { class: 'mb-8 w-full max-w-sm mx-auto' }, [
          h('h2', { class: 'text-sm uppercase text-zinc-400 mb-3' }, 'Primary Actions'),
          h('div', { class: 'space-y-3' }, [
            h(
              'button',
              {
                class: 'w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg',
                type: 'button',
              },
              'Login'
            ),
            h(
              'button',
              {
                class: 'w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg',
                type: 'button',
              },
              'Pick Songs'
            ),
          ]),
        ]),

        // Secondary button section
        h('div', { class: 'mb-8 w-full max-w-sm mx-auto' }, [
          h('h2', { class: 'text-sm uppercase text-zinc-400 mb-3' }, 'Secondary Actions'),
          h('div', { class: 'space-y-3' }, [
            h(
              'button',
              {
                class: 'w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-8 py-3 rounded-full transition-colors border border-zinc-500',
                type: 'button',
              },
              'Back to Lobby'
            ),
            h(
              'button',
              {
                class: 'w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-8 py-3 rounded-full transition-colors border border-zinc-500',
                type: 'button',
              },
              'Leave Room'
            ),
          ]),
        ]),

        // Card section
        h('div', { class: 'w-full max-w-sm mx-auto' }, [
          h('h2', { class: 'text-sm uppercase text-zinc-400 mb-3' }, 'Cards & Containers'),
          h('div', { class: 'space-y-3' }, [
            h('div', { class: 'bg-zinc-900 border border-zinc-500 rounded-3xl p-6' }, [
              h('h3', { class: 'font-semibold mb-1' }, 'Info Card'),
              h('p', { class: 'text-zinc-400 text-sm' }, 'Status message here'),
            ]),
          ]),
        ]),
      ]);
  },
});

const meta: Meta = {
  title: 'Design System/Color Scheme',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const PrimaryButton: Story = {
  name: '1. Primary Button',
  render: () => ({
    components: { PrimaryButtonDisplay },
    template: '<PrimaryButtonDisplay />',
  }),
};

export const SecondaryButton: Story = {
  name: '2. Secondary Button',
  render: () => ({
    components: { SecondaryButtonDisplay },
    template: '<SecondaryButtonDisplay />',
  }),
};

export const CardWithBorder: Story = {
  name: '3. Card with Border',
  render: () => ({
    components: { CardWithBorderDisplay },
    template: '<CardWithBorderDisplay />',
  }),
};

export const CombinedScheme: Story = {
  name: '4. Combined View',
  render: () => ({
    components: { CombinedSchemeDisplay },
    template: '<CombinedSchemeDisplay />',
  }),
};
