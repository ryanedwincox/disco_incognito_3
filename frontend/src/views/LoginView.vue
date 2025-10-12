<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
    <header class="text-center mb-10">
      <h1 class="text-4xl font-bold tracking-[0.3em] uppercase mb-4">Disco Incognito</h1>
      <p v-if="isTestMode" class="text-sm text-zinc-400 mt-2">
        Test Mode: Each login creates a new random user
      </p>
    </header>
    <div class="w-full max-w-sm">
      <button
        class="w-full bg-disco-pink hover:bg-disco-pink-light text-black font-semibold px-8 py-3 rounded-full transition-colors shadow-lg"
        type="button"
        @click="handleLogin"
      >
        {{ isTestMode ? 'Create Test User' : 'Log in with Spotify' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Check if we're in test mode via environment variable
const isTestMode = computed(() => {
  return import.meta.env.VITE_TEST_MODE === 'true'
})

function handleLogin() {
  // TODO: Implement actual login logic
  // In test mode: This will call the backend which uses TestMusicAdapter
  // In live mode: This will call the backend which uses SpotifyAdapter
  console.log(isTestMode.value ? 'Creating test user...' : 'Logging in with Spotify...')
}
</script>
