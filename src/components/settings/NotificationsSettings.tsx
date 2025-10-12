import React, { useState, useEffect } from 'react';
import { Bell, Filter, Trash2, Check, X, CheckCircle, Info, AlertCircle, AlertTriangle, Save } from 'lucide-react';
import { notificationService, Notification } from '../../services/notificationService';

interface NotificationsSettingsProps {
  preferences: {
    email_updates: boolean;
    security_alerts: boolean;
    billing_notifications: boolean;
    product_updates: boolean;
    email_frequency: 'immediate' | 'daily' | 'weekly';
  };
  onUpdatePreferences: (preferences: any) => void;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
  onConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function NotificationsSettings({
  preferences,
  onUpdatePreferences,
  onSuccess,
  onError,
  onConfirm
}: NotificationsSettingsProps) {
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'success' | 'error' | 'warning' | 'info'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllNotifications();
  }, []);

  const loadAllNotifications = async () => {
    try {
      const notifications = await notificationService.getNotifications(100);
      setAllNotifications(notifications);
    } catch (error) {
      console.error('Error loading all notifications:', error);
    }
  };

  const handleDeleteAllNotifications = () => {
    onConfirm(
      'Eliminar todas las notificaciones',
      '¿Estás seguro de que deseas eliminar todas tus notificaciones? Esta acción no se puede deshacer.',
      async () => {
        try {
          await notificationService.deleteAllNotifications();
          await loadAllNotifications();
          onSuccess(
            'Notificaciones eliminadas',
            'Todas tus notificaciones han sido eliminadas exitosamente.'
          );
        } catch (error) {
          console.error('Error deleting all notifications:', error);
          onError(
            'Error al eliminar',
            'Ha ocurrido un error al eliminar las notificaciones.'
          );
        }
      }
    );
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      onError(
        'Error al eliminar',
        'Ha ocurrido un error al eliminar la notificación.'
      );
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setAllNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      await notificationService.updatePreferences(preferences);
      onSuccess(
        'Preferencias guardadas',
        'Tus preferencias de notificaciones han sido actualizadas.'
      );
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      onError(
        'Error al guardar',
        'Ha ocurrido un error al guardar tus preferencias.'
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = allNotifications.filter(n => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'unread') return !n.is_read;
    return n.type === notificationFilter;
  });

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - notifDate.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Hace un momento';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    return notifDate.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Historial de Notificaciones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Historial de Notificaciones</h3>
            <p className="text-sm text-gray-600">Gestiona todas tus notificaciones</p>
          </div>
          <button
            onClick={handleDeleteAllNotifications}
            disabled={allNotifications.length === 0}
            className="text-red-600 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Todo</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {[
            { value: 'all', label: 'Todas', count: allNotifications.length },
            { value: 'unread', label: 'No leídas', count: allNotifications.filter(n => !n.is_read).length },
            { value: 'success', label: 'Éxito', count: allNotifications.filter(n => n.type === 'success').length },
            { value: 'error', label: 'Errores', count: allNotifications.filter(n => n.type === 'error').length },
            { value: 'warning', label: 'Alertas', count: allNotifications.filter(n => n.type === 'warning').length },
            { value: 'info', label: 'Info', count: allNotifications.filter(n => n.type === 'info').length },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setNotificationFilter(filter.value as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                notificationFilter === filter.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>

        {/* Lista de Notificaciones */}
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No hay notificaciones que mostrar</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition-colors ${
                  !notification.is_read
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </h4>
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Marcar leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferencias de Notificaciones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferencias de Notificaciones</h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">Actualizaciones por Email</span>
              <p className="text-xs text-gray-500">Recibe noticias sobre nuevas funcionalidades</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.email_updates}
              onChange={(e) => onUpdatePreferences({
                ...preferences,
                email_updates: e.target.checked
              })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">Alertas de Seguridad</span>
              <p className="text-xs text-gray-500">Notificaciones sobre actividad sospechosa</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.security_alerts}
              onChange={(e) => onUpdatePreferences({
                ...preferences,
                security_alerts: e.target.checked
              })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">Notificaciones de Facturación</span>
              <p className="text-xs text-gray-500">Recordatorios de pago y facturas</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.billing_notifications}
              onChange={(e) => onUpdatePreferences({
                ...preferences,
                billing_notifications: e.target.checked
              })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Frecuencia de Emails</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="email_frequency"
                  checked={preferences.email_frequency === 'immediate'}
                  onChange={() => onUpdatePreferences({
                    ...preferences,
                    email_frequency: 'immediate'
                  })}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Inmediato</span>
                  <p className="text-xs text-gray-500">Recibe emails al instante</p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="email_frequency"
                  checked={preferences.email_frequency === 'daily'}
                  onChange={() => onUpdatePreferences({
                    ...preferences,
                    email_frequency: 'daily'
                  })}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Diario</span>
                  <p className="text-xs text-gray-500">Resumen diario de notificaciones</p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="email_frequency"
                  checked={preferences.email_frequency === 'weekly'}
                  onChange={() => onUpdatePreferences({
                    ...preferences,
                    email_frequency: 'weekly'
                  })}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Semanal</span>
                  <p className="text-xs text-gray-500">Resumen semanal de notificaciones</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSavePreferences}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{loading ? 'Guardando...' : 'Guardar Preferencias'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
