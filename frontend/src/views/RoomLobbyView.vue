<!-- RoomLobbyView: Room lobby showing players and song pairs before game starts. Displays room code, player list with host indicator, and song pair section. Provides navigation to song picker and option to leave room. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <div class="max-w-lg mx-auto">
    <header class="mb-8">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-sm uppercase text-zinc-400">Room Code</h2>
          <p class="text-4xl font-bold tracking-[0.5em]">{{ roomCode }}</p>
        </div>
      </div>
      <div class="flex flex-col space-y-3">
        <button
          class="w-full px-6 py-3 rounded-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold transition-colors"
          type="button"
          @click="pickSongs"
        >
          Add Songs
        </button>
        <button
          v-if="isHost"
          class="w-full px-6 py-3 rounded-full bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="isStarting"
          @click="startGame"
        >
          {{ isStarting ? 'Starting...' : 'Start Game' }}
        </button>
      </div>
    </header>

    <section class="space-y-6">
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
          </li>
          <li v-if="players.length === 0" class="text-zinc-400 text-center py-4">
            No players yet
          </li>
        </ul>
      </div>

      <div class="bg-zinc-900/70 rounded-3xl border border-zinc-500 p-6">
        <h3 class="text-lg font-semibold mb-4">Song Pairs</h3>
        <p class="text-zinc-400">{{ songCountText }}</p>
      </div>
    </section>

    <button
      class="w-full px-6 py-3 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
      type="button"
      :disabled="isLeaving"
      @click="leaveRoom"
    >
      {{ isLeaving ? 'Leaving...' : 'Leave' }}
    </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'
import { useRoomApi } from '../composables/useRoomApi'
import { useActionDebounce } from '../composables/useActionDebounce'
import { useNotificationStore } from '../stores/notifications'
import { websocketService } from '../services/websocket'
import { STORAGE_KEYS } from '../config/storageKeys'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { roomFetch } = useRoomApi()
const notifications = useNotificationStore()
const { isPending: isStarting, trigger: triggerStart } = useActionDebounce()

const roomCode = computed(() => roomStore.code || '')
const players = computed(() => roomStore.players)
const currentUserId = computed(() => authStore.user?.id ?? null)
const songCountText = computed(() => {
  const count = roomStore.songCount
  if (count === 1) return '1 song pair in queue'
  return `${count} song pairs in queue`
})
const isHost = computed(() => {
  if (!currentUserId.value) return false
  const currentPlayer = players.value.find(p => p.id === currentUserId.value)
  return currentPlayer?.isHost ?? false
})
const isLeaving = ref(false)

onMounted(async () => {
  // Load auth state from sessionStorage (in case of page refresh)
  authStore.loadFromStorage()

  if (!roomCode.value) {
    return
  }

  // Fetch room data from API if available
  try {
    const response = await roomFetch(`/api/rooms/${roomCode.value}`)

    if (response.status === 404) {
      return // roomFetch already redirected
    }

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

        // Set song count from API response
        if (Array.isArray(data.song_pairs)) {
          roomStore.setSongCount(data.song_pairs.length)
        }

        // Auto-join if current user is not already in the room
        const userId = authStore.user?.id
        const displayName = authStore.userName
        const isInRoom = data.players.some((p: { id: string }) => p.id === userId)

        if (userId && !isInRoom) {
          await joinRoomAsPlayer(userId, displayName)
        }
      }
    }
  } catch {
    // Best-effort fetch — failures are non-fatal; the lobby still renders.
  }
})

async function joinRoomAsPlayer(playerId: string, displayName: string) {
  try {
    const response = await roomFetch(`/api/rooms/${roomCode.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        display_name: displayName,
      }),
    })

    if (response.status === 404) {
      return // roomFetch already redirected
    }

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
    } else {
      const err = await response.json().catch(() => ({}))
      console.error('Failed to join room:', err)
      notifications.error('Join Failed', err.detail || 'Could not join the room — please try again.')
    }
  } catch (error) {
    console.error('Could not join room:', error)
    notifications.error('Join Failed', 'Could not join the room — please try again.')
  }
}

async function leaveRoom() {
  const userId = authStore.user?.id

  isLeaving.value = true
  try {
    // Disconnect WS before HTTP leave call
    websocketService.disconnect()

    // Call API to leave room
    if (userId && roomCode.value) {
      try {
        const response = await roomFetch(`/api/rooms/${roomCode.value}/leave`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: userId }),
        })
        if (!response.ok && response.status !== 404) {
          const err = await response.json().catch(() => ({}))
          console.error('Could not leave room via API:', err)
          // Non-fatal — proceed with local cleanup anyway
        }
      } catch (error) {
        console.error('Could not leave room via API:', error)
        notifications.error('Leave Failed', 'Could not leave the room gracefully — you have been removed locally.')
      }
    }

    // Clear reconnect token explicitly (sessionStorage, not localStorage)
    sessionStorage.removeItem(STORAGE_KEYS.RECONNECT_TOKEN)

    // Reset room state - AppOrchestrator will switch to RoomSelectionView
    roomStore.reset()
  } finally {
    isLeaving.value = false
  }
}

function pickSongs() {
  // Set status to picking_songs - AppOrchestrator will switch to SongPickerView
  roomStore.setStatus('picking_songs')
}

async function startGame() {
  if (!currentUserId.value) {
    console.error('No player ID available')
    return
  }

  try {
    await triggerStart(async () => {
      const response = await roomFetch(`/api/rooms/${roomCode.value}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: currentUserId.value,
        }),
      })

      if (response.status === 404) {
        return // roomFetch already redirected
      }

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
          }
        }

        // AppOrchestrator will switch view based on roomStore.status
      } else {
        const err = await response.json().catch(() => ({}))
        console.error('Failed to start game:', err.detail)
        notifications.error('Start Failed', err.detail || 'Could not start the game — please try again.')
      }
    })
  } catch (error) {
    console.error('Error starting game:', error)
    notifications.error('Start Failed', 'Could not start the game — please try again.')
  }
}
</script>
