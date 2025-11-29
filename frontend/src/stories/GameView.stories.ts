// Story: GameView - Active game round with countdown timer and music player
import type { Meta, StoryObj } from '@storybook/vue3';
import { useMusicStore } from '../stores/music';
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
      const musicStore = useMusicStore();
      musicStore.$patch({
        currentTrackTitle: "Stayin' Alive",
        devices: [{ id: 'dev-1', name: 'MacBook Pro', type: 'Computer', isActive: true, volumePercent: 80 }],
        activeDeviceId: 'dev-1',
        playbackState: {
          isPlaying: true,
          track: {
            id: 'track-1',
            name: "Stayin' Alive",
            artist: 'Bee Gees',
            album: 'Saturday Night Fever',
            duration: 285000,
            uri: 'spotify:track:abc123',
          },
          deviceId: 'dev-1',
          progressMs: 45000,
          durationMs: 285000,
        },
        selectedTrack: null,
        error: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Round in progress with music playing
export const RoundInProgress: Story = {
  name: 'Round In Progress',
};

// Round with no track playing
export const NoTrackPlaying: Story = {
  name: 'No Track Playing',
  decorators: [
    (story) => {
      const musicStore = useMusicStore();
      musicStore.$patch({
        currentTrackTitle: null,
        devices: [],
        activeDeviceId: null,
        playbackState: {
          isPlaying: false,
          track: null,
          deviceId: null,
          progressMs: 0,
          durationMs: 0,
        },
        selectedTrack: null,
        error: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};
