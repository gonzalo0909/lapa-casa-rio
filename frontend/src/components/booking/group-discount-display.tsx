// lapa-casa-hostel/frontend/src/components/booking/group-discount-display.tsx

"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * GroupDiscountDisplay Component
 * 
 * Visual display of group discount tiers
 * Shows current discount and next tier incentive
 * 
 * @component
 */
interface GroupDiscountDisplayProps {
  totalBeds: number;
  discountPercent: number;
  discountAmount: number;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const GroupDiscountDisplay: React.FC<GroupDiscountDisplayProps> = ({
  totalBeds,
  discountPercent,
  discountAmount,
  locale = 'pt',
  className = ''
}) => {
  const getDiscountTier = () => {
    if (totalBeds >= 26) return 'platinum';
    if (totalBeds >= 16) return 'gold';
    if (totalBeds >= 7) return 'silver';
    return 'none';
  };

  const getNextTier = () => {
    if (totalBeds < 7) return { beds: 7, discount: 10, name: 'silver' };
    if (totalBeds < 16) return { beds: 16, discount: 15, name: 'gold' };
    if (totalBeds < 26) return { beds: 26, discount: 20, name: 'platinum' };
    return null;
  };

  const currentTier = getDiscountTier();
  const nextTier = getNextTier();
  const bedsToNextTier = nextTier ? nextTier.beds - totalBeds : 0;

  const tierColors = {
    silver: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    gold: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    platinum: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' }
  };

  const colors = tierColors[currentTier as keyof typeof tierColors] || tierColors.silver;

  return (
    <div className={`group-discount-display ${className}`}>
      <div className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">
                {currentTier === 'platinum' ? '💎' : currentTier === 'gold' ? '🥇' : '🥈'}
              </span>
              <h4 className={`font-bold ${colors.text}`}>
                {T(`tier_${currentTier}`, locale)}
              </h4>
            </div>
            <p className="text-sm text-gray-700">
              {totalBeds} {totalBeds === 1 ? T('bed', locale) : T('beds', locale)} • {discountPercent}% {T('discount', locale)}
            </p>
          </div>
          <Badge className={`${colors.bg} ${colors.text} border-0 font-bold text-lg`}>
            -{discountPercent}%
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-300">
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
            <p className="text-sm font-semibold text-blue-900">
              {T('nextTier', locale)}
            </p>
          </div>
          <p className="text-sm text-blue-800">
            {T('addMore', locale).replace('{beds}', bedsToNextTier.toString())} {' '}
            {T('toUnlock', locale)} <strong>{nextTier.discount}%</strong> {T('discount', locale)}
          </p>
          <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(totalBeds / nextTier.beds) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className={`p-2 rounded text-center ${totalBeds >= 7 ? 'bg-gray-200' : 'bg-gray-100'}`}>
          <p className="text-xs text-gray-600">7+ {T('beds', locale)}</p>
          <p className={`font-bold ${totalBeds >= 7 ? 'text-gray-900' : 'text-gray-500'}`}>10%</p>
        </div>
        <div className={`p-2 rounded text-center ${totalBeds >= 16 ? 'bg-yellow-200' : 'bg-gray-100'}`}>
          <p className="text-xs text-gray-600">16+ {T('beds', locale)}</p>
          <p className={`font-bold ${totalBeds >= 16 ? 'text-yellow-900' : 'text-gray-500'}`}>15%</p>
        </div>
        <div className={`p-2 rounded text-center ${totalBeds >= 26 ? 'bg-purple-200' : 'bg-gray-100'}`}>
          <p className="text-xs text-gray-600">26+ {T('beds', locale)}</p>
          <p className={`font-bold ${totalBeds >= 26 ? 'text-purple-900' : 'text-gray-500'}`}>20%</p>
        </div>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      tier_silver: 'Grupo Prata',
      tier_gold: 'Grupo Ouro',
      tier_platinum: 'Grupo Platina',
      bed: 'cama',
      beds: 'camas',
      discount: 'desconto',
      youSave: 'Você economiza',
      nextTier: 'Próximo Nível',
      addMore: 'Adicione mais {beds} camas',
      toUnlock: 'para desbloquear'
    },
    es: {
      tier_silver: 'Grupo Plata',
      tier_gold: 'Grupo Oro',
      tier_platinum: 'Grupo Platino',
      bed: 'cama',
      beds: 'camas',
      discount: 'descuento',
      youSave: 'Ahorras',
      nextTier: 'Próximo Nivel',
      addMore: 'Añade {beds} camas más',
      toUnlock: 'para desbloquear'
    },
    en: {
      tier_silver: 'Silver Group',
      tier_gold: 'Gold Group',
      tier_platinum: 'Platinum Group',
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
