/**
 * Leading-edge debounce composable with built-in 429 retry logic.
 *
 * Owns `isPending` state that drives button disabled/spinner UI.
 * Prevents double-submission: if `isPending` is true, `trigger` is a no-op.
 * Retries the action on HTTP 429 with exponential backoff (up to 3 times).
 * Re-throws on exhaustion so callers can surface a user-facing notification.
 *
 * Unmount-safe: will not mutate `isPending` after component teardown.
 */
import { onUnmounted, ref } from "vue";
import { retryWithBackoff } from "@/utils/retryWithBackoff";

function is429(error: unknown): boolean {
  return (
    error != null &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: unknown }).status === 429
  );
}

export function useActionDebounce() {
  const isPending = ref(false);
  let mounted = true;

  onUnmounted(() => {
    mounted = false;
  });

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
    } finally {
      if (mounted) {
        isPending.value = false;
      }
    }
  }

  return { isPending, trigger };
}
