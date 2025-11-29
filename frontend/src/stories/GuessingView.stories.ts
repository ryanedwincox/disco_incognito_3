// Story: GuessingView - Dancer incognito voting interface
import type { Meta, StoryObj } from '@storybook/vue3';
import GuessingView from '../views/GuessingView.vue';

const meta: Meta<typeof GuessingView> = {
  title: 'Views/GuessingView',
  component: GuessingView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default guessing view with hardcoded players
export const Default: Story = {};
