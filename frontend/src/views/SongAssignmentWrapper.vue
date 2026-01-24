<!-- Wrapper for SongAssignmentView that fetches room state and determines player's song assignment. Extracts song from room.current_round.player_assignments and determines if player is incognito. Includes MusicPlayerBar at bottom for playback controls. -->
<template>
  <div class="min-h-screen">
    <SongAssignmentView
      :song="playerSong"
      :is-incognito="false"
      :show-ready-button="!isReady"
      @ready="handleReady"
    />
    <!-- Music Player Bar (Fixed Bottom) -->
    <div class="fixed bottom-0 left-0 right-0">
      <MusicPlayerBar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'
import { useMusicStore, type TrackInfo } from '../stores/music'
import { useRoomApi } from '../composables/useRoomApi'
import SongAssignmentView from './SongAssignmentView.vue'
import MusicPlayerBar from '../components/MusicPlayerBar.vue'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const musicStore = useMusicStore()
const { handleRoomResponse, API_URL } = useRoomApi()

const roomCode = computed(() => roomStore.code || '')
const currentUserId = computed(() => authStore.user?.id ?? null)
const isReady = ref(false)
const readyPlayers = ref<string[]>([])

// Convert roomStore.assignedSong to TrackInfo format expected by SongAssignmentView
const playerSong = computed<TrackInfo | null>(() => {
  const assigned = roomStore.assignedSong
  if (!assigned) return null

  return {
    id: assigned.id,
    name: assigned.title,
    artist: assigned.artist,
    album: '',
    duration: 0,
    uri: ''
  }
})


onMounted(async () => {
  // Load auth state from localStorage (in case of page refresh)
  authStore.loadFromStorage()

  // Fetch music player state (devices and playback) for MusicPlayerBar
  if (authStore.isAuthenticated) {
    await musicStore.getDevices()
    await musicStore.getPlaybackState()
  }

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
          readyPlayers.value = data.current_round.ready_players
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
        readyPlayers.value = data.current_round.ready_players
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

// Note: Status changes from WebSocket will trigger AppOrchestrator to switch views automatically
</script>
