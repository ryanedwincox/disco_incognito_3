// Story: GameView - Active game round with host-controlled listening phase
import type { Meta, StoryObj } from '@storybook/vue3';
import { useRoomStore } from '../stores/room';
import { useAuthStore } from '../stores/auth';
import GameView from '../views/GameView.vue';

const meta: Meta<typeof GameView> = {
  title: 'Views/GameView',
  component: GameView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      const authStore = useAuthStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'host-1', displayName: 'DJ Host' },
      });
      roomStore.$patch({
        code: '456',
        status: 'playing',
        assignedSong: { id: 'song-1', title: "Stayin' Alive", artist: 'Bee Gees' },
        players: [
          { id: 'host-1', name: 'DJ Host', isHost: true, isConnected: true },
          { id: 'player-1', name: 'Funky Player', isHost: false, isConnected: true },
        ],
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Round in progress — host sees End Listening button
export const RoundInProgress: Story = {
  name: 'Round In Progress',
};
