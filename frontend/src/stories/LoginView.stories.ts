// Story: LoginView - Guest login page with name input and Login button
import type { Meta, StoryObj } from '@storybook/vue3-vite';
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

// Default login view with name input and Login button
export const Default: Story = {};
