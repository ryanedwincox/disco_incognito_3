<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 py-10">
    <header class="text-center mb-10">
      <h2 class="text-3xl font-semibold uppercase tracking-wide">Who Is The Odd Duck?</h2>
      <p class="text-zinc-400">Pick the player you think heard a different song.</p>
    </header>

    <ul class="max-w-2xl mx-auto grid gap-4 md:grid-cols-2">
      <li v-for="player in players" :key="player.id" class="bg-zinc-900 rounded-3xl p-6 space-y-3">
        <h3 class="text-xl font-semibold">{{ player.name }}</h3>
        <button class="w-full border border-disco-pink text-disco-pink py-2 rounded-full" type="button">
          Guess {{ player.name }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface GuessingPlayer {
  id: string;
  name: string;
}

const players: GuessingPlayer[] = [
  { id: "player-1", name: "DJ Host" },
  { id: "player-2", name: "Guest Listener" }
];
</script>
