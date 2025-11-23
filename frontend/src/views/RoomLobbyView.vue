<!-- Room lobby showing players and song pairs before game starts. Displays room code, player list with host indicator, and song pair section. Provides navigation to song picker and option to leave room. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="mb-8">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-sm uppercase text-zinc-400">Room Code</h2>
          <p class="text-4xl font-bold tracking-[0.5em]">{{ roomCode }}</p>
        </div>
      </div>
      <div class="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-3">
        <button
          class="w-full md:w-auto px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-600 transition-colors"
          type="button"
          @click="leaveRoom"
        >
          Leave
        </button>
        <button
          class="w-full md:w-auto px-6 py-3 rounded-full bg-disco-pink text-black font-semibold hover:bg-disco-pink-light transition-colors"
          type="button"
          @click="pickSongs"
        >
          Pick Songs
        </button>
      </div>
    </header>

    <section class="grid gap-6 md:grid-cols-2">
      <div class="bg-zinc-900/70 rounded-3xl p-6">
        <h3 class="text-lg font-semibold mb-4">Players</h3>
        <div v-if="loading" class="text-zinc-400">Loading...</div>
        <div v-else-if="error" class="text-red-400">{{ error }}</div>
        <ul v-else-if="players.length > 0" class="space-y-3">
          <li
            v-for="player in players"
            :key="player.id"
            class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3"
          >
            <span>{{ player.name }}</span>
            <span
              v-if="player.isHost"
              class="text-xs uppercase tracking-wider text-disco-pink"
            >Host</span>
            <span
              v-else
              class="text-xs uppercase tracking-wider text-zinc-400"
            >Ready</span>
          </li>
        </ul>
        <p v-else class="text-zinc-400">Waiting for players to join...</p>
      </div>

      <div class="bg-zinc-900/70 rounded-3xl p-6">
        <h3 class="text-lg font-semibold mb-4">Song Pairs</h3>
        <p v-if="songPairCount > 0" class="text-zinc-400">
          {{ songPairCount }} song pair{{ songPairCount === 1 ? '' : 's' }} added. Song pairs remain hidden until the reveal phase.
        </p>
        <p v-else class="text-zinc-400">Song pairs remain hidden until the reveal phase. Add them from the song picker.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

interface Player {
  id: string
  name: string
  isHost: boolean
  isConnected: boolean
}

const router = useRouter()
const route = useRoute()

const roomCode = computed(() => route.params.code || '123')
const players = ref<Player[]>([])
const songPairCount = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchRoom() {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get(`${apiUrl}/api/rooms/${roomCode.value}`)
    players.value = response.data.players
    songPairCount.value = response.data.songPairCount
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      error.value = 'Room not found'
    } else {
      error.value = 'Failed to load room'
    }
    console.error('Error fetching room:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchRoom()
})

function leaveRoom() {
  console.log('Leaving room:', roomCode.value)
  // Navigate back to room selection
  router.push('/rooms')
}

function pickSongs() {
  console.log('Navigating to song picker for room:', roomCode.value)
  // Navigate to song picker for this room
  router.push(`/rooms/${roomCode.value}/songs`)
}
</script>
