/**
 * Room API composable with automatic 404 handling for expired rooms and
 * automatic Authorization header injection from the active session.
 *
 * Redirects to home page with a notification when a room is not found.
 * Injects the Bearer token so the backend rate-limiter can key on the
 * per-player identity rather than the shared IP address (NAT collapse fix).
 */
import { useRouter } from "vue-router";
import { useNotificationStore } from "@/stores/notifications";
import { useAuthStore } from "@/stores/auth";
import { API_URL } from "@/config/api";

export function useRoomApi() {
  const router = useRouter();
  const notifications = useNotificationStore();
  const authStore = useAuthStore();

  function getToken(): string | null {
    return authStore.accessToken ?? sessionStorage.getItem("access_token");
  }

  // Notifies the user and redirects to /rooms when a 404 detail string
  // indicates room expiry. Returns true if it matched (room expired), false otherwise.
  function redirectIfRoomExpired(detail: string): boolean {
    if (detail.includes("Room") || detail.includes("not found")) {
      notifications.error(
        "Room Expired",
        "This room has expired or no longer exists. Please create or join a new room."
      );
      router.push("/rooms");
      return true;
    }
    return false;
  }

  /**
   * Fetch wrapper that injects the Authorization header and handles 404
   * room-expired responses.
   *
   * Merges the auth header with any caller-supplied headers so all room
   * API calls carry the Bearer token needed for per-player rate-limit keys.
   */
  async function roomFetch(
    endpoint: string,
    options?: RequestInit
  ): Promise<Response> {
    const token = getToken();
    const authHeaders: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers ?? {}),
      },
    };
    const response = await fetch(`${API_URL}${endpoint}`, mergedOptions);

    if (response.status === 429) {
      // Throw a tagged error so retryWithBackoff / useActionDebounce can retry.
      throw Object.assign(new Error("Rate limited"), { status: 429 });
    }

    if (response.status === 404) {
      const data = await response.json().catch(() => ({}));
      redirectIfRoomExpired(data.detail ?? "Room not found");
    }

    return response;
  }

  /**
   * Handle a fetch response that may indicate an expired room.
   * Call this with an existing response to check for 404 and redirect.
   */
  async function handleRoomResponse(response: Response): Promise<boolean> {
    if (response.status === 404) {
      const data = await response.clone().json().catch(() => ({}));
      return redirectIfRoomExpired(data.detail ?? "Room not found");
    }
    return false; // Not a room expiration error
  }

  /**
   * Returns the Authorization header object for the current session.
   * Spread into fetch `headers` so room endpoints carry the Bearer token
   * required for per-player-per-room rate-limit bucketing on the backend.
   *
   * @example
   *   fetch(url, { headers: { 'Content-Type': 'application/json', ...authHeaders() } })
   */
  function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  return {
    roomFetch,
    handleRoomResponse,
    authHeaders,
  };
}
