<!-- Pre-playback countdown overlay. Shows 3→2→1→GO! before music starts. Driven by gameStore.playbackStartTime; sets countdownSecondsLeft to null on completion to yield to GameView. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
    <h2 class="text-2xl font-semibold uppercase tracking-widest mb-12">Get Ready!</h2>
    <p class="text-8xl font-bold text-disco-pink">{{ displayText }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'

/** Duration to flash "GO!" before yielding to GameView. */
const GO_DISPLAY_MS = 400

/** Max countdown seconds (safety clamp for unexpected server delays). */
const MAX_COUNTDOWN_SECONDS = 5

const gameStore = useGameStore()
const displayText = ref('')

let intervalId: number | null = null
let goTimeout: number | null = null
let targetTimeMs: number | null = null

/**
 * Derive remaining seconds from the absolute target time.
 * Avoids setInterval drift by re-computing from clock on each tick.
 */
function getRemainingSeconds(): number {
  if (targetTimeMs === null) return 0
  return Math.ceil((targetTimeMs - Date.now()) / 1000)
}

onMounted(() => {
  const startTimeStr = gameStore.playbackStartTime
  if (!startTimeStr) {
    gameStore.setCountdownSecondsLeft(null)
    return
  }

  targetTimeMs = new Date(startTimeStr).getTime()
  let secondsLeft = getRemainingSeconds()

  if (secondsLeft <= 0) {
    gameStore.setCountdownSecondsLeft(null)
    return
  }
  if (secondsLeft > MAX_COUNTDOWN_SECONDS) {
    secondsLeft = MAX_COUNTDOWN_SECONDS
  }

  gameStore.setCountdownSecondsLeft(secondsLeft)
  displayText.value = String(secondsLeft)

  intervalId = window.setInterval(() => {
    const remaining = getRemainingSeconds()
    if (remaining > 0) {
      gameStore.setCountdownSecondsLeft(remaining)
      displayText.value = String(remaining)
    } else {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
      displayText.value = 'GO!'
      goTimeout = window.setTimeout(() => {
        gameStore.setCountdownSecondsLeft(null)
      }, GO_DISPLAY_MS)
    }
  }, 1000)
})

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (goTimeout !== null) {
    clearTimeout(goTimeout)
    goTimeout = null
  }
})
</script>
