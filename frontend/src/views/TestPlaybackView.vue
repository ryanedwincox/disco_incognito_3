<!-- Spotify playback testing interface for development. Provides track search, selection, and playback controls. Displays device connection status and includes the music player bar. Used for testing Spotify integration. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white">
    <!-- Main Content -->
    <div class="px-6 pt-12 pb-32">
      <header class="text-center mb-8 space-y-2">
        <h2 class="text-3xl font-semibold tracking-wide">Playback Test</h2>
        <p class="text-zinc-400 text-sm max-w-md mx-auto">Search for a song and test Spotify playback integration</p>
      </header>

      <!-- Auth Status -->
      <div v-if="!authStore.isAuthenticated" class="max-w-2xl mx-auto mb-6">
        <div class="bg-yellow-900/30 border border-yellow-600/50 rounded-2xl p-4 text-center">
          <p class="text-yellow-400 text-sm mb-3">You need to be logged in to test Spotify playback</p>
          <button
            class="bg-disco-pink text-black font-medium px-6 py-2 rounded-full hover:bg-disco-pink-light transition-colors"
            type="button"
            @click="handleLogin"
          >
            Login with Spotify
          </button>
        </div>
      </div>

      <div class="max-w-2xl mx-auto space-y-6">
        <!-- Search Input -->
        <div class="relative">
          <input
            v-model="searchQuery"
            class="w-full rounded-full bg-zinc-900 px-6 py-4 text-lg placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-disco-pink/50"
            placeholder="Search for a song..."
            type="search"
            :disabled="!authStore.isAuthenticated"
            @input="handleSearch"
          />
          <svg
            v-if="musicStore.isSearching"
            class="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-disco-pink animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        <!-- Error Message -->
        <div v-if="musicStore.error" class="bg-red-900/30 border border-red-600/50 rounded-2xl p-4 text-center">
          <p class="text-red-400 text-sm">{{ musicStore.error }}</p>
          <button
            class="text-red-300 text-xs underline mt-2"
            type="button"
            @click="musicStore.clearError()"
          >
            Dismiss
          </button>
        </div>

        <!-- Search Results -->
        <div v-if="musicStore.searchResults.length > 0" class="bg-zinc-900 rounded-3xl p-5 space-y-3">
          <h3 class="text-lg font-semibold mb-4">Search Results</h3>
          <div
            v-for="track in musicStore.searchResults"
            :key="track.id"
            class="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
            @click="selectTrack(track)"
          >
            <!-- Album Art -->
            <div class="flex-shrink-0 w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden">
              <img
                v-if="track.albumArt"
                :src="track.albumArt"
                :alt="track.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-6 h-6 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
            </div>
            <!-- Track Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ track.name }}</p>
              <p class="text-sm text-zinc-400 truncate">{{ track.artist }}</p>
            </div>
            <!-- Duration -->
            <div class="text-xs text-zinc-500">
              {{ formatDuration(track.duration) }}
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="searchQuery && !musicStore.isSearching" class="bg-zinc-900 rounded-3xl p-8 text-center">
          <svg class="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
          </svg>
          <p class="text-zinc-500">No results found</p>
        </div>

        <!-- Connection Status -->
        <div class="bg-zinc-900 rounded-2xl p-4 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-zinc-400">Spotify Device</span>
            <div class="flex items-center gap-2">
              <button
                v-if="authStore.isAuthenticated"
                class="text-xs text-disco-pink hover:text-disco-pink-light"
                type="button"
                @click="refreshDevices"
              >
                Refresh
              </button>
              <span
                class="text-xs px-2 py-1 rounded-full"
                :class="deviceConnected
                  ? 'bg-disco-pink/20 text-disco-pink'
                  : 'bg-zinc-800 text-zinc-500'"
              >
                {{ deviceConnected ? 'Connected' : 'Not Connected' }}
              </span>
            </div>
          </div>
          <p class="text-xs text-zinc-500">{{ deviceName || 'No device selected' }}</p>

          <!-- Device List -->
          <div v-if="musicStore.devices.length > 1" class="pt-2 space-y-2">
            <p class="text-xs text-zinc-400">Available devices:</p>
            <div
              v-for="device in musicStore.devices"
              :key="device.id"
              class="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50 cursor-pointer hover:bg-zinc-800"
              @click="selectDevice(device.id)"
            >
              <span class="text-sm">{{ device.name }}</span>
              <span v-if="device.isActive" class="text-xs text-disco-pink">Active</span>
            </div>
          </div>
        </div>

        <!-- Back Button -->
        <button
          class="w-full bg-zinc-800 text-white font-medium py-3 rounded-full hover:bg-zinc-700 transition-colors"
          type="button"
          @click="goBack"
        >
          Back to Room Selection
        </button>
      </div>
    </div>

    <!-- Music Player Bar (Fixed Bottom) -->
    <div class="fixed bottom-0 left-0 right-0">
      <MusicPlayerBar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MusicPlayerBar from '../components/MusicPlayerBar.vue'
import { useMusicStore, type TrackInfo } from '../stores/music'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const musicStore = useMusicStore()
const authStore = useAuthStore()

// Search state
const searchQuery = ref('')

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout>

// Computed
const deviceConnected = computed(() => musicStore.devices.length > 0 && musicStore.hasActiveDevice)
const deviceName = computed(() => {
  const activeDevice = musicStore.devices.find(d => d.isActive)
  return activeDevice?.name || (musicStore.devices.length > 0 ? musicStore.devices[0].name : 'No device')
})

// Lifecycle
onMounted(async () => {
  // Load auth from storage
  authStore.loadFromStorage()

  // Fetch devices if authenticated
  if (authStore.isAuthenticated) {
    await musicStore.getDevices()
    await musicStore.getPlaybackState()
  }
})

// Methods
async function handleLogin() {
  await authStore.testLogin()
  if (authStore.isAuthenticated) {
    await musicStore.getDevices()
  }
}

function handleSearch() {
  clearTimeout(searchTimeout)

  if (!searchQuery.value.trim()) {
    musicStore.searchResults = []
    return
  }

  // Debounce search
  searchTimeout = setTimeout(async () => {
    await musicStore.searchTracks(searchQuery.value)
  }, 300)
}

function selectTrack(track: TrackInfo) {
  // Set selected track in store - will show in bottom bar
  musicStore.setSelectedTrack(track)
  // Clear search results to close the dropdown
  musicStore.searchResults = []
  searchQuery.value = ''
  console.log('Selected track:', track.uri)
}

async function refreshDevices() {
  await musicStore.getDevices()
}

async function selectDevice(deviceId: string) {
  await musicStore.transferPlayback(deviceId)
  await musicStore.getDevices()
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function goBack() {
  router.push('/rooms')
}
</script>
