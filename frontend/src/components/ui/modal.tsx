// components/ui/modal.tsx
// ENCHUFE TEMPORAL para el preview. Modal minimalista con la misma API pública
// (Modal / ModalBody) que usa apartment-engine.tsx.

'use client';

import React from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  disableBackdropClick?: boolean;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, disableBackdropClick, children }) => {
  if (!open) { return null; }
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!disableBackdropClick) { onClose(); } }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.5)', padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, #fff)', color: 'var(--fg, #111)',
          borderRadius: 16, maxWidth: 420, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const ModalBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: '1.5rem' }}>{children}</div>
);
