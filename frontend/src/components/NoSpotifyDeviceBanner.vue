<!-- Persistent bottom banner shown when no Spotify devices are available. Polls for device recovery at 10s intervals. Provides "Check Now" manual refresh. -->
<template>
  <Transition name="slide">
    <div
      v-if="showBanner"
      class="fixed bottom-0 left-0 right-0 z-30 bg-amber-900 border-t-2 border-amber-500 text-white"
      role="alert"
    >
      <div class="px-6 py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Speaker X Icon -->
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.547 3.062A.75.75 0 0110 3.75v12.5a.75.75 0 01-1.264.546L5.203 13H3.75A.75.75 0 013 12.25v-4.5A.75.75 0 013.75 7h1.453l3.533-3.796a.75.75 0 01.811-.142z" />
              <path d="M13.28 7.22a.75.75 0 10-1.06 1.06L13.94 10l-1.72 1.72a.75.75 0 101.06 1.06L15 11.06l1.72 1.72a.75.75 0 101.06-1.06L16.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L15 8.94l-1.72-1.72z" />
            </svg>
          </div>

          <!-- Message -->
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold mb-0.5">No Spotify Device</h3>
            <p class="text-xs text-amber-200">
              Open Spotify on any device to enable playback
            </p>
          </div>
        </div>

        <!-- Check Now Button -->
        <button
          v-if="!isChecking"
          class="flex-shrink-0 bg-amber-700 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-full text-sm transition-colors"
          type="button"
          @click="checkNow"
        >
          Check Now
        </button>

        <!-- Checking Spinner -->
        <div v-else class="flex-shrink-0">
          <svg class="w-5 h-5 text-amber-300 animate-spin" fill="none" viewBox="0 0 24 24">
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMusicStore } from '@/stores/music'

const authStore = useAuthStore()
const musicStore = useMusicStore()

const POLL_INTERVAL_MS = 10_000
let pollInterval: ReturnType<typeof setInterval> | null = null
const isChecking = ref(false)

const showBanner = computed(() =>
  authStore.isAuthenticated &&
  authStore.isSpotifyUser &&
  musicStore.hasCheckedDevices &&
  musicStore.devices.length === 0
)

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => { await musicStore.getDevices() }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

async function checkNow() {
  stopPolling()
  isChecking.value = true
  try {
    await musicStore.getDevices()
  } finally {
    isChecking.value = false
  }
  if (musicStore.devices.length === 0) {
    startPolling()
  }
}

// Reset device check state on logout to prevent stale banner flash on re-login
watch(() => authStore.isAuthenticated, (authenticated) => {
  if (!authenticated) {
    musicStore.hasCheckedDevices = false
    stopPolling()
  }
})

watch(showBanner, (visible, wasVisible) => {
  if (visible && !wasVisible) {
    startPolling()
  } else if (!visible && wasVisible) {
    stopPolling()
  }
})

onMounted(() => {
  if (showBanner.value) startPolling()
})

onUnmounted(() => {
  stopPolling()
})
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
