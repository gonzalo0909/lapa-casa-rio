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

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/>
          </svg>
          {T('policyTitle', locale)}
        </h4>
        <p className="text-sm text-gray-700">{T('policyNone', locale)}</p>
      </div>
    </div>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Pagamento em 2 Etapas',
      step1: 'Depósito agora', step1Note: 'Confirma sua reserva imediatamente -- a confirmação chega por email e WhatsApp',
      step2: 'Saldo em', step2Note: 'Pago no hostel na chegada, salvo se preferir cartão',
      guaranteesTitle: 'Garantias e Segurança',
      instant: 'Confirmação instantânea da reserva',
      flexible: 'Política de cancelamento clara, sem letra miúda',
      fraud: 'Proteção contra fraudes',
      encrypted: 'Dados criptografados e seguros',
      faqTitle: 'Perguntas Frequentes',
      faq1Q: 'O que acontece se eu cancelar?',
      faq1A: 'O depósito não é reembolsável em caso de cancelamento, qualquer que seja a antecedência.',
      faq2Q: 'O que acontece se eu não pagar o saldo?',
      faq2A: 'Enviamos até 3 lembretes por email nos dias seguintes. Se ainda assim não pagar, entraremos em contato diretamente com você antes do check-in.',
      policyTitle: 'Política de Cancelamento',
      policyNone: 'O depósito não é reembolsável em caso de cancelamento ou não comparecimento, qualquer que seja a antecedência.'
    },
    es: {
      title: 'Pago en 2 Etapas',
      step1: 'Depósito ahora', step1Note: 'Confirma tu reserva de inmediato -- la confirmación te llega por email y WhatsApp',
      step2: 'Saldo el', step2Note: 'Se paga en el hostel al llegar, salvo que prefieras tarjeta',
      guaranteesTitle: 'Garantías y Seguridad',
      instant: 'Confirmación instantánea de la reserva',
      flexible: 'Política de cancelación clara, sin letra chica',
      fraud: 'Protección contra fraude',
      encrypted: 'Datos cifrados y seguros',
      faqTitle: 'Preguntas Frecuentes',
      faq1Q: '¿Qué pasa si cancelo?',
      faq1A: 'El depósito no es reembolsable en caso de cancelación, sin importar con cuánta anticipación avises.',
      faq2Q: '¿Qué pasa si no pago el saldo?',
      faq2A: 'Te mandamos hasta 3 recordatorios por email en los días siguientes. Si igual no pagás, te contactamos directamente antes del check-in.',
      policyTitle: 'Política de Cancelación',
      policyNone: 'El depósito no es reembolsable en caso de cancelación o no-show, sin importar con cuánta anticipación avises.'
    },
    en: {
      title: '2-Step Payment',
      step1: 'Deposit now', step1Note: 'Confirms your booking immediately -- the confirmation is sent by email and WhatsApp',
      step2: 'Balance on', step2Note: 'Paid at the hostel on arrival, unless you\'d rather pay by card',
      guaranteesTitle: 'Guarantees & Security',
      instant: 'Instant booking confirmation',
      flexible: 'Clear cancellation policy, no fine print',
      fraud: 'Fraud protection',
      encrypted: 'Encrypted, secure data',
      faqTitle: 'Frequently Asked Questions',
      faq1Q: 'What happens if I cancel?',
      faq1A: 'The deposit is non-refundable in case of cancellation, no matter how much notice you give.',
      faq2Q: 'What if I don\'t pay the balance?',
      faq2A: 'We\'ll send up to 3 email reminders over the following days. If it\'s still unpaid, we\'ll contact you directly before check-in.',
      policyTitle: 'Cancellation Policy',
      policyNone: 'The deposit is non-refundable in case of cancellation or no-show, no matter how much notice you give.'
    },
    fr: {
      title: 'Paiement en 2 Étapes',
      step1: 'Acompte maintenant', step1Note: 'Confirme votre réservation immédiatement -- la confirmation vous est envoyée par e-mail et WhatsApp',
      step2: 'Solde le', step2Note: 'Payé à l’auberge à l’arrivée, sauf si vous préférez la carte',
      guaranteesTitle: 'Garanties et Sécurité',
      instant: 'Confirmation instantanée de la réservation',
      flexible: 'Politique d’annulation claire, sans petits caractères',
      fraud: 'Protection contre la fraude',
      encrypted: 'Données chiffrées et sécurisées',
      faqTitle: 'Questions Fréquentes',
      faq1Q: 'Que se passe-t-il si j’annule ?',
      faq1A: 'L’acompte n’est pas remboursable en cas d’annulation, quel que soit le délai de prévenance.',
      faq2Q: 'Que se passe-t-il si je ne paie pas le solde ?',
      faq2A: 'Nous vous envoyons jusqu’à 3 rappels par e-mail les jours suivants. Si le solde reste impayé, nous vous contacterons directement avant l’arrivée.',
      policyTitle: 'Politique d’Annulation',
      policyNone: 'L’acompte n’est pas remboursable en cas d’annulation ou de non-présentation, quel que soit le délai de prévenance.'
    },
    de: {
      title: 'Zahlung in 2 Schritten',
      step1: 'Anzahlung jetzt', step1Note: 'Bestätigt Ihre Buchung sofort -- die Bestätigung erhalten Sie per E-Mail und WhatsApp',
      step2: 'Restbetrag am', step2Note: 'Zahlung im Hostel bei Ankunft, außer Sie zahlen lieber mit Karte',
      guaranteesTitle: 'Garantien & Sicherheit',
      instant: 'Sofortige Buchungsbestätigung',
      flexible: 'Klare Stornierungsbedingungen, ohne Kleingedrucktes',
      fraud: 'Betrugsschutz',
      encrypted: 'Verschlüsselte, sichere Daten',
      faqTitle: 'Häufige Fragen',
      faq1Q: 'Was passiert, wenn ich storniere?',
      faq1A: 'Die Anzahlung wird bei Stornierung nicht erstattet, unabhängig von der Vorlaufzeit.',
      faq2Q: 'Was, wenn ich den Restbetrag nicht zahle?',
      faq2A: 'Wir senden in den folgenden Tagen bis zu 3 E-Mail-Erinnerungen. Bleibt es unbezahlt, kontaktieren wir Sie direkt vor dem Check-in.',
      policyTitle: 'Stornierungsbedingungen',
      policyNone: 'Die Anzahlung wird bei Stornierung oder Nichterscheinen nicht erstattet, unabhängig von der Vorlaufzeit.'
    }
  };
  return t[locale]?.[key] || key;
}
