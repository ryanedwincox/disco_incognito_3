<!-- Room selection hub for creating or joining game rooms. Provides Create Room button to generate random 3-digit codes, and Join Room form for entering existing codes. Also includes navigation to playback test page. -->
<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6 py-10">
    <h2 class="text-3xl font-semibold uppercase tracking-wide mb-10">Choose Your Room</h2>
    <div class="w-full max-w-md space-y-6">
      <button
        class="w-full bg-disco-pink text-black font-semibold py-3 rounded-full"
        type="button"
        @click="createRoom"
      >
        Create Room
      </button>
      <div class="bg-zinc-900/70 p-5 rounded-3xl space-y-3">
        <label class="block text-sm font-medium text-zinc-400" for="room-code">Enter Room Code</label>
        <input
          id="room-code"
          v-model="roomCode"
          maxlength="3"
          class="w-full rounded-full bg-zinc-800 px-4 py-3 tracking-[0.6em] text-center uppercase"
          placeholder="123"
        />
        <button
          class="w-full border border-disco-pink text-disco-pink py-3 rounded-full"
          type="button"
          @click="joinRoom"
        >
          Join Room
        </button>
      </div>
      <button
        class="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-8 py-3 rounded-full transition-colors"
        type="button"
        @click="goToTest"
      >
        Test Playback
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const roomCode = ref('')

function createRoom() {
  // Generate a random 3-digit room code
  const code = Math.floor(100 + Math.random() * 900).toString()
  console.log('Creating room with code:', code)

  // Navigate to room lobby
  router.push(`/rooms/${code}`)
}

function joinRoom() {
  if (roomCode.value.length === 3) {
    console.log('Joining room:', roomCode.value)
    router.push(`/rooms/${roomCode.value}`)
  } else {
    console.log('Please enter a 3-digit room code')
  }
}

function goToTest() {
  router.push('/test')
}
</script>
