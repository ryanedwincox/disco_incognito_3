// Story: LoginView - Spotify OAuth login page with main login options and guest name input state
import type { Meta, StoryObj } from '@storybook/vue3';
import LoginView from '../views/LoginView.vue';

const meta: Meta<typeof LoginView> = {
  title: 'Views/LoginView',
  component: LoginView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default login view with main options
export const Default: Story = {};

// Guest name input variant would require component state manipulation
// which happens via internal ref state, so we just document it here
export const MainLoginOptions: Story = {
  name: 'Main Login Options',
};
