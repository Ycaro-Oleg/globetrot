import type { ReactNode } from 'react';
import { Button, Dialog, Heading, Modal as AriaModal, ModalOverlay } from 'react-aria-components';

export interface ModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  isDismissable?: boolean;
}

/** Controlled modal with a localized title and explicit close action. */
export function Modal({
  isOpen,
  onOpenChange,
  title,
  closeLabel,
  children,
  isDismissable = false,
}: ModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className="gt-modal-overlay"
    >
      <AriaModal className="gt-modal">
        <Dialog className="gt-modal__dialog">
          {({ close }) => (
            <>
              <header className="gt-modal__header">
                <Heading slot="title">{title}</Heading>
                <Button onPress={close} aria-label={closeLabel} className="gt-modal__close">
                  ×
                </Button>
              </header>
              {children}
            </>
          )}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
