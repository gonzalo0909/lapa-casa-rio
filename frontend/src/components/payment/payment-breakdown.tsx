// lapa-casa-hostel/frontend/src/components/payment/payment-breakdown.tsx

'use client';

import React from 'react';
import { Card } from '../ui/card';

interface PaymentBreakdownProps {
  amount: number;
  depositAmount: number;
  remainingAmount: number;
  currency: string;
  groupDiscount?: number;
  seasonMultiplier?: number;
  baseAmount?: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

const BCP47: Record<string, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE' };

export function PaymentBreakdown({
  amount,
  depositAmount,
  remainingAmount,
  currency,
  groupDiscount = 0,
  seasonMultiplier = 1,
  baseAmount,
  locale = 'pt'
}: PaymentBreakdownProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(BCP47[locale] ?? 'pt-BR', {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD'
    }).format(value);
  };

  const depositPercentage = (depositAmount / amount) * 100;
  const hasDiscount = groupDiscount > 0;
  const hasSurcharge = seasonMultiplier > 1;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{T('title', locale)}</h3>

      <div className="space-y-3">
        {baseAmount && baseAmount !== amount && (
          <>
            <div className="flex justify-between items-center text-gray-600">
              <span>{T('baseAmount', locale)}</span>
              <span>{formatCurrency(baseAmount)}</span>
            </div>

            {hasDiscount && (
              <div className="flex justify-between items-center text-green-600">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                  </svg>
                  {T('groupDiscount', locale)} ({(groupDiscount * 100).toFixed(0)}%)
                </span>
                <span>-{formatCurrency(baseAmount * groupDiscount)}</span>
              </div>
            )}

            {hasSurcharge && (
              <div className="flex justify-between items-center text-amber-600">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                  </svg>
                  {T('seasonSurcharge', locale)} (+{((seasonMultiplier - 1) * 100).toFixed(0)}%)
                </span>
                <span>+{formatCurrency(baseAmount * (seasonMultiplier - 1))}</span>
              </div>
            )}

            <div className="border-t pt-3"></div>
          </>
        )}

        <div className="flex justify-between items-center font-semibold text-lg">
          <span>{T('totalAmount', locale)}</span>
          <span>{formatCurrency(amount)}</span>
        </div>

        <div className="border-t pt-3 mt-3"></div>

        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-blue-900">{T('depositLabel', locale)}</p>
              <p className="text-sm text-blue-700">{depositPercentage.toFixed(0)}% {T('ofTotal', locale)}</p>
            </div>
            <span className="text-xl font-bold text-blue-900">{formatCurrency(depositAmount)}</span>
          </div>

          <div className="text-xs text-blue-700 space-y-1">
            <p>• {T('depositNote1', locale)}</p>
            <p>• {T('depositNote2', locale)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">{T('remainingLabel', locale)}</p>
              <p className="text-sm text-gray-600">{(100 - depositPercentage).toFixed(0)}% {T('ofTotal', locale)}</p>
            </div>
            <span className="text-xl font-bold text-gray-900">{formatCurrency(remainingAmount)}</span>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>• {T('remainingNote1', locale)}</p>
            <p>• {T('remainingNote2', locale)}</p>
          </div>
        </div>

        <div className="border-t pt-3 mt-3"></div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span>{T('secureNote', locale)}</span>
        </div>
      </div>
    </Card>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Resumo do Pagamento', baseAmount: 'Valor base', groupDiscount: 'Desconto grupo',
      seasonSurcharge: 'Alta temporada', totalAmount: 'Valor total', depositLabel: 'Depósito inicial',
      ofTotal: 'do valor total', depositNote1: 'Pague agora para confirmar sua reserva',
      depositNote2: 'Não reembolsável em caso de cancelamento ou não comparecimento', remainingLabel: 'Saldo restante',
      remainingNote1: 'Pago no hostel na chegada (dinheiro), salvo se preferir pagar com cartão', remainingNote2: 'Não é cobrado automaticamente -- te enviamos um lembrete por email 7 dias antes do check-in',
      secureNote: 'Pagamento 100% seguro e criptografado'
    },
    es: {
      title: 'Resumen del Pago', baseAmount: 'Monto base', groupDiscount: 'Descuento grupo',
      seasonSurcharge: 'Temporada alta', totalAmount: 'Monto total', depositLabel: 'Depósito inicial',
      ofTotal: 'del monto total', depositNote1: 'Pagá ahora para confirmar tu reserva',
      depositNote2: 'No reembolsable en caso de cancelación o no-show', remainingLabel: 'Saldo restante',
      remainingNote1: 'Se paga en el hostel al llegar (efectivo), salvo que prefieras pagar con tarjeta', remainingNote2: 'No se cobra automáticamente -- te mandamos un recordatorio por email 7 días antes del check-in',
      secureNote: 'Pago 100% seguro y cifrado'
    },
    en: {
      title: 'Payment Summary', baseAmount: 'Base amount', groupDiscount: 'Group discount',
      seasonSurcharge: 'High season', totalAmount: 'Total amount', depositLabel: 'Initial deposit',
      ofTotal: 'of the total', depositNote1: 'Pay now to confirm your booking',
      depositNote2: 'Non-refundable in case of cancellation or no-show', remainingLabel: 'Remaining balance',
      remainingNote1: 'Paid at the hostel on arrival (cash), unless you\'d rather pay by card', remainingNote2: 'Not charged automatically -- we\'ll email you a reminder 7 days before check-in',
      secureNote: '100% secure, encrypted payment'
    },
    fr: {
      title: 'Résumé du Paiement', baseAmount: 'Montant de base', groupDiscount: 'Remise de groupe',
      seasonSurcharge: 'Haute saison', totalAmount: 'Montant total', depositLabel: 'Acompte initial',
      ofTotal: 'du montant total', depositNote1: 'Payez maintenant pour confirmer votre réservation',
      depositNote2: 'Non remboursable en cas d’annulation ou de non-présentation', remainingLabel: 'Solde restant',
      remainingNote1: 'Payé à l’auberge à l’arrivée (espèces), sauf si vous préférez payer par carte', remainingNote2: 'Non prélevé automatiquement -- nous vous enverrons un rappel par e-mail 7 jours avant l’arrivée',
      secureNote: 'Paiement 100% sécurisé et chiffré'
    },
    de: {
      title: 'Zahlungsübersicht', baseAmount: 'Grundbetrag', groupDiscount: 'Gruppenrabatt',
      seasonSurcharge: 'Hochsaison', totalAmount: 'Gesamtbetrag', depositLabel: 'Erste Anzahlung',
      ofTotal: 'des Gesamtbetrags', depositNote1: 'Jetzt zahlen, um Ihre Buchung zu bestätigen',
      depositNote2: 'Nicht erstattungsfähig bei Stornierung oder Nichterscheinen', remainingLabel: 'Restbetrag',
      remainingNote1: 'Zahlung im Hostel bei Ankunft (bar), außer Sie zahlen lieber mit Karte', remainingNote2: 'Keine automatische Abbuchung -- wir erinnern Sie 7 Tage vor Check-in per E-Mail',
      secureNote: '100% sichere, verschlüsselte Zahlung'
    }
  };
  return t[locale]?.[key] || key;
}
