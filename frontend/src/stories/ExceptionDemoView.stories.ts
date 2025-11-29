// Story: ExceptionDemoView - Demo view showing error notifications on mount
import type { Meta, StoryObj } from '@storybook/vue3';
import { useNotificationStore } from '../stores/notifications';
import ExceptionDemoView from '../views/ExceptionDemoView.vue';

const meta: Meta<typeof ExceptionDemoView> = {
  title: 'Views/ExceptionDemoView',
  component: ExceptionDemoView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story) => {
      const notificationStore = useNotificationStore();
      // Clear any existing notifications before the component adds new ones
      notificationStore.$patch({
        notifications: [],
      });
      return { components: { story }, template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default view (will show error + warning notifications on mount)
export const Default: Story = {};
