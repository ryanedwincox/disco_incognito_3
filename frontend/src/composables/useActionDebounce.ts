/**
 * Leading-edge debounce composable with built-in 429 retry and toast logic.
 *
 * Owns `isPending` state that drives button disabled/spinner UI.
 * Prevents double-submission: if `isPending` is true, `trigger` is a no-op.
 * Retries the action on HTTP 429 with exponential backoff (up to 3 times).
 * On exhaustion, shows a "Server busy" warning toast automatically.
 * Non-429 errors propagate to the caller.
 *
 * Unmount-safe: will not mutate `isPending` after component teardown.
 */
import { onUnmounted, readonly, ref } from "vue";
import { retryWithBackoff } from "@/utils/retryWithBackoff";
import { useNotificationStore } from "@/stores/notifications";

export function is429(error: unknown): boolean {
  return (
    error != null &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: unknown }).status === 429
  );
}

export function useActionDebounce() {
  const notifications = useNotificationStore();
  const isPending = ref(false);
  let mounted = true;

  onUnmounted(() => {
    mounted = false;
  });

  /**
   * Execute `action`, guarding against concurrent invocations.
   * Retries on 429 automatically. Shows a toast on exhaustion.
   * Re-throws non-429 errors to the caller.
   */
  async function trigger(action: () => Promise<void>): Promise<void> {
    if (isPending.value) return;

    isPending.value = true;
    try {
      await retryWithBackoff(action, {
        maxRetries: 3,
        baseDelayMs: 500,
        jitterMs: 200,
        retryOn: is429,
      });
    } catch (err) {
      if (is429(err)) {
        notifications.warning(
          "Server busy",
          "Server is busy, please try again in a moment."
        );
        // Swallow — toast was shown; no further propagation needed.
      } else {
        throw err;
      }
    } finally {
      if (mounted) {
        isPending.value = false;
      }
    }
  }

  return { isPending: readonly(isPending), trigger };
}
