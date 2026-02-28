<!-- Dancer Incognito guessing interface where players vote on who heard a different song. Displays all players as cards with guess buttons. Players select who they think is the Dancer Incognito. -->
<template>
  <div class="min-h-screen bg-zinc-950 text-white px-6 pt-12 pb-28">
    <header class="text-center mb-10 space-y-2">
      <h1 class="text-3xl font-semibold uppercase tracking-wide">Who Is The Dancer Incognito?</h1>
      <p class="text-zinc-400 text-sm">Pick the player you think heard a different song.</p>
    </header>

    <!-- Vote confirmation message -->
    <div v-if="hasVoted" class="max-w-lg mx-auto mb-6 bg-green-900/30 border border-green-500/50 rounded-2xl p-4 text-center">
      <p class="text-green-400">You voted for <span class="font-semibold">{{ votedForName }}</span></p>
      <p class="text-zinc-400 text-sm mt-1">Waiting for other players to vote...</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center text-zinc-400">
      Loading players...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="max-w-lg mx-auto bg-red-900/30 border border-red-500/50 rounded-2xl p-4 text-center">
      <p class="text-red-400">{{ error }}</p>
    </div>

    <!-- Player list -->
    <ul v-else class="max-w-lg mx-auto space-y-4">
      <li v-for="player in players" :key="player.id" class="bg-zinc-900 rounded-3xl border border-zinc-500 p-6 space-y-3">
        <h3 class="text-xl font-semibold">{{ player.name }}</h3>
        <button
          class="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="hasVoted || submitting"
          @click="vote(player.id)"
        >
          {{ hasVoted ? (votedFor === player.id ? 'Your Vote' : 'Voted') : `Guess ${player.name}` }}
        </button>
      </li>
    </ul>

    <!-- Host controls: vote progress + reveal override (fetch-time snapshot, not live) -->
    <div v-if="isHost" class="max-w-lg mx-auto mt-8 space-y-3">
      <p class="text-center text-zinc-400 text-sm">
        {{ voteProgress.votedCount }}/{{ voteProgress.totalPlayers }} voted
      </p>
      <div class="flex justify-center">
        <button
          class="px-6 py-3 rounded-full bg-disco-pink hover:bg-disco-pink-hover text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          :disabled="revealing"
          @click="revealResults"
        >
          {{ revealing ? 'Revealing...' : 'Reveal' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useAuthStore } from '@/stores/auth';
import { useRoomStore } from '@/stores/room';
import { useRoomApi } from '@/composables/useRoomApi';
import { useActionDebounce } from '@/composables/useActionDebounce';
import { useNotificationStore } from '@/stores/notifications';
import { getErrorStatus } from '@/utils/getErrorStatus';

const { roomFetch } = useRoomApi();

interface GuessingPlayer {
  id: string;
  name: string;
}

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
  current_round?: {
    votes: Record<string, string>;
  };
}

const playerStore = usePlayerStore();
const authStore = useAuthStore();
const roomStore = useRoomStore();
const notifications = useNotificationStore();
const { isPending: submitting, trigger: triggerVote } = useActionDebounce();
const { isPending: revealing, trigger: triggerReveal } = useActionDebounce();

const players = ref<GuessingPlayer[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const votedFor = ref<string | null>(null);
const votesCount = ref(0);

const hasVoted = computed(() => votedFor.value !== null);
const votedForName = computed(() => {
  if (!votedFor.value) return '';
  const player = players.value.find(p => p.id === votedFor.value);
  return player?.name ?? 'Unknown';
});

const roomCode = computed(() => roomStore.code || '');

const isHost = computed(() => {
  const currentUserId = authStore.user?.id;
  if (!currentUserId) return false;
  const currentPlayer = roomStore.players.find(p => p.id === currentUserId);
  return currentPlayer?.isHost ?? false;
});

const voteProgress = computed(() => ({
  votedCount: votesCount.value,
  totalPlayers: players.value.length,
}));

async function fetchRoom() {
  try {
    loading.value = true;
    error.value = null;

    // Load auth state from sessionStorage (in case of page refresh)
    authStore.loadFromStorage();

    const response = await roomFetch(`/api/rooms/${roomCode.value}`);

    // Handle expired room (404)
    if (response.status === 404) {
      return; // roomFetch already redirected
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch room: ${response.status}`);
    }
    const room: RoomResponse = await response.json();

    // Map players to guessing format
    players.value = room.players.map(p => ({
      id: p.id,
      name: p.display_name,
    }));

    // Track vote progress for host display
    votesCount.value = Object.keys(room.current_round?.votes ?? {}).length;

    // Check if current player has already voted (use auth store for user ID)
    const currentPlayerId = authStore.user?.id ?? playerStore.id;
    if (currentPlayerId && room.current_round?.votes?.[currentPlayerId]) {
      votedFor.value = room.current_round.votes[currentPlayerId];
    }

    // If status is 'results', update store - AppOrchestrator will switch view
    if (room.status === 'results') {
      roomStore.setStatus('results');
    }
  } catch (err) {
    console.error('Failed to fetch room:', err);
    error.value = 'Failed to load players. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function vote(guessedPlayerId: string) {
  if (hasVoted.value || submitting.value) return;

  const currentPlayerId = authStore.user?.id ?? playerStore.id;
  if (!currentPlayerId) {
    error.value = 'Not logged in. Please refresh and try again.';
    return;
  }

  error.value = null;
  try {
    await triggerVote(async () => {
      const response = await roomFetch(`/api/rooms/${roomCode.value}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: currentPlayerId,
          guessed_player_id: guessedPlayerId,
        }),
      });

      if (response.status === 429) {
        throw Object.assign(new Error('Rate limited'), { status: 429 });
      }

      if (response.status === 404) {
        return; // roomFetch already redirected
      }

      if (!response.ok) {
        throw new Error(`Failed to vote: ${response.status}`);
      }

      const data: RoomResponse = await response.json();
      votedFor.value = guessedPlayerId;

      // If status is 'results', update store - AppOrchestrator will switch view
      if (data.status === 'results') {
        roomStore.setStatus('results');
      }
    });
  } catch (err) {
    if (getErrorStatus(err) === 429) {
      notifications.warning('Server busy', 'Server is busy, please try again in a moment.');
    } else {
      console.error('Failed to vote:', err);
      error.value = 'Failed to submit vote. Please try again.';
    }
  }
}

async function revealResults() {
  const playerId = authStore.user?.id;
  if (!playerId || !roomCode.value) return;

  error.value = null;
  try {
    await triggerReveal(async () => {
      const response = await roomFetch(`/api/rooms/${roomCode.value}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      });

      if (response.status === 429) {
        throw Object.assign(new Error('Rate limited'), { status: 429 });
      }

      if (response.status === 404) return; // roomFetch already redirected

      if (response.ok) {
        const data: RoomResponse = await response.json();
        roomStore.setStatus(data.status);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to reveal results:', err.detail);
        error.value = 'Failed to reveal results. Please try again.';
      }
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      notifications.warning('Server busy', 'Server is busy, please try again in a moment.');
    } else {
      console.error('Error revealing results:', err);
      error.value = 'Failed to reveal results. Please try again.';
    }
  }
}

onMounted(() => {
  fetchRoom();
});
</script>
