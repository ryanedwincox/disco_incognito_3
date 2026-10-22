// Story: RoomSelectionView - Room creation and join interface
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { useAuthStore } from '../stores/auth';
import RoomSelectionView from '../views/RoomSelectionView.vue';

const meta: Meta<typeof RoomSelectionView> = {
  title: 'Views/RoomSelectionView',
  component: RoomSelectionView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const authStore = useAuthStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Test User' },
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default view with Create Room and Join Room options
export const Default: Story = {
  name: 'Default',
};
