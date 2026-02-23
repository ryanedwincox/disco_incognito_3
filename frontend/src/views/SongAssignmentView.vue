<!-- SongAssignmentView: Song reveal view showing the player's assigned song before playback. Displays song title and artist. Props-driven for Storybook demonstration. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12" style="padding-bottom: 6rem;">
    <header class="text-center mb-8 space-y-2">
      <h1 class="text-3xl font-semibold">Your Song</h1>
      <p class="text-zinc-400 text-sm max-w-md mx-auto">
        Get ready to dance! This is the song you'll be playing.
      </p>
    </header>

    <section class="max-w-md mx-auto space-y-6">
      <!-- Song Card -->
      <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-6 space-y-4">
        <!-- Song Info -->
        <div class="relative text-center space-y-1">
          <h3 class="text-2xl font-bold">{{ song?.name || 'Unknown Song' }}</h3>
          <p class="text-lg text-zinc-400">{{ song?.artist || 'Unknown Artist' }}</p>
          <button
            class="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white transition-colors"
            type="button"
            aria-label="Copy song info"
            @click="copyToClipboard"
          >
            <svg v-if="!copied" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            <svg v-else aria-hidden="true" class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Ready Button -->
      <button
        v-if="showReadyButton"
        class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
        :disabled="isReadying"
        @click="$emit('ready')"
      >
        {{ isReadying ? 'Readying...' : "I'm Ready!" }}
      </button>

      <!-- Host: Player Ready Status Panel -->
      <div v-if="isHost" class="bg-zinc-900 rounded-2xl border border-zinc-500 p-4 space-y-3">
        <h4 class="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Player Status</h4>
        <ul class="space-y-2">
          <li
            v-for="player in players"
            :key="player.id"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-white">{{ player.name }}</span>
            <span
              :class="readyPlayers.includes(player.id)
                ? 'text-green-400'
                : 'text-zinc-500'"
              class="font-medium"
            >
              {{ readyPlayers.includes(player.id) ? 'Ready' : 'Waiting...' }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Host: Force Start Button -->
      <button
        v-if="isHost"
        class="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
        :disabled="isForceStarting"
        @click="$emit('force-start')"
      >
        {{ isForceStarting ? 'Starting...' : 'Start Round' }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import type { TrackInfo } from '../types'

interface RoomPlayer {
  id: string
  name: string
  isHost: boolean
  isConnected: boolean
}

interface Props {
  song: TrackInfo | null
  showReadyButton?: boolean
  isHost?: boolean
  players?: RoomPlayer[]
  readyPlayers?: string[]
  isReadying?: boolean
  isForceStarting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showReadyButton: false,
  isHost: false,
  players: () => [],
  readyPlayers: () => [],
  isReadying: false,
  isForceStarting: false,
})

defineEmits<{
  ready: []
  'force-start': []
}>()

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

onUnmounted(() => {
  clearTimeout(copyTimer)
})

async function copyToClipboard(): Promise<void> {
  const text =
    props.song?.name && props.song?.artist
      ? `${props.song.name} - ${props.song.artist}`
      : (props.song?.name ?? 'Unknown Song')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.warn('Clipboard write failed:', err)
  }
}
</script>
