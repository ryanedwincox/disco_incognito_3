<!-- Demo view that displays error notifications on mount. Used for screenshot capture of exception/error notification states. Shows both error and warning notifications automatically. -->
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
/** Demo view that displays error notifications on mount for screenshot capture. */
import { onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notifications'

const notificationStore = useNotificationStore()

let warningTimerId: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  // Show error notification for screenshot
  notificationStore.error(
    'Connection Failed',
    'Unable to connect to the server. Please check your connection and try again.'
  )

  // Also show a warning
  warningTimerId = setTimeout(() => {
    notificationStore.warning(
      'Session Expiring',
      'Your session is about to expire. Some features may be limited.',
      true // persistent
    )
  }, 100)
})

onUnmounted(() => {
  if (warningTimerId !== undefined) {
    clearTimeout(warningTimerId)
  }
})
</script>
