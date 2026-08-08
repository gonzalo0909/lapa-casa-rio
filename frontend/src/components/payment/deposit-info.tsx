// lapa-casa-hostel/frontend/src/components/payment/deposit-info.tsx

'use client';

import React, { useMemo } from 'react';
import { Alert } from '../ui/alert';

interface DepositInfoProps {
  depositAmount: number;
  remainingAmount: number;
  checkInDate: string;
  currency: string;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

const BCP47: Record<string, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE' };

export function DepositInfo({
  depositAmount,
  remainingAmount,
  checkInDate,
  currency,
  locale = 'pt'
}: DepositInfoProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(BCP47[locale] ?? 'pt-BR', {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD'
    }).format(value);
  };

  const remainingPaymentDate = useMemo(() => {
    const checkIn = new Date(checkInDate);
    const paymentDate = new Date(checkIn);
    paymentDate.setDate(checkIn.getDate() - 7);

    return paymentDate.toLocaleDateString(BCP47[locale] ?? 'pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }, [checkInDate, locale]);

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">{T('title', locale)}</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <div>
                    <p className="font-medium">{T('step1', locale)}: {formatCurrency(depositAmount)}</p>
                    <p className="text-blue-700">{T('step1Note', locale)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <div>
                    <p className="font-medium">{T('step2', locale)} {remainingPaymentDate}: {formatCurrency(remainingAmount)}</p>
                    <p className="text-blue-700">{T('step2Note', locale)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Alert>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-green-100 rounded-full p-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-green-900 mb-2">{T('guaranteesTitle', locale)}</h4>
            <ul className="space-y-1 text-sm text-green-800">
              {['instant', 'flexible', 'fraud', 'encrypted'].map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  {T(k, locale)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          {T('faqTitle', locale)}
        </h4>
        <div className="space-y-3 text-sm">
          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 transition-colors">
              {T('faq1Q', locale)}
            </summary>
            <p className="mt-2 text-gray-600 pl-4">{T('faq1A', locale)}</p>
          </details>

          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 transition-colors">
              {T('faq2Q', locale)}
            </summary>
            <p className="mt-2 text-gray-600 pl-4">{T('faq2A', locale)}</p>
          </details>
        </div>
      </div>
    </div>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Pagamento em 2 Etapas',
      step1: 'Depósito agora', step1Note: 'Confirma sua reserva imediatamente',
      step2: 'Saldo em', step2Note: 'Cobrança automática 7 dias antes do check-in',
      guaranteesTitle: 'Garantias e Segurança',
      instant: 'Confirmação instantânea da reserva',
      flexible: 'Política de cancelamento flexível',
      fraud: 'Proteção contra fraudes',
      encrypted: 'Dados criptografados e seguros',
      faqTitle: 'Perguntas Frequentes',
      faq1Q: 'O que acontece se eu cancelar?',
      faq1A: 'Cancelamentos com mais de 7 dias de antecedência recebem reembolso total do depósito. Para cancelamentos mais próximos da data, consulte nossa política completa.',
      faq2Q: 'O que acontece se o pagamento do saldo falhar?',
      faq2A: 'Tentaremos processar novamente automaticamente algumas vezes. Se persistir, entraremos em contato para regularizar antes do check-in.'
    },
    es: {
      title: 'Pago en 2 Etapas',
      step1: 'Depósito ahora', step1Note: 'Confirma tu reserva de inmediato',
      step2: 'Saldo el', step2Note: 'Cobro automático 7 días antes del check-in',
      guaranteesTitle: 'Garantías y Seguridad',
      instant: 'Confirmación instantánea de la reserva',
      flexible: 'Política de cancelación flexible',
      fraud: 'Protección contra fraude',
      encrypted: 'Datos cifrados y seguros',
      faqTitle: 'Preguntas Frecuentes',
      faq1Q: '¿Qué pasa si cancelo?',
      faq1A: 'Las cancelaciones con más de 7 días de anticipación reciben reembolso total del depósito. Para cancelaciones más cercanas a la fecha, consultá nuestra política completa.',
      faq2Q: '¿Qué pasa si falla el pago del saldo?',
      faq2A: 'Vamos a reintentar el cobro automáticamente algunas veces. Si persiste, te vamos a contactar para regularizarlo antes del check-in.'
    },
    en: {
      title: '2-Step Payment',
      step1: 'Deposit now', step1Note: 'Confirms your booking immediately',
      step2: 'Balance on', step2Note: 'Automatic charge 7 days before check-in',
      guaranteesTitle: 'Guarantees & Security',
      instant: 'Instant booking confirmation',
      flexible: 'Flexible cancellation policy',
      fraud: 'Fraud protection',
      encrypted: 'Encrypted, secure data',
      faqTitle: 'Frequently Asked Questions',
      faq1Q: 'What happens if I cancel?',
      faq1A: 'Cancellations more than 7 days in advance get a full deposit refund. For cancellations closer to the date, check our full policy.',
      faq2Q: 'What if the balance payment fails?',
      faq2A: 'We\'ll automatically retry the charge a few times. If it keeps failing, we\'ll contact you to sort it out before check-in.'
    },
    fr: {
      title: 'Paiement en 2 Étapes',
      step1: 'Acompte maintenant', step1Note: 'Confirme votre réservation immédiatement',
      step2: 'Solde le', step2Note: 'Prélèvement automatique 7 jours avant l’arrivée',
      guaranteesTitle: 'Garanties et Sécurité',
      instant: 'Confirmation instantanée de la réservation',
      flexible: 'Politique d’annulation flexible',
      fraud: 'Protection contre la fraude',
      encrypted: 'Données chiffrées et sécurisées',
      faqTitle: 'Questions Fréquentes',
      faq1Q: 'Que se passe-t-il si j’annule ?',
      faq1A: 'Les annulations plus de 7 jours à l’avance sont intégralement remboursées. Pour les annulations plus proches de la date, consultez notre politique complète.',
      faq2Q: 'Que se passe-t-il si le paiement du solde échoue ?',
      faq2A: 'Nous réessaierons automatiquement le prélèvement quelques fois. Si le problème persiste, nous vous contacterons avant l’arrivée.'
    },
    de: {
      title: 'Zahlung in 2 Schritten',
      step1: 'Anzahlung jetzt', step1Note: 'Bestätigt Ihre Buchung sofort',
      step2: 'Restbetrag am', step2Note: 'Automatische Abbuchung 7 Tage vor Check-in',
      guaranteesTitle: 'Garantien & Sicherheit',
      instant: 'Sofortige Buchungsbestätigung',
      flexible: 'Flexible Stornierungsbedingungen',
      fraud: 'Betrugsschutz',
      encrypted: 'Verschlüsselte, sichere Daten',
      faqTitle: 'Häufige Fragen',
      faq1Q: 'Was passiert, wenn ich storniere?',
      faq1A: 'Stornierungen mehr als 7 Tage im Voraus erhalten die volle Anzahlung zurück. Für spätere Stornierungen siehe unsere vollständigen Bedingungen.',
      faq2Q: 'Was, wenn die Zahlung des Restbetrags fehlschlägt?',
      faq2A: 'Wir versuchen die Abbuchung automatisch einige Male erneut. Bleibt es erfolglos, kontaktieren wir Sie vor dem Check-in.'
    }
  };
  return t[locale]?.[key] || key;
}
