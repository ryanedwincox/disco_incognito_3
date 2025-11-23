<!-- Room lobby showing players and song pairs before game starts. Displays room code, player list with host indicator, and song pair section. Provides navigation to song picker and option to leave room. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="mb-8">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-sm uppercase text-zinc-400">Room Code</h2>
          <p class="text-4xl font-bold tracking-[0.5em]">{{ roomCode }}</p>
        </div>
      </div>
      <div class="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-3">
        <button
          class="w-full md:w-auto px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-600 transition-colors"
          type="button"
          @click="leaveRoom"
        >
          Leave
        </button>
        <button
          class="w-full md:w-auto px-6 py-3 rounded-full bg-disco-pink text-black font-semibold hover:bg-disco-pink-light transition-colors"
          type="button"
          @click="pickSongs"
        >
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
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const roomCode = computed(() => route.params.code || '123')

function leaveRoom() {
  console.log('Leaving room:', roomCode.value)
  // Navigate back to room selection
  router.push('/rooms')
}

function pickSongs() {
  console.log('Navigating to song picker for room:', roomCode.value)
  // Navigate to song picker for this room
  router.push(`/rooms/${roomCode.value}/songs`)
}
</script>
