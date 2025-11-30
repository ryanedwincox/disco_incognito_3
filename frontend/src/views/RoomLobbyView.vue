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
        <button
          v-if="isHost"
          class="w-full md:w-auto px-6 py-3 rounded-full bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors"
          type="button"
          :disabled="isStarting"
          @click="startGame"
        >
          {{ isStarting ? 'Starting...' : 'Start Game' }}
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
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const authStore = useAuthStore()

const roomCode = computed(() => (route.params.code as string) || '123')
const players = computed(() => roomStore.players)
const currentUserId = computed(() => authStore.user?.id ?? null)
const isHost = computed(() => {
  if (!currentUserId.value) return false
  const currentPlayer = players.value.find(p => p.id === currentUserId.value)
  return currentPlayer?.isHost ?? false
})
const isStarting = ref(false)

onMounted(async () => {
  // Load auth state from localStorage (in case of page refresh)
  authStore.loadFromStorage()

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

        // Auto-join if current user is not already in the room
        const userId = authStore.user?.id
        const displayName = authStore.user?.displayName || 'Guest'
        const isInRoom = data.players.some((p: { id: string }) => p.id === userId)

        if (userId && !isInRoom) {
          await joinRoomAsPlayer(userId, displayName)
        }
      }
    }
  } catch (error) {
    console.log('Could not fetch room data:', error)
  }
})

async function joinRoomAsPlayer(playerId: string, displayName: string) {
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        display_name: displayName,
      }),
    })

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
      console.log('Successfully joined room:', roomCode.value)
    }
  } catch (error) {
    console.log('Could not join room:', error)
  }
}

function leaveRoom() {
  console.log('Leaving room:', roomCode.value)
  roomStore.reset()
  router.push('/rooms')
}

function pickSongs() {
  console.log('Navigating to song picker for room:', roomCode.value)
  router.push(`/rooms/${roomCode.value}/songs`)
}

async function startGame() {
  if (!currentUserId.value) {
    console.error('No player ID available')
    return
  }

  isStarting.value = true
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player_id: currentUserId.value,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      roomStore.setStatus(data.status)

      // Extract assigned song for current player from current_round.player_assignments
      if (data.current_round?.player_assignments && currentUserId.value) {
        const assignment = data.current_round.player_assignments[currentUserId.value]
        if (assignment) {
          roomStore.setAssignedSong({
            id: assignment.id,
            title: assignment.title,
            artist: assignment.artist,
          })
          console.log('Assigned song:', assignment.title, 'by', assignment.artist)
        }
      }

      console.log('Game started, status:', data.status)
      // Navigate to the song reveal view
      router.push(`/rooms/${roomCode.value}/reveal`)
    } else {
      const error = await response.json()
      console.error('Failed to start game:', error.detail)
    }
  } catch (error) {
    console.error('Error starting game:', error)
  } finally {
    isStarting.value = false
  }
}
</script>
