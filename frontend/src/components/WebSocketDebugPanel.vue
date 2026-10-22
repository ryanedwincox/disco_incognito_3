<!-- WebSocket debug panel for development. Shows connection status and last message in expandable panel. Only visible in test mode. -->
<template>
  <div class="fixed bottom-0 left-0 right-0 z-30">
    <!-- Toggle Button -->
    <button
      class="bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-800 transition-all duration-200"
      type="button"
      @click="expanded = !expanded"
    >
      WS Debug: {{ wsStore.status }}
      <span class="ml-2">{{ expanded ? '▼' : '▲' }}</span>
    </button>

    <!-- Expanded Panel -->
    <div
      class="bg-zinc-900 text-white overflow-hidden transition-all duration-200"
      :class="expanded ? 'max-h-96' : 'max-h-0'"
    >
      <div class="p-4">
        <div class="mb-2 text-sm text-zinc-400">Last Message:</div>
        <pre class="font-mono text-xs bg-zinc-800 p-3 rounded-sm overflow-auto max-h-64">{{
          wsStore.lastMessage ? JSON.stringify(wsStore.lastMessage, null, 2) : 'No messages yet'
        }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'

const wsStore = useWebSocketStore()
const expanded = ref(false)
</script>
