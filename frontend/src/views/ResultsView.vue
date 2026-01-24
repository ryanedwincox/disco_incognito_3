<!-- Round reveal view showing the true Odd Duck and voting results. Displays who the Odd Duck was, how each player voted, and who guessed correctly. Provides Finish Round button for the host. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-10">
    <header class="text-center mb-10 space-y-2">
      <h2 class="text-4xl font-bold text-disco-pink uppercase tracking-widest">Reveal</h2>
      <p class="text-zinc-400 text-sm">See who guessed correctly and who the Dancer Incognito really was.</p>
    </header>

    <!-- Loading state -->
    <div v-if="loading" class="text-center text-zinc-400">
      Loading results...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="max-w-lg mx-auto bg-red-900/30 border border-red-500/50 rounded-2xl p-4 text-center">
      <p class="text-red-400">{{ error }}</p>
    </div>

    <!-- Results -->
    <section v-else class="max-w-lg mx-auto bg-zinc-900/80 rounded-3xl border border-zinc-500 p-6 space-y-6">
      <!-- Dancer Incognito reveal with highlight -->
      <div class="bg-disco-pink/20 border-2 border-disco-pink rounded-2xl p-4 text-center">
        <h3 class="text-sm uppercase text-disco-pink">Dancer Incognito</h3>
        <p class="text-2xl font-semibold text-disco-pink">{{ incognitoPlayerName }}</p>
      </div>

      <!-- Votes list -->
      <div>
        <h3 class="text-sm uppercase text-zinc-400 mb-2">Votes</h3>
        <ul class="space-y-2">
          <li
            v-for="vote in voteResults"
            :key="vote.voterId"
            class="flex items-center justify-between rounded-2xl px-4 py-3"
            :class="vote.isCorrect ? 'bg-green-900/30 border border-green-500/50' : 'bg-zinc-900'"
          >
            <span :class="vote.isCorrect ? 'text-green-400 font-semibold' : ''">{{ vote.voterName }}</span>
            <span :class="vote.isCorrect ? 'text-green-400' : 'text-disco-pink'">
              {{ vote.isCorrect ? 'Guessed Correctly!' : `Guessed ${vote.guessedName}` }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Host-only Finish Round button -->
      <button
        v-if="isHost"
        class="w-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold py-3 rounded-full transition-colors"
        type="button"
        @click="finishRound"
      >
        Finish Round
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useAuthStore } from '@/stores/auth';
import { useRoomStore } from '@/stores/room';
import { useRoomApi } from '@/composables/useRoomApi';

const { handleRoomResponse, API_URL } = useRoomApi();

interface RoomPlayer {
  id: string;
  display_name: string;
  is_host: boolean;
  is_connected: boolean;
}

interface RoomResponse {
  code: string;
  host_id: string;
  players: RoomPlayer[];
  status: string;
}

interface ResultsResponse {
  incognito_player_id: string;
  votes: Record<string, string>;
  correct_guessers: string[];
}

interface VoteResult {
  voterId: string;
  voterName: string;
  guessedId: string;
  guessedName: string;
  isCorrect: boolean;
}

const playerStore = usePlayerStore();
const authStore = useAuthStore();
const roomStore = useRoomStore();

const loading = ref(true);
const error = ref<string | null>(null);
const players = ref<RoomPlayer[]>([]);
const hostId = ref<string | null>(null);
const incognitoPlayerId = ref<string | null>(null);
const votes = ref<Record<string, string>>({});
const correctGuessers = ref<string[]>([]);

const roomCode = computed(() => roomStore.code || '');

const isHost = computed(() => {
  const currentUserId = authStore.user?.id ?? playerStore.id;
  return currentUserId === hostId.value;
});

const incognitoPlayerName = computed(() => {
  if (!incognitoPlayerId.value) return 'Unknown';
  const player = players.value.find(p => p.id === incognitoPlayerId.value);
  return player?.display_name ?? 'Unknown';
});

const voteResults = computed((): VoteResult[] => {
  return Object.entries(votes.value).map(([voterId, guessedId]) => {
    const voter = players.value.find(p => p.id === voterId);
    const guessed = players.value.find(p => p.id === guessedId);
    return {
      voterId,
      voterName: voter?.display_name ?? 'Unknown',
      guessedId,
      guessedName: guessed?.display_name ?? 'Unknown',
      isCorrect: correctGuessers.value.includes(voterId),
    };
  });
});

async function fetchResults() {
  try {
    loading.value = true;
    error.value = null;

    // Load auth state from localStorage (in case of page refresh)
    authStore.loadFromStorage();

    // Fetch room data for player list and host info
    const roomResponse = await fetch(`${API_URL}/api/rooms/${roomCode.value}`);

    // Handle expired room (404)
    if (await handleRoomResponse(roomResponse)) {
      return;
    }

    if (!roomResponse.ok) {
      throw new Error(`Failed to fetch room: ${roomResponse.status}`);
    }
    const roomData: RoomResponse = await roomResponse.json();
    players.value = roomData.players;
    hostId.value = roomData.host_id;

    // Fetch results data
    const resultsResponse = await fetch(`${API_URL}/api/rooms/${roomCode.value}/results`);
    if (!resultsResponse.ok) {
      if (resultsResponse.status === 400) {
        error.value = 'Results not available yet. Waiting for all players to vote.';
        return;
      }
      throw new Error(`Failed to fetch results: ${resultsResponse.status}`);
    }
    const resultsData: ResultsResponse = await resultsResponse.json();
    incognitoPlayerId.value = resultsData.incognito_player_id;
    votes.value = resultsData.votes;
    correctGuessers.value = resultsData.correct_guessers;
  } catch (err) {
    console.error('Failed to fetch results:', err);
    error.value = 'Failed to load results. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function finishRound() {
  try {
    const currentUserId = authStore.user?.id ?? playerStore.id;

    // Call backend to finish round (removes song pair, resets state)
    const response = await fetch(`${API_URL}/api/rooms/${roomCode.value}/finish-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: currentUserId }),
    });

    // Handle expired room (404)
    if (await handleRoomResponse(response)) {
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('Failed to finish round:', errorData.detail);
      error.value = errorData.detail || 'Failed to finish round';
      return;
    }

    // Go back to lobby for next round - AppOrchestrator will switch view
    roomStore.setStatus('lobby');
  } catch (err) {
    console.error('Failed to finish round:', err);
    error.value = 'Failed to finish round. Please try again.';
  }
}

onMounted(() => {
  fetchResults();
});
</script>
