<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 py-10">
    <header class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-sm uppercase text-zinc-400">Room Code</h2>
        <p class="text-4xl font-bold tracking-[0.5em]">123</p>
      </div>
      <div class="space-x-3">
        <button class="px-4 py-2 rounded-full border border-zinc-700 text-zinc-300" type="button">
          Leave
        </button>
        <button class="px-4 py-2 rounded-full bg-disco-pink text-black font-semibold" type="button">
          Pick Songs
        </button>
      </div>
    </header>

    <section class="grid gap-6 md:grid-cols-2">
      <div class="bg-zinc-900/70 rounded-3xl p-6">
        <h3 class="text-lg font-semibold mb-4">Players</h3>
        <ul class="space-y-3">
          <li class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
            <span>DJ Host</span>
            <span class="text-xs uppercase tracking-wider text-disco-pink">Host</span>
          </li>
          <li class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
            <span>Guest Listener</span>
            <span class="text-xs uppercase tracking-wider text-zinc-400">Ready</span>
          </li>
        </ul>
      </div>

      <div class="bg-zinc-900/70 rounded-3xl p-6">
        <h3 class="text-lg font-semibold mb-4">Song Pairs</h3>
        <p class="text-zinc-400">Song pairs remain hidden until the reveal phase. Add them from the song picker.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Lobby state will be sourced from Pinia stores using WebSocket updates later.
</script>
