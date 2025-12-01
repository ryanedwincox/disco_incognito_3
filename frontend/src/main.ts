import { createApp } from "vue";
import { createPinia } from "pinia";
import axios from "axios";
import App from "./App.vue";
import router from "./router";
import "./assets/tailwind.css";
import { useNotificationStore } from "./stores/notifications";

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);

// Configure axios interceptor for rate limiting (429) responses
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const notificationStore = useNotificationStore();
      notificationStore.warning(
        "Rate Limited",
        "Too many requests. Please wait a moment and try again."
      );
    }
    return Promise.reject(error);
  }
);

// Global error handler for uncaught exceptions
app.config.errorHandler = (err, instance, info) => {
  console.error("Global error handler caught:", err, info);

  const notificationStore = useNotificationStore();
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorTitle = info === "render"
    ? "Rendering Error"
    : info === "component setup"
    ? "Component Error"
    : "Application Error";

  notificationStore.error(
    errorTitle,
    errorMessage,
    true // persistent
  );
};

// Global handler for unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);

  const notificationStore = useNotificationStore();
  const errorMessage = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason);

  notificationStore.error(
    "Network Error",
    errorMessage,
    true // persistent
  );

  event.preventDefault();
});

// Global handler for uncaught errors
window.addEventListener("error", (event) => {
  console.error("Uncaught error:", event.error);

  const notificationStore = useNotificationStore();
  const errorMessage = event.error instanceof Error
    ? event.error.message
    : event.message;

  notificationStore.error(
    "Runtime Error",
    errorMessage,
    true // persistent
  );

  event.preventDefault();
});

app.mount("#app");
