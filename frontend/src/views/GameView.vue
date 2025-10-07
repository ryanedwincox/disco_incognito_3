<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <header class="px-6 py-10 text-center space-y-2">
      <h2 class="text-2xl font-semibold uppercase tracking-widest">Round In Progress</h2>
      <p class="text-zinc-400">Music plays for 90 seconds. Keep listening and watch other players.</p>
    </header>

    <main class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
        <p class="text-sm uppercase text-zinc-400">Time Remaining</p>
        <p class="text-6xl font-bold text-disco-pink">01:30</p>
      </div>
    </main>

    <footer class="bg-zinc-900/80">
      <div class="max-w-5xl mx-auto py-4 px-6 grid grid-cols-3 items-center">
        <div class="text-left">
          <p class="text-xs uppercase text-zinc-500">Now Playing</p>
          <p class="font-medium">Unknown Track</p>
        </div>
        <div class="flex justify-center">
          <button class="px-6 py-2 rounded-full bg-zinc-800 text-zinc-400" disabled type="button">
            Pause
          </button>
        </div>
        <div class="text-right">
          <p class="text-xs uppercase text-zinc-500">Device</p>
          <p class="font-medium">Web Player</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Playback synchronization will be coordinated once Spotify integration is complete.
</script>
