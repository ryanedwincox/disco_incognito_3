import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import TestPlaybackView from "@/views/TestPlaybackView.vue";
import ErrorTestView from "@/views/ErrorTestView.vue";
import ServerDisconnectedDemoView from "@/views/ServerDisconnectedDemoView.vue";
import ExceptionDemoView from "@/views/ExceptionDemoView.vue";
import RoomSelectionView from "@/views/RoomSelectionView.vue";
import RoomLobbyView from "@/views/RoomLobbyView.vue";
import GamePlayingView from "@/views/GamePlayingView.vue";
import SongPickerView from "@/views/SongPickerView.vue";
import GameView from "@/views/GameView.vue";
import GuessingView from "@/views/GuessingView.vue";
import RevealView from "@/views/RevealView.vue";
import SongRevealWrapper from "@/views/SongRevealWrapper.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "login",
    component: LoginView
  },
  {
    path: "/test",
    name: "test-playback",
    component: TestPlaybackView
  },
  {
    path: "/test/errors",
    name: "test-errors",
    component: ErrorTestView
  },
  {
    path: "/test/server-disconnected",
    name: "demo-server-disconnected",
    component: ServerDisconnectedDemoView
  },
  {
    path: "/test/exception",
    name: "demo-exception",
    component: ExceptionDemoView
  },
  {
    path: "/rooms",
    name: "room-selection",
    component: RoomSelectionView
  },
  {
    path: "/rooms/:code",
    name: "room-lobby",
    component: RoomLobbyView
  },
  {
    path: "/rooms/:code/playing",
    name: "game-playing",
    component: GamePlayingView
  },
  {
    path: "/rooms/:code/songs",
    name: "song-picker",
    component: SongPickerView
  },
  {
    path: "/rooms/:code/play",
    name: "game",
    component: GameView
  },
  {
    path: "/rooms/:code/guess",
    name: "guessing",
    component: GuessingView
  },
  {
    path: "/rooms/:code/reveal",
    name: "song-reveal",
    component: SongRevealWrapper
  },
  {
    path: "/rooms/:code/results",
    name: "reveal",
    component: RevealView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
