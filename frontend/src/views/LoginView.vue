<!-- Login view for Spotify authentication. Handles both live OAuth flow and test mode direct login. Displays login button, loading states, and error/success messages. Redirects to room selection on successful authentication. -->
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
          class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="isLoading"
          @click="handleSpotifyLogin"
        >
          {{ isLoading ? 'Logging in...' : 'Login with Spotify' }}
        </button>

        <!-- Manual/Guest Login Button -->
        <button
          class="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-8 py-3 rounded-full transition-colors border border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showNameInput = ref(false)
const displayName = ref('')

// Handle OAuth callback on mount
onMounted(() => {
  const query = route.query

  // Check if this is an OAuth callback with tokens
  if (query['auth_success'] === 'true' && query['access_token']) {
    const accessToken = query['access_token'] as string
    const refreshToken = query['refresh_token'] as string
    const userId = query['user_id'] as string
    const userName = query['display_name'] as string

    // Store tokens
    authStore.setTokens(accessToken, refreshToken)

    // Store user info
    authStore.setUser({
      id: userId,
      displayName: userName,
      email: '' // Email not provided in callback
    })

    successMessage.value = `Welcome, ${userName}!`
    console.log(`✅ Spotify login successful: ${userName}`)

    // Clean up URL - AppOrchestrator will handle view switch based on auth state
    setTimeout(() => {
      router.replace('/')
    }, 500)
  } else if (query['error']) {
    // Handle OAuth error
    errorMessage.value = query['error'] as string
  }
})

async function handleSpotifyLogin() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Attempt Spotify login (redirects in live mode, returns in test mode)
    await authStore.spotifyLogin()

    // If we get here, test mode login succeeded (live mode would have redirected)
    // AppOrchestrator will handle view switch based on auth state
    if (authStore.isAuthenticated) {
      successMessage.value = `Welcome, ${authStore.userName}!`
    }
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
      // AppOrchestrator will handle view switch based on auth state
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
