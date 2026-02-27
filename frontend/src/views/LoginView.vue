<!-- LoginView: Guest login with display name input. -->
<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
    <header class="text-center mb-10">
      <h1 class="text-4xl font-bold tracking-[0.3em] uppercase mb-4">DISCO INCOGNITO</h1>
    </header>

    <div class="w-full max-w-sm space-y-4">
      <div>
        <label for="guest-handle" class="block text-sm text-zinc-400 mb-2">Enter your name</label>
        <input
          id="guest-handle"
          v-model="displayName"
          type="text"
          placeholder="e.g. Ryan"
          maxlength="50"
          autocomplete="new-password"
          class="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:border-disco-pink transition-colors"
          @keyup.enter="handleLogin"
        />
      </div>

      <button
        class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
        :disabled="isLoading || !displayName.trim()"
        @click="handleLogin"
      >
        {{ isLoading ? 'Logging in...' : 'Login' }}
      </button>

      <div
        v-if="errorMessage"
        class="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-xl text-sm"
      >
        {{ errorMessage }}
      </div>

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
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const displayName = ref('')

async function handleLogin() {
  if (!displayName.value.trim()) return

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await authStore.login(displayName.value.trim())

    if (result.success) {
      successMessage.value = `Welcome, ${authStore.userName}!`
    } else {
      errorMessage.value = result.error || 'Failed to log in'
    }
  } catch (error: unknown) {
    console.error('Login error:', error)
    errorMessage.value = (error as Error).message || 'An error occurred during login'
  } finally {
    isLoading.value = false
  }
}
</script>
