<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <header class="px-6 pt-12 pb-6 text-center space-y-2">
      <h2 class="text-2xl font-semibold uppercase tracking-widest">Round In Progress</h2>
      <p class="text-zinc-400 text-sm">Music plays for 90 seconds. Keep listening and watch other players.</p>
    </header>

    <main class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
        <p class="text-sm uppercase text-zinc-400">Time Remaining</p>
        <p class="text-6xl font-bold text-disco-pink">01:30</p>
      </div>
    </main>

    <MusicPlayerBar />
  </div>
</template>

<script setup lang="ts">
import MusicPlayerBar from '@/components/MusicPlayerBar.vue'

// Playback synchronization will be coordinated once Spotify integration is complete.
</script>
