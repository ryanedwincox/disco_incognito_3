// Story: RoomSelectionView - Room creation and join interface
import type { Meta, StoryObj } from '@storybook/vue3';
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
      // Setup auth store state before rendering
      const authStore = useAuthStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Test User', email: 'test@example.com' },
        isSpotifyUser: true,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default view with Spotify user (shows Test Playback button)
export const SpotifyUser: Story = {
  name: 'Spotify User',
};

// Guest user variant (same capabilities as Spotify user)
export const GuestUser: Story = {
  name: 'Guest User',
  decorators: [
    (story) => {
      const authStore = useAuthStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Guest', email: '' },
        isSpotifyUser: false,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};
