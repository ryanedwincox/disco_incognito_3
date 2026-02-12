<!-- Toast notification system displaying stacked alerts at screen top. Supports error, warning, info, and success notification types with icons. Handles auto-dismiss timing and manual dismissal with animated transitions. -->
<template>
  <div class="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-4 px-4 pointer-events-none">
    <TransitionGroup name="notification">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="w-full max-w-md mb-3 pointer-events-auto"
      >
        <div
          class="rounded-2xl shadow-2xl border backdrop-blur-sm transition-all duration-200 hover:scale-[1.02]"
          :class="notificationClasses(notification.type)"
          role="alert"
        >
          <div class="p-4 flex items-start gap-3">
            <!-- Icon -->
            <div class="flex-shrink-0 pt-0.5">
              <!-- Error Icon -->
              <svg
                v-if="notification.type === 'error'"
                aria-hidden="true"
                class="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clip-rule="evenodd"
                />
              </svg>
              <!-- Warning Icon -->
              <svg
                v-else-if="notification.type === 'warning'"
                aria-hidden="true"
                class="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clip-rule="evenodd"
                />
              </svg>
              <!-- Info Icon -->
              <svg
                v-else-if="notification.type === 'info'"
                aria-hidden="true"
                class="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clip-rule="evenodd"
                />
              </svg>
              <!-- Success Icon -->
              <svg
                v-else-if="notification.type === 'success'"
                aria-hidden="true"
                class="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-semibold mb-1">{{ notification.title }}</h3>
              <p class="text-xs opacity-90">{{ notification.message }}</p>
            </div>

            <!-- Dismiss Button -->
            <button
              v-if="notification.dismissible"
              class="flex-shrink-0 p-2 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
              type="button"
              @click="dismiss(notification.id)"
            >
              <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationStore, type NotificationType } from '@/stores/notifications'

const notificationStore = useNotificationStore()

const notifications = computed(() => notificationStore.notifications)

function notificationClasses(type: NotificationType): string {
  const baseClasses = {
    error: 'bg-red-900/95 text-red-100 border-red-700',
    warning: 'bg-yellow-900/95 text-yellow-100 border-yellow-700',
    info: 'bg-blue-900/95 text-blue-100 border-blue-700',
    success: 'bg-green-900/95 text-green-100 border-green-700'
  }
  return baseClasses[type] || baseClasses.info
}

function dismiss(id: string) {
  notificationStore.dismissNotification(id)
}
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100px);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>
