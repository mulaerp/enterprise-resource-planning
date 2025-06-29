import { useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

// Hook to automatically generate system notifications based on business logic
export const useNotificationSystem = () => {
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Simulate real-time notifications
    const interval = setInterval(() => {
      // Random chance to generate a notification
      if (Math.random() < 0.1) { // 10% chance every 30 seconds
        const notifications = [
          {
            title: 'New Order Received',
            message: `Order #${Math.floor(Math.random() * 1000) + 1000} received from customer`,
            type: 'success' as const,
            actionUrl: '/sales',
            actionLabel: 'View Orders'
          },
          {
            title: 'Low Stock Alert',
            message: `Product inventory is running low`,
            type: 'warning' as const,
            actionUrl: '/inventory',
            actionLabel: 'Check Inventory'
          },
          {
            title: 'Payment Received',
            message: `Payment of $${(Math.random() * 5000 + 500).toFixed(2)} received`,
            type: 'success' as const,
            actionUrl: '/invoicing',
            actionLabel: 'View Invoices'
          },
          {
            title: 'System Update',
            message: 'New features are available in the system',
            type: 'info' as const,
            actionUrl: '/configuration',
            actionLabel: 'View Updates'
          }
        ];

        const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
        addNotification(randomNotification);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [addNotification]);

  // Function to trigger specific business notifications
  const triggerBusinessNotification = (type: string, data: any) => {
    switch (type) {
      case 'low_stock':
        addNotification({
          title: 'Low Stock Alert',
          message: `${data.productName} is running low (${data.quantity} units remaining)`,
          type: 'warning',
          actionUrl: '/inventory',
          actionLabel: 'View Inventory'
        });
        break;
      
      case 'new_sale':
        addNotification({
          title: 'New Sale',
          message: `New sale order ${data.orderId} received from ${data.customerName}`,
          type: 'success',
          actionUrl: '/sales',
          actionLabel: 'View Sales'
        });
        break;
      
      case 'invoice_overdue':
        addNotification({
          title: 'Invoice Overdue',
          message: `Invoice ${data.invoiceId} is overdue by ${data.days} days`,
          type: 'error',
          actionUrl: '/invoicing',
          actionLabel: 'View Invoices'
        });
        break;
      
      case 'payment_received':
        addNotification({
          title: 'Payment Received',
          message: `Payment of $${data.amount} received for invoice ${data.invoiceId}`,
          type: 'success',
          actionUrl: '/invoicing',
          actionLabel: 'View Invoices'
        });
        break;
      
      default:
        console.warn('Unknown notification type:', type);
    }
  };

  return { triggerBusinessNotification };
};