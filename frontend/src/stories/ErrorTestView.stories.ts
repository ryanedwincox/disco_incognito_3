// Story: ErrorTestView - Development testing interface for notifications and error states
import type { Meta, StoryObj } from '@storybook/vue3';
import { useWebSocketStore } from '../stores/websocket';
import { useNotificationStore } from '../stores/notifications';
import ErrorTestView from '../views/ErrorTestView.vue';

const meta: Meta<typeof ErrorTestView> = {
  title: 'Views/ErrorTestView',
  component: ErrorTestView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const wsStore = useWebSocketStore();
      const notificationStore = useNotificationStore();
      wsStore.$patch({
        status: 'connected',
        lastMessage: null,
      });
      notificationStore.$patch({
        notifications: [],
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default connected state
export const Connected: Story = {
  name: 'Connected',
};

// Disconnected state
export const Disconnected: Story = {
  name: 'Disconnected',
  decorators: [
    (story) => {
      const wsStore = useWebSocketStore();
      wsStore.$patch({
        status: 'disconnected',
        lastMessage: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

// With active notifications
export const WithNotifications: Story = {
  name: 'With Notifications',
  decorators: [
    (story) => {
      const wsStore = useWebSocketStore();
      const notificationStore = useNotificationStore();
      wsStore.$patch({
        status: 'connected',
        lastMessage: null,
      });
      notificationStore.$patch({
        notifications: [
          { id: 'n1', type: 'error', title: 'Connection Failed', message: 'Unable to connect to server', timestamp: Date.now(), dismissible: true, persistent: false },
          { id: 'n2', type: 'warning', title: 'Slow Connection', message: 'Some features may be limited', timestamp: Date.now(), dismissible: true, persistent: true },
        ],
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};
