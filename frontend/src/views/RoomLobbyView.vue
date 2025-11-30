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
          class="w-full md:w-auto px-6 py-3 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 transition-colors"
          type="button"
          @click="leaveRoom"
        >
          Leave
        </button>
        <button
          class="w-full md:w-auto px-6 py-3 rounded-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold transition-colors"
          type="button"
          @click="pickSongs"
        >
          Pick Songs
        </button>
      </div>
    </header>

    <section class="grid gap-6 md:grid-cols-2">
      <div class="bg-zinc-900/70 rounded-3xl border border-zinc-500 p-6">
        <h3 class="text-lg font-semibold mb-4">Players</h3>
        <ul class="space-y-3">
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
              class="text-xs uppercase tracking-wider text-zinc-400"
            >
              {{ player.isConnected ? 'Ready' : 'Disconnected' }}
            </span>
          </li>
          <li v-if="players.length === 0" class="text-zinc-400 text-center py-4">
            No players yet
          </li>
        </ul>
      </div>

      <div class="bg-zinc-900/70 rounded-3xl border border-zinc-500 p-6">
        <h3 class="text-lg font-semibold mb-4">Song Pairs</h3>
        <p class="text-zinc-400">Song pairs remain hidden until the reveal phase. Add them from the song picker.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()

const roomCode = computed(() => (route.params.code as string) || '123')
const players = computed(() => roomStore.players)

onMounted(async () => {
  // Set room code in store
  roomStore.setRoom(roomCode.value)

  // Fetch room data from API if available
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}`)
    if (response.ok) {
      const data = await response.json()
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
    }
  } catch (error) {
    console.log('Could not fetch room data:', error)
  }
})

function leaveRoom() {
  console.log('Leaving room:', roomCode.value)
  roomStore.reset()
  router.push('/rooms')
}

function pickSongs() {
  console.log('Navigating to song picker for room:', roomCode.value)
  router.push(`/rooms/${roomCode.value}/songs`)
}
</script>
