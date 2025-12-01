/**
 * Music playback state store for Spotify device management.
 * Tracks current playing track, available devices, and active device selection.
 * Provides actions for updating playback state received from Spotify Web API.
 */
import { defineStore } from "pinia";
import axios from "axios";
import { useAuthStore } from "./auth";
import { useNotificationStore } from "./notifications";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface TrackInfo {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  albumArt?: string;
  uri: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number;
}

interface PlaybackState {
  isPlaying: boolean;
  track: TrackInfo | null;
  deviceId: string | null;
  progressMs: number;
  durationMs: number;
}

interface MusicState {
  currentTrackTitle: string | null;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
  searchResults: TrackInfo[];
  isSearching: boolean;
  playbackState: PlaybackState;
  selectedTrack: TrackInfo | null;
  error: string | null;
  isRetrying: boolean;
  retryAttempt: number;
  playbackError: string | null;
}

export const useMusicStore = defineStore("music", {
  state: (): MusicState => ({
    currentTrackTitle: null,
    devices: [],
    activeDeviceId: null,
    searchResults: [],
    isSearching: false,
    playbackState: {
      isPlaying: false,
      track: null,
      deviceId: null,
      progressMs: 0,
      durationMs: 0
    },
    selectedTrack: null,
    error: null,
    isRetrying: false,
    retryAttempt: 0,
    playbackError: null
  }),

  getters: {
    isPlaying: (state) => state.playbackState.isPlaying,
    currentTrack: (state) => state.playbackState.track || state.selectedTrack,
    hasActiveDevice: (state) => state.devices.some(d => d.isActive)
  },

  actions: {
    setCurrentTrack(title: string | null) {
      this.currentTrackTitle = title;
    },

    setDevices(devices: DeviceInfo[]) {
      this.devices = devices;
    },

    setActiveDevice(deviceId: string | null) {
      this.activeDeviceId = deviceId;
    },

    clearError() {
      this.error = null;
    },

    clearPlaybackError() {
      this.playbackError = null;
      this.retryAttempt = 0;
      this.isRetrying = false;
    },

    setSelectedTrack(track: TrackInfo | null) {
      console.log('setSelectedTrack called:', track);
      this.selectedTrack = track;
      console.log('selectedTrack is now:', this.selectedTrack);
      console.log('currentTrack getter returns:', this.currentTrack);
    },

    getAuthHeaders() {
      const authStore = useAuthStore();
      if (!authStore.accessToken) {
        throw new Error("Not authenticated");
      }
      return {
        Authorization: `Bearer ${authStore.accessToken}`
      };
    },

    async searchTracks(query: string, limit: number = 20): Promise<TrackInfo[]> {
      if (!query.trim()) {
        this.searchResults = [];
        return [];
      }

      this.isSearching = true;
      this.error = null;

      try {
        const response = await axios.get(`${API_URL}/api/spotify/search`, {
          params: { q: query, limit },
          headers: this.getAuthHeaders()
        });

        const tracks: TrackInfo[] = response.data.tracks.map((track: {
          id: string;
          name: string;
          artist: string;
          album: string;
          duration_ms: number;
          album_art?: string;
          uri: string;
        }) => ({
          id: track.id,
          name: track.name,
          artist: track.artist,
          album: track.album,
          duration: track.duration_ms,
          albumArt: track.album_art,
          uri: track.uri
        }));

        this.searchResults = tracks;
        return tracks;
      } catch (error) {
        console.error("Search failed:", error);
        this.error = "Failed to search tracks";
        this.searchResults = [];
        return [];
      } finally {
        this.isSearching = false;
      }
    },

    async playTrack(trackUri: string, deviceId?: string): Promise<boolean> {
      this.error = null;
      this.playbackError = null;
      console.log('playTrack called:', { trackUri, deviceId });

      // Retry with exponential backoff
      const maxAttempts = 3;
      const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (attempt > 0) {
            this.isRetrying = true;
            this.retryAttempt = attempt;
            console.log(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delays[attempt - 1]}ms`);
            await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
          }

          await axios.post(
            `${API_URL}/api/spotify/play`,
            { track_uri: trackUri, device_id: deviceId },
            { headers: this.getAuthHeaders() }
          );

          // Success - clear retry state
          this.playbackState.isPlaying = true;
          this.isRetrying = false;
          this.retryAttempt = 0;
          this.playbackError = null;
          return true;
        } catch (error) {
          console.error(`Play failed (attempt ${attempt + 1}/${maxAttempts}):`, error);

          // If this is the last attempt, show error
          if (attempt === maxAttempts - 1) {
            this.isRetrying = false;
            this.retryAttempt = 0;
            this.playbackError = "Failed to play track after 3 attempts";
            this.error = "Failed to play track";

            // Show toast notification
            const notificationStore = useNotificationStore();
            notificationStore.error(
              "Playback Failed",
              "Unable to start playback after multiple attempts. Please check your connection and try again."
            );
            return false;
          }
          // Otherwise, continue to next retry
        }
      }

      return false;
    },

    async pausePlayback(deviceId?: string): Promise<boolean> {
      this.error = null;
      console.log('pausePlayback called:', { deviceId });

      try {
        await axios.post(
          `${API_URL}/api/spotify/pause`,
          null,
          {
            params: deviceId ? { device_id: deviceId } : undefined,
            headers: this.getAuthHeaders()
          }
        );

        this.playbackState.isPlaying = false;
        return true;
      } catch (error) {
        console.error("Pause failed:", error);
        this.error = "Failed to pause playback";
        return false;
      }
    },

    async getPlaybackState(): Promise<PlaybackState | null> {
      this.error = null;

      try {
        const response = await axios.get(`${API_URL}/api/spotify/playback`, {
          headers: this.getAuthHeaders()
        });

        const data = response.data;
        console.log('getPlaybackState response:', data);
        this.playbackState = {
          isPlaying: data.is_playing || false,
          track: data.track ? {
            id: data.track.id,
            name: data.track.name,
            artist: data.track.artist,
            album: data.track.album,
            duration: data.track.duration_ms,
            albumArt: data.track.album_art,
            uri: data.track.uri
          } : null,
          deviceId: data.device_id,
          progressMs: data.progress_ms || 0,
          durationMs: data.duration_ms || 0
        };

        if (this.playbackState.track) {
          this.currentTrackTitle = this.playbackState.track.name;
        }

        console.log('playbackState set:', this.playbackState);
        return this.playbackState;
      } catch (error) {
        console.error("Get playback state failed:", error);
        this.error = "Failed to get playback state";
        return null;
      }
    },

    async getDevices(): Promise<DeviceInfo[]> {
      this.error = null;

      try {
        const response = await axios.get(`${API_URL}/api/spotify/devices`, {
          headers: this.getAuthHeaders()
        });

        const devices: DeviceInfo[] = response.data.devices.map((device: {
          id: string;
          name: string;
          type: string;
          is_active: boolean;
          volume_percent: number;
        }) => ({
          id: device.id,
          name: device.name,
          type: device.type,
          isActive: device.is_active,
          volumePercent: device.volume_percent
        }));

        this.devices = devices;

        const activeDevice = devices.find(d => d.isActive);
        if (activeDevice) {
          this.activeDeviceId = activeDevice.id;
        }

        return devices;
      } catch (error) {
        console.error("Get devices failed:", error);
        this.error = "Failed to get devices";
        return [];
      }
    },

    async transferPlayback(deviceId: string, play: boolean = false): Promise<boolean> {
      this.error = null;

      try {
        await axios.post(
          `${API_URL}/api/spotify/transfer`,
          { device_id: deviceId, play },
          { headers: this.getAuthHeaders() }
        );

        this.activeDeviceId = deviceId;
        return true;
      } catch (error) {
        console.error("Transfer playback failed:", error);
        this.error = "Failed to transfer playback";
        return false;
      }
    }
  }
});
