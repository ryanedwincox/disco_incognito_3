<!-- Development testing view for notification and error state displays. Provides buttons to trigger various notification types (error, warning, info, success), simulate server disconnection, and throw test exceptions. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 py-12">
    <header class="text-center mb-8">
      <h1 class="text-3xl font-semibold tracking-wide">Error State Tests</h1>
      <p class="text-zinc-400 text-sm mt-2">Testing notification and error displays</p>
    </header>

    <div class="max-w-2xl mx-auto space-y-4">
      <!-- Trigger Error Notification -->
      <button
        class="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="showError"
      >
        Show Error Notification
      </button>

      <!-- Trigger Warning Notification -->
      <button
        class="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="showWarning"
      >
        Show Warning Notification
      </button>

      <!-- Trigger Info Notification -->
      <button
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="showInfo"
      >
        Show Info Notification
      </button>

      <!-- Trigger Success Notification -->
      <button
        class="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="showSuccess"
      >
        Show Success Notification
      </button>

      <!-- Toggle Server Disconnection -->
      <button
        class="w-full font-semibold py-3 rounded-full transition-colors"
        :class="serverDisconnected ? 'bg-green-600 hover:bg-green-500' : 'bg-red-800 hover:bg-red-700'"
        type="button"
        @click="toggleServerConnection"
      >
        {{ serverDisconnected ? 'Reconnect Server' : 'Simulate Server Disconnect' }}
      </button>

      <!-- Throw Exception -->
      <button
        class="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="throwException"
      >
        Throw Test Exception
      </button>

      <!-- Back Button -->
      <button
        class="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-full transition-colors"
        type="button"
        @click="goBack"
      >
        Back to Login
      </button>
    </div>

    <!-- Current State Display -->
    <div class="max-w-2xl mx-auto mt-8 bg-zinc-900 rounded-2xl p-6">
      <h3 class="text-lg font-semibold mb-4">Current State</h3>
      <div class="space-y-2 text-sm font-mono">
        <div class="flex justify-between">
          <span class="text-zinc-400">WebSocket Status:</span>
          <span
            :class="{
              'text-green-400': wsStore.status === 'connected',
              'text-yellow-400': wsStore.status === 'connecting',
              'text-red-400': wsStore.status === 'disconnected'
            }"
          >
            {{ wsStore.status }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Active Notifications:</span>
          <span class="text-white">{{ notificationStore.notifications.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocketStore } from '@/stores/websocket'
import { useNotificationStore } from '@/stores/notifications'

const router = useRouter()
const wsStore = useWebSocketStore()
const notificationStore = useNotificationStore()

const serverDisconnected = ref(false)

function showError() {
  notificationStore.error(
    'Connection Failed',
    'Unable to connect to the server. Please check your connection and try again.'
  )
}

function showWarning() {
  notificationStore.warning(
    'Session Expiring',
    'Your session is about to expire. Some features may be limited.',
    true // persistent
  )
}

function showInfo() {
  notificationStore.info('Room Code Copied', 'Share this code with your friends to join the game!')
}

function showSuccess() {
  notificationStore.success('Song Pair Added', 'Your tracks have been added to the pool.')
}

function toggleServerConnection() {
  serverDisconnected.value = !serverDisconnected.value
  if (serverDisconnected.value) {
    wsStore.setStatus('disconnected')
  } else {
    wsStore.setStatus('connected')
  }
}

function throwException() {
  // This will throw an uncaught exception
  throw new Error('Test exception: Simulated runtime error for testing error handling')
}

function goBack() {
  // Reset state before going back
  wsStore.setStatus('connected')
  serverDisconnected.value = false
  notificationStore.clearAll()
  router.push('/')
}
</script>
