/**
 * Tests for auth store token validation behavior.
 *
 * Validates that:
 * - loadFromStorage clears tokens on 401 response
 * - loadFromStorage preserves tokens on network error
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import axios from "axios";
import { useAuthStore } from "../../src/stores/auth";

// Mock axios
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _getStore: () => store
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("Auth Store - Token Validation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadFromStorage", () => {
    it("clears tokens when validateTokens returns 401", async () => {
      // Setup: Tokens in localStorage
      localStorageMock.setItem("access_token", "test_token_123");
      localStorageMock.setItem("refresh_token", "test_refresh_123");
      localStorageMock.setItem(
        "user",
        JSON.stringify({ id: "user1", displayName: "Test User", email: "test@example.com" })
      );

      // Mock 401 response from /auth/verify
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401 }
      });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should be cleared
      expect(authStore.accessToken).toBeNull();
      expect(authStore.refreshToken).toBeNull();
      expect(authStore.user).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("access_token");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("refresh_token");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("user");
    });

    it("preserves tokens on network error (offline mode)", async () => {
      // Setup: Tokens in localStorage
      localStorageMock.setItem("access_token", "test_token_456");
      localStorageMock.setItem("refresh_token", "test_refresh_456");
      localStorageMock.setItem(
        "user",
        JSON.stringify({ id: "user2", displayName: "Offline User", email: "offline@example.com" })
      );

      // Mock network error (no response object)
      mockedAxios.get.mockRejectedValueOnce(new Error("Network Error"));

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should be preserved
      expect(authStore.accessToken).toBe("test_token_456");
      expect(authStore.refreshToken).toBe("test_refresh_456");
      expect(authStore.user).toEqual({
        id: "user2",
        displayName: "Offline User",
        email: "offline@example.com"
      });
      // removeItem should NOT have been called for tokens
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith("access_token");
    });

    it("preserves tokens on 500 server error", async () => {
      // Setup: Tokens in localStorage
      localStorageMock.setItem("access_token", "test_token_789");
      localStorageMock.setItem("refresh_token", "test_refresh_789");
      localStorageMock.setItem(
        "user",
        JSON.stringify({ id: "user3", displayName: "Server Error User", email: "error@example.com" })
      );

      // Mock 500 server error
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 500 }
      });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should be preserved (not a 401)
      expect(authStore.accessToken).toBe("test_token_789");
      expect(authStore.refreshToken).toBe("test_refresh_789");
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith("access_token");
    });

    it("does not call validateTokens when no token in storage", async () => {
      // No tokens in localStorage
      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // axios.get should NOT have been called
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(authStore.accessToken).toBeNull();
    });

    it("keeps tokens when validateTokens returns 200", async () => {
      // Setup: Tokens in localStorage
      localStorageMock.setItem("access_token", "valid_token");
      localStorageMock.setItem("refresh_token", "valid_refresh");
      localStorageMock.setItem(
        "user",
        JSON.stringify({ id: "valid_user", displayName: "Valid User", email: "valid@example.com" })
      );

      // Mock 200 response from /auth/verify
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { user_id: "valid_user", display_name: "Valid User" }
      });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should remain
      expect(authStore.accessToken).toBe("valid_token");
      expect(authStore.refreshToken).toBe("valid_refresh");
      expect(authStore.user).toEqual({
        id: "valid_user",
        displayName: "Valid User",
        email: "valid@example.com"
      });
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith("access_token");
    });
  });

  describe("validateTokens", () => {
    it("calls /api/auth/verify with Bearer token", async () => {
      localStorageMock.setItem("access_token", "my_token");
      localStorageMock.setItem("refresh_token", "my_refresh");

      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/verify"),
        expect.objectContaining({
          headers: { Authorization: "Bearer my_token" }
        })
      );
    });

    it("does nothing when accessToken is null", async () => {
      const authStore = useAuthStore();
      // accessToken is null by default
      await authStore.validateTokens();

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });
});
