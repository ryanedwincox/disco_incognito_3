<!--
  AppOrchestrator: State-driven view selection based on Pinia store state.
  Phase-to-View Mapping:
    - unauthenticated → LoginView
    - authenticated_no_room → RoomSelectionView
    - lobby → RoomLobbyView
    - picking_songs → SongPickerView
    - song_selection → SongAssignmentView
    - playing → GameView
    - guessing → GuessingView
    - results → ResultsView
-->
<template>
  <component :is="currentView" />
</template>

<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import { websocketService } from '../services/websocket'
import LoginView from '../views/LoginView.vue'
import RoomSelectionView from '../views/RoomSelectionView.vue'
import RoomLobbyView from '../views/RoomLobbyView.vue'
import SongPickerView from '../views/SongPickerView.vue'
import SongAssignmentWrapper from '../views/SongAssignmentWrapper.vue'
import GameView from '../views/GameView.vue'
import GuessingView from '../views/GuessingView.vue'
import ResultsView from '../views/ResultsView.vue'

const authStore = useAuthStore()
const roomStore = useRoomStore()

// Load auth state from localStorage on app init (before computing which view to show)
authStore.loadFromStorage()

// Phase-to-view mapping
const phaseToViewMap: Record<string, Component> = {
  lobby: RoomLobbyView,
  picking_songs: SongPickerView,
  song_selection: SongAssignmentWrapper,
  playing: GameView,
  guessing: GuessingView,
  results: ResultsView
}

// Computed application phase
type AppPhase = 'unauthenticated' | 'authenticated_no_room' | 'lobby' | 'picking_songs' | 'song_selection' | 'playing' | 'guessing' | 'results'

const appPhase = computed<AppPhase>(() => {
  if (!authStore.isAuthenticated) {
    return 'unauthenticated'
  }
  if (!roomStore.code) {
    return 'authenticated_no_room'
  }
  return roomStore.status as AppPhase
})

// Computed view based on phase
const currentView = computed<Component>(() => {
  if (appPhase.value === 'unauthenticated') {
    return LoginView
  }
  if (appPhase.value === 'authenticated_no_room') {
    return RoomSelectionView
  }
  return phaseToViewMap[appPhase.value] || RoomLobbyView
})

// Connect to app-level WebSocket on auth success
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated, wasAuthenticated) => {
    if (isAuthenticated && !wasAuthenticated && authStore.user?.id) {
      // Connect to client WebSocket on authentication
      websocketService.connectClient(authStore.user.id)
    } else if (!isAuthenticated && wasAuthenticated) {
      // Disconnect on logout
      websocketService.disconnect()
      roomStore.reset()
    }
  },
  { immediate: true }
)
</script>
