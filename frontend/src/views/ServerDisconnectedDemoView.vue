<!-- Demo view that simulates server disconnection state. Sets WebSocket status to disconnected on mount for screenshot capture. Resets connection state when leaving the view. -->
<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
    <header class="text-center mb-10">
      <h1 class="text-4xl font-bold tracking-[0.3em] uppercase mb-4">Disco Incognito</h1>
    </header>
    <div class="w-full max-w-sm space-y-3">
      <button
        class="w-full bg-disco-pink hover:bg-disco-pink-light text-black font-semibold px-8 py-3 rounded-full transition-colors shadow-lg"
        type="button"
      >
        Login
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Demo view that simulates server disconnection state for screenshot capture. */
import { onMounted, onUnmounted } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'

const wsStore = useWebSocketStore()

onMounted(() => {
  // Set disconnected state for screenshot
  wsStore.setStatus('disconnected')
})

onUnmounted(() => {
  // Reset to connected when leaving
  wsStore.setStatus('connected')
})
</script>
