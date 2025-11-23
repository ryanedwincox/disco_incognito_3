<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
    <header class="text-center mb-10">
      <h1 class="text-4xl font-bold tracking-[0.3em] uppercase mb-4">DISCO INCOGNITO</h1>
    </header>

    <div class="w-full max-w-sm space-y-4">
      <!-- Guest Name Input Form (shown when showNameInput is true) -->
      <div v-if="showNameInput" class="space-y-4">
        <div>
          <label for="displayName" class="block text-sm text-zinc-400 mb-2">Enter your name</label>
          <input
            id="displayName"
            v-model="displayName"
            type="text"
            placeholder="Your name"
            maxlength="50"
            class="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-disco-pink transition-colors"
            @keyup.enter="handleManualLogin"
          />
        </div>
        <button
          class="w-full bg-disco-pink hover:bg-disco-pink-light text-black font-semibold px-8 py-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="isLoading || !displayName.trim()"
          @click="handleManualLogin"
        >
          {{ isLoading ? 'Joining...' : 'Join as Guest' }}
        </button>
        <button
          class="w-full text-zinc-400 hover:text-white py-2 transition-colors"
          type="button"
          @click="showNameInput = false"
        >
          ← Back
        </button>
      </div>

      <!-- Main Login Options (shown when showNameInput is false) -->
      <template v-else>
        <!-- Spotify Login Button -->
        <button
          class="w-full bg-disco-pink hover:bg-disco-pink-light text-black font-semibold px-8 py-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="isLoading"
          @click="handleSpotifyLogin"
        >
          {{ isLoading ? 'Logging in...' : 'Login with Spotify' }}
        </button>

        <!-- Manual/Guest Login Button -->
        <button
          class="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-8 py-3 rounded-full transition-colors border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="isLoading"
          @click="showNameInput = true"
        >
          Continue as Guest
        </button>

        <p class="text-xs text-zinc-500 text-center mt-2">
          Guest users can join games but cannot select songs
        </p>
      </template>

      <!-- Error Message -->
      <div
        v-if="errorMessage"
        class="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-xl text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div
        v-if="successMessage"
        class="bg-green-900/30 border border-green-500 text-green-200 px-4 py-3 rounded-xl text-sm"
      >
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showNameInput = ref(false)
const displayName = ref('')

async function handleSpotifyLogin() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Redirect to Spotify OAuth
    await authStore.spotifyLogin()
    // Note: Will redirect to Spotify, so code after this won't execute
  } catch (error: unknown) {
    console.error('Login error:', error)
    errorMessage.value = (error as Error).message || 'An error occurred during login'
  } finally {
    isLoading.value = false
  }
}

async function handleManualLogin() {
  if (!displayName.value.trim()) return

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await authStore.manualLogin(displayName.value.trim())

    if (result.success) {
      successMessage.value = `Welcome, ${authStore.userName}!`
      // Redirect to room selection after short delay
      setTimeout(() => {
        router.push('/rooms')
      }, 1000)
    } else {
      errorMessage.value = result.error || 'Failed to join as guest'
    }
  } catch (error: unknown) {
    console.error('Manual login error:', error)
    errorMessage.value = (error as Error).message || 'An error occurred during login'
  } finally {
    isLoading.value = false
  }
}
</script>
