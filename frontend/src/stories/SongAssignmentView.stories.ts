// Story: SongAssignmentView - Song assignment before playback with regular and incognito player states
import type { Meta, StoryObj } from '@storybook/vue3';
import SongAssignmentView from '../views/SongAssignmentView.vue';
import type { TrackInfo } from '../stores/music';

const mockSong: TrackInfo = {
  id: 'track-1',
  name: "Stayin' Alive",
  artist: 'Bee Gees',
  album: 'Saturday Night Fever',
  duration: 285000,
  albumArt: 'https://i.scdn.co/image/ab67616d0000b273f34e8811a138e97e8c57f863',
  uri: 'spotify:track:1234567890',
};

const mockIncognitoSong: TrackInfo = {
  id: 'track-2',
  name: 'September',
  artist: 'Earth, Wind & Fire',
  album: 'The Best of Earth, Wind & Fire, Vol. 1',
  duration: 214000,
  albumArt: 'https://i.scdn.co/image/ab67616d0000b273ed3b0d34557d2cc51f76d5f0',
  uri: 'spotify:track:0987654321',
};

const meta: Meta<typeof SongAssignmentView> = {
  title: 'Views/SongAssignmentView',
  component: SongAssignmentView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    song: {
      description: 'The song assigned to the player',
    },
    isIncognito: {
      description: 'Whether this player is the Dancer Incognito',
      control: 'boolean',
    },
    showReadyButton: {
      description: 'Show the ready button for player confirmation',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Regular player sees their assigned song
export const RegularPlayer: Story = {
  name: 'Regular Player',
  args: {
    song: mockSong,
    isIncognito: false,
    showReadyButton: true,
  },
};

// Incognito player sees their different song with special styling
export const IncognitoPlayer: Story = {
  name: 'Incognito Player (Dancer Incognito)',
  args: {
    song: mockIncognitoSong,
    isIncognito: true,
    showReadyButton: true,
  },
};

// Song without album art falls back to emoji
export const NoAlbumArt: Story = {
  name: 'No Album Art',
  args: {
    song: {
      ...mockSong,
      albumArt: undefined,
    },
    isIncognito: false,
    showReadyButton: false,
  },
};

// Minimal song info
export const MinimalSongInfo: Story = {
  name: 'Minimal Song Info',
  args: {
    song: {
      id: 'track-3',
      name: 'Unknown Track',
      artist: 'Unknown Artist',
      album: '',
      duration: 0,
      uri: 'spotify:track:unknown',
    },
    isIncognito: false,
    showReadyButton: false,
  },
};
