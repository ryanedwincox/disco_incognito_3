<!-- Song reveal view showing the player's assigned song before playback. Displays song title, artist, album art with indication of 'your song' vs 'incognito song'. Props-driven for Storybook demonstration. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-8 space-y-2">
      <h2 class="text-3xl font-semibold">Your Song</h2>
      <p class="text-zinc-400 text-sm max-w-md mx-auto">
        Get ready to dance! This is the song you'll be playing.
      </p>
    </header>

    <section class="max-w-md mx-auto space-y-6">
      <!-- Song Card -->
      <div class="bg-zinc-900 rounded-3xl p-6 space-y-4">
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

        <!-- Song Type Badge -->
        <div class="flex justify-center">
          <span
            :class="[
              'px-4 py-2 rounded-full text-sm font-medium',
              isIncognito
                ? 'bg-disco-pink/20 text-disco-pink border border-disco-pink'
                : 'bg-green-500/20 text-green-400 border border-green-500'
            ]"
          >
            {{ isIncognito ? '🎭 Incognito Song' : '🎵 Your Song' }}
          </span>
        </div>
      </div>

      <!-- Instructions -->
      <div class="bg-zinc-900/50 rounded-2xl p-4 text-center">
        <p class="text-sm text-zinc-400">
          <template v-if="isIncognito">
            You're the <span class="text-disco-pink font-semibold">Dancer Incognito</span>!
            Blend in and don't let others guess you're dancing to a different song.
          </template>
          <template v-else>
            Dance to your song and try to spot who's dancing to something different!
          </template>
        </p>
      </div>

      <!-- Ready Button (optional, for future use) -->
      <button
        v-if="showReadyButton"
        class="w-full bg-disco-pink text-black font-semibold py-3 rounded-full hover:bg-disco-pink-light transition-colors"
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
