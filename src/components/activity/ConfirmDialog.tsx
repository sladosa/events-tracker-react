/**
 * ConfirmDialog Component
 * 
 * Reusable confirmation modal for:
 * - Cancel confirmation
 * - Discard draft confirmation
 * - Delete event confirmation
 * - Resume session dialog
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export type DialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
  /** If true, shows only confirm button (for info dialogs) */
  hideCancel?: boolean;
  /** Custom icon to show instead of default */
  icon?: React.ReactNode;
}

const variantStyles: Record<DialogVariant, {
  icon: string;
  iconBg: string;
  confirmButton: string;
}> = {
  danger: {
    icon: '⚠️',
    iconBg: 'bg-rose-100',
    confirmButton: 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500',
  },
  warning: {
    icon: '⚡',
    iconBg: 'bg-amber-100',
    confirmButton: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500',
  },
  info: {
    icon: '📋',
    iconBg: 'bg-blue-100',
    confirmButton: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
  hideCancel = false,
  icon,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  
  // Focus management
  useEffect(() => {
    if (open) {
      // Focus confirm button when dialog opens
      confirmButtonRef.current?.focus();
      
      // Trap focus inside dialog
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
        
        if (e.key === 'Tab' && dialogRef.current) {
          const focusableElements = dialogRef.current.querySelectorAll(
            'button:not([disabled])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
          
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onCancel]);
  
  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);
  
  if (!open) return null;
  
  const styles = variantStyles[variant];
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div 
        ref={dialogRef}
        className={cn(
          "relative bg-white rounded-xl shadow-xl max-w-md w-full",
          "transform transition-all duration-200",
          "animate-in fade-in zoom-in-95"
        )}
      >
        <div className="p-6">
          {/* Icon */}
          <div className={cn(
            "mx-auto flex items-center justify-center w-12 h-12 rounded-full mb-4",
            styles.iconBg
          )}>
            <span className="text-2xl" role="img" aria-hidden="true">
              {icon ?? styles.icon}
            </span>
          </div>
          
          {/* Title */}
          <h2 
            id="dialog-title"
            className="text-lg font-semibold text-gray-900 text-center mb-2"
          >
            {title}
          </h2>
          
          {/* Message */}
          <p className="text-gray-600 text-center whitespace-pre-line">
            {message}
          </p>
        </div>
        
        {/* Actions */}
        <div className={cn(
          "flex gap-3 px-6 pb-6",
          hideCancel ? "justify-center" : "justify-end"
        )}>
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                "px-4 py-2 rounded-lg font-medium",
                "bg-gray-100 text-gray-700",
                "hover:bg-gray-200",
                "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
                "transition-colors"
              )}
            >
              {cancelLabel}
            </button>
          )}
          
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 rounded-lg font-medium text-white",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "transition-colors",
              styles.confirmButton
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Preset Dialog Components
// ============================================

interface CancelDialogProps {
  open: boolean;
  eventCount: number;
  photoCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelDialog({
  open,
  eventCount,
  photoCount,
  onConfirm,
  onCancel,
}: CancelDialogProps) {
  let message: string;
  if (eventCount > 0) {
    message = `You have ${eventCount} unsaved event${eventCount !== 1 ? 's' : ''}`;
    if (photoCount > 0) {
      message += ` and ${photoCount} photo${photoCount !== 1 ? 's' : ''}`;
    }
    message += '. Discard and exit?';
  } else if (photoCount > 0) {
    message = `You have ${photoCount} unsaved photo${photoCount !== 1 ? 's' : ''}. Discard and exit?`;
  } else {
    message = 'You have unsaved changes. Discard and exit?';
  }
  
  return (
    <ConfirmDialog
      open={open}
      title="Discard Changes?"
      message={message}
      confirmLabel="Discard"
      cancelLabel="Keep Editing"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

interface ResumeDialogProps {
  open: boolean;
  age: string;
  categoryPath: string;
  eventCount: number;
  photoCount: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumeDialog({
  open,
  age,
  categoryPath,
  eventCount,
  photoCount,
  onResume,
  onDiscard,
}: ResumeDialogProps) {
  let message = `You have an unfinished session from ${age}.\n\n`;
  message += `Category: ${categoryPath}\n`;
  message += `Events: ${eventCount}`;
  if (photoCount > 0) {
    message += `\nPhotos: ${photoCount}`;
  }
  
  return (
    <ConfirmDialog
      open={open}
      title="Resume Previous Session?"
      message={message}
      confirmLabel="Resume Session"
      cancelLabel="Discard"
      variant="info"
      onConfirm={onResume}
      onCancel={onDiscard}
      icon="📋"
    />
  );
}

interface DiscardDraftDialogProps {
  open: boolean;
  eventCount: number;
  photoCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardDraftDialog({
  open,
  eventCount,
  photoCount,
  onConfirm,
  onCancel,
}: DiscardDraftDialogProps) {
  let message = 'This will permanently delete:\n';
  message += `• ${eventCount} unsaved event${eventCount !== 1 ? 's' : ''}`;
  if (photoCount > 0) {
    message += `\n• ${photoCount} photo${photoCount !== 1 ? 's' : ''}`;
  }
  message += '\n\nThis action cannot be undone.';
  
  return (
    <ConfirmDialog
      open={open}
      title="Discard Session?"
      message={message}
      confirmLabel="Yes, Discard"
      cancelLabel="Cancel"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

interface DeleteEventDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteEventDialog({
  open,
  onConfirm,
  onCancel,
}: DeleteEventDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Delete Event?"
      message="This event will be permanently deleted when you save."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

interface SuccessDialogProps {
  open: boolean;
  eventCount: number;
  onEdit?: () => void;
  onGoHome: () => void;
}

export function SuccessDialog({
  open,
  eventCount,
  onEdit,
  onGoHome,
}: SuccessDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Activity Saved!"
      message={`Successfully saved ${eventCount} event${eventCount !== 1 ? 's' : ''}.`}
      confirmLabel={onEdit ? "Edit" : "Go to Home"}
      cancelLabel="Go to Home"
      variant="info"
      onConfirm={onEdit ?? onGoHome}
      onCancel={onGoHome}
      hideCancel={!onEdit}
      icon="✅"
    />
  );
}
