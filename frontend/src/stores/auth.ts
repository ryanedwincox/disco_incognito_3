/**
 * Authentication store managing Spotify OAuth tokens and user session.
 * Handles token storage in localStorage, test mode login, live Spotify OAuth flow,
 * and session persistence. Provides user info and authentication status getters.
 */
import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "../config/api";

interface UserInfo {
  id: string;
  displayName: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  isSpoofedMode: boolean;
  isTestMode: boolean;
  isSpotifyUser: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    isSpoofedMode: import.meta.env.VITE_UI_MODE === "minimal",
    isTestMode: import.meta.env.VITE_TEST_MODE === "true",
    isSpotifyUser: true
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    userName: (state) => state.user?.displayName || "Guest"
  },

  actions: {
    setTokens(accessToken: string, refreshToken: string) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;

      // Store tokens in localStorage for persistence
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
    },

    setUser(user: UserInfo) {
      this.user = user;
      localStorage.setItem("user", JSON.stringify(user));
    },

    clearTokens() {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      this.isSpotifyUser = true;

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      localStorage.removeItem("is_spotify_user");
    },

    async testLogin(): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await axios.post(`${API_URL}/api/auth/test-login`);
        const data = response.data;

        // Set tokens
        this.setTokens(data.access_token, data.refresh_token);

        // Set user info
        this.setUser({
          id: data.user_id,
          displayName: data.display_name,
          email: data.email
        });

        console.log(`✅ Test user created: ${data.display_name}`);
        return { success: true };
      } catch (error: unknown) {
        console.error("Test login failed:", error);
        const axiosError = error as { response?: { data?: { detail?: string } }; message?: string };
        return {
          success: false,
          error: axiosError.response?.data?.detail || axiosError.message || "Login failed"
        };
      }
    },

    async manualLogin(displayName: string): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await axios.post(`${API_URL}/api/auth/manual-login`, {
          display_name: displayName
        });
        const data = response.data;

        // Set tokens
        this.setTokens(data.access_token, data.refresh_token);

        // Set user info
        this.setUser({
          id: data.user_id,
          displayName: data.display_name,
          email: data.email
        });

        // Mark as non-Spotify user
        this.isSpotifyUser = false;
        localStorage.setItem("is_spotify_user", "false");

        console.log(`✅ Guest user created: ${data.display_name}`);
        return { success: true };
      } catch (error: unknown) {
        console.error("Manual login failed:", error);
        const axiosError = error as { response?: { data?: { detail?: string } }; message?: string };
        return {
          success: false,
          error: axiosError.response?.data?.detail || axiosError.message || "Login failed"
        };
      }
    },

    async spotifyLogin(): Promise<void> {
      try {
        // Get authorization URL (or direct auth data in test mode)
        const response = await axios.get(`${API_URL}/api/auth/login`);
        const data = response.data;

        // In test mode, backend returns auth data directly
        if (data.access_token) {
          this.setTokens(data.access_token, data.refresh_token);
          this.setUser({
            id: data.user_id,
            displayName: data.display_name,
            email: data.email
          });
          // Mark as Spotify user and persist to localStorage
          this.isSpotifyUser = true;
          localStorage.setItem("is_spotify_user", "true");
          console.log(`✅ Test mode login successful: ${data.display_name}`);
          return;
        }

        // Live mode: redirect to Spotify authorization
        if (data.authorize_url) {
          window.location.href = data.authorize_url;
        } else {
          throw new Error("No authorization URL received");
        }
      } catch (error: unknown) {
        console.error("Spotify login failed:", error);
        const axiosError = error as { response?: { data?: { detail?: string } } };
        throw new Error(axiosError.response?.data?.detail || "Failed to initiate login");
      }
    },

    loadFromStorage() {
      const accessToken = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");
      const userJson = localStorage.getItem("user");
      const isSpotifyUser = localStorage.getItem("is_spotify_user");

      if (accessToken && refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
      }

      if (userJson) {
        try {
          this.user = JSON.parse(userJson);
        } catch (e) {
          console.error("Failed to parse user from storage");
        }
      }

      // Restore isSpotifyUser flag (defaults to true if not set)
      this.isSpotifyUser = isSpotifyUser !== "false";
    }
  }
});
