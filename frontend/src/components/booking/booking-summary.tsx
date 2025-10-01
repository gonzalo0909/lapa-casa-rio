// lapa-casa-hostel/frontend/src/components/booking/booking-summary.tsx

"use client";

import React from 'react';
import { PriceSummary } from './price-summary';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DateRange, Room, GuestDetails } from '@/types/global';

interface BookingSummaryProps {
  dateRange: DateRange;
  rooms: Room[];
  guestDetails: GuestDetails;
  totalPrice: number;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const BookingSummary: React.FC<BookingSummaryProps> = ({
  dateRange,
  rooms,
  guestDetails,
  totalPrice,
  locale = 'pt',
  className = ''
}) => {
  const nights = dateRange.checkIn && dateRange.checkOut
    ? Math.ceil((dateRange.checkOut.getTime() - dateRange.checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const totalBeds = rooms.reduce((sum, room) => sum + room.bedsCount, 0);

  return (
    <div className={`booking-summary ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{T('title', locale)}</h2>
        <p className="text-gray-600">{T('subtitle', locale)}</p>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>📅</span> {T('dates', locale)}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{T('checkIn', locale)}:</span>
            <span className="font-medium">{formatDate(dateRange.checkIn!, locale)} - 14:00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{T('checkOut', locale)}:</span>
            <span className="font-medium">{formatDate(dateRange.checkOut!, locale)} - 11:00</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">{T('totalNights', locale)}:</span>
            <span className="font-semibold">{nights} {nights === 1 ? T('night', locale) : T('nights', locale)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>🛏️</span> {T('rooms', locale)}
        </h3>
        <div className="space-y-3">
          {rooms.map((room, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{room.name}</p>
                <p className="text-sm text-gray-600">
                  {room.bedsCount} {room.bedsCount === 1 ? T('bed', locale) : T('beds', locale)}
                </p>
              </div>
              <Badge>{room.type === 'female' ? '👩' : room.isFlexible ? '🔄' : '👥'}</Badge>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">{T('totalBeds', locale)}:</span>
            <span className="font-semibold">{totalBeds} {totalBeds === 1 ? T('bed', locale) : T('beds', locale)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>👤</span> {T('guest', locale)}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{T('name', locale)}:</span>
            <span className="font-medium">{guestDetails.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{T('email', locale)}:</span>
            <span className="font-medium">{guestDetails.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{T('phone', locale)}:</span>
            <span className="font-medium">{guestDetails.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{T('country', locale)}:</span>
            <span className="font-medium">{guestDetails.country}</span>
          </div>
        </div>
        {guestDetails.specialRequests && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-1">{T('specialRequests', locale)}:</p>
            <p className="text-sm text-gray-900">{guestDetails.specialRequests}</p>
          </div>
        )}
      </Card>

      <PriceSummary
        dateRange={dateRange}
        rooms={rooms}
        totalPrice={totalPrice}
        locale={locale}
      />

      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800 text-center">
          ✓ {T('confirmation', locale)}
        </p>
      </div>
    </div>
  );
};

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(
    locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
    { day: '2-digit', month: 'long', year: 'numeric' }
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Resumo da Reserva',
      subtitle: 'Revise todos os detalhes antes de confirmar',
      dates: 'Datas',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      totalNights: 'Total de noites',
      night: 'noite',
      nights: 'noites',
      rooms: 'Quartos',
      bed: 'cama',
      beds: 'camas',
      totalBeds: 'Total de camas',
      guest: 'Hóspede',
      name: 'Nome',
      email: 'Email',
      phone: 'Telefone',
      country: 'País',
      specialRequests: 'Solicitações especiais',
      confirmation: 'Confirmação será enviada para seu email'
    },
    es: {
      title: 'Resumen de Reserva',
      subtitle: 'Revisa todos los detalles antes de confirmar',
      dates: 'Fechas',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      totalNights: 'Total de noches',
      night: 'noche',
      nights: 'noches',
      rooms: 'Habitaciones',
      bed: 'cama',
      beds: 'camas',
      totalBeds: 'Total de camas',
      guest: 'Huésped',
      name: 'Nombre',
      email: 'Email',
      phone: 'Teléfono',
      country: 'País',
      specialRequests: 'Solicitudes especiales',
      confirmation: 'Confirmación será enviada a tu email'
    },
    en: {
      title: 'Booking Summary',
      subtitle: 'Review all details before confirming',
      dates: 'Dates',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      totalNights: 'Total nights',
      night: 'night',
      nights: 'nights',
      rooms: 'Rooms',
      bed: 'bed',
      beds: 'beds',
      totalBeds: 'Total beds',
      guest: 'Guest',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      country: 'Country',
      specialRequests: 'Special requests',
      confirmation: 'Confirmation will be sent to your email'
    }
  };
  return t[locale]?.[key] || key;
}
