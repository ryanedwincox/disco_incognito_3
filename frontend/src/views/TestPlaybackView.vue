<template>
  <div class="min-h-screen bg-zinc-950 text-white">
    <!-- Main Content -->
    <div class="px-6 pt-12 pb-32">
      <header class="text-center mb-8 space-y-2">
        <h2 class="text-3xl font-semibold tracking-wide">Playback Test</h2>
        <p class="text-zinc-400 text-sm max-w-md mx-auto">Search for a song and test Spotify playback integration</p>
      </header>

      <div class="max-w-2xl mx-auto space-y-6">
        <!-- Search Input -->
        <div class="relative">
          <input
            v-model="searchQuery"
            class="w-full rounded-full bg-zinc-900 px-6 py-4 text-lg placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-disco-pink/50"
            placeholder="Search for a song..."
            type="search"
            @input="handleSearch"
          />
          <svg
            v-if="isSearching"
            class="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-disco-pink animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="bg-zinc-900 rounded-3xl p-5 space-y-3">
          <h3 class="text-lg font-semibold mb-4">Search Results</h3>
          <div
            v-for="track in searchResults"
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
        <div v-else-if="searchQuery && !isSearching" class="bg-zinc-900 rounded-3xl p-8 text-center">
          <svg class="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
          </svg>
          <p class="text-zinc-500">No results found</p>
        </div>

        <!-- Selected Track Card -->
        <div v-if="selectedTrack" class="bg-gradient-to-br from-disco-pink/20 to-purple-900/20 rounded-3xl p-6 space-y-4 border border-disco-pink/30">
          <h3 class="text-lg font-semibold text-disco-pink">Selected Track</h3>
          <div class="flex items-center gap-4">
            <div class="flex-shrink-0 w-20 h-20 bg-zinc-800 rounded-xl overflow-hidden">
              <img
                v-if="selectedTrack.albumArt"
                :src="selectedTrack.albumArt"
                :alt="selectedTrack.name"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-lg">{{ selectedTrack.name }}</p>
              <p class="text-zinc-300">{{ selectedTrack.artist }}</p>
              <p class="text-sm text-zinc-400 mt-1">{{ selectedTrack.album }}</p>
            </div>
          </div>

          <!-- Playback Controls -->
          <div class="space-y-3 pt-2">
            <button
              class="w-full font-semibold py-4 rounded-full transition-all duration-200 flex items-center justify-center gap-2"
              :class="isPlaying
                ? 'bg-white text-black hover:bg-gray-100'
                : 'bg-disco-pink text-black hover:bg-disco-pink-light'"
              type="button"
              @click="togglePlayback"
            >
              <svg v-if="!isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
              {{ isPlaying ? 'Pause' : 'Play Track' }}
            </button>

            <div class="flex gap-3">
              <button
                class="flex-1 bg-zinc-800 text-white font-medium py-3 rounded-full hover:bg-zinc-700 transition-colors"
                type="button"
                @click="stopPlayback"
              >
                Stop
              </button>
              <button
                class="flex-1 bg-zinc-800 text-white font-medium py-3 rounded-full hover:bg-zinc-700 transition-colors"
                type="button"
                @click="clearSelection"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <!-- Connection Status -->
        <div class="bg-zinc-900 rounded-2xl p-4 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-zinc-400">Spotify Device</span>
            <span
              class="text-xs px-2 py-1 rounded-full"
              :class="deviceConnected
                ? 'bg-disco-pink/20 text-disco-pink'
                : 'bg-zinc-800 text-zinc-500'"
            >
              {{ deviceConnected ? 'Connected' : 'Not Connected' }}
            </span>
          </div>
          <p class="text-xs text-zinc-500">{{ deviceName || 'No device selected' }}</p>
        </div>

        <!-- Back Button -->
        <button
          class="w-full bg-zinc-800 text-white font-medium py-3 rounded-full hover:bg-zinc-700 transition-colors"
          type="button"
          @click="goBack"
        >
          Back to Login
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import MusicPlayerBar from '../components/MusicPlayerBar.vue'

const router = useRouter()

// Search state
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<Array<{
  id: string
  name: string
  artist: string
  album: string
  duration: number
  albumArt?: string
  uri: string
}>>([])

// Playback state
const selectedTrack = ref<typeof searchResults.value[0] | null>(null)
const isPlaying = ref(false)
const deviceConnected = ref(false)
const deviceName = ref('Web Player')

// Mock search function (will be replaced with real Spotify API)
let searchTimeout: ReturnType<typeof setTimeout>
function handleSearch() {
  clearTimeout(searchTimeout)

  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true

  // Simulate API delay
  searchTimeout = setTimeout(() => {
    // Mock data - replace with real Spotify search in Phase 5
    searchResults.value = [
      {
        id: '1',
        name: 'Stayin\' Alive',
        artist: 'Bee Gees',
        album: 'Saturday Night Fever',
        duration: 285000,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b273f98d90cb3a9e82e797024e32',
        uri: 'spotify:track:mock1'
      },
      {
        id: '2',
        name: 'September',
        artist: 'Earth, Wind & Fire',
        album: 'The Best of Earth, Wind & Fire Vol. 1',
        duration: 215000,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b273b7b169a4fef5a9247f0e4021',
        uri: 'spotify:track:mock2'
      },
      {
        id: '3',
        name: 'I Wanna Dance with Somebody',
        artist: 'Whitney Houston',
        album: 'Whitney',
        duration: 291000,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b273f7f1b7e42f3b8f8ddac3a0e1',
        uri: 'spotify:track:mock3'
      },
      {
        id: '4',
        name: 'Don\'t Stop Believin\'',
        artist: 'Journey',
        album: 'Escape',
        duration: 251000,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b273c5653f9038e42efba85151ee',
        uri: 'spotify:track:mock4'
      }
    ].filter(track =>
      track.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.value.toLowerCase())
    )

    isSearching.value = false
  }, 500)
}

function selectTrack(track: typeof searchResults.value[0]) {
  selectedTrack.value = track
  console.log('Selected track:', track.uri)
}

function togglePlayback() {
  if (!selectedTrack.value) return

  isPlaying.value = !isPlaying.value
  console.log(isPlaying.value ? 'Playing:' : 'Paused:', selectedTrack.value.uri)
  // TODO: Connect to Spotify Web Playback SDK
}

function stopPlayback() {
  isPlaying.value = false
  console.log('Stopped playback')
  // TODO: Connect to Spotify Web Playback SDK
}

function clearSelection() {
  selectedTrack.value = null
  isPlaying.value = false
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function goBack() {
  router.push('/')
}
</script>
