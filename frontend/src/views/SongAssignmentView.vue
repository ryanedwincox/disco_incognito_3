<!-- Song reveal view showing the player's assigned song before playback. Displays song title and artist. Props-driven for Storybook demonstration. -->
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
        <div class="text-center space-y-1">
          <h3 class="text-2xl font-bold">{{ song?.name || 'Unknown Song' }}</h3>
          <p class="text-lg text-zinc-400">{{ song?.artist || 'Unknown Artist' }}</p>
        </div>
      </div>

      <!-- Ready Button -->
      <button
        v-if="showReadyButton"
        class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="$emit('ready')"
      >
        I'm Ready!
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
        class="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="$emit('force-start')"
      >
        Start Round
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
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
}

withDefaults(defineProps<Props>(), {
  showReadyButton: false,
  isHost: false,
  players: () => [],
  readyPlayers: () => [],
})

defineEmits<{
  ready: []
  'force-start': []
}>()
</script>
