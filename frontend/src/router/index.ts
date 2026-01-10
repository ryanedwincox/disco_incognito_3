import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

// Lazy load views to avoid circular dependency issues in Storybook
const LoginView = () => import("@/views/LoginView.vue");
const TestPlaybackView = () => import("@/views/TestPlaybackView.vue");
const ErrorTestView = () => import("@/views/ErrorTestView.vue");
const ServerDisconnectedDemoView = () => import("@/views/ServerDisconnectedDemoView.vue");
const ExceptionDemoView = () => import("@/views/ExceptionDemoView.vue");
const RoomSelectionView = () => import("@/views/RoomSelectionView.vue");
const RoomLobbyView = () => import("@/views/RoomLobbyView.vue");
const GamePlayingView = () => import("@/views/GamePlayingView.vue");
const SongPickerView = () => import("@/views/SongPickerView.vue");
const GameView = () => import("@/views/GameView.vue");
const GuessingView = () => import("@/views/GuessingView.vue");
const ResultsView = () => import("@/views/ResultsView.vue");
const SongAssignmentWrapper = () => import("@/views/SongAssignmentWrapper.vue");

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
    path: "/rooms/:code/assignment",
    name: "song-assignment",
    component: SongAssignmentWrapper
  },
  {
    path: "/rooms/:code/results",
    name: "results",
    component: ResultsView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
