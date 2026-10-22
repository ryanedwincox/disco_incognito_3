// Story: SongPickerView - Manual song entry with title and artist fields
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { useAuthStore } from '../stores/auth';
import { useRoomStore } from '../stores/room';
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
      const roomStore = useRoomStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Test User' },
      });
      roomStore.$patch({
        code: '456',
        status: 'song_selection',
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Empty form with title and artist fields for two songs
export const EmptyForm: Story = {
  name: 'Empty Form',
};
