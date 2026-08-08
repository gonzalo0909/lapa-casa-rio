// lapa-casa-hostel/frontend/src/components/booking/group-discount-display.tsx

"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { GroupDiscountTier } from '@/types/global';

/**
 * GroupDiscountDisplay Component
 *
 * Muestra el tramo de descuento activo y el próximo tramo, a partir de
 * los tramos reales (group_discount_tiers, editables desde el admin) --
 * antes tenía 3 tramos fijos (7/16/26 camas -> 10/15/20%) hardcodeados
 * acá adentro, desconectados de la API.
 *
 * @component
 */
interface GroupDiscountDisplayProps {
  totalBeds: number;
  discountPercent: number;
  discountAmount: number;
  tiers: GroupDiscountTier[];
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const GroupDiscountDisplay: React.FC<GroupDiscountDisplayProps> = ({
  totalBeds,
  discountPercent,
  discountAmount,
  tiers,
  locale = 'pt',
  className = ''
}) => {
  const sortedTiers = [...tiers].sort((a, b) => a.minBeds - b.minBeds);
  const nextTier = sortedTiers.find((t) => totalBeds < t.minBeds) ?? null;
  const bedsToNextTier = nextTier ? nextTier.minBeds - totalBeds : 0;

  return (
    <div className={`group-discount-display ${className}`}>
      <div className="p-4 rounded-lg border-2 bg-green-50 border-green-300">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎉</span>
              <h4 className="font-bold text-green-800">{T('title', locale)}</h4>
            </div>
            <p className="text-sm text-gray-700">
              {totalBeds} {totalBeds === 1 ? T('bed', locale) : T('beds', locale)} • {discountPercent}% {T('discount', locale)}
            </p>
          </div>
          <Badge className="bg-green-100 text-green-800 border-0 font-bold text-lg">
            -{discountPercent}%
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-green-300">
          <span className="text-sm font-medium text-gray-700">{T('youSave', locale)}:</span>
          <span className="text-lg font-bold text-green-600">
            R$ {discountAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {nextTier && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🎯</span>
            <p className="text-sm font-semibold text-blue-900">{T('nextTier', locale)}</p>
          </div>
          <p className="text-sm text-blue-800">
            {T('addMore', locale).replace('{beds}', bedsToNextTier.toString())} {' '}
            {T('toUnlock', locale)} <strong>{Math.round(nextTier.percentage * 100)}%</strong> {T('discount', locale)}
          </p>
          <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.min(100, (totalBeds / nextTier.minBeds) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {sortedTiers.length > 0 && (
        <div className={`mt-3 grid gap-2`} style={{ gridTemplateColumns: `repeat(${sortedTiers.length}, minmax(0, 1fr))` }}>
          {sortedTiers.map((tier) => (
            <div
              key={tier.minBeds}
              className={`p-2 rounded text-center ${totalBeds >= tier.minBeds ? 'bg-green-200' : 'bg-gray-100'}`}
            >
              <p className="text-xs text-gray-600">{tier.minBeds}+ {T('beds', locale)}</p>
              <p className={`font-bold ${totalBeds >= tier.minBeds ? 'text-green-900' : 'text-gray-500'}`}>
                {Math.round(tier.percentage * 100)}%
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Desconto para Grupos',
      bed: 'cama',
      beds: 'camas',
      discount: 'desconto',
      youSave: 'Você economiza',
      nextTier: 'Próximo Nível',
      addMore: 'Adicione mais {beds} camas',
      toUnlock: 'para desbloquear'
    },
    es: {
      title: 'Descuento para Grupos',
      bed: 'cama',
      beds: 'camas',
      discount: 'descuento',
      youSave: 'Ahorras',
      nextTier: 'Próximo Nivel',
      addMore: 'Añade {beds} camas más',
      toUnlock: 'para desbloquear'
    },
    en: {
      title: 'Group Discount',
      bed: 'bed',
      beds: 'beds',
      discount: 'discount',
      youSave: 'You save',
      nextTier: 'Next Tier',
      addMore: 'Add {beds} more beds',
      toUnlock: 'to unlock'
    }
  };
  return t[locale]?.[key] || key;
}
