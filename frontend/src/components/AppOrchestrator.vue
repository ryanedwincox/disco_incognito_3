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
  <component v-if="isInitialized" :is="currentView" />
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
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

// Track initialization state - render nothing until auth validation completes
const isInitialized = ref(false)

// Load and validate auth state from localStorage on app init
;(async () => {
  await authStore.loadFromStorage()
  isInitialized.value = true

  // On init: if sessionStorage has roomCode AND reconnect_token, reconnect WS
  const savedRoomCode = sessionStorage.getItem('disco_room_code')
  const savedReconnectToken = sessionStorage.getItem('disco_reconnect_token')
  if (savedRoomCode && savedReconnectToken && authStore.isAuthenticated && authStore.user?.id) {
    roomStore.setRoom(savedRoomCode)
    websocketService.connectToRoom(authStore.user.id, savedRoomCode)
  }
})()

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

// Disconnect WS and reset room on logout
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated, wasAuthenticated) => {
    if (!isAuthenticated && wasAuthenticated) {
      websocketService.disconnect()
      roomStore.reset()
    }
  }
)
</script>
