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
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Handle OAuth callback on mount
onMounted(() => {
  const query = route.query

  // Check if this is an OAuth callback with tokens
  if (query.auth_success === 'true' && query.access_token) {
    const accessToken = query.access_token as string
    const refreshToken = query.refresh_token as string
    const userId = query.user_id as string
    const displayName = query.display_name as string

    // Store tokens
    authStore.setTokens(accessToken, refreshToken)

    // Store user info
    authStore.setUser({
      id: userId,
      displayName: displayName,
      email: '' // Email not provided in callback
    })

    successMessage.value = `Welcome, ${displayName}!`
    console.log(`✅ Spotify login successful: ${displayName}`)

    // Clean up URL and redirect to rooms
    setTimeout(() => {
      router.replace('/rooms')
    }, 500)
  } else if (query.error) {
    // Handle OAuth error
    errorMessage.value = query.error as string
  }
})

// Check if we're in test mode via environment variable
const isTestMode = computed(() => {
  const testModeValue = import.meta.env.VITE_TEST_MODE
  console.log('VITE_TEST_MODE raw value:', testModeValue)
  console.log('VITE_TEST_MODE type:', typeof testModeValue)
  console.log('All VITE_ env vars:', import.meta.env)
  return testModeValue === 'true'
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
