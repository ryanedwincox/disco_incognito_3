// Story: SongAssignmentView - Song assignment before round ends
import type { Meta, StoryObj } from '@storybook/vue3';
import SongAssignmentView from '../views/SongAssignmentView.vue';
import type { TrackInfo } from '../types';

const mockSong: TrackInfo = {
  id: 'track-1',
  name: "Stayin' Alive",
  artist: 'Bee Gees',
};

const mockIncognitoSong: TrackInfo = {
  id: 'track-2',
  name: 'September',
  artist: 'Earth, Wind & Fire',
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
    isHost: {
      description: 'Whether the current player is the host',
      control: 'boolean',
    },
    isEndingRound: {
      description: 'Whether the End Round request is in flight (host only)',
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
    isHost: false,
  },
};

// Incognito player sees their different song
export const IncognitoPlayer: Story = {
  name: 'Incognito Player (Dancer Incognito)',
  args: {
    song: mockIncognitoSong,
    isHost: false,
  },
};

// Host view — End Round button visible
export const Host: Story = {
  name: 'Host',
  args: {
    song: mockSong,
    isHost: true,
    isEndingRound: false,
  },
};

// Host view — End Round in flight
export const HostEndingRound: Story = {
  name: 'Host - Ending Round',
  args: {
    song: mockSong,
    isHost: true,
    isEndingRound: true,
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
    },
    isHost: false,
  },
};
