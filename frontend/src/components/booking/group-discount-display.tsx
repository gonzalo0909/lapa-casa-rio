// lapa-casa-hostel/frontend/src/components/booking/group-discount-display.tsx

"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * GroupDiscountDisplay Component
 *
 * Muestra únicamente el tramo de descuento ya activo para el total de
 * camas reservadas -- a pedido del dueño, no se muestra el resto de los
 * tramos (ej. el de 13+ camas cuando ya aplica el de 3+) para no
 * distraer con información que no aplica a esta reserva.
 *
 * @component
 */
interface GroupDiscountDisplayProps {
  totalBeds: number;
  discountPercent: number;
  discountAmount: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const GroupDiscountDisplay: React.FC<GroupDiscountDisplayProps> = ({
  totalBeds,
  discountPercent,
  discountAmount,
  locale = 'pt',
  className = ''
}) => {
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
    },
    es: {
      title: 'Descuento para Grupos',
      bed: 'cama',
      beds: 'camas',
      discount: 'descuento',
      youSave: 'Ahorras',
    },
    en: {
      title: 'Group Discount',
      bed: 'bed',
      beds: 'beds',
      discount: 'discount',
      youSave: 'You save',
    },
    fr: {
      title: 'Remise de Groupe',
      bed: 'lit',
      beds: 'lits',
      discount: 'remise',
      youSave: 'Vous économisez',
    },
    de: {
      title: 'Gruppenrabatt',
      bed: 'Bett',
      beds: 'Betten',
      discount: 'Rabatt',
      youSave: 'Sie sparen',
    }
  };
  return t[locale]?.[key] || key;
}
