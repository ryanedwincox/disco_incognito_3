import { defineStore } from "pinia";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isSpoofedMode: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    isSpoofedMode: import.meta.env.VITE_UI_MODE === "minimal"
  }),
  actions: {
    setTokens(accessToken: string, refreshToken: string) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    },
    clearTokens() {
      this.accessToken = null;
      this.refreshToken = null;
    }
  }
});
