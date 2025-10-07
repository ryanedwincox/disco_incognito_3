import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import RoomSelectionView from "@/views/RoomSelectionView.vue";
import RoomLobbyView from "@/views/RoomLobbyView.vue";
import SongPickerView from "@/views/SongPickerView.vue";
import GameView from "@/views/GameView.vue";
import GuessingView from "@/views/GuessingView.vue";
import RevealView from "@/views/RevealView.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "login",
    component: LoginView
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
    name: "reveal",
    component: RevealView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
