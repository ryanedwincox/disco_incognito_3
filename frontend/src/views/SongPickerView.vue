<!-- SongPickerView: Manual song entry for adding a pair of songs to the game pool. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-8">
      <h1 class="text-3xl font-semibold">Add Songs</h1>
    </header>

    <div class="max-w-lg mx-auto space-y-6">
      <!-- Song 1 -->
      <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5 space-y-3">
        <h3 class="text-lg font-semibold">Song 1</h3>
        <div>
          <label for="song1-title" class="block text-sm text-zinc-400 mb-1">Title</label>
          <input
            id="song1-title"
            v-model="song1Title"
            type="text"
            maxlength="200"
            placeholder="Song title"
            class="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:border-disco-pink transition-colors"
          />
        </div>
        <div>
          <label for="song1-artist" class="block text-sm text-zinc-400 mb-1">Artist</label>
          <input
            id="song1-artist"
            v-model="song1Artist"
            type="text"
            maxlength="200"
            placeholder="Artist name"
            class="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:border-disco-pink transition-colors"
          />
        </div>
      </div>

      <!-- Song 2 -->
      <div class="bg-zinc-900 rounded-3xl border border-zinc-500 p-5 space-y-3">
        <h3 class="text-lg font-semibold">Song 2</h3>
        <div>
          <label for="song2-title" class="block text-sm text-zinc-400 mb-1">Title</label>
          <input
            id="song2-title"
            v-model="song2Title"
            type="text"
            maxlength="200"
            placeholder="Song title"
            class="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:border-disco-pink transition-colors"
          />
        </div>
        <div>
          <label for="song2-artist" class="block text-sm text-zinc-400 mb-1">Artist</label>
          <input
            id="song2-artist"
            v-model="song2Artist"
            type="text"
            maxlength="200"
            placeholder="Artist name"
            class="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:border-disco-pink transition-colors"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-3">
        <button
          class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="!allFieldsFilled || isSaving"
          @click="addSongPair"
        >
          {{ isSaving ? 'Adding...' : 'Add Song Pair' }}
        </button>
        <button
          class="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 font-medium py-3 rounded-full transition-colors"
          type="button"
          @click="goBack"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Manual song entry for adding a pair of songs to the game pool. Two title+artist fields submitted via POST to the room songs endpoint. */
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import { useNotificationStore } from '../stores/notifications'
import { useRoomApi } from '../composables/useRoomApi'

const authStore = useAuthStore()
const roomStore = useRoomStore()
const notificationStore = useNotificationStore()
const { handleRoomResponse, API_URL } = useRoomApi()

const song1Title = ref('')
const song1Artist = ref('')
const song2Title = ref('')
const song2Artist = ref('')
const isSaving = ref(false)

const allFieldsFilled = computed(() =>
  song1Title.value.trim() !== '' &&
  song1Artist.value.trim() !== '' &&
  song2Title.value.trim() !== '' &&
  song2Artist.value.trim() !== ''
)

async function addSongPair() {
  if (!allFieldsFilled.value) return

  const userId = authStore.user?.id
  if (!userId) {
    console.error('No user ID available')
    return
  }

  isSaving.value = true
  try {
    const roomCode = roomStore.code
    const songs = [
      { title: song1Title.value.trim(), artist: song1Artist.value.trim() },
      { title: song2Title.value.trim(), artist: song2Artist.value.trim() },
    ]

    for (const song of songs) {
      const response = await fetch(`${API_URL}/api/rooms/${roomCode}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: userId,
          title: song.title,
          artist: song.artist,
        }),
      })

      if (await handleRoomResponse(response)) {
        return
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to add song')
      }
    }

    notificationStore.success('Songs Added', `Added "${songs[0].title}" and "${songs[1].title}" to the room!`)
    goBack()
  } catch (error: unknown) {
    console.error('Failed to add song pair:', error)
    notificationStore.error('Error', 'Failed to add song pair')
  } finally {
    isSaving.value = false
  }
}

function goBack() {
  roomStore.setStatus('lobby')
}
</script>
