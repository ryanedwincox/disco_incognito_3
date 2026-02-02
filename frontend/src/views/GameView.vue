<!-- Active game round view with countdown timer. Shows remaining time during the 90-second listening phase. Includes the music player bar for playback control during the round. Coordinates synchronized audio playback using playback_start_time from server. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <header class="px-6 pt-12 pb-6 text-center space-y-2">
      <h2 class="text-2xl font-semibold uppercase tracking-widest">Round In Progress</h2>
      <p class="text-zinc-400 text-sm">Music plays for 90 seconds. Keep listening and watch other players.</p>
    </header>

    <main class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
        <p class="text-sm uppercase text-zinc-400">
          {{ waitingForSync ? 'Syncing...' : 'Time Remaining' }}
        </p>
        <p class="text-6xl font-bold text-disco-pink">01:30</p>
      </div>
    </main>

    <div v-if="isHost" class="px-6 pb-6 flex justify-center">
      <button
        class="px-6 py-3 rounded-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold transition-colors"
        type="button"
        @click="endListening"
      >
        End Listening
      </button>
    </div>

    <MusicPlayerBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import MusicPlayerBar from '@/components/MusicPlayerBar.vue'
import { useGameStore } from '@/stores/game'
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { useAuthStore } from '@/stores/auth'
import { useRoomApi } from '@/composables/useRoomApi'

const gameStore = useGameStore()
const musicStore = useMusicStore()
const roomStore = useRoomStore()
const authStore = useAuthStore()
const { API_URL } = useRoomApi()

const isHost = computed(() => {
  const currentUserId = authStore.user?.id
  if (!currentUserId) return false
  const currentPlayer = roomStore.players.find(p => p.id === currentUserId)
  return currentPlayer?.isHost ?? false
})

async function endListening() {
  const playerId = authStore.user?.id
  const roomCode = roomStore.code
  if (!playerId || !roomCode) return

  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomCode}/end-listening`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })

    if (response.ok) {
      const data = await response.json()
      roomStore.setStatus(data.status)
      console.log('Listening ended, status:', data.status)
    } else {
      const error = await response.json()
      console.error('Failed to end listening:', error.detail)
    }
  } catch (error) {
    console.error('Error ending listening:', error)
  }
}

const waitingForSync = ref(false)
let playbackTimer: number | null = null

/**
 * Schedule audio playback for the synchronized start time.
 * If the start time has already passed, starts immediately.
 */
function schedulePlayback() {
  const startTimeStr = gameStore.playbackStartTime
  if (!startTimeStr) {
    console.log('No playback_start_time set, skipping sync')
    return
  }

  const startTime = new Date(startTimeStr).getTime()
  const now = Date.now()
  const delayMs = startTime - now

  console.log('Playback sync:', {
    server_start_time: startTimeStr,
    client_now: new Date().toISOString(),
    delay_ms: delayMs
  })

  if (delayMs <= 0) {
    // Start time already passed, start immediately
    console.log(`Start time passed ${-delayMs}ms ago, starting playback immediately`)
    triggerPlayback()
  } else {
    // Wait until the scheduled time
    waitingForSync.value = true
    console.log(`Waiting ${delayMs}ms until synchronized playback start`)
    playbackTimer = window.setTimeout(() => {
      waitingForSync.value = false
      triggerPlayback()
    }, delayMs)
  }
}

/**
 * Trigger audio playback using the music store.
 */
function triggerPlayback() {
  const actualStartTime = Date.now()
  const expectedStartTime = gameStore.playbackStartTime
    ? new Date(gameStore.playbackStartTime).getTime()
    : actualStartTime
  const driftMs = actualStartTime - expectedStartTime

  console.log('Triggering playback:', {
    actual_start: new Date(actualStartTime).toISOString(),
    expected_start: gameStore.playbackStartTime,
    drift_ms: driftMs
  })

  // Get the assigned song for the current player and play it
  const assignedSong = roomStore.assignedSong
  if (assignedSong && musicStore.currentTrack) {
    musicStore.playTrack(musicStore.currentTrack.uri, musicStore.activeDeviceId || undefined)
  } else {
    console.log('No track available for playback')
  }
}

onMounted(() => {
  schedulePlayback()
})

onUnmounted(() => {
  if (playbackTimer !== null) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
})
</script>
