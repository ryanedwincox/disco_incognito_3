<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-10 space-y-2">
      <h2 class="text-4xl font-bold text-disco-pink uppercase tracking-widest">Reveal</h2>
      <p class="text-zinc-400 text-sm">See who guessed correctly and who the Odd Duck really was.</p>
    </header>

    <section class="max-w-4xl mx-auto bg-zinc-900/80 rounded-3xl p-6 space-y-6">
      <div>
        <h3 class="text-sm uppercase text-zinc-400">Odd Duck</h3>
        <p class="text-2xl font-semibold">DJ Host</p>
      </div>
      <div>
        <h3 class="text-sm uppercase text-zinc-400 mb-2">Votes</h3>
        <ul class="space-y-2">
          <li class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
            <span>Guest Listener</span>
            <span class="text-disco-pink">Guessed DJ Host</span>
          </li>
          <li class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
            <span>DJ Host</span>
            <span class="text-green-400">Guessed Correctly</span>
          </li>
        </ul>
      </div>
      <button class="w-full bg-disco-pink text-black font-semibold py-3 rounded-full" type="button">
        Next Round
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
// Host-only controls will display conditionally once player roles are stored in Pinia.
</script>
