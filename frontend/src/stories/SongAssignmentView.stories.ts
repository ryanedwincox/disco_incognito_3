// Story: SongAssignmentView - Song assignment before round with regular and incognito player states
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

// Minimal song info
export const MinimalSongInfo: Story = {
  name: 'Minimal Song Info',
  args: {
    song: {
      id: 'track-3',
      name: 'Unknown Track',
      artist: 'Unknown Artist',
    },
    isIncognito: false,
    showReadyButton: false,
  },
};
