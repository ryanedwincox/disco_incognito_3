<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
    <h2 class="text-3xl font-semibold uppercase tracking-wide mb-8">Choose Your Room</h2>
    <div class="w-full max-w-md space-y-5">
      <button class="w-full bg-disco-pink text-black font-semibold py-3 rounded-full" type="button">
        Create Room
      </button>
      <div class="bg-zinc-900/70 p-5 rounded-3xl space-y-3">
        <label class="block text-sm font-medium text-zinc-400" for="room-code">Enter Room Code</label>
        <input
          id="room-code"
          maxlength="3"
          class="w-full rounded-full bg-zinc-800 px-4 py-3 tracking-[0.6em] text-center uppercase"
          placeholder="123"
        />
        <button class="w-full border border-disco-pink text-disco-pink py-3 rounded-full" type="button">
          Join Room
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Room creation and join logic will connect to WebSocket API in Phase 3.
</script>
