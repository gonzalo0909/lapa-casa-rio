'use client';

// frontend/src/components/payment/mp-card-payment.tsx
//
// Formulario de tarjeta brasileña via Mercado Pago.
// Carga el SDK de MP (sdk.mercadopago.com/js/v2) y usa Core Methods
// para tokenizar la tarjeta en el cliente (PCI-compliant).
// El token resultante se envía a POST /payments/deposit-mp-card.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, handleAPIError } from '@/lib/api';
import { LoadingSpinner } from '../ui/loading-spinner';
import { type PaymentLocale, createPaymentT } from './payment-i18n';

// ── Tipos del SDK de MP ──────────────────────────────────────────────────────

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: object) => MercadoPagoInstance;
  }
}

interface MercadoPagoInstance {
  createCardToken(data: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ id: string; status?: string }>;

  getPaymentMethods(data: { bin: string }): Promise<{
    results: Array<{ id: string; name: string; issuer?: { id: string } }>;
  }>;

  getIssuers(data: { paymentMethodId: string; bin: string }): Promise<
    Array<{ id: string; name: string }>
  >;

  getInstallments(data: {
    amount: string;
    locale: string;
    paymentTypeId: string;
    bin: string;
  }): Promise<Array<{
    payment_method_id: string;
    payer_costs: Array<{ installments: number; recommended_message: string }>;
  }>>;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface MpCardPaymentProps {
  reservationId: string;
  depositAmount: number;
  surchargePercent: number;
  locale: PaymentLocale;
  onSuccess: (data: { paymentId: string; amount: number }) => void;
  onError: (err: Error) => void;
  /** Número de tarjeta pre-detectado por AutoCardPayment (sin espacios).
   *  Si se pasa, el campo se inicializa con este valor y se lanza la
   *  detección de BIN automáticamente al montar el SDK. */
  initialCardNumber?: string;
  /** Callback opcional: se llama con los primeros 6 dígitos (BIN) cada vez
   *  que cambia el número de tarjeta. AutoCardPayment lo usa para detectar
   *  en segundo plano si la tarjeta es internacional. */
  onBinChange?: (bin: string) => void;
  /** Callback opcional: se llama cuando el SDK de MP falla al cargar o
   *  inicializarse. AutoCardPayment lo usa para cambiar automáticamente al
   *  formulario de Stripe en lugar de mostrar un error al usuario. */
  onSdkError?: () => void;
  /** Endpoint alternativo para el POST de tarjeta MP. Por defecto usa el
   *  del hostel; pasar '/payments/apartments/deposit-mp-card' para apartamentos. */
  mpCardEndpoint?: string;
}

// ── i18n ─────────────────────────────────────────────────────────────────────

const T = createPaymentT({
  pt: {
    name:          'Nome do Titular',
    namePh:        'Como está no cartão',
    number:        'Número do Cartão',
    numberPh:      '0000 0000 0000 0000',
    expiry:        'Validade',
    expiryPh:      'MM/AAAA',
    cvv:           'CVV',
    cvvPh:         '123',
    cpf:           'CPF do Titular',
    cpfPh:         '000.000.000-00',
    installments:  'Parcelas',
    pay:           'Pagar',
    processing:    'Processando…',
    secure:        'Dados criptografados pelo Mercado Pago · PCI-DSS',
    sdkLoading:    'Carregando formulário de cartão…',
    errSdk:        'Erro ao carregar o formulário. Recarregue a página.',
    errRequired:   'Preencha todos os campos obrigatórios.',
    errCpf:        'CPF inválido.',
    errExpiry:     'Data de validade inválida. Use MM/AAAA.',
    errToken:      'Erro ao tokenizar cartão. Verifique os dados.',
    errPayment:    'Pagamento recusado. Verifique os dados ou tente outro cartão.',
    surcharge:     '+ {pct}% taxa para cartão',
    total:         'Total cobrado',
  },
  es: {
    name:          'Nombre del Titular',
    namePh:        'Como figura en la tarjeta',
    number:        'Número de Tarjeta',
    numberPh:      '0000 0000 0000 0000',
    expiry:        'Vencimiento',
    expiryPh:      'MM/AAAA',
    cvv:           'CVV',
    cvvPh:         '123',
    cpf:           'CPF del Titular',
    cpfPh:         '000.000.000-00',
    installments:  'Cuotas',
    pay:           'Pagar',
    processing:    'Procesando…',
    secure:        'Datos cifrados por Mercado Pago · PCI-DSS',
    sdkLoading:    'Cargando formulario de tarjeta…',
    errSdk:        'Error al cargar el formulario. Recargá la página.',
    errRequired:   'Completá todos los campos obligatorios.',
    errCpf:        'CPF inválido.',
    errExpiry:     'Fecha de vencimiento inválida. Usá MM/AAAA.',
    errToken:      'Error al procesar la tarjeta. Verificá los datos.',
    errPayment:    'Pago rechazado. Verificá los datos o usá otra tarjeta.',
    surcharge:     '+ {pct}% recargo por tarjeta',
    total:         'Total cobrado',
  },
  en: {
    name:          'Cardholder Name',
    namePh:        'As it appears on card',
    number:        'Card Number',
    numberPh:      '0000 0000 0000 0000',
    expiry:        'Expiry',
    expiryPh:      'MM/YYYY',
    cvv:           'CVV',
    cvvPh:         '123',
    cpf:           'Holder CPF',
    cpfPh:         '000.000.000-00',
    installments:  'Installments',
    pay:           'Pay',
    processing:    'Processing…',
    secure:        'Encrypted by Mercado Pago · PCI-DSS',
    sdkLoading:    'Loading card form…',
    errSdk:        'Error loading card form. Reload the page.',
    errRequired:   'Please fill in all required fields.',
    errCpf:        'Invalid CPF.',
    errExpiry:     'Invalid expiry date. Use MM/YYYY.',
    errToken:      'Error tokenizing card. Please check the details.',
    errPayment:    'Payment declined. Try another card or use PIX.',
    surcharge:     '+ {pct}% card surcharge',
    total:         'Total charged',
  },
  fr: {
    name:          'Nom du Titulaire',
    namePh:        'Comme sur la carte',
    number:        'Numéro de Carte',
    numberPh:      '0000 0000 0000 0000',
    expiry:        'Expiration',
    expiryPh:      'MM/AAAA',
    cvv:           'CVV',
    cvvPh:         '123',
    cpf:           'CPF du Titulaire',
    cpfPh:         '000.000.000-00',
    installments:  'Versements',
    pay:           'Payer',
    processing:    'Traitement…',
    secure:        'Chiffré par Mercado Pago · PCI-DSS',
    sdkLoading:    'Chargement du formulaire…',
    errSdk:        'Erreur de chargement. Rechargez la page.',
    errRequired:   'Remplissez tous les champs obligatoires.',
    errCpf:        'CPF invalide.',
    errExpiry:     "Date d'expiration invalide. Utilisez MM/AAAA.",
    errToken:      'Erreur de tokenisation. Vérifiez les données.',
    errPayment:    'Paiement refusé. Essayez une autre carte ou PIX.',
    surcharge:     '+ {pct}% de frais carte',
    total:         'Total débité',
  },
  de: {
    name:          'Name des Karteninhabers',
    namePh:        'Wie auf der Karte',
    number:        'Kartennummer',
    numberPh:      '0000 0000 0000 0000',
    expiry:        'Ablaufdatum',
    expiryPh:      'MM/JJJJ',
    cvv:           'CVV',
    cvvPh:         '123',
    cpf:           'CPF des Inhabers',
    cpfPh:         '000.000.000-00',
    installments:  'Raten',
    pay:           'Zahlen',
    processing:    'Verarbeitung…',
    secure:        'Verschlüsselt von Mercado Pago · PCI-DSS',
    sdkLoading:    'Formular wird geladen…',
    errSdk:        'Fehler beim Laden. Seite neu laden.',
    errRequired:   'Bitte alle Pflichtfelder ausfüllen.',
    errCpf:        'Ungültige CPF.',
    errExpiry:     'Ungültiges Ablaufdatum. Format: MM/JJJJ.',
    errToken:      'Fehler beim Tokenisieren. Daten prüfen.',
    errPayment:    'Zahlung abgelehnt. Andere Karte oder PIX verwenden.',
    surcharge:     '+ {pct}% Kartengebühr',
    total:         'Gesamt belastet',
  },
  it: {
    name:          'Nome del Titolare',
    namePh:        'Come riportato sulla carta',
    number:        'Numero della Carta',
    numberPh:      '0000 0000 0000 0000',
    expiry:        'Scadenza',
    expiryPh:      'MM/AAAA',
    cvv:           'CVV',
    cvvPh:         '123',
    cpf:           'CPF del Titolare',
    cpfPh:         '000.000.000-00',
    installments:  'Rate',
    pay:           'Paga',
    processing:    'Elaborazione…',
    secure:        'Dati cifrati da Mercado Pago · PCI-DSS',
    sdkLoading:    'Caricamento modulo…',
    errSdk:        'Errore di caricamento. Ricarica la pagina.',
    errRequired:   'Compila tutti i campi obbligatori.',
    errCpf:        'CPF non valido.',
    errExpiry:     'Data di scadenza non valida. Usa MM/AAAA.',
    errToken:      'Errore di tokenizzazione. Verifica i dati.',
    errPayment:    "Pagamento rifiutato. Prova un'altra carta o usa PIX.",
    surcharge:     '+ {pct}% commissione carta',
    total:         'Totale addebitato',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 6);
  if (d.length > 2) { return d.slice(0, 2) + '/' + d.slice(2); }
  return d;
}
function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
           .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
           .replace(/(\d{3})(\d{1,3})/, '$1.$2');
}
function validateCpf(cpf: string) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) { return false; }
  let s = 0;
  // noUncheckedIndexedAccess: c[i] es string|undefined — ?? '0' es inerte
  // porque c.length === 11 garantiza que los índices 0-10 existen.
  for (let i = 0; i < 9; i++) { s += +(c[i] ?? '0') * (10 - i); }
  let d = 11 - (s % 11); if (d >= 10) { d = 0; }
  if (d !== +(c[9] ?? '0')) { return false; }
  s = 0;
  for (let i = 0; i < 10; i++) { s += +(c[i] ?? '0') * (11 - i); }
  d = 11 - (s % 11); if (d >= 10) { d = 0; }
  return d === +(c[10] ?? '0');
}

const fmtBRL = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Estilos inline (usa vars del apartment-engine) ───────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '.65rem .9rem', borderRadius: 8,
  border: '1.5px solid var(--border, #ddd)',
  background: 'var(--bg-card, #fff)', color: 'var(--fg, #111)',
  fontSize: '.95rem', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: '.85rem', fontWeight: 600, marginBottom: '.35rem', display: 'block' };
const fieldBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: '.85rem' };
const errStyle: React.CSSProperties = {
  padding: '.75rem 1rem', borderRadius: 8, background: '#FEE2E2',
  border: '1.5px solid #FCA5A5', color: '#991B1B', fontSize: '.9rem', marginBottom: '1rem',
};
const secureRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '.4rem',
  fontSize: '.8rem', color: 'var(--fg-muted, #666)', justifyContent: 'center', marginTop: '.75rem',
};

// ── Componente ────────────────────────────────────────────────────────────────

export function MpCardPayment({
  reservationId, depositAmount, surchargePercent, locale, onSuccess, onError,
  initialCardNumber, onBinChange: onBinChangeExternal, onSdkError, mpCardEndpoint,
}: MpCardPaymentProps) {

  const mpRef = useRef<MercadoPagoInstance | null>(null);
  const [sdkReady, setSdkReady]           = useState(false);
  const [sdkError, setSdkError]           = useState(false);
  const [surcharge, setSurcharge]         = useState(surchargePercent);

  const [name,      setName]        = useState('');
  // Si viene pre-detectado desde AutoCardPayment, formateamos el número inicial
  const [number,    setNumber]      = useState(
    initialCardNumber ? initialCardNumber.replace(/(.{4})/g, '$1 ').trim() : ''
  );
  const [expiry,    setExpiry]      = useState('');
  const [cvv,       setCvv]         = useState('');
  const [cpf,       setCpf]         = useState('');
  const [installments, setInstallments] = useState(1);
  const [installmentOpts, setInstallmentOpts] = useState<Array<{ n: number; label: string }>>([]);

  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [issuerId,        setIssuerId]        = useState('');

  const [error,       setError]     = useState<string | null>(null);
  const [processing,  setProcessing] = useState(false);

  const chargedAmount = Math.round(depositAmount * (1 + surcharge / 100) * 100) / 100;

  // ── Cargar surcharge del backend ─────────────────────────────────────────

  useEffect(() => {
    if (surchargePercent > 0) { return; } // ya viene del padre
    api.get<{ success: boolean; data: { cardSurchargePercent: number } }>('/payments/surcharge')
      .then(r => setSurcharge(r.data.cardSurchargePercent))
      .catch(() => {}); // si falla, usamos 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar SDK de MP ────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') { return; }
    if (window.MercadoPago) { initMp(); return; }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload  = initMp;
    script.onerror = () => { if (onSdkError) { onSdkError(); } else { setSdkError(true); } };
    document.head.appendChild(script);

    function initMp() {
      const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
      if (!key || !window.MercadoPago) {
        if (onSdkError) { onSdkError(); } else { setSdkError(true); }
        return;
      }
      try {
        mpRef.current = new window.MercadoPago(key, { locale: 'pt-BR' });
        setSdkReady(true);
      } catch {
        if (onSdkError) { onSdkError(); } else { setSdkError(true); }
      }
    }
  }, []);

  // ── Detectar método de pago e cuotas por BIN ─────────────────────────────

  const onBinChange = useCallback(async (bin: string) => {
    const mp = mpRef.current;
    if (!mp || bin.length < 6) { setInstallmentOpts([]); return; }
    try {
      const methods = await mp.getPaymentMethods({ bin });
      const method  = methods.results[0];
      if (!method) { return; }

      setPaymentMethodId(method.id);

      const issuers = await mp.getIssuers({ paymentMethodId: method.id, bin });
      setIssuerId(issuers[0]?.id ?? '');

      const instData = await mp.getInstallments({
        amount: String(chargedAmount),
        locale: 'pt-BR',
        paymentTypeId: 'credit_card',
        bin,
      });
      const opts = instData[0]?.payer_costs?.map(c => ({ n: c.installments, label: c.recommended_message })) ?? [];
      setInstallmentOpts(opts);
      if (opts.length > 0 && !opts.find(o => o.n === installments)) {
        setInstallments(opts[0]!.n);
      }
    } catch {
      // silent — las cuotas son opcionales
    }
  }, [chargedAmount, installments]);

  // Si viene initialCardNumber desde AutoCardPayment, disparar BIN detection
  // cuando el SDK esté listo (después de que onBinChange ya está definido).
  useEffect(() => {
    if (sdkReady && initialCardNumber && initialCardNumber.length >= 6) {
      onBinChange(initialCardNumber.slice(0, 6));
    }
  }, [sdkReady, initialCardNumber, onBinChange]);

  const handleNumberChange = (v: string) => {
    const fmt = formatCardNumber(v);
    setNumber(fmt);
    const raw = fmt.replace(/\s/g, '');
    if (raw.length >= 6) {
      const bin = raw.slice(0, 6);
      onBinChange(bin);
      onBinChangeExternal?.(bin);
    } else {
      setInstallmentOpts([]);
      onBinChangeExternal?.('');
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !number.trim() || !expiry.trim() || !cvv.trim() || !cpf.trim()) {
      setError(T('errRequired', locale));
      return;
    }
    if (!validateCpf(cpf)) {
      setError(T('errCpf', locale));
      return;
    }
    const expiryParts = expiry.replace(/\s/g, '').split('/');
    if (expiryParts.length !== 2 || expiryParts[0]!.length !== 2 || expiryParts[1]!.length < 4) {
      setError(T('errExpiry', locale));
      return;
    }

    const mp = mpRef.current;
    if (!mp) { setError(T('errSdk', locale)); return; }

    setProcessing(true);
    try {
      // 1. Tokenizar la tarjeta en el frontend (datos nunca salen sin cifrar)
      const tokenResult = await mp.createCardToken({
        cardNumber:          number.replace(/\s/g, ''),
        cardholderName:      name.trim(),
        cardExpirationMonth: expiryParts[0]!,
        cardExpirationYear:  expiryParts[1]!,
        securityCode:        cvv,
        identificationType:  'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      });

      if (!tokenResult?.id) {
        setError(T('errToken', locale));
        return;
      }

      // 2. Enviar token al backend
      const endpoint = mpCardEndpoint ?? '/payments/deposit-mp-card';
      const res = await api.post<{
        success: boolean;
        data: { payment: { paymentId: string; amount: number; status: string } };
        message: string;
      }>(endpoint, {
        reservationId,
        token:           tokenResult.id,
        paymentMethodId: paymentMethodId || 'credit_card',
        issuerId:        issuerId || '',
        installments,
        cpf:             cpf.replace(/\D/g, ''),
      });

      const pmt = res.data.payment;

      if (pmt.status === 'approved') {
        onSuccess({ paymentId: pmt.paymentId, amount: pmt.amount });
      } else if (pmt.status === 'in_process' || pmt.status === 'pending') {
        // Pago en análise — tratamos como éxito parcial (el webhook confirmará)
        onSuccess({ paymentId: pmt.paymentId, amount: pmt.amount });
      } else {
        setError(T('errPayment', locale));
        onError(new Error('mp_rejected'));
      }
    } catch (err: any) {
      const msg = handleAPIError(err, locale) || T('errPayment', locale);
      setError(msg);
      onError(err instanceof Error ? err : new Error(msg));
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Si hay onSdkError, el padre maneja el error (p.ej. cambiando a Stripe);
  // no renderizamos nada para evitar un flash del mensaje de error.
  if (sdkError && !onSdkError) {
    return <div style={errStyle}>{T('errSdk', locale)}</div>;
  }
  if (sdkError) {
    return null;
  }
  if (!sdkReady) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--fg-muted,#666)', fontSize: '.9rem' }}>
        <LoadingSpinner size="sm" />
        <span style={{ marginLeft: '.5rem' }}>{T('sdkLoading', locale)}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Resumen de cargo */}
      {surcharge > 0 && (
        <div style={{
          marginBottom: '1rem', padding: '.65rem 1rem', borderRadius: 8,
          background: 'var(--warn-bg,#FBE9DB)', border: '1px solid var(--warn-border,#E29B72)',
          color: 'var(--warn-fg,#9A4A28)', fontSize: '.88rem',
        }}>
          {T('surcharge', locale).replace('{pct}', String(surcharge))}
          {' — '}
          <strong>{T('total', locale)}: {fmtBRL(chargedAmount)}</strong>
        </div>
      )}

      {error && <div style={errStyle} role="alert">{error}</div>}

      {/* Nombre */}
      <div style={fieldBox}>
        <label style={lbl}>{T('name', locale)}</label>
        <input style={inp} type="text" value={name} placeholder={T('namePh', locale)}
          onChange={e => setName(e.target.value)} disabled={processing} autoComplete="cc-name" />
      </div>

      {/* Número */}
      <div style={fieldBox}>
        <label style={lbl}>{T('number', locale)}</label>
        <input style={inp} type="text" inputMode="numeric" value={number}
          placeholder={T('numberPh', locale)} maxLength={19}
          onChange={e => handleNumberChange(e.target.value)}
          disabled={processing} autoComplete="cc-number" />
      </div>

      {/* Validade + CVV */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '.85rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={lbl}>{T('expiry', locale)}</label>
          <input style={inp} type="text" inputMode="numeric" value={expiry}
            placeholder={T('expiryPh', locale)} maxLength={7}
            onChange={e => setExpiry(formatExpiry(e.target.value))}
            disabled={processing} autoComplete="cc-exp" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={lbl}>{T('cvv', locale)}</label>
          <input style={inp} type="text" inputMode="numeric" value={cvv}
            placeholder={T('cvvPh', locale)} maxLength={4}
            onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={processing} autoComplete="cc-csc" />
        </div>
      </div>

      {/* CPF */}
      <div style={fieldBox}>
        <label style={lbl}>{T('cpf', locale)}</label>
        <input style={inp} type="text" inputMode="numeric" value={cpf}
          placeholder={T('cpfPh', locale)} maxLength={14}
          onChange={e => setCpf(formatCpf(e.target.value))}
          disabled={processing} autoComplete="off" />
      </div>

      {/* Cuotas */}
      {installmentOpts.length > 1 && (
        <div style={fieldBox}>
          <label style={lbl}>{T('installments', locale)}</label>
          <select style={inp} value={installments}
            onChange={e => setInstallments(Number(e.target.value))}
            disabled={processing}>
            {installmentOpts.map(o => (
              <option key={o.n} value={o.n}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Botón */}
      <button type="submit" disabled={processing} style={{
        width: '100%', padding: '.85rem', borderRadius: 10, border: 'none',
        background: processing ? 'var(--border,#ddd)' : 'var(--primary,#2C4A8C)',
        color: processing ? 'var(--fg-muted,#888)' : '#fff',
        fontWeight: 700, fontSize: '1rem', cursor: processing ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem',
      }}>
        {processing
          ? <><LoadingSpinner size="sm" /> {T('processing', locale)}</>
          : `${T('pay', locale)} ${fmtBRL(chargedAmount)}`
        }
      </button>

      {/* Seguridad */}
      <div style={secureRow}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>{T('secure', locale)}</span>
      </div>
    </form>
  );
}
