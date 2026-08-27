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

  const checkInDisplayDate = useMemo(() => {
    const checkIn = new Date(checkInDate);
    return checkIn.toLocaleDateString(BCP47[locale] ?? 'pt-BR', {
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
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">{T('title', locale)}</h4>
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                <div className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <div>
                    <p className="font-medium">{T('step1', locale)}: {formatCurrency(depositAmount)}</p>
                    <p className="text-blue-700 dark:text-blue-400">{T('step1Note', locale)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <div>
                    <p className="font-medium">{T('step2', locale)} ({checkInDisplayDate}): {formatCurrency(remainingAmount)}</p>
                    <p className="text-blue-700 dark:text-blue-400">{T('step2Note', locale)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Alert>

      <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-green-100 dark:bg-green-900/60 rounded-full p-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">{T('guaranteesTitle', locale)}</h4>
            <ul className="space-y-1 text-sm text-green-800 dark:text-green-300">
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

      <div className="bg-card rounded-lg p-4 border border-border">
        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          {T('faqTitle', locale)}
        </h4>
        <div className="space-y-3 text-sm">
          <details className="group">
            <summary className="cursor-pointer font-medium text-foreground hover:text-primary transition-colors">
              {T('faq1Q', locale)}
            </summary>
            <p className="mt-2 text-muted-foreground pl-4">{T('faq1A', locale)}</p>
          </details>

          <details className="group">
            <summary className="cursor-pointer font-medium text-foreground hover:text-primary transition-colors">
              {T('faq2Q', locale)}
            </summary>
            <p className="mt-2 text-muted-foreground pl-4">{T('faq2A', locale)}</p>
          </details>
        </div>
      </div>

      <div className="bg-card rounded-lg p-4 border border-border">
        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/>
          </svg>
          {T('policyTitle', locale)}
        </h4>
        <p className="text-sm text-muted-foreground">{T('policyNone', locale)}</p>
      </div>
    </div>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: ‘Pagamento em 2 Etapas’,
      step1: ‘Depósito agora’, step1Note: ‘Confirma sua reserva imediatamente — a confirmação chega por email e WhatsApp’,
      step2: ‘Saldo no check-in’, step2Note: ‘Pago diretamente ao Administrador no check-in — não é cobrado pela plataforma’,
      guaranteesTitle: ‘Garantias e Segurança’,
      instant: ‘Confirmação instantânea da reserva’,
      flexible: ‘Política de cancelamento clara, sem letra miúda’,
      fraud: ‘Proteção contra fraudes’,
      encrypted: ‘Dados criptografados e seguros’,
      faqTitle: ‘Perguntas Frequentes’,
      faq1Q: ‘O que acontece se eu cancelar?’,
      faq1A: ‘Se cancelar em até 7 dias da confirmação da reserva e o check-in for a mais de 7 dias, você recebe reembolso integral (Art. 49 CDC). Se o check-in for em menos de 7 dias, pode cancelar até as 11h do próprio dia. Fora dessas hipóteses, o depósito não é reembolsável.’,
      faq2Q: ‘O saldo restante é cobrado automaticamente?’,
      faq2A: ‘Não. Os 70% restantes são pagos diretamente ao Administrador no check-in, sem passar pela plataforma.’,
      policyTitle: ‘Política de Cancelamento’,
      policyNone: ‘Cancelamento em até 7 dias da confirmação (com check-in a mais de 7 dias): reembolso integral. Check-in em menos de 7 dias: reembolso até as 11h do dia. Demais casos ou no-show: depósito não reembolsável.’
    },
    es: {
      title: ‘Pago en 2 Etapas’,
      step1: ‘Depósito ahora’, step1Note: ‘Confirma tu reserva de inmediato — la confirmación te llega por email y WhatsApp’,
      step2: ‘Saldo en el check-in’, step2Note: ‘Pagado directamente al Administrador en el check-in — no se cobra por la plataforma’,
      guaranteesTitle: ‘Garantías y Seguridad’,
      instant: ‘Confirmación instantánea de la reserva’,
      flexible: ‘Política de cancelación clara, sin letra chica’,
      fraud: ‘Protección contra fraude’,
      encrypted: ‘Datos cifrados y seguros’,
      faqTitle: ‘Preguntas Frecuentes’,
      faq1Q: ‘¿Qué pasa si cancelo?’,
      faq1A: ‘Si cancelás dentro de los 7 días de la confirmación y el check-in es a más de 7 días, recibís reembolso total. Si el check-in es en menos de 7 días, podés cancelar hasta las 11h del mismo día. Fuera de esos casos, el depósito no se reembolsa.’,
      faq2Q: ‘¿El saldo restante se cobra automáticamente?’,
      faq2A: ‘No. El 70% restante se paga directamente al Administrador en el check-in, sin pasar por la plataforma.’,
      policyTitle: ‘Política de Cancelación’,
      policyNone: ‘Cancelación dentro de los 7 días de confirmación (con check-in a más de 7 días): reembolso total. Check-in en menos de 7 días: reembolso hasta las 11h del día. Otros casos o no-show: depósito no reembolsable.’
    },
    en: {
      title: ‘2-Step Payment’,
      step1: ‘Deposit now’, step1Note: ‘Confirms your booking immediately — confirmation sent by email and WhatsApp’,
      step2: ‘Balance at check-in’, step2Note: ‘Paid directly to the Administrator at check-in — not charged by the platform’,
      guaranteesTitle: ‘Guarantees & Security’,
      instant: ‘Instant booking confirmation’,
      flexible: ‘Clear cancellation policy, no fine print’,
      fraud: ‘Fraud protection’,
      encrypted: ‘Encrypted, secure data’,
      faqTitle: ‘Frequently Asked Questions’,
      faq1Q: ‘What happens if I cancel?’,
      faq1A: ‘If you cancel within 7 days of booking confirmation and check-in is more than 7 days away, you receive a full refund. If check-in is within 7 days, you can cancel until 11am on check-in day. In all other cases the deposit is non-refundable.’,
      faq2Q: ‘Is the remaining balance charged automatically?’,
      faq2A: ‘No. The remaining 70% is paid directly to the Administrator at check-in — it does not go through the platform.’,
      policyTitle: ‘Cancellation Policy’,
      policyNone: ‘Cancellation within 7 days of booking (check-in more than 7 days away): full refund. Check-in within 7 days: refund until 11am on the day. All other cases or no-show: deposit non-refundable.’
    },
    fr: {
      title: ‘Paiement en 2 Étapes’,
      step1: ‘Acompte maintenant’, step1Note: ‘Confirme votre réservation immédiatement — la confirmation vous est envoyée par e-mail et WhatsApp’,
      step2: ‘Solde au check-in’, step2Note: ‘Payé directement à l’Administrateur à l’arrivée — non prélevé par la plateforme’,
      guaranteesTitle: ‘Garanties et Sécurité’,
      instant: ‘Confirmation instantanée de la réservation’,
      flexible: ‘Politique d’annulation claire, sans petits caractères’,
      fraud: ‘Protection contre la fraude’,
      encrypted: ‘Données chiffrées et sécurisées’,
      faqTitle: ‘Questions Fréquentes’,
      faq1Q: ‘Que se passe-t-il si j’annule ?’,
      faq1A: ‘Si vous annulez dans les 7 jours suivant la confirmation et que l’arrivée est à plus de 7 jours, vous êtes intégralement remboursé. Si l’arrivée est dans moins de 7 jours, vous pouvez annuler jusqu’à 11h le jour même. Dans tous les autres cas, l’acompte n’est pas remboursable.’,
      faq2Q: ‘Le solde restant est-il prélevé automatiquement ?’,
      faq2A: ‘Non. Les 70 % restants sont réglés directement à l’Administrateur à l’arrivée — ils ne transitent pas par la plateforme.’,
      policyTitle: ‘Politique d’Annulation’,
      policyNone: ‘Annulation dans les 7 jours suivant la confirmation (arrivée à plus de 7 jours) : remboursement intégral. Arrivée dans moins de 7 jours : remboursement jusqu’à 11h le jour J. Autres cas ou no-show : acompte non remboursable.’
    },
    de: {
      title: ‘Zahlung in 2 Schritten’,
      step1: ‘Anzahlung jetzt’, step1Note: ‘Bestätigt Ihre Buchung sofort — die Bestätigung erhalten Sie per E-Mail und WhatsApp’,
      step2: ‘Restbetrag beim Check-in’, step2Note: ‘Direkt an den Administrator beim Check-in gezahlt — nicht über die Plattform abgerechnet’,
      guaranteesTitle: ‘Garantien & Sicherheit’,
      instant: ‘Sofortige Buchungsbestätigung’,
      flexible: ‘Klare Stornierungsbedingungen, ohne Kleingedrucktes’,
      fraud: ‘Betrugsschutz’,
      encrypted: ‘Verschlüsselte, sichere Daten’,
      faqTitle: ‘Häufige Fragen’,
      faq1Q: ‘Was passiert, wenn ich storniere?’,
      faq1A: ‘Bei Stornierung innerhalb von 7 Tagen nach Buchungsbestätigung und Check-in mehr als 7 Tage entfernt erhalten Sie eine volle Rückerstattung. Ist der Check-in in weniger als 7 Tagen, können Sie bis 11 Uhr am Check-in-Tag stornieren. In allen anderen Fällen ist die Anzahlung nicht erstattungsfähig.’,
      faq2Q: ‘Wird der Restbetrag automatisch abgebucht?’,
      faq2A: ‘Nein. Die verbleibenden 70 % werden direkt beim Check-in an den Administrator gezahlt — ohne Abwicklung über die Plattform.’,
      policyTitle: ‘Stornierungsbedingungen’,
      policyNone: ‘Stornierung innerhalb von 7 Tagen nach Buchung (Check-in mehr als 7 Tage entfernt): volle Rückerstattung. Check-in in weniger als 7 Tagen: Rückerstattung bis 11 Uhr. Sonstige Fälle oder Nichterscheinen: Anzahlung nicht erstattungsfähig.’
    }
  };
  return t[locale]?.[key] || key;
}
