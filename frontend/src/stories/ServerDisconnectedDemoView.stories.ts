// Story: ServerDisconnectedDemoView - Demo view simulating server disconnection state
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { useWebSocketStore } from '../stores/websocket';
import ServerDisconnectedDemoView from '../views/ServerDisconnectedDemoView.vue';

const meta: Meta<typeof ServerDisconnectedDemoView> = {
  title: 'Views/ServerDisconnectedDemoView',
  component: ServerDisconnectedDemoView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const wsStore = useWebSocketStore();
      // Start with connected state - component will set to disconnected on mount
      wsStore.$patch({
        status: 'connected',
        lastMessage: null,
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default view (will show disconnected state on mount)
export const Default: Story = {};
