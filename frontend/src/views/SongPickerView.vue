<!-- Song pair selection interface for adding tracks to the game pool. In test mode, generates random disco song pairs. In live mode, provides Spotify search. Handles pair saving and navigation back to lobby. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-8 space-y-2">
      <h2 class="text-3xl font-semibold">Pick a Pair</h2>
      <p class="text-zinc-400 text-sm max-w-md mx-auto">
        {{ isTestMode ? 'In test mode: Click "Save Pair" to add random disco songs!' : 'Search Spotify tracks, pick two songs, and drop them into the room pool.' }}
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
          v-if="!isTestMode"
          class="w-full rounded-full bg-zinc-900 px-6 py-4 text-lg"
          placeholder="Search Spotify"
          type="search"
        />

        <div class="grid gap-4 md:grid-cols-2">
        <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
          <h3 class="text-lg font-semibold mb-3">
            {{ isTestMode ? 'Random Song Pair' : 'Search Results' }}
          </h3>
          <div v-if="isTestMode && selectedPair.length > 0" class="space-y-2">
            <div v-for="(song, index) in selectedPair" :key="index" class="bg-zinc-800 rounded-xl p-3">
              <p class="font-medium">{{ song.name }}</p>
              <p class="text-sm text-zinc-400">{{ song.artist }}</p>
            </div>
          </div>
          <p v-else class="text-zinc-500">
            {{ isTestMode ? 'Random songs will appear when you click "Generate Random Pair"' : 'Results appear here in test mode once the Spotify adapter is wired.' }}
          </p>
        </div>
        <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5">
          <h3 class="text-lg font-semibold mb-3">Actions</h3>
          <div class="space-y-3">
            <button
              v-if="isTestMode"
              class="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 font-medium py-3 rounded-full transition-colors"
              type="button"
              @click="generateRandomPair"
            >
              Generate Random Pair
            </button>
            <button
              class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              :disabled="!isTestMode || selectedPair.length === 0"
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
import { useRoomApi } from '../composables/useRoomApi'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { handleRoomResponse, API_URL } = useRoomApi()

const isTestMode = computed(() => import.meta.env.VITE_TEST_MODE === 'true')
const isSpotifyUser = computed(() => authStore.isSpotifyUser)

interface Song {
  id: string
  name: string
  artist: string
  uri: string
}

const selectedPair = ref<Song[]>([])
const isSaving = ref(false)
const successMessage = ref('')

// Disco-themed song library for test mode
const DISCO_SONGS = [
  { name: "Stayin' Alive", artist: "Bee Gees" },
  { name: "September", artist: "Earth, Wind & Fire" },
  { name: "I Will Survive", artist: "Gloria Gaynor" },
  { name: "Le Freak", artist: "Chic" },
  { name: "Dancing Queen", artist: "ABBA" },
  { name: "Boogie Wonderland", artist: "Earth, Wind & Fire" },
  { name: "Don't Stop 'Til You Get Enough", artist: "Michael Jackson" },
  { name: "Ring My Bell", artist: "Anita Ward" },
  { name: "Last Dance", artist: "Donna Summer" },
  { name: "Celebration", artist: "Kool & The Gang" },
  { name: "Y.M.C.A.", artist: "Village People" },
  { name: "Disco Inferno", artist: "The Trammps" },
  { name: "Hot Stuff", artist: "Donna Summer" },
  { name: "Super Freak", artist: "Rick James" },
  { name: "Get Down Tonight", artist: "KC and the Sunshine Band" },
  { name: "Car Wash", artist: "Rose Royce" },
  { name: "Play That Funky Music", artist: "Wild Cherry" },
  { name: "That's the Way (I Like It)", artist: "KC and the Sunshine Band" },
  { name: "Brick House", artist: "Commodores" },
  { name: "I'm Coming Out", artist: "Diana Ross" }
]

function generateRandomPair() {
  // Get two random different songs
  const shuffled = [...DISCO_SONGS].sort(() => 0.5 - Math.random())
  const [song1, song2] = shuffled.slice(0, 2)

  selectedPair.value = [
    {
      id: `test-song-${Date.now()}-1`,
      name: song1.name,
      artist: song1.artist,
      uri: `spotify:track:test-${Date.now()}-1`
    },
    {
      id: `test-song-${Date.now()}-2`,
      name: song2.name,
      artist: song2.artist,
      uri: `spotify:track:test-${Date.now()}-2`
    }
  ]

  console.log('Generated random pair:', selectedPair.value)
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

    // Handle expired room (404)
    if (await handleRoomResponse(response)) {
      return
    }

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
