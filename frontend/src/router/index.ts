import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

// Lazy load views to avoid circular dependency issues in Storybook
const LoginView = () => import("@/views/LoginView.vue");
const TestPlaybackView = () => import("@/views/TestPlaybackView.vue");
const ErrorTestView = () => import("@/views/ErrorTestView.vue");
const ServerDisconnectedDemoView = () => import("@/views/ServerDisconnectedDemoView.vue");
const ExceptionDemoView = () => import("@/views/ExceptionDemoView.vue");

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
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
