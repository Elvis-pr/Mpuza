import React from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
}

const icons: Record<ToastType, string> = {
  success: '✅',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onDismiss }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast ${type} show`}
      onClick={onDismiss}
    >
      <span>{icons[type]}</span>
      <span>{message}</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, font: 'inherit' }}
      >
        ✕
      </button>
    </div>
  );
};
