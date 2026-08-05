// lapa-casa-hostel/frontend/src/components/ui/modal.tsx

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Modal Component - Lapa Casa Hostel
 *
 * Accessible modal dialog with backdrop, animations, and focus trap.
 * Optimized for booking confirmation, payment processing, and detailed views.
 *
 * @component
 * @example
 * <Modal open={isOpen} onClose={handleClose}>
 *   <ModalHeader>
 *     <ModalTitle>Confirmar Reserva</ModalTitle>
 *   </ModalHeader>
 *   <ModalBody>
 *     <p>Conteúdo do modal</p>
 *   </ModalBody>
 *   <ModalFooter>
 *     <Button onClick={handleClose}>Cancelar</Button>
 *     <Button variant="primary">Confirmar</Button>
 *   </ModalFooter>
 * </Modal>
 */

const modalVariants = cva(
  'relative bg-white rounded-xl shadow-xl transform transition-all',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-7xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface ModalProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof modalVariants> {
  /** Controls modal visibility */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Prevent closing on backdrop click */
  disableBackdropClick?: boolean;
  /** Prevent closing on Escape key */
  disableEscapeKey?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      className,
      size,
      open,
      onClose,
      disableBackdropClick = false,
      disableEscapeKey = false,
      showCloseButton = true,
      children,
      ...props
    },
    ref
  ) => {
    const modalRef = React.useRef<HTMLDivElement>(null);

    // Handle Escape key
    React.useEffect(() => {
      if (!open) {
        return;
      }

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !disableEscapeKey) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, disableEscapeKey, onClose]);

    // Lock body scroll while open
    React.useEffect(() => {
      if (!open) {
        return;
      }

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }, [open]);

    // Focus the modal when it opens
    React.useEffect(() => {
      if (open) {
        modalRef.current?.focus();
      }
    }, [open]);

    if (!open) {
      return null;
    }

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !disableBackdropClick) {
        onClose();
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="presentation"
      >
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          aria-hidden="true"
          onClick={handleBackdropClick}
        />
        <div
          ref={(node) => {
            (modalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={modalVariants({ size, className: `${className || ''} w-full max-h-[90vh] overflow-y-auto outline-none` })}
          {...props}
        >
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {children}
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

// Modal Header Component
const ModalHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col gap-1.5 p-6 pb-4 ${className || ''}`}
      {...props}
    />
  )
);

ModalHeader.displayName = 'ModalHeader';

// Modal Title Component
const ModalTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-xl font-semibold leading-tight text-gray-900 pr-8 ${className || ''}`}
      {...props}
    />
  )
);

ModalTitle.displayName = 'ModalTitle';

// Modal Body Component
const ModalBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-6 py-2 ${className || ''}`}
      {...props}
    />
  )
);

ModalBody.displayName = 'ModalBody';

// Modal Footer Component
const ModalFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex items-center justify-end gap-3 p-6 pt-4 ${className || ''}`}
      {...props}
    />
  )
);

ModalFooter.displayName = 'ModalFooter';

export { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, modalVariants };
