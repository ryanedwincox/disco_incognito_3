<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 py-12">
    <header class="text-center mb-8">
      <h2 class="text-3xl font-semibold tracking-wide">Exception Display State</h2>
      <p class="text-zinc-400 text-sm mt-2">Demonstration of error notifications</p>
    </header>

    <div class="max-w-2xl mx-auto">
      <div class="bg-zinc-900 rounded-3xl p-8 text-center">
        <p class="text-zinc-400">
          Error and warning notifications appear at the top of the screen with appropriate styling and icons.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notifications'

const notificationStore = useNotificationStore()

onMounted(() => {
  // Show error notification for screenshot
  notificationStore.error(
    'Connection Failed',
    'Unable to connect to the Spotify API. Please check your credentials and try again.'
  )

  // Also show a warning
  setTimeout(() => {
    notificationStore.warning(
      'Premium Required',
      'Spotify Premium account required for playback. Some features may be limited.',
      true // persistent
    )
  }, 100)
})
</script>
