// Story: TestPlaybackView - Spotify playback testing interface
import type { Meta, StoryObj } from '@storybook/vue3';
import { useAuthStore } from '../stores/auth';
import { useMusicStore } from '../stores/music';
import TestPlaybackView from '../views/TestPlaybackView.vue';

const meta: Meta<typeof TestPlaybackView> = {
  title: 'Views/TestPlaybackView',
  component: TestPlaybackView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const authStore = useAuthStore();
      const musicStore = useMusicStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Test User', email: 'test@example.com' },
        isSpotifyUser: true,
      });
      musicStore.$patch({
        searchResults: [],
        isSearching: false,
        devices: [{ id: 'dev-1', name: 'MacBook Pro', type: 'Computer', isActive: true, volumePercent: 80 }],
        activeDeviceId: 'dev-1',
        error: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Authenticated user with device connected
export const Authenticated: Story = {
  name: 'Authenticated',
};

// Not authenticated state
export const NotAuthenticated: Story = {
  name: 'Not Authenticated',
  decorators: [
    (story) => {
      const authStore = useAuthStore();
      const musicStore = useMusicStore();
      authStore.$patch({
        accessToken: null,
        user: null,
        isSpotifyUser: true,
      });
      musicStore.$patch({
        searchResults: [],
        isSearching: false,
        devices: [],
        activeDeviceId: null,
        error: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

// With search results
export const WithSearchResults: Story = {
  name: 'With Search Results',
  decorators: [
    (story) => {
      const authStore = useAuthStore();
      const musicStore = useMusicStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Test User', email: 'test@example.com' },
        isSpotifyUser: true,
      });
      musicStore.$patch({
        searchResults: [
          { id: 't1', name: "Stayin' Alive", artist: 'Bee Gees', album: 'Saturday Night Fever', duration: 285000, uri: 'spotify:track:abc1' },
          { id: 't2', name: 'September', artist: 'Earth, Wind & Fire', album: "The Best of Earth, Wind & Fire", duration: 215000, uri: 'spotify:track:abc2' },
          { id: 't3', name: 'Dancing Queen', artist: 'ABBA', album: 'Arrival', duration: 231000, uri: 'spotify:track:abc3' },
        ],
        isSearching: false,
        devices: [{ id: 'dev-1', name: 'MacBook Pro', type: 'Computer', isActive: true, volumePercent: 80 }],
        activeDeviceId: 'dev-1',
        error: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

// With error state
export const WithError: Story = {
  name: 'With Error',
  decorators: [
    (story) => {
      const authStore = useAuthStore();
      const musicStore = useMusicStore();
      authStore.$patch({
        accessToken: 'test-token',
        user: { id: 'user-1', displayName: 'Test User', email: 'test@example.com' },
        isSpotifyUser: true,
      });
      musicStore.$patch({
        searchResults: [],
        isSearching: false,
        devices: [],
        activeDeviceId: null,
        error: 'Failed to connect to Spotify. Please check your connection.',
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};
