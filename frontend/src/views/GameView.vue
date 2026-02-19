<!-- GameView: Active game round view with host-controlled listening phase. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <header class="px-6 pt-12 pb-6 text-center space-y-2">
      <h1 class="text-2xl font-semibold uppercase tracking-widest">Round In Progress</h1>
      <p class="text-4xl" aria-hidden="true">🎵</p>
    </header>

    <main class="flex-1 flex items-center justify-center px-6">
      <div class="w-full max-w-md space-y-6">
        <!-- Assigned Song Info -->
        <div v-if="assignedSong" class="bg-zinc-900 rounded-3xl border border-zinc-500 p-6 text-center space-y-2">
          <p class="text-sm uppercase text-zinc-400">Now Playing</p>
          <h3 class="text-2xl font-bold">{{ assignedSong.title }}</h3>
          <p class="text-lg text-zinc-400">{{ assignedSong.artist }}</p>
        </div>

        <!-- Host controls -->
        <div v-if="isHost" class="text-center space-y-4">
          <button
            class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors"
            type="button"
            @click="endListening"
          >
            End Listening
          </button>
        </div>

        <!-- Non-host waiting message -->
        <p v-else class="text-center text-zinc-400">
          Waiting for host to end listening...
        </p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
/** Active game round view with host-controlled listening phase. Shows assigned song and provides host end-listening control. */
import { computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useAuthStore } from '@/stores/auth'
import { useRoomApi } from '@/composables/useRoomApi'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { handleRoomResponse, API_URL } = useRoomApi()

const assignedSong = computed(() => roomStore.assignedSong)

const isHost = computed(() => {
  const currentUserId = authStore.user?.id
  if (!currentUserId) return false
  const currentPlayer = roomStore.players.find(p => p.id === currentUserId)
  return currentPlayer?.isHost ?? false
})

async function endListening() {
  const playerId = authStore.user?.id
  const roomCode = roomStore.code
  if (!playerId || !roomCode) return

  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode}/end-listening`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })

    if (await handleRoomResponse(response)) return

    if (response.ok) {
      const data = await response.json()
      roomStore.setStatus(data.status)
    } else {
      const error = await response.json()
      console.error('Failed to end listening:', error.detail)
    }
  } catch (error) {
    console.error('Error ending listening:', error)
  }
}
</script>
