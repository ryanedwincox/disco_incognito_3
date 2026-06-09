/** Authentication store managing guest login sessions and token persistence. */
import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "../config/api";

interface UserInfo {
  id: string;
  displayName: string;
  customName?: string;
}

interface AxiosErrorShape {
  response?: { data?: { detail?: string }; status?: number };
  message?: string;
}

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accessToken: null,
    user: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    userName: (state) => state.user?.customName || state.user?.displayName || "Guest"
  },

  actions: {
    setToken(accessToken: string) {
      this.accessToken = accessToken;
      sessionStorage.setItem("access_token", accessToken);
    },

    setUser(user: UserInfo) {
      this.user = user;
      sessionStorage.setItem("user", JSON.stringify(user));
    },

    clearTokens() {
      this.accessToken = null;
      this.user = null;

      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("user");
    },

    async login(displayName: string): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await axios.post(`${API_URL}/api/auth/login`, {
          display_name: displayName
        });
        const data = response.data;

        this.setToken(data.access_token);

        this.setUser({
          id: data.user_id,
          displayName: data.display_name,
        });

        return { success: true };
      } catch (error: unknown) {
        console.error("Login failed:", error);
        const axiosError = error as AxiosErrorShape;
        return {
          success: false,
          error: axiosError.response?.data?.detail || axiosError.message || "Login failed"
        };
      }
    },

    async updateDisplayName(customName: string | null): Promise<{ success: boolean; error?: string }> {
      try {
        await axios.post(
          `${API_URL}/api/auth/update-name`,
          { custom_name: customName },
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );

        if (this.user) {
          if (customName) {
            this.user.customName = customName;
          } else {
            delete this.user.customName;
          }
          sessionStorage.setItem("user", JSON.stringify(this.user));
        }

        return { success: true };
      } catch (error: unknown) {
        console.error("Failed to update display name:", error);
        const axiosError = error as AxiosErrorShape;
        return {
          success: false,
          error: axiosError.response?.data?.detail || axiosError.message || "Failed to update name"
        };
      }
    },

    async loadFromStorage(): Promise<void> {
      const accessToken = sessionStorage.getItem("access_token");
      const userJson = sessionStorage.getItem("user");

      if (accessToken) {
        this.accessToken = accessToken;
      }

      if (userJson) {
        try {
          this.user = JSON.parse(userJson);
        } catch (e) {
          console.error("Failed to parse user from storage");
        }
      }

      if (this.accessToken) {
        await this.validateTokens();
      }
    },

    async validateTokens(): Promise<void> {
      if (!this.accessToken) {
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        if (this.user && response.data?.custom_name) {
          this.user.customName = response.data.custom_name;
          sessionStorage.setItem("user", JSON.stringify(this.user));
        } else if (this.user && !response.data?.custom_name) {
          delete this.user.customName;
          sessionStorage.setItem("user", JSON.stringify(this.user));
        }
      } catch (error: unknown) {
        const axiosError = error as AxiosErrorShape;

        if (axiosError.response?.status === 401) {
          this.clearTokens();
        } else {
          console.warn("Token validation failed (offline?), keeping tokens:", error);
        }
      }
    }
  }
});
