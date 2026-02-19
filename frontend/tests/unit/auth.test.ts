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

// Mock sessionStorage (auth store uses sessionStorage for per-tab isolation)
const sessionStorageMock = (() => {
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

Object.defineProperty(global, "sessionStorage", { value: sessionStorageMock });

describe("Auth Store - Token Validation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadFromStorage", () => {
    it("clears tokens when validateTokens returns 401", async () => {
      // Setup: Token in sessionStorage
      sessionStorageMock.setItem("access_token", "test_token_123");
      sessionStorageMock.setItem(
        "user",
        JSON.stringify({ id: "user1", displayName: "Test User" })
      );

      // Mock 401 response from /auth/verify
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401 }
      });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should be cleared
      expect(authStore.accessToken).toBeNull();
      expect(authStore.user).toBeNull();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("access_token");
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("user");
    });

    it("preserves tokens on network error (offline mode)", async () => {
      // Setup: Token in sessionStorage
      sessionStorageMock.setItem("access_token", "test_token_456");
      sessionStorageMock.setItem(
        "user",
        JSON.stringify({ id: "user2", displayName: "Offline User" })
      );

      // Mock network error (no response object)
      mockedAxios.get.mockRejectedValueOnce(new Error("Network Error"));

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should be preserved
      expect(authStore.accessToken).toBe("test_token_456");
      expect(authStore.user).toEqual({
        id: "user2",
        displayName: "Offline User",
      });
      // removeItem should NOT have been called for tokens
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalledWith("access_token");
    });

    it("preserves tokens on 500 server error", async () => {
      // Setup: Token in sessionStorage
      sessionStorageMock.setItem("access_token", "test_token_789");
      sessionStorageMock.setItem(
        "user",
        JSON.stringify({ id: "user3", displayName: "Server Error User" })
      );

      // Mock 500 server error
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 500 }
      });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // Tokens should be preserved (not a 401)
      expect(authStore.accessToken).toBe("test_token_789");
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalledWith("access_token");
    });

    it("does not call validateTokens when no token in storage", async () => {
      // No tokens in sessionStorage
      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      // axios.get should NOT have been called
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(authStore.accessToken).toBeNull();
    });

    it("keeps tokens when validateTokens returns 200", async () => {
      // Setup: Token in sessionStorage
      sessionStorageMock.setItem("access_token", "valid_token");
      sessionStorageMock.setItem(
        "user",
        JSON.stringify({ id: "valid_user", displayName: "Valid User" })
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
      expect(authStore.user).toEqual({
        id: "valid_user",
        displayName: "Valid User",
      });
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalledWith("access_token");
    });
  });

  describe("validateTokens", () => {
    it("calls /api/auth/verify with Bearer token", async () => {
      sessionStorageMock.setItem("access_token", "my_token");

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

  describe("Custom Name", () => {
    it("userName getter prefers customName over displayName", () => {
      const authStore = useAuthStore();
      authStore.user = { id: "u1", displayName: "Original Name", customName: "My Custom" };

      expect(authStore.userName).toBe("My Custom");
    });

    it("userName getter falls back to displayName when no customName", () => {
      const authStore = useAuthStore();
      authStore.user = { id: "u1", displayName: "Original Name" };

      expect(authStore.userName).toBe("Original Name");
    });

    it("updateDisplayName persists customName to store and sessionStorage", async () => {
      const authStore = useAuthStore();
      authStore.accessToken = "test_token";
      authStore.user = { id: "u1", displayName: "Original" };

      // Mock successful POST
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { display_name: "New Name" } });

      const result = await authStore.updateDisplayName("New Name");

      expect(result.success).toBe(true);
      expect(authStore.user?.customName).toBe("New Name");
      expect(authStore.userName).toBe("New Name");

      // Verify sessionStorage was updated
      const stored = JSON.parse(sessionStorageMock._getStore()["user"] || "{}");
      expect(stored.customName).toBe("New Name");
    });

    it("updateDisplayName with null clears customName", async () => {
      const authStore = useAuthStore();
      authStore.accessToken = "test_token";
      authStore.user = { id: "u1", displayName: "Original", customName: "Custom" };

      // Mock successful POST
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { display_name: "Original" } });

      const result = await authStore.updateDisplayName(null);

      expect(result.success).toBe(true);
      expect(authStore.user?.customName).toBeUndefined();
      expect(authStore.userName).toBe("Original");
    });

    it("validateTokens restores customName from verify response", async () => {
      sessionStorageMock.setItem("access_token", "token_with_custom");
      sessionStorageMock.setItem(
        "user",
        JSON.stringify({ id: "u1", displayName: "Original Name" })
      );

      // Mock verify returning custom_name
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { user_id: "u1", display_name: "Custom Name", custom_name: "Custom Name" }
      });

      const authStore = useAuthStore();
      await authStore.loadFromStorage();

      expect(authStore.user?.customName).toBe("Custom Name");
      expect(authStore.userName).toBe("Custom Name");
    });
  });
});
