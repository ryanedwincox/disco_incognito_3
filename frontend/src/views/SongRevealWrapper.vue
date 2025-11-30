<!-- Wrapper for SongRevealView that fetches room state and determines player's song assignment. Extracts song from room.current_round.player_assignments and determines if player is incognito. -->
<template>
  <SongRevealView
    :song="playerSong"
    :is-incognito="isIncognito"
    :show-ready-button="false"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'
import type { TrackInfo } from '../stores/music'
import SongRevealView from './SongRevealView.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const route = useRoute()
const roomStore = useRoomStore()
const authStore = useAuthStore()

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

// Determine if current player is the incognito player
// This is determined by checking if their assigned song matches song_for_incognito
const isIncognito = computed(() => {
  // For now, we don't have direct access to song_for_incognito from the API
  // The backend hides incognito_player_id for security
  // We'll need to check if our assigned song is the "different" one
  // This would require comparing with the room's current_round data
  // For the initial implementation, default to false
  // TODO: Implement proper isIncognito detection when API provides song_for_incognito
  return false
})

onMounted(async () => {
  // Load auth state from localStorage (in case of page refresh)
  authStore.loadFromStorage()

  // Set room code in store
  roomStore.setRoom(roomCode.value)

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
