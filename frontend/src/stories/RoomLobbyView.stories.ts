// Story: RoomLobbyView - Room lobby with player list and host controls
import type { Meta, StoryObj } from '@storybook/vue3';
import { useRoomStore } from '../stores/room';
import RoomLobbyView from '../views/RoomLobbyView.vue';

const meta: Meta<typeof RoomLobbyView> = {
  title: 'Views/RoomLobbyView',
  component: RoomLobbyView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      roomStore.$patch({
        code: '456',
        players: [
          { id: 'p1', name: 'DJ Host', isHost: true, isConnected: true },
          { id: 'p2', name: 'Guest Player', isHost: false, isConnected: true },
        ],
        status: 'lobby',
        songCount: 0,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default lobby with players
export const WithPlayers: Story = {
  name: 'With Players',
};

// Empty lobby
export const EmptyLobby: Story = {
  name: 'Empty Lobby',
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      roomStore.$patch({
        code: '789',
        players: [],
        status: 'lobby',
        songCount: 0,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

// Lobby with disconnected player
export const WithDisconnectedPlayer: Story = {
  name: 'With Disconnected Player',
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      roomStore.$patch({
        code: '321',
        players: [
          { id: 'p1', name: 'DJ Host', isHost: true, isConnected: true },
          { id: 'p2', name: 'Away Player', isHost: false, isConnected: false },
          { id: 'p3', name: 'Active Player', isHost: false, isConnected: true },
        ],
        status: 'lobby',
        songCount: 2,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

// Song count variants
export const ZeroSongsInQueue: Story = {
  name: 'Zero Songs In Queue',
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      roomStore.$patch({
        code: 'ABC1',
        players: [
          { id: 'p1', name: 'DJ Host', isHost: true, isConnected: true },
        ],
        status: 'lobby',
        songCount: 0,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export const OneSongInQueue: Story = {
  name: 'One Song In Queue',
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      roomStore.$patch({
        code: 'ABC2',
        players: [
          { id: 'p1', name: 'DJ Host', isHost: true, isConnected: true },
          { id: 'p2', name: 'Guest Player', isHost: false, isConnected: true },
        ],
        status: 'lobby',
        songCount: 1,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export const MultipleSongsInQueue: Story = {
  name: 'Multiple Songs In Queue',
  decorators: [
    (story) => {
      const roomStore = useRoomStore();
      roomStore.$patch({
        code: 'ABC3',
        players: [
          { id: 'p1', name: 'DJ Host', isHost: true, isConnected: true },
          { id: 'p2', name: 'Guest Player', isHost: false, isConnected: true },
          { id: 'p3', name: 'Another Guest', isHost: false, isConnected: true },
        ],
        status: 'lobby',
        songCount: 5,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};
