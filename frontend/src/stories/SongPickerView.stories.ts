// Story: SongPickerView - Song pair selection interface with test mode and Spotify user states
import type { Meta, StoryObj } from '@storybook/vue3';
import { useAuthStore } from '../stores/auth';
import SongPickerView from '../views/SongPickerView.vue';

const meta: Meta<typeof SongPickerView> = {
  title: 'Views/SongPickerView',
  component: SongPickerView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
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

// Spotify user can pick songs
export const SpotifyUser: Story = {
  name: 'Spotify User',
};
