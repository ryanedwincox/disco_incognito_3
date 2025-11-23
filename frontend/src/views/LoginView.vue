<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
    <header class="text-center mb-10">
      <h1 class="text-4xl font-bold tracking-[0.3em] uppercase mb-4">DISCO INCOGNITO</h1>
      <p v-if="isTestMode" class="text-sm text-zinc-400 mt-2">
        Test Mode: Each login creates a new random user
      </p>
    </header>

    <div class="w-full max-w-sm space-y-4">
      <!-- Login Button -->
      <button
        class="w-full bg-disco-pink hover:bg-disco-pink-light text-black font-semibold px-8 py-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
        :disabled="isLoading"
        @click="handleLogin"
      >
        {{ loginButtonText }}
      </button>

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
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Check if we're in test mode via environment variable
const isTestMode = computed(() => {
  return import.meta.env.VITE_TEST_MODE === 'true'
})

const loginButtonText = computed(() => {
  if (isLoading.value) {
    return isTestMode.value ? 'Creating Test User...' : 'Logging in...'
  }
  return isTestMode.value ? 'Create Test User' : 'Log in with Spotify'
})

async function handleLogin() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (isTestMode.value) {
      // Test mode: Direct login with random user
      const result = await authStore.testLogin()

      if (result.success) {
        successMessage.value = `Welcome, ${authStore.userName}!`
        // Redirect to room selection after short delay
        setTimeout(() => {
          router.push('/rooms')
        }, 1000)
      } else {
        errorMessage.value = result.error || 'Failed to create test user'
      }
    } else {
      // Live mode: Redirect to Spotify OAuth
      await authStore.spotifyLogin()
      // Note: Will redirect to Spotify, so code after this won't execute
    }
  } catch (error: unknown) {
    console.error('Login error:', error)
    errorMessage.value = (error as Error).message || 'An error occurred during login'
  } finally {
    isLoading.value = false
  }
}
</script>
