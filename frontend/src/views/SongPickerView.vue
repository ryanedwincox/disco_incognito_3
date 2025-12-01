<!-- Song pair selection interface for adding tracks to the game pool. Provides Spotify search (mock in test mode, real in live mode). Handles pair saving and navigation back to lobby. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-8 space-y-2">
      <h2 class="text-3xl font-semibold">Pick a Pair</h2>
      <p class="text-zinc-400 text-sm max-w-md mx-auto">
        Search for tracks, select exactly two songs, and add them to the room pool.
      </p>
    </header>

    <div class="max-w-3xl mx-auto space-y-6">
      <!-- Spectator mode message for non-Spotify users -->
      <div v-if="!isSpotifyUser" class="bg-zinc-900 rounded-3xl border border-zinc-500 p-6 text-center space-y-4">
        <div class="text-5xl mb-2">🎵</div>
        <h3 class="text-xl font-semibold">Spotify Login Required</h3>
        <p class="text-zinc-400 text-sm max-w-md mx-auto">
          You're logged in as a guest. To add songs to the game, you'll need to log in with Spotify.
        </p>
        <button
          class="w-full max-w-xs mx-auto bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 font-medium py-3 rounded-full transition-colors"
          type="button"
          @click="goBack"
        >
          Back to Lobby
        </button>
      </div>

      <!-- Song picker for Spotify users -->
      <template v-else>
        <input
          v-model="searchQuery"
          class="w-full rounded-full bg-zinc-900 px-6 py-4 text-lg"
          placeholder="Search for songs..."
          type="search"
          @input="handleSearchInput"
        />

        <div class="grid gap-4 md:grid-cols-2">
          <!-- Search Results -->
          <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
            <h3 class="text-lg font-semibold mb-3">Search Results</h3>
            <div v-if="isSearching" class="text-zinc-500 text-center py-4">
              Searching...
            </div>
            <div v-else-if="searchResults.length > 0" class="space-y-2 max-h-80 overflow-y-auto">
              <button
                v-for="track in searchResults"
                :key="track.id"
                class="w-full text-left bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
                :class="{ 'ring-2 ring-disco-pink': isSelected(track) }"
                type="button"
                @click="toggleTrackSelection(track)"
              >
                <div class="flex items-center gap-3">
                  <img
                    :src="track.album_art"
                    :alt="track.album"
                    class="w-12 h-12 rounded-lg object-cover"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">{{ track.name }}</p>
                    <p class="text-sm text-zinc-400 truncate">{{ track.artist }}</p>
                  </div>
                  <div v-if="isSelected(track)" class="text-disco-pink font-bold text-lg">
                    ✓
                  </div>
                </div>
              </button>
            </div>
            <p v-else class="text-zinc-500">
              {{ searchQuery ? 'No results found' : 'Type to search for songs' }}
            </p>
          </div>

          <!-- Selected Pair & Actions -->
          <div class="space-y-4">
            <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
              <h3 class="text-lg font-semibold mb-3">Selected Pair ({{ selectedPair.length }}/2)</h3>
              <div v-if="selectedPair.length > 0" class="space-y-2">
                <div v-for="(song, index) in selectedPair" :key="song.id" class="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
                  <img
                    :src="song.album_art"
                    :alt="song.album"
                    class="w-10 h-10 rounded-lg object-cover"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">{{ song.name }}</p>
                    <p class="text-sm text-zinc-400 truncate">{{ song.artist }}</p>
                  </div>
                  <button
                    type="button"
                    class="text-zinc-400 hover:text-white p-1"
                    @click="removeFromPair(index)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p v-else class="text-zinc-500">
                Select 2 songs from search results
              </p>
            </div>

            <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
              <h3 class="text-lg font-semibold mb-3">Actions</h3>
              <div class="space-y-3">
                <button
                  class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  :disabled="selectedPair.length !== 2"
                  @click="savePair"
                >
                  {{ isSaving ? 'Saving...' : 'Save Pair' }}
                </button>
                <button
                  class="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 font-medium py-3 rounded-full transition-colors"
                  type="button"
                  @click="goBack"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="successMessage" class="bg-green-900/30 border border-green-500 text-green-200 px-4 py-3 rounded-xl text-sm text-center">
          {{ successMessage }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isTestMode = computed(() => import.meta.env.VITE_TEST_MODE === 'true')
const isSpotifyUser = computed(() => authStore.isSpotifyUser)

interface Track {
  id: string
  name: string
  artist: string
  album: string
  album_art: string
  uri: string
}

const selectedPair = ref<Track[]>([])
const isSaving = ref(false)
const successMessage = ref('')
const searchQuery = ref('')
const searchResults = ref<Track[]>([])
const isSearching = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Get access token - use mock token in test mode
function getAccessToken(): string {
  if (isTestMode.value) {
    return 'test-access-token'
  }
  return authStore.accessToken || ''
}

// Debounced search handler
function handleSearchInput() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    performSearch()
  }, 300)
}

async function performSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const token = getAccessToken()

    const response = await fetch(`${API_URL}/api/spotify/search?q=${encodeURIComponent(query)}&limit=20`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Search failed')
    }

    const data = await response.json()
    searchResults.value = data.tracks || []
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

function isSelected(track: Track): boolean {
  return selectedPair.value.some(t => t.id === track.id)
}

function toggleTrackSelection(track: Track) {
  const index = selectedPair.value.findIndex(t => t.id === track.id)
  if (index >= 0) {
    // Already selected - remove it
    selectedPair.value.splice(index, 1)
  } else if (selectedPair.value.length < 2) {
    // Not selected and room for more - add it
    selectedPair.value.push(track)
  }
  // If already at 2 and trying to add different track, do nothing
}

function removeFromPair(index: number) {
  selectedPair.value.splice(index, 1)
}

async function savePair() {
  if (selectedPair.value.length !== 2) {
    return
  }

  const userId = authStore.user?.id
  if (!userId) {
    console.error('No user ID available')
    return
  }

  isSaving.value = true
  successMessage.value = ''

  try {
    const roomCode = route.params.code
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    const response = await fetch(`${API_URL}/api/rooms/${roomCode}/songs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player_id: userId,
        track_a: selectedPair.value[0].uri,
        track_b: selectedPair.value[1].uri,
        title_a: selectedPair.value[0].name,
        artist_a: selectedPair.value[0].artist,
        title_b: selectedPair.value[1].name,
        artist_b: selectedPair.value[1].artist,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to save')
    }

    console.log('Saved song pair to room:', roomCode)
    successMessage.value = `Saved pair: "${selectedPair.value[0].name}" and "${selectedPair.value[1].name}"!`

    // Wait a moment then go back to lobby
    setTimeout(() => {
      goBack()
    }, 1500)
  } catch (error: unknown) {
    console.error('Failed to save pair:', error)
    successMessage.value = 'Failed to save song pair'
  } finally {
    isSaving.value = false
  }
}

function goBack() {
  const roomCode = route.params.code
  router.push(`/rooms/${roomCode}`)
}
</script>
