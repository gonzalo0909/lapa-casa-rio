// lapa-casa-hostel/frontend/src/components/payment/payment-confirmation-page.tsx

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { bookingAPI, handleAPIError } from '@/lib/api';
import { PaymentCountdown } from './payment-countdown';
import { PaymentProcessor } from './payment-processor';
import { Alert } from '../ui/alert';
import { LoadingSpinner } from '../ui/loading-spinner';

/**
 * PaymentConfirmationPage Component
 *
 * Página real de /payment/[id]: busca a reserva via GET /bookings/:id,
 * mostra o resumo + countdown até pending_expires_at (5 min),
 * e delega no PaymentProcessor após escolhido o método de pagamento.
 * Usa next-intl para i18n.
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

const BCP47: Record<string, string> = {
  pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE',
};

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(BCP47[locale] ?? 'pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export const PaymentConfirmationPage: React.FC<PaymentConfirmationPageProps> = ({
  bookingId,
  locale,
}) => {
  const t = useTranslations('paymentPage');
  const tb = useTranslations('booking');

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
        fullyPaid: data.payment.fullyPaid,
      });
    } catch (err) {
      setError(handleAPIError(err, locale));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, locale]);

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
        <Alert variant="danger">{error || t('notFound')}</Alert>
      </div>
    );
  }

  const depositDone = booking.depositPaid || paidJustNow;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Resumo da reserva */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('confirmationNumber')}:{' '}
              <span className="font-mono font-semibold text-foreground">
                {booking.confirmationNumber}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{tb('checkIn')}</p>
            <p className="font-medium text-foreground">{formatDate(booking.checkIn, locale)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{tb('checkOut')}</p>
            <p className="font-medium text-foreground">{formatDate(booking.checkOut, locale)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('guest')}</p>
            <p className="font-medium text-foreground">{booking.guestName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{tb('beds')}</p>
            <p className="font-medium text-foreground">{booking.bedsCount}</p>
          </div>
        </div>
      </div>

      {/* Estado do pagamento */}
      {depositDone ? (
        <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-6 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="font-bold text-green-900 dark:text-green-300">{t('depositSuccessTitle')}</p>
          <p className="text-sm text-green-800 dark:text-green-400 mt-2">{t('depositSuccessNote')}</p>
        </div>
      ) : booking.status === 'cancelled' || isExpired ? (
        <Alert variant="danger">{t('cancelledNote')}</Alert>
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
