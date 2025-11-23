<!-- Odd Duck guessing interface where players vote on who heard a different song. Displays all players as cards with guess buttons. Players select who they think is the Odd Duck. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-10 space-y-2">
      <h2 class="text-3xl font-semibold uppercase tracking-wide">Who Is The Dancer Incognito?</h2>
      <p class="text-zinc-400 text-sm">Pick the player you think heard a different song.</p>
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
