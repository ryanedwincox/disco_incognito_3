// usePageVisibility: Fires onVisible() on visibilitychange events when tab returns to foreground. NOT concerned with connection management or reconnect logic. | I/O: (onVisible: () => void) → registers/removes DOM event listener
import { onMounted, onUnmounted } from "vue";

export function usePageVisibility(onVisible: () => void): void {
  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      onVisible();
    }
  }

  onMounted(() =>
    document.addEventListener("visibilitychange", handleVisibilityChange)
  );
  onUnmounted(() =>
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  );
}
