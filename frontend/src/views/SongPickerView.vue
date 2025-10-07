<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 py-10 space-y-8">
    <header class="text-center">
      <h2 class="text-3xl font-semibold">Pick a Pair</h2>
      <p class="text-zinc-400">Search Spotify tracks, pick two songs, and drop them into the room pool.</p>
    </header>

    <div class="max-w-3xl mx-auto space-y-6">
      <input
        class="w-full rounded-full bg-zinc-900 px-6 py-4 text-lg"
        placeholder="Search Spotify"
        type="search"
      />

      <div class="grid gap-4 md:grid-cols-2">
        <div class="bg-zinc-900 rounded-3xl p-5">
          <h3 class="text-lg font-semibold mb-3">Search Results</h3>
          <p class="text-zinc-500">Results appear here in test mode once the Spotify adapter is wired.</p>
        </div>
        <div class="bg-zinc-900 rounded-3xl p-5">
          <h3 class="text-lg font-semibold mb-3">Selected Pair</h3>
          <p class="text-zinc-500">Choose two different tracks to enable the "Save Pair" button.</p>
          <button class="mt-4 w-full bg-disco-pink text-black font-semibold py-3 rounded-full" type="button">
            Save Pair
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Spotify search will use the spoofed adapter during Phase 1-4 development.
</script>
