// lapa-casa-hostel/frontend/src/components/payment/payment-confirmation-page.tsx

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { bookingAPI, handleAPIError } from '@/lib/api';
import { PaymentCountdown } from './payment-countdown';
import { PaymentProcessor } from './payment-processor';
import { Alert } from '../ui/alert';
import { LoadingSpinner } from '../ui/loading-spinner';

/**
 * PaymentConfirmationPage Component
 *
 * Página real de /payment/[id]: trae la reserva por GET /bookings/:id,
 * muestra el resumen + la cuenta regresiva real hasta pending_expires_at
 * (5 min, ver backend/src/services/booking-service.ts), y una vez
 * elegido el método de pago delega en PaymentProcessor.
 *
 * @component
 */
interface PaymentConfirmationPageProps {
  bookingId: string;
  locale: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

interface BookingSummary {
  status: string;
  confirmationNumber: string;
  pendingExpiresAt: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  total: number;
  deposit: number;
  remaining: number;
  bedsCount: number;
  depositPaid: boolean;
  fullyPaid: boolean;
}

const BCP47: Record<string, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE' };

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(BCP47[locale] ?? 'pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

export const PaymentConfirmationPage: React.FC<PaymentConfirmationPageProps> = ({ bookingId, locale }) => {
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [paidJustNow, setPaidJustNow] = useState(false);

  const loadBooking = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await bookingAPI.getById(bookingId);
      const data = response.data;
      setBooking({
        status: data.booking.status,
        confirmationNumber: data.booking.confirmationNumber,
        pendingExpiresAt: data.booking.pendingExpiresAt,
        checkIn: data.dates.checkIn,
        checkOut: data.dates.checkOut,
        nights: data.dates.nights,
        guestName: data.guest.fullName,
        total: data.pricing.total,
        deposit: data.pricing.deposit,
        remaining: data.pricing.remaining,
        bedsCount: data.pricing.bedsCount,
        depositPaid: data.payment.depositPaid,
        fullyPaid: data.payment.fullyPaid
      });
    } catch (err) {
      setError(handleAPIError(err));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Alert variant="danger">{error || T('notFound', locale)}</Alert>
      </div>
    );
  }

  const depositDone = booking.depositPaid || paidJustNow;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{T('title', locale)}</h1>
            <p className="text-gray-600 mt-1">{T('confirmationNumber', locale)}: <span className="font-mono font-semibold">{booking.confirmationNumber}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">{T('checkIn', locale)}</p>
            <p className="font-medium text-gray-900">{formatDate(booking.checkIn, locale)}</p>
          </div>
          <div>
            <p className="text-gray-500">{T('checkOut', locale)}</p>
            <p className="font-medium text-gray-900">{formatDate(booking.checkOut, locale)}</p>
          </div>
          <div>
            <p className="text-gray-500">{T('guest', locale)}</p>
            <p className="font-medium text-gray-900">{booking.guestName}</p>
          </div>
          <div>
            <p className="text-gray-500">{T('beds', locale)}</p>
            <p className="font-medium text-gray-900">{booking.bedsCount}</p>
          </div>
        </div>
      </div>

      {depositDone ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="font-bold text-green-900">{T('depositSuccessTitle', locale)}</p>
          <p className="text-sm text-green-800 mt-2">{T('depositSuccessNote', locale)}</p>
        </div>
      ) : booking.status === 'cancelled' || isExpired ? (
        <Alert variant="danger">{T('cancelledNote', locale)}</Alert>
      ) : (
        <>
          {booking.pendingExpiresAt && (
            <PaymentCountdown
              expiresAt={booking.pendingExpiresAt}
              onExpire={() => setIsExpired(true)}
              locale={locale}
              className="mb-6"
            />
          )}

          <PaymentProcessor
            reservationId={bookingId}
            totalAmount={booking.total}
            depositAmount={booking.deposit}
            remainingAmount={booking.remaining}
            checkInDate={booking.checkIn}
            locale={locale}
            onSuccess={() => setPaidJustNow(true)}
          />
        </>
      )}
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Confirme sua Reserva',
      confirmationNumber: 'Número de confirmação',
      checkIn: 'Check-in', checkOut: 'Check-out', guest: 'Hóspede', beds: 'Camas',
      notFound: 'Não encontramos essa reserva.',
      depositSuccessTitle: 'Depósito recebido! Sua reserva está confirmada.',
      depositSuccessNote: 'Enviamos os detalhes por email. Vamos te lembrar de pagar o saldo restante 7 dias antes do check-in.',
      cancelledNote: 'Esta reserva não está mais disponível para pagamento.'
    },
    es: {
      title: 'Confirmá tu Reserva',
      confirmationNumber: 'Número de confirmación',
      checkIn: 'Check-in', checkOut: 'Check-out', guest: 'Huésped', beds: 'Camas',
      notFound: 'No encontramos esa reserva.',
      depositSuccessTitle: '¡Depósito recibido! Tu reserva está confirmada.',
      depositSuccessNote: 'Te enviamos los detalles por email. Te vamos a recordar que pagues el saldo restante 7 días antes del check-in.',
      cancelledNote: 'Esta reserva ya no está disponible para pagar.'
    },
    en: {
      title: 'Confirm Your Booking',
      confirmationNumber: 'Confirmation number',
      checkIn: 'Check-in', checkOut: 'Check-out', guest: 'Guest', beds: 'Beds',
      notFound: 'We couldn’t find that booking.',
      depositSuccessTitle: 'Deposit received! Your booking is confirmed.',
      depositSuccessNote: 'We sent the details by email. We\'ll remind you to pay the remaining balance 7 days before check-in.',
      cancelledNote: 'This booking is no longer available for payment.'
    },
    fr: {
      title: 'Confirmez votre Réservation',
      confirmationNumber: 'Numéro de confirmation',
      checkIn: 'Arrivée', checkOut: 'Départ', guest: 'Client', beds: 'Lits',
      notFound: 'Nous n’avons pas trouvé cette réservation.',
      depositSuccessTitle: 'Acompte reçu ! Votre réservation est confirmée.',
      depositSuccessNote: 'Nous avons envoyé les détails par e-mail. Nous vous rappellerons de payer le solde 7 jours avant l’arrivée.',
      cancelledNote: 'Cette réservation n’est plus disponible pour le paiement.'
    },
    de: {
      title: 'Bestätigen Sie Ihre Buchung',
      confirmationNumber: 'Bestätigungsnummer',
      checkIn: 'Check-in', checkOut: 'Check-out', guest: 'Gast', beds: 'Betten',
      notFound: 'Wir konnten diese Buchung nicht finden.',
      depositSuccessTitle: 'Anzahlung erhalten! Ihre Buchung ist bestätigt.',
      depositSuccessNote: 'Wir haben Ihnen die Details per E-Mail gesendet. Wir erinnern Sie daran, den Restbetrag 7 Tage vor Check-in zu zahlen.',
      cancelledNote: 'Diese Buchung ist nicht mehr für die Zahlung verfügbar.'
    }
  };
  return t[locale]?.[key] || key;
}
