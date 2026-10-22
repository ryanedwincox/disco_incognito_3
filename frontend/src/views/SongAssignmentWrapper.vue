<!-- SongAssignmentWrapper: Wrapper for SongAssignmentView that fetches room state and handles song assignment and end-round controls. -->
<template>
  <div class="min-h-screen">
    <SongAssignmentView
      :song="playerSong"
      :is-host="isHost"
      :is-ending-round="isEndingRound"
      @end-round="handleEndRound"
    />
    <!-- Ready button — only shown during song_selection phase before player marks ready -->
    <div v-if="roomStore.status === 'song_selection'" class="fixed bottom-0 left-0 right-0 px-6 pb-6 bg-linear-to-t from-zinc-950 to-transparent">
      <div class="max-w-md mx-auto">
        <button
          v-if="!isReady"
          class="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="isMarkingReady"
          @click="markReady"
        >
          {{ isMarkingReady ? 'Marking ready...' : 'Ready' }}
        </button>
        <div
          v-else
          class="w-full bg-zinc-800 text-green-400 font-semibold py-3 rounded-full text-center border border-green-500/30"
        >
          Ready ✓
        </div>
      </div>
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
import type { TrackInfo } from '../types'
import SongAssignmentView from './SongAssignmentView.vue'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { roomFetch } = useRoomApi()
const notifications = useNotificationStore()
const { isPending: isEndingRound, trigger: triggerEndRound } = useActionDebounce()
const isMarkingReady = ref(false)

const roomCode = computed(() => roomStore.code || '')
const currentUserId = computed(() => authStore.user?.id ?? null)

const isHost = computed(() => {
  if (!currentUserId.value) return false
  const currentPlayer = roomStore.players.find(p => p.id === currentUserId.value)
  return currentPlayer?.isHost ?? false
})

const isReady = computed(() =>
  currentUserId.value !== null &&
  roomStore.readyPlayers.includes(currentUserId.value)
)

// Convert roomStore.assignedSong to TrackInfo format expected by SongAssignmentView
const playerSong = computed<TrackInfo | null>(() => {
  const assigned = roomStore.assignedSong
  if (!assigned) return null

  return {
    id: assigned.id,
    name: assigned.title,
    artist: assigned.artist,
  }
})


onMounted(async () => {
  // Load auth state from sessionStorage (in case of page refresh)
  authStore.loadFromStorage()

  // If assignedSong is not set (page refresh), fetch room data to get it
  if (!roomStore.assignedSong && currentUserId.value && roomCode.value) {
    try {
      const response = await roomFetch(`/api/rooms/${roomCode.value}`)

      if (response.status === 404) {
        return // roomFetch already redirected
      }

      if (response.ok) {
        const data = await response.json()

        // Update room status
        if (data.status) {
          roomStore.setStatus(data.status)
        }

        // Extract assigned song for current player
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

        // Populate readyPlayers from fetched round state
        if (Array.isArray(data.current_round?.ready_players)) {
          roomStore.setReadyPlayers(data.current_round.ready_players)
        }

        // Status update will trigger AppOrchestrator to switch view if needed
      }
    } catch {
      // Best-effort fetch — failures are non-fatal; the view still renders.
    }
  }
})

// Handle ready button click
async function markReady() {
  if (!currentUserId.value || !roomCode.value || isMarkingReady.value || isReady.value) return

  isMarkingReady.value = true
  try {
    const response = await roomFetch(`/api/rooms/${roomCode.value}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: currentUserId.value }),
    })

    if (response.status === 404) return // roomFetch already redirected

    if (response.ok) {
      // Server will broadcast player_ready; optimistically mark locally too
      roomStore.markPlayerReady(currentUserId.value)
    } else {
      const err = await response.json().catch(() => ({}))
      console.error('Failed to mark ready:', err)
      notifications.error('Ready Failed', 'Could not mark you as ready — please try again.')
    }
  } catch (error) {
    console.error('Error marking ready:', error)
    notifications.error('Ready Failed', 'Could not mark you as ready — please try again.')
  } finally {
    isMarkingReady.value = false
  }
}

// Handle end-round button click (host only)
async function handleEndRound() {
  if (!currentUserId.value || !isHost.value) return

  try {
    await triggerEndRound(async () => {
      const response = await roomFetch(`/api/rooms/${roomCode.value}/end-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: currentUserId.value }),
      })

      if (response.status === 404) return // roomFetch already redirected

      if (response.ok) {
        const data = await response.json()
        roomStore.setStatus(data.status)
      } else {
        const err = await response.json().catch(() => ({}))
        console.error('Failed to end round:', err)
        notifications.error('End Round Failed', err.detail || 'Could not end the round — please try again.')
      }
    })
  } catch (error) {
    console.error('Error ending round:', error)
    notifications.error('End Round Failed', 'Could not end the round — please try again.')
  }
}

// Note: Status changes from WebSocket will trigger AppOrchestrator to switch views automatically
</script>
