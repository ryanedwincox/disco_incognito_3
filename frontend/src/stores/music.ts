/**
 * Music playback state store for Spotify device management.
 * Tracks current playing track, available devices, and active device selection.
 * Provides actions for updating playback state received from Spotify Web API.
 */
import { defineStore } from "pinia";

interface DeviceInfo {
  id: string;
  name: string;
  isActive: boolean;
}

interface MusicState {
  currentTrackTitle: string | null;
  devices: DeviceInfo[];
  activeDeviceId: string | null;
}

export const useMusicStore = defineStore("music", {
  state: (): MusicState => ({
    currentTrackTitle: null,
    devices: [],
    activeDeviceId: null
  }),
  actions: {
    setCurrentTrack(title: string | null) {
      this.currentTrackTitle = title;
    },
    setDevices(devices: DeviceInfo[]) {
      this.devices = devices;
    },
    setActiveDevice(deviceId: string | null) {
      this.activeDeviceId = deviceId;
    }
  }
});
