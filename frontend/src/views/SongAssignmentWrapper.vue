<!-- SongAssignmentWrapper: Wrapper for SongAssignmentView that fetches room state and determines song assignment. -->
<template>
  <div class="min-h-screen">
    <SongAssignmentView
      :song="playerSong"
      :show-ready-button="!isReady"
      :is-host="isHost"
      :players="roomStore.players"
      :ready-players="roomStore.readyPlayers"
      @ready="handleReady"
      @force-start="handleForceStart"
    />
  </div>
</template>

<script setup lang="ts">
/** Wrapper for SongAssignmentView that fetches room state and determines player's song assignment. */
import { computed, onMounted, ref } from 'vue'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'
import { useRoomApi } from '../composables/useRoomApi'
import { useWebSocketStore } from '../stores/websocket'
import type { TrackInfo } from '../types'
import SongAssignmentView from './SongAssignmentView.vue'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const wsStore = useWebSocketStore()
const { handleRoomResponse, API_URL } = useRoomApi()

const roomCode = computed(() => roomStore.code || '')
const currentUserId = computed(() => authStore.user?.id ?? null)
const isReady = ref(false)
const players = computed(() => roomStore.players)
const isHost = computed(() => {
  if (!currentUserId.value) return false
  const currentPlayer = players.value.find(p => p.id === currentUserId.value)
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

        // Track ready players
        if (data.current_round?.ready_players) {
          roomStore.setReadyPlayers(data.current_round.ready_players)
          if (currentUserId.value && data.current_round.ready_players.includes(currentUserId.value)) {
            isReady.value = true
          }
        }

        // Status update will trigger AppOrchestrator to switch view if needed
      }
    } catch (error) {
      console.log('Could not fetch room data:', error)
    }
  }
})

// Handle ready button click
async function handleReady() {
  if (!currentUserId.value || isReady.value) return

  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: currentUserId.value })
    })

    // Handle expired room (404)
    if (await handleRoomResponse(response)) {
      return
    }

    if (response.ok) {
      isReady.value = true
      const data = await response.json()

      // Update ready players list
      if (data.current_round?.ready_players) {
        roomStore.setReadyPlayers(data.current_round.ready_players)
      }

      // Update room status - AppOrchestrator will switch view if 'playing'
      if (data.status) {
        roomStore.setStatus(data.status)
      }
    }
  } catch (error) {
    console.log('Could not mark ready:', error)
  }
}

// Handle force-start button click (host only)
async function handleForceStart() {
  if (!currentUserId.value || !isHost.value) return

  const url = `${API_URL}/api/rooms/${roomCode.value}/force-start`
  console.log('[force-start] POST', url, { player_id: currentUserId.value, wsStatus: wsStore.status })

  if (wsStore.status !== 'connected') {
    console.warn(`[force-start] WebSocket is ${wsStore.status} — force-start may succeed but phase_changed won't arrive`)
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: currentUserId.value })
    })

    console.log('[force-start] response', response.status, response.statusText)

    // Handle expired room (404)
    if (await handleRoomResponse(response)) {
      return
    }

    if (!response.ok) {
      const data = await response.json()
      console.error('[force-start] failed:', response.status, data.detail)
    } else {
      console.log('[force-start] success — waiting for WebSocket phase_changed')
    }
  } catch (error) {
    console.error('[force-start] network error:', error)
  }
}

// Note: Status changes from WebSocket will trigger AppOrchestrator to switch views automatically
</script>
