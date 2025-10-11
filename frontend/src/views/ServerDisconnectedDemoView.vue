<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 py-12">
    <header class="text-center mb-8">
      <h2 class="text-3xl font-semibold tracking-wide">Server Disconnected State</h2>
      <p class="text-zinc-400 text-sm mt-2">Demonstration of server disconnection warning</p>
    </header>

    <div class="max-w-2xl mx-auto">
      <div class="bg-zinc-900 rounded-3xl p-8 text-center">
        <p class="text-zinc-400">
          The red banner at the bottom shows when the WebSocket connection to the server is lost.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
