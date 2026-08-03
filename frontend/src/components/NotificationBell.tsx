import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceType: string;
  referenceId: string;
  isRead: boolean;
  priority: string;
  createdAt: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // Deployment hardening: this hardcoded 'dev-user' meant every deployed user shared (and could
  // read) one dev account's notifications. Use the actually-authenticated user's id instead, and
  // skip fetching entirely - rather than call the API with a bogus id - while there isn't one
  // (logged out, or AuthContext's session-restore fetchUser() hasn't resolved yet).
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      return;
    }
    loadUnreadCount(userId);
    const interval = setInterval(() => loadUnreadCount(userId), 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      loadNotifications(userId);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUnreadCount = async (forUserId: string) => {
    try {
      const response = await api.get(`/notifications/unread/count?userId=${encodeURIComponent(forUserId)}`);
      setUnreadCount(response.data);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadNotifications = async (forUserId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/notifications?userId=${encodeURIComponent(forUserId)}&page=0&size=10`);
      setNotifications(response.data.content);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) {
      return;
    }
    try {
      await api.put(`/notifications/read-all?userId=${encodeURIComponent(userId)}`);
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on reference type
    if (notification.referenceType === 'PRODUCT' && notification.referenceId) {
      navigate(`/products/${notification.referenceId}/edit`);
    } else if (notification.referenceType === 'ORDER' && notification.referenceId) {
      navigate(`/sales-orders/${notification.referenceId}`);
    }
    
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle size={16} className="text-amber-600" />;
      case 'ORDER_STATUS':
        return <ShoppingCart size={16} className="text-blue-600" />;
      default:
        return <Package size={16} className="text-slate-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'border-l-4 border-red-600';
      case 'HIGH':
        return 'border-l-4 border-amber-500';
      default:
        return 'border-l-4 border-blue-600';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <Bell size={20} className="text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1 rounded-full transition-colors flex items-center gap-1 text-slate-700"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="p-8 text-center text-slate-500">Loading...</div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <Bell size={48} className="mx-auto mb-3 text-slate-300" />
                <p>No notifications</p>
              </div>
            )}

            {!loading && notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-200 ${
                  !notification.isRead ? 'bg-brand-50' : ''
                } ${getPriorityColor(notification.priority)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-medium text-sm ${!notification.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-brand-600 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a full notifications page
                }}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
