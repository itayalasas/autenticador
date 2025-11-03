import { useState } from 'react';

interface NotificationState {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm?: () => void;
}

export function useNotification() {
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      onConfirm?: () => void;
      showCancel?: boolean;
    }
  ) => {
    setNotification({
      isOpen: true,
      type,
      title,
      message,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      onConfirm: options?.onConfirm,
      showCancel: options?.showCancel
    });
  };

  const showSuccess = (title: string, message: string, options?: { confirmText?: string; cancelText?: string; onConfirm?: () => void; showCancel?: boolean }) => {
    showNotification('success', title, message, options);
  };

  const showError = (title: string, message: string, options?: { confirmText?: string; cancelText?: string; onConfirm?: () => void; showCancel?: boolean }) => {
    showNotification('error', title, message, options);
  };

  const showWarning = (title: string, message: string, options?: { confirmText?: string; cancelText?: string; onConfirm?: () => void; showCancel?: boolean }) => {
    showNotification('warning', title, message, options);
  };

  const showInfo = (title: string, message: string, options?: { confirmText?: string; cancelText?: string; onConfirm?: () => void; showCancel?: boolean }) => {
    showNotification('info', title, message, options);
  };

  const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
    }
  ) => {
    setConfirmation({
      isOpen: true,
      title,
      message,
      confirmText: options?.confirmText || 'Confirmar',
      cancelText: options?.cancelText || 'Cancelar',
      type: options?.type || 'warning',
      loading: false,
      onConfirm
    });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  };

  const closeConfirmation = () => {
    setConfirmation(prev => ({ ...prev, isOpen: false, loading: false }));
  };

  const setConfirmationLoading = (loading: boolean) => {
    setConfirmation(prev => ({ ...prev, loading }));
  };

  return {
    notification,
    confirmation,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation,
    closeNotification,
    closeConfirmation,
    setConfirmationLoading
  };
}