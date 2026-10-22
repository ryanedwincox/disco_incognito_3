// Story: ResultsView - Round results showing who was the dancer incognito
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ResultsView from '../views/ResultsView.vue';

const meta: Meta<typeof ResultsView> = {
  title: 'Views/ResultsView',
  component: ResultsView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default results view with hardcoded results
export const Default: Story = {};
