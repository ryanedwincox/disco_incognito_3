// Story: RevealView - Round results showing who was the dancer incognito
import type { Meta, StoryObj } from '@storybook/vue3';
import RevealView from '../views/RevealView.vue';

const meta: Meta<typeof RevealView> = {
  title: 'Views/RevealView',
  component: RevealView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default reveal view with hardcoded results
export const Default: Story = {};
