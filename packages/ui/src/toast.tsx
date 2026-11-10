'use client';

import type { ReactNode } from 'react';
import { Button } from 'react-aria-components';

type UndoAction = { onUndo: () => void; undoLabel: string } | { onUndo?: never; undoLabel?: never };

export type ToastProps = UndoAction & {
  message: ReactNode;
  dismissLabel: string;
  onDismiss: () => void;
};

/** Persistent notification; the host controls dismissal and optional undo. */
export function Toast({ message, dismissLabel, onDismiss, onUndo, undoLabel }: ToastProps) {
  return (
    <div className="gt-toast">
      <div role="status" aria-live="polite">
        {message}
      </div>
      <div className="gt-toast__actions">
        {onUndo && (
          <Button className="gt-toast__action" onPress={onUndo}>
            {undoLabel}
          </Button>
        )}
        <Button className="gt-toast__action" onPress={onDismiss}>
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
