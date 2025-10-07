<template>
  <div class="bg-zinc-900/80 px-6 py-4 grid grid-cols-3 items-center">
    <div>
      <p class="text-xs uppercase text-zinc-500">Now Playing</p>
      <p class="font-medium">Track Title</p>
    </div>
    <div class="flex justify-center">
      <button class="px-6 py-2 rounded-full bg-zinc-800 text-zinc-400" type="button">
        Play
      </button>
    </div>
    <div class="text-right">
      <p class="text-xs uppercase text-zinc-500">Device</p>
      <p class="font-medium">Not Connected</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Receives props for track info and control state once playback is wired up.
</script>
