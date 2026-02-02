<!-- Room selection hub for creating or joining game rooms. Provides Create Room button to generate random 3-digit codes, and Join Room form for entering existing codes. Also includes navigation to playback test page. -->
<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6 py-10">
    <h2 class="text-3xl font-semibold uppercase tracking-wide mb-10">Choose Your Room</h2>
    <div class="w-full max-w-md space-y-6">
      <button
        class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="createRoom"
      >
        Create Room
      </button>
      <div class="bg-zinc-900/70 p-5 rounded-3xl border border-zinc-500 space-y-3">
        <label class="block text-sm font-medium text-zinc-400" for="room-code">Enter Room Code</label>
        <input
          id="room-code"
          v-model="roomCode"
          maxlength="3"
          class="w-full rounded-full bg-zinc-800 px-4 py-3 tracking-[0.6em] text-center uppercase"
          placeholder="123"
          @keyup.enter="joinRoom"
        />
        <button
          class="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 py-3 rounded-full transition-colors"
          type="button"
          @click="joinRoom"
        >
          Join Room
        </button>
      </div>
      <button
        v-if="authStore.isSpotifyUser"
        class="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 font-medium px-8 py-3 rounded-full transition-colors"
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
import { useAuthStore } from '@/stores/auth'
import { useRoomStore } from '@/stores/room'
import { useNotificationStore } from '@/stores/notifications'
import { API_URL } from '@/config/api'
import { websocketService } from '@/services/websocket'
import axios from 'axios'

const router = useRouter()
const authStore = useAuthStore()
const roomStore = useRoomStore()
const notificationStore = useNotificationStore()
const roomCode = ref('')

// Load auth state from sessionStorage on component mount
authStore.loadFromStorage()

async function createRoom() {
  // Generate a random 3-digit room code
  const code = Math.floor(100 + Math.random() * 900).toString()
  console.log('Creating room with code:', code)

  try {
    // POST to create room on backend
    await axios.post(
      `${API_URL}/api/rooms`,
      { room_code: code },
      {
        headers: {
          Authorization: `Bearer ${authStore.accessToken}`
        }
      }
    )

    // Set room code in store - AppOrchestrator will switch to RoomLobbyView
    roomStore.setRoom(code)
    roomStore.setStatus('lobby')

    // Connect WS to room - room_state message will populate full store
    const userId = authStore.user?.id
    if (userId) {
      websocketService.connectToRoom(userId, code)
    }
  } catch (error: unknown) {
    console.error('Failed to create room:', error)
    const axiosError = error as { response?: { data?: { detail?: string } }; message?: string }
    const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to create room'
    notificationStore.error('Room Creation Failed', errorMessage)
  }
}

async function joinRoom() {
  if (roomCode.value.length !== 3) {
    console.log('Please enter a 3-digit room code')
    return
  }

  const code = roomCode.value
  console.log('Joining room:', code)

  try {
    // Check if room exists first
    const checkResponse = await axios.get(`${API_URL}/api/rooms/${code}`)
    const roomData = checkResponse.data

    // Join room via API
    const userId = authStore.user?.id
    const displayName = authStore.user?.displayName || 'Guest'

    if (userId) {
      await axios.post(`${API_URL}/api/rooms/${code}/join`, {
        player_id: userId,
        display_name: displayName
      })
    }

    // Set room code in store - AppOrchestrator will switch to RoomLobbyView
    roomStore.setRoom(code)
    roomStore.setStatus(roomData.status || 'lobby')

    // Connect WS to room - room_state message will populate full store
    const wsUserId = authStore.user?.id
    if (wsUserId) {
      websocketService.connectToRoom(wsUserId, code)
    }
  } catch (error: unknown) {
    console.error('Failed to join room:', error)
    const axiosError = error as { response?: { status?: number; data?: { detail?: string } }; message?: string }
    if (axiosError.response?.status === 404) {
      notificationStore.error('Room Not Found', 'The room code is invalid or has expired')
    } else {
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to join room'
      notificationStore.error('Join Room Failed', errorMessage)
    }
  }
}

function goToTest() {
  router.push('/test')
}
</script>
