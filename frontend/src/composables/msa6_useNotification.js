/**
 * msa6_useNotification.js
 * Notification/toast message state and display logic.
 */
import { reactive } from 'vue';

export function useNotification() {
  const notification = reactive({
    show: false,
    message: '',
    type: 'info',
    timeout: null,
  });

  function showNotification(message, type = 'info', duration = 3000) {
    try {
      if (notification.timeout) {
        clearTimeout(notification.timeout);
      }

      notification.message = message;
      notification.type = type;
      notification.show = true;

      notification.timeout = setTimeout(() => {
        notification.show = false;
        notification.timeout = null;
      }, duration);
    } catch (error) {
      console.error('[showNotification] Error:', error);
    }
  }

  return {
    notification,
    showNotification,
  };
}
