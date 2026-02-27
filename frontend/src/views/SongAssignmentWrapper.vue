<!-- SongAssignmentWrapper: Wrapper for SongAssignmentView that fetches room state and handles song assignment and end-round controls. -->
<template>
  <div class="min-h-screen">
    <SongAssignmentView
      :song="playerSong"
      :is-host="isHost"
      :is-ending-round="isEndingRound"
      @end-round="handleEndRound"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'
import { useRoomApi } from '../composables/useRoomApi'
import type { TrackInfo } from '../types'
import SongAssignmentView from './SongAssignmentView.vue'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { handleRoomResponse, API_URL } = useRoomApi()

const roomCode = computed(() => roomStore.code || '')
const currentUserId = computed(() => authStore.user?.id ?? null)
const isEndingRound = ref(false)

const isHost = computed(() => {
  if (!currentUserId.value) return false
  const currentPlayer = roomStore.players.find(p => p.id === currentUserId.value)
  return currentPlayer?.isHost ?? false
})

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
      const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}`)

      // Handle expired room (404)
      if (await handleRoomResponse(response)) {
        return
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

        // Status update will trigger AppOrchestrator to switch view if needed
      }
    } catch (error) {
      console.log('Could not fetch room data:', error)
    }
  }
})

// Handle end-round button click (host only)
async function handleEndRound() {
  if (!currentUserId.value || !isHost.value) return

  isEndingRound.value = true
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}/end-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: currentUserId.value }),
    })

    if (await handleRoomResponse(response)) return

    if (response.ok) {
      const data = await response.json()
      roomStore.setStatus(data.status)
    } else {
      const error = await response.json()
      console.error('Failed to end round:', error)
    }
  } catch (error) {
    console.error('Error ending round:', error)
  } finally {
    isEndingRound.value = false
  }
}

// Note: Status changes from WebSocket will trigger AppOrchestrator to switch views automatically
</script>
