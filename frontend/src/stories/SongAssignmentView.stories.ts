// Story: SongAssignmentView - Song assignment before and during round playback
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
    showEndListeningButton: {
      description: 'Show the End Listening button (host-only, playing phase)',
      control: 'boolean',
    },
    isPlayingPhase: {
      description: 'Whether the round is currently in the playing phase',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Regular player sees their assigned song (song_selection phase)
export const RegularPlayer: Story = {
  name: 'Regular Player',
  args: {
    song: mockSong,
    isHost: false,
    isPlayingPhase: false,
  },
};

// Incognito player sees their different song
export const IncognitoPlayer: Story = {
  name: 'Incognito Player (Dancer Incognito)',
  args: {
    song: mockIncognitoSong,
    isHost: false,
    isPlayingPhase: false,
  },
};

// Host view during song_selection phase (Start Round button visible)
export const HostSongSelection: Story = {
  name: 'Host - Song Selection Phase',
  args: {
    song: mockSong,
    isHost: true,
    isPlayingPhase: false,
    showEndListeningButton: false,
  },
};

// Host view during playing phase (End Listening button visible)
export const HostPlaying: Story = {
  name: 'Host - Playing Phase (End Listening)',
  args: {
    song: mockSong,
    isHost: true,
    isPlayingPhase: true,
    showEndListeningButton: true,
  },
};

// Non-host player during playing phase (waiting message visible)
export const PlayerWaitingForHost: Story = {
  name: 'Player - Waiting for Host to End Listening',
  args: {
    song: mockSong,
    isHost: false,
    isPlayingPhase: true,
    showEndListeningButton: false,
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
    isPlayingPhase: false,
  },
};
