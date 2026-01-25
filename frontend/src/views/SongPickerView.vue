<!-- Song selection interface for adding tracks to the game pool. Provides Spotify search (mock in test mode, real in live mode). Handles song saving and allows adding multiple songs. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-8 space-y-2">
      <h2 class="text-3xl font-semibold">Add Songs</h2>
      <p class="text-zinc-400 text-sm max-w-md mx-auto">
        Search for tracks and add them to the room pool. Add at least 2 songs to start the game.
      </p>
    </header>

    <div class="max-w-lg mx-auto space-y-6">
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

        <div class="space-y-4">
          <!-- Search Results -->
          <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
            <h3 class="text-lg font-semibold mb-3">Search Results</h3>
            <div v-if="isSearching" class="text-zinc-500 text-center py-4">
              Searching...
            </div>
            <div v-else-if="searchResults.length > 0" class="space-y-2 max-h-80 overflow-y-auto -mx-1 px-1">
              <button
                v-for="track in searchResults"
                :key="track.id"
                class="w-full text-left bg-zinc-800 hover:bg-zinc-700 rounded-xl p-3 transition-colors"
                :class="{ 'ring-2 ring-disco-pink': isSelected(track) }"
                type="button"
                @click="selectTrack(track)"
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

          <!-- Selected Songs & Actions -->
          <div class="space-y-4">
            <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
              <h3 class="text-lg font-semibold mb-3">Selected Songs ({{ selectedTracks.length }}/2)</h3>
              <div class="space-y-2">
                <!-- Slot 1 -->
                <div v-if="selectedTracks[0]" class="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
                  <img
                    :src="selectedTracks[0].album_art"
                    :alt="selectedTracks[0].album"
                    class="w-10 h-10 rounded-lg object-cover"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">{{ selectedTracks[0].name }}</p>
                    <p class="text-sm text-zinc-400 truncate">{{ selectedTracks[0].artist }}</p>
                  </div>
                  <button
                    type="button"
                    class="text-zinc-400 hover:text-white p-1"
                    @click="clearSelection(0)"
                  >
                    ✕
                  </button>
                </div>
                <div v-else class="bg-zinc-800/50 rounded-xl p-3 text-zinc-500 text-center">
                  Select first song
                </div>

                <!-- Slot 2 -->
                <div v-if="selectedTracks[1]" class="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
                  <img
                    :src="selectedTracks[1].album_art"
                    :alt="selectedTracks[1].album"
                    class="w-10 h-10 rounded-lg object-cover"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">{{ selectedTracks[1].name }}</p>
                    <p class="text-sm text-zinc-400 truncate">{{ selectedTracks[1].artist }}</p>
                  </div>
                  <button
                    type="button"
                    class="text-zinc-400 hover:text-white p-1"
                    @click="clearSelection(1)"
                  >
                    ✕
                  </button>
                </div>
                <div v-else class="bg-zinc-800/50 rounded-xl p-3 text-zinc-500 text-center">
                  Select second song
                </div>
              </div>
            </div>

            <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
              <h3 class="text-lg font-semibold mb-3">Actions</h3>
              <div class="space-y-3">
                <button
                  class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  :disabled="selectedTracks.length !== 2 || isSaving"
                  @click="addSongPair"
                >
                  {{ isSaving ? 'Adding...' : 'Add Song Pair' }}
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
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import { useRoomApi } from '../composables/useRoomApi'

const authStore = useAuthStore()
const roomStore = useRoomStore()
const { handleRoomResponse, API_URL } = useRoomApi()

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

const selectedTracks = ref<Track[]>([])
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
  return selectedTracks.value.some(t => t.id === track.id)
}

function selectTrack(track: Track) {
  const index = selectedTracks.value.findIndex(t => t.id === track.id)
  if (index !== -1) {
    // Clicking selected track deselects it
    selectedTracks.value.splice(index, 1)
  } else if (selectedTracks.value.length < 2) {
    // Add track if under max (2)
    selectedTracks.value.push(track)
  }
  // If already at max 2, clicking unselected track does nothing
}

function clearSelection(index?: number) {
  if (index !== undefined) {
    selectedTracks.value.splice(index, 1)
  } else {
    selectedTracks.value = []
  }
}

async function addSongPair() {
  if (selectedTracks.value.length !== 2) {
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
    const roomCode = roomStore.code

    // Send two sequential POSTs for the song pair
    for (const track of selectedTracks.value) {
      const response = await fetch(`${API_URL}/api/rooms/${roomCode}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: userId,
          track_uri: track.uri,
          title: track.name,
          artist: track.artist,
        }),
      })

      // Handle expired room (404)
      if (await handleRoomResponse(response)) {
        return
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to add song')
      }
    }

    console.log('Added song pair to room:', roomCode)
    const songNames = selectedTracks.value.map(t => t.name).join('" and "')
    successMessage.value = `Added "${songNames}" to the room!`

    // Clear selection to allow adding more pairs
    selectedTracks.value = []

    // Clear success message after a few seconds
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error: unknown) {
    console.error('Failed to add song pair:', error)
    successMessage.value = 'Failed to add song pair'
  } finally {
    isSaving.value = false
  }
}

function goBack() {
  // Go back to lobby - AppOrchestrator will switch to RoomLobbyView
  roomStore.setStatus('lobby')
}
</script>
