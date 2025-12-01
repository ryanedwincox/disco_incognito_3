<!-- Server disconnection banner shown when WebSocket connection is lost. Displays at screen bottom with reconnection status and retry button. Watches WebSocket store status and shows appropriate messaging. -->
<template>
  <Transition name="slide">
    <div
      v-if="isDisconnected"
      class="fixed bottom-0 left-0 right-0 z-40 bg-red-900 border-t-2 border-red-500 text-white"
      role="alert"
    >
      <div class="px-6 py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Warning Icon -->
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-red-300 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          <!-- Message -->
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold mb-0.5">Server Disconnected</h3>
            <p class="text-xs text-red-200">
              {{ reconnecting ? 'Attempting to reconnect...' : 'Lost connection to server. Check your network.' }}
            </p>
          </div>
        </div>

        <!-- Retry Button -->
        <button
          v-if="!reconnecting"
          class="flex-shrink-0 bg-red-700 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-full text-sm transition-colors"
          type="button"
          @click="retry"
        >
          Retry
        </button>

        <!-- Connecting Spinner -->
        <div v-else class="flex-shrink-0">
          <svg class="w-5 h-5 text-red-300 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'
import { websocketService } from '@/services/websocket'

const wsStore = useWebSocketStore()
const reconnecting = ref(false)

// Only show banner if:
// 1. We've previously had a successful connection (hasEverConnected)
// 2. AND we're currently disconnected or connecting (lost connection)
// This prevents showing the banner during initial page load / first connection attempt
const isDisconnected = computed(
  () => wsStore.hasEverConnected && (wsStore.status === 'disconnected' || wsStore.status === 'connecting')
)

// Watch for status changes
watch(
  () => wsStore.status,
  (newStatus) => {
    if (newStatus === 'connecting') {
      reconnecting.value = true
    } else if (newStatus === 'connected') {
      reconnecting.value = false
    } else if (newStatus === 'disconnected') {
      reconnecting.value = false
    }
  }
)

function retry() {
  reconnecting.value = true
  console.log('Retry button clicked - attempting to reconnect...')
  websocketService.reconnect()
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(100%);
}
</style>
