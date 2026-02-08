<!-- Persistent music player bar shown at bottom of screen during gameplay. Displays current track info, play/pause button, and device selector. Provides controls for Spotify playback across all game views. -->
<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 px-4 py-3">
    <div class="max-w-5xl mx-auto flex items-center gap-3">
      <!-- Album Art (Left) -->
      <div class="flex-shrink-0">
        <div class="w-14 h-14 bg-gradient-to-br from-disco-pink/20 to-purple-900/20 rounded-lg flex items-center justify-center overflow-hidden">
          <img
            v-if="albumArt"
            :src="albumArt"
            :alt="trackTitle || 'Album art'"
            class="w-full h-full object-cover"
          />
          <svg v-else class="w-8 h-8 text-disco-pink/40" fill="currentColor" viewBox="0 0 20 20">
            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
          </svg>
        </div>
      </div>

      <!-- Track Info & Controls (Center/Flex) -->
      <div class="flex-1 min-w-0 flex items-center gap-3">
        <!-- Track Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">
            {{ trackTitle || 'No track playing' }}
          </p>
          <p class="text-xs truncate" :class="playbackError ? 'text-red-400' : 'text-zinc-400'">
            <span v-if="isRetrying">
              Retrying... (Attempt {{ retryAttempt + 1 }}/3)
            </span>
            <span v-else-if="playbackError">
              {{ playbackError }}
            </span>
            <span v-else>
              {{ artistName || 'Select a device to start' }}
            </span>
          </p>
        </div>

        <!-- Play/Pause Button or Retry Button -->
        <button
          v-if="!playbackError"
          class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
          :class="isPlaying
            ? 'bg-disco-pink hover:bg-disco-pink-light hover:scale-105'
            : 'bg-white hover:bg-gray-100 hover:scale-105'"
          :disabled="!canPlay || isRetrying"
          type="button"
          @click="togglePlayback"
        >
          <!-- Retry Spinner -->
          <svg v-if="isRetrying" class="w-5 h-5 text-black animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <!-- Play Icon -->
          <svg v-else-if="!isPlaying" class="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
          <!-- Pause Icon -->
          <svg v-else class="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
          </svg>
        </button>

        <!-- Retry Button (shown on error) -->
        <button
          v-else
          class="flex-shrink-0 px-4 py-2 rounded-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all duration-200"
          type="button"
          @click="retryPlayback"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
          </svg>
          Retry
        </button>
      </div>

      <!-- Device Selector (Right) -->
      <div class="flex-shrink-0 relative">
        <button
          class="px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
          :class="deviceConnected
            ? 'bg-disco-pink/10 text-disco-pink hover:bg-disco-pink/20'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
          type="button"
          @click="toggleDeviceSelector"
        >
          <!-- Speaker Device Icon -->
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
            <path d="M13.829 7.172a.75.75 0 00-1.061 1.06 2.5 2.5 0 010 3.536.75.75 0 001.06 1.06 4 4 0 000-5.656z" />
          </svg>
          <span class="hidden sm:inline">{{ deviceName || 'Connect' }}</span>
        </button>

        <!-- Device Dropdown -->
        <div
          v-if="showDeviceSelector"
          class="absolute bottom-full right-0 mb-2 w-64 bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 overflow-hidden"
        >
          <div class="p-3 border-b border-zinc-700 flex items-center justify-between">
            <span class="text-sm font-medium text-white">Select Device</span>
            <button
              class="text-xs text-disco-pink hover:text-disco-pink-light"
              type="button"
              @click="refreshDevices"
            >
              Refresh
            </button>
          </div>
          <div class="max-h-48 overflow-y-auto">
            <div
              v-if="musicStore.devices.length === 0"
              class="p-4 text-center text-zinc-500 text-sm"
            >
              No devices found. Open Spotify on a device.
            </div>
            <button
              v-for="device in musicStore.devices"
              :key="device.id"
              class="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-700/50 transition-colors text-left"
              type="button"
              @click="selectDevice(device.id)"
            >
              <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0010 16.25V3.75z" />
                </svg>
                <span class="text-sm text-white">{{ device.name }}</span>
              </div>
              <span v-if="device.isActive" class="text-xs text-disco-pink">Active</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMusicStore } from '../stores/music'

const musicStore = useMusicStore()

// Device selector state
const showDeviceSelector = ref(false)

// Computed properties from store
const trackTitle = computed(() => musicStore.currentTrack?.name || null)
const artistName = computed(() => musicStore.currentTrack?.artist || null)
const albumArt = computed(() => musicStore.currentTrack?.albumArt)
const isPlaying = computed(() => musicStore.isPlaying)
const canPlay = computed(() => musicStore.currentTrack !== null)
const deviceConnected = computed(() => musicStore.hasActiveDevice)
const deviceName = computed(() => {
  const activeDevice = musicStore.devices.find(d => d.isActive)
  return activeDevice?.name || null
})
const isRetrying = computed(() => musicStore.isRetrying)
const retryAttempt = computed(() => musicStore.retryAttempt)
const playbackError = computed(() => musicStore.playbackError)

// Methods connected to music store
async function togglePlayback() {
  if (isPlaying.value) {
    await musicStore.pausePlayback()
  } else if (musicStore.currentTrack) {
    await musicStore.playTrack(musicStore.currentTrack.uri, musicStore.activeDeviceId || undefined)
  }
}

function toggleDeviceSelector() {
  showDeviceSelector.value = !showDeviceSelector.value
  if (showDeviceSelector.value) {
    // Refresh devices when opening
    refreshDevices()
  }
}

async function refreshDevices() {
  await musicStore.getDevices()
}

async function selectDevice(deviceId: string) {
  await musicStore.transferPlayback(deviceId, true)
  await musicStore.getDevices()
  showDeviceSelector.value = false
}

async function retryPlayback() {
  musicStore.clearPlaybackError()
  if (musicStore.currentTrack) {
    await musicStore.playTrack(musicStore.currentTrack.uri, musicStore.activeDeviceId || undefined)
  }
}
</script>
