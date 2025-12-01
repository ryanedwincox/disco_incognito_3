/**
 * Room API composable with automatic 404 handling for expired rooms.
 * Redirects to home page with a notification when a room is not found.
 */
import { useRouter } from "vue-router";
import { useNotificationStore } from "@/stores/notifications";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useRoomApi() {
  const router = useRouter();
  const notifications = useNotificationStore();

  /**
   * Fetch wrapper that handles 404 room expired responses.
   * Redirects to /rooms with an error notification on 404.
   */
  async function roomFetch(
    endpoint: string,
    options?: RequestInit
  ): Promise<Response> {
    const response = await fetch(`${API_URL}${endpoint}`, options);

    if (response.status === 404) {
      const data = await response.json().catch(() => ({}));
      const detail = data.detail || "Room not found";

      // Check if it's a room not found error
      if (detail.includes("Room") || detail.includes("not found")) {
        notifications.error(
          "Room Expired",
          "This room has expired or no longer exists. Please create or join a new room."
        );
        router.push("/rooms");
      }
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
      const detail = data.detail || "Room not found";

      if (detail.includes("Room") || detail.includes("not found")) {
        notifications.error(
          "Room Expired",
          "This room has expired or no longer exists. Please create or join a new room."
        );
        router.push("/rooms");
        return true; // Handled as expired
      }
    }
    return false; // Not a room expiration error
  }

  return {
    roomFetch,
    handleRoomResponse,
    API_URL
  };
}
