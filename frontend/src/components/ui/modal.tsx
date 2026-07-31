// lapa-casa-hostel/frontend/src/components/ui/modal.tsx

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
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !disableEscapeKey && open) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
