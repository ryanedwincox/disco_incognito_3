<!-- Song reveal view showing the player's assigned song before playback. Displays song title, artist, album art. Props-driven for Storybook demonstration. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12" style="padding-bottom: 6rem;">
    <header class="text-center mb-6">
      <h2 class="text-3xl font-semibold">Your Song</h2>
    </header>

    <section class="max-w-md mx-auto space-y-6">
      <!-- Song Card -->
      <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-6 space-y-4">
        <!-- Album Art -->
        <div class="aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-zinc-800">
          <img
            v-if="song?.albumArt"
            :src="song.albumArt"
            :alt="`${song.album} album art`"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-6xl">🎵</span>
          </div>
        </div>

        <!-- Song Info -->
        <div class="text-center space-y-1">
          <h3 class="text-2xl font-bold">{{ song?.name || 'Unknown Song' }}</h3>
          <p class="text-lg text-zinc-400">{{ song?.artist || 'Unknown Artist' }}</p>
          <p v-if="song?.album" class="text-sm text-zinc-500">{{ song.album }}</p>
        </div>

      </div>

      <!-- Ready Button (optional, for future use) -->
      <button
        v-if="showReadyButton"
        class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="$emit('ready')"
      >
        I'm Ready!
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { TrackInfo } from '../stores/music'

interface Props {
  song: TrackInfo | null
  isIncognito?: boolean
  showReadyButton?: boolean
}

withDefaults(defineProps<Props>(), {
  isIncognito: false,
  showReadyButton: false
})

defineEmits<{
  ready: []
}>()
</script>
