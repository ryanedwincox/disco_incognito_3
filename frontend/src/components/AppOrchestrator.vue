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
  <div ref="viewContainer">
    <component v-if="isInitialized" :is="currentView" />
  </div>
</template>

<script setup lang="ts">
/** AppOrchestrator: State-driven view selection based on Pinia store state. Routes to views by auth/room phase. */
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import { websocketService } from '../services/websocket'
import { STORAGE_KEYS } from '../config/storageKeys'
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
  const savedRoomCode = sessionStorage.getItem(STORAGE_KEYS.ROOM_CODE)
  const savedReconnectToken = sessionStorage.getItem(STORAGE_KEYS.RECONNECT_TOKEN)
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

// On reconnect: if server sends lobby status but player was on song picker page,
// restore the song picker view so they don't lose their progress.
// Watches BOTH status and code: handles the case where status is already "lobby"
// when the room code is set (same-value watcher skip would otherwise miss it).
watch(
  [() => roomStore.status, () => roomStore.code],
  ([status, code]) => {
    if (status !== 'lobby') return
    if (!code) return
    const raw = localStorage.getItem(STORAGE_KEYS.SONG_PICKER_STATE)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as { roomCode?: string }
      if (typeof saved.roomCode === 'string' && saved.roomCode === code) {
        roomStore.setStatus('picking_songs')
      }
    } catch {
      // Malformed storage entry — ignore
    }
  }
)

// Focus management: move focus to heading on view transitions for screen readers
const viewContainer = ref<HTMLElement | null>(null)

watch(currentView, async () => {
  await nextTick()
  if (!viewContainer.value) return
  // h2 fallback: RoomLobbyView still uses h2 (needs design decision for h1)
  const heading = viewContainer.value.querySelector('h1, h2') as HTMLElement | null
  if (!heading) return
  heading.setAttribute('tabindex', '-1')
  heading.focus()
})
</script>
