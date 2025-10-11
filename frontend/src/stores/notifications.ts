import { defineStore } from "pinia";

export type NotificationType = "error" | "warning" | "info" | "success";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  dismissible?: boolean;
  persistent?: boolean; // Stays until explicitly dismissed
}

interface NotificationState {
  notifications: Notification[];
}

export const useNotificationStore = defineStore("notifications", {
  state: (): NotificationState => ({
    notifications: []
  }),

  actions: {
    addNotification(
      type: NotificationType,
      title: string,
      message: string,
      options: { dismissible?: boolean; persistent?: boolean; duration?: number } = {}
    ) {
      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        title,
        message,
        timestamp: Date.now(),
        dismissible: options.dismissible ?? true,
        persistent: options.persistent ?? false
      };

      this.notifications.push(notification);

      // Auto-dismiss after duration (default 5s) unless persistent
      if (!options.persistent) {
        const duration = options.duration ?? 5000;
        setTimeout(() => {
          this.dismissNotification(notification.id);
        }, duration);
      }

      return notification.id;
    },

    dismissNotification(id: string) {
      const index = this.notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        this.notifications.splice(index, 1);
      }
    },

    clearAll() {
      this.notifications = [];
    },

    // Convenience methods
    error(title: string, message: string, persistent = false) {
      return this.addNotification("error", title, message, {
        persistent,
        dismissible: true
      });
    },

    warning(title: string, message: string, persistent = false) {
      return this.addNotification("warning", title, message, {
        persistent,
        dismissible: true,
        duration: persistent ? undefined : 7000
      });
    },

    info(title: string, message: string) {
      return this.addNotification("info", title, message, {
        dismissible: true,
        duration: 4000
      });
    },

    success(title: string, message: string) {
      return this.addNotification("success", title, message, {
        dismissible: true,
        duration: 3000
      });
    }
  }
});
