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
            autocomplete="off"
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
            autocomplete="off"
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
            autocomplete="off"
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
            autocomplete="off"
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
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import { useNotificationStore } from '../stores/notifications'
import { useRoomApi } from '../composables/useRoomApi'
import { STORAGE_KEYS } from '../config/storageKeys'

interface SongPickerStoredState {
  roomCode: string
  song1Title: string
  song1Artist: string
  song2Title: string
  song2Artist: string
}

// Store/service setup
const authStore = useAuthStore()
const roomStore = useRoomStore()
const notificationStore = useNotificationStore()
const { roomFetch } = useRoomApi()

// Reactive refs — declared before functions that close over them
const song1Title = ref('')
const song1Artist = ref('')
const song2Title = ref('')
const song2Artist = ref('')
const isSaving = ref(false)

// Type guard for localStorage deserialization (DbC)
function isSongPickerState(v: unknown): v is SongPickerStoredState {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj.roomCode === 'string' &&
    typeof obj.song1Title === 'string' &&
    typeof obj.song1Artist === 'string' &&
    typeof obj.song2Title === 'string' &&
    typeof obj.song2Artist === 'string'
  )
}

function saveSongPickerState() {
  if (!roomStore.code) return
  const state: SongPickerStoredState = {
    roomCode: roomStore.code,
    song1Title: song1Title.value,
    song1Artist: song1Artist.value,
    song2Title: song2Title.value,
    song2Artist: song2Artist.value,
  }
  localStorage.setItem(STORAGE_KEYS.SONG_PICKER_STATE, JSON.stringify(state))
}

function clearSongPickerState() {
  localStorage.removeItem(STORAGE_KEYS.SONG_PICKER_STATE)
}

// Guard flag: prevents onMounted ref-sets from triggering a redundant write-back
let isRestoring = false

onMounted(() => {
  const raw = localStorage.getItem(STORAGE_KEYS.SONG_PICKER_STATE)
  if (!raw) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isSongPickerState(parsed)) return
    if (parsed.roomCode !== roomStore.code) return
    isRestoring = true
    song1Title.value = parsed.song1Title
    song1Artist.value = parsed.song1Artist
    song2Title.value = parsed.song2Title
    song2Artist.value = parsed.song2Artist
    isRestoring = false
  } catch {
    isRestoring = false
    // Malformed storage entry — ignore
  }
})

watch([song1Title, song1Artist, song2Title, song2Artist], () => {
  if (isRestoring) return
  saveSongPickerState()
})

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
    const response = await roomFetch(`/api/rooms/${roomCode}/song-pairs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: userId,
        song_a_title: song1Title.value.trim(),
        song_a_artist: song1Artist.value.trim(),
        song_b_title: song2Title.value.trim(),
        song_b_artist: song2Artist.value.trim(),
      }),
    })

    if (response.status === 404) {
      return // roomFetch already redirected
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to add song pair')
    }

    // Capture titles before clearing
    const titleA = song1Title.value.trim()
    const titleB = song2Title.value.trim()
    clearSongPickerState()
    notificationStore.success('Songs Added', `Added "${titleA}" and "${titleB}" to the room!`)
    goBack()
  } catch (error: unknown) {
    console.error('Failed to add song pair:', error)
    notificationStore.error('Error', 'Failed to add song pair')
  } finally {
    isSaving.value = false
  }
}

function goBack() {
  clearSongPickerState()
  roomStore.setStatus('lobby')
}
</script>
