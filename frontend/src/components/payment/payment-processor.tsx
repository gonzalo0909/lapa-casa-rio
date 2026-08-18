// components/payment/payment-processor.tsx
// ENCHUFE TEMPORAL para el preview. Simula la pantalla de pago (Stripe / PIX)
// con la misma API pública (props) que el componente real, para poder ver
// el paso 4 sin integrar pasarelas.

'use client';

import React from 'react';

interface PaymentProcessorProps {
  reservationId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  checkInDate: string;
  locale: string;
  onSuccess: () => void;
}

export const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  totalAmount,
  depositAmount,
  remainingAmount,
  onSuccess,
}) => {
  const box: React.CSSProperties = {
    border: '1.5px solid var(--border, #ccc)',
    borderRadius: 12,
    padding: '1.25rem',
    background: 'var(--bg-card, #fff)',
    color: 'var(--fg, #111)',
  };

  return (
    <div style={box}>
      <h3 style={{ fontFamily: 'Georgia, serif', marginBottom: '.75rem' }}>Pagamento (demo)</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', fontSize: '.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Total</span><span>R$ {totalAmount.toLocaleString('pt-BR')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Depósito ahora</span><span>R$ {depositAmount.toLocaleString('pt-BR')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Resto en el check-in</span><span>R$ {remainingAmount.toLocaleString('pt-BR')}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSuccess}
        style={{
          marginTop: '1rem', width: '100%', padding: '.8rem',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
          background: 'var(--accent, #C8870A)', color: '#fff',
        }}
      >
        Simular pago aprobado →
      </button>
    </div>
  );
};
