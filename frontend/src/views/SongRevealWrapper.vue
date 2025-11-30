<!-- Wrapper for SongRevealView that fetches room state and determines player's song assignment. Extracts song from room.current_round.player_assignments and determines if player is incognito. Includes MusicPlayerBar at bottom for playback controls. -->
<template>
  <div class="min-h-screen">
    <SongRevealView
      :song="playerSong"
      :is-incognito="false"
      :show-ready-button="true"
    />
    <!-- Music Player Bar (Fixed Bottom) -->
    <div class="fixed bottom-0 left-0 right-0">
      <MusicPlayerBar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'
import { useMusicStore, type TrackInfo } from '../stores/music'
import SongRevealView from './SongRevealView.vue'
import MusicPlayerBar from '../components/MusicPlayerBar.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const route = useRoute()
const roomStore = useRoomStore()
const authStore = useAuthStore()
const musicStore = useMusicStore()

const roomCode = computed(() => route.params.code as string)
const currentUserId = computed(() => authStore.user?.id ?? null)

// Convert roomStore.assignedSong to TrackInfo format expected by SongRevealView
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

  // Set room code in store
  roomStore.setRoom(roomCode.value)

  // Fetch music player state (devices and playback) for MusicPlayerBar
  if (authStore.isAuthenticated) {
    await musicStore.getDevices()
    await musicStore.getPlaybackState()
  }

  // If assignedSong is not set (page refresh), fetch room data to get it
  if (!roomStore.assignedSong && currentUserId.value) {
    try {
      const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}`)
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
      }
    } catch (error) {
      console.log('Could not fetch room data:', error)
    }
  }
})
</script>
