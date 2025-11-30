<!-- Game playing view: displays assigned song after game starts. Shows song title, artist, album art placeholder, listening status, room code, and player list. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <!-- Header with Room Code -->
    <header class="mb-8">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-sm uppercase text-zinc-400">Now Playing</h2>
          <p class="text-4xl font-bold tracking-[0.5em]" data-testid="room-code">{{ roomCode }}</p>
          <p class="text-sm text-green-400 mt-1">Status: {{ roomStatus }}</p>
        </div>
      </div>
      <button
        class="w-full md:w-auto px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-600 transition-colors"
        type="button"
        @click="leaveRoom"
      >
        Leave Game
      </button>
    </header>

    <!-- Song Assignment Card -->
    <section class="bg-gradient-to-br from-disco-pink/20 to-purple-900/20 rounded-3xl p-8 mb-8" data-testid="song-card">
      <div class="flex flex-col items-center text-center">
        <!-- Album Art Placeholder -->
        <div class="w-48 h-48 bg-zinc-800 rounded-2xl mb-6 flex items-center justify-center" data-testid="album-art-placeholder">
          <span class="text-6xl">🎵</span>
        </div>

        <!-- Song Info -->
        <p class="text-sm text-zinc-400 mb-2">Your Song:</p>
        <h1 class="text-3xl font-bold text-white mb-2" data-testid="song-title">{{ assignedSong?.title || 'Loading...' }}</h1>
        <p class="text-xl text-disco-pink mb-4" data-testid="song-artist">by {{ assignedSong?.artist || '...' }}</p>

        <!-- Listening Status -->
        <div class="flex items-center gap-2 text-green-400 animate-pulse" data-testid="listening-status">
          <span class="text-2xl">🎵</span>
          <span class="text-lg font-semibold">Listening now...</span>
        </div>
      </div>
    </section>

    <!-- Players Section -->
    <section class="bg-zinc-900/70 rounded-3xl p-6">
      <h3 class="text-lg font-semibold mb-4">Players in Game</h3>
      <ul class="space-y-3" data-testid="player-list">
        <li
          v-for="player in players"
          :key="player.id"
          class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3"
        >
          <span>{{ player.name }}</span>
          <span
            v-if="player.isHost"
            class="bg-disco-pink text-black text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          >
            Host
          </span>
          <span
            v-else
            class="text-xs uppercase tracking-wider text-green-400"
          >
            Playing
          </span>
        </li>
        <li v-if="players.length === 0" class="text-zinc-400 text-center py-4">
          Loading players...
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const authStore = useAuthStore()

const roomCode = computed(() => (route.params.code as string) || '')
const players = computed(() => roomStore.players)
const roomStatus = computed(() => roomStore.status)
const assignedSong = computed(() => roomStore.assignedSong)

onMounted(async () => {
  // Load auth state from localStorage (in case of page refresh)
  authStore.loadFromStorage()

  // Set room code in store
  roomStore.setRoom(roomCode.value)

  // Fetch room data from API if needed (for page refresh scenarios)
  if (!assignedSong.value || players.value.length === 0) {
    await fetchRoomData()
  }
})

async function fetchRoomData() {
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}`)
    if (response.ok) {
      const data = await response.json()

      // Update players
      if (data.players) {
        roomStore.setPlayers(
          data.players.map((p: { id: string; display_name: string; is_host: boolean; is_connected: boolean }) => ({
            id: p.id,
            name: p.display_name,
            isHost: p.is_host,
            isConnected: p.is_connected
          }))
        )
      }

      // Update status
      if (data.status) {
        roomStore.setStatus(data.status)
      }

      // Get assigned song for current player
      const currentUserId = authStore.user?.id
      if (data.current_round?.player_assignments && currentUserId) {
        const assignment = data.current_round.player_assignments[currentUserId]
        if (assignment) {
          roomStore.setAssignedSong({
            id: assignment.id,
            title: assignment.title,
            artist: assignment.artist,
          })
        }
      }
    }
  } catch (error) {
    console.log('Could not fetch room data:', error)
  }
}

function leaveRoom() {
  console.log('Leaving game:', roomCode.value)
  roomStore.reset()
  router.push('/rooms')
}
</script>
