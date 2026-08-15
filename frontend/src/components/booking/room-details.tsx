// lapa-casa-hostel/frontend/src/components/booking/room-details.tsx

"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { DateRange, RoomAvailability } from '@/types/global';

/**
 * RoomDetails Component
 * 
 * Detailed room information modal content
 * Shows amenities, policies, and features
 * 
 * @component
 */
interface RoomDetailsProps {
  room: RoomAvailability;
  dateRange: DateRange;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const RoomDetails: React.FC<RoomDetailsProps> = ({
  room,
  dateRange,
  locale = 'pt',
  className = ''
}) => {
  const getRoomAmenities = () => {
    const baseAmenities = [
      { icon: '🛏️', label: T('bunkBeds', locale) },
      { icon: '🔒', label: T('lockers', locale) },
      { icon: '🔌', label: T('outlets', locale) },
      { icon: '💡', label: T('readingLights', locale) },
      { icon: '❄️', label: T('airConditioning', locale) },
      { icon: '🪟', label: T('windows', locale) }
    ];

    if (room.capacity >= 12) {
      baseAmenities.push({ icon: '🚿', label: T('privateBathroom', locale) });
    }

    return baseAmenities;
  };

  const getSharedAmenities = () => [
    { icon: '🍳', label: T('sharedKitchen', locale) },
    { icon: '📶', label: T('freeWifi', locale) },
    { icon: '🎮', label: T('commonArea', locale) },
    { icon: '🔐', label: T('security24h', locale) }
  ];

  const nights = dateRange.checkIn && dateRange.checkOut
    ? Math.ceil((dateRange.checkOut.getTime() - dateRange.checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className={`room-details ${className}`}>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{room.isFlexible ? '🔄' : room.type === 'female' ? '👩' : '👥'}</span>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{room.name}</h3>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge variant={room.isFlexible ? 'warning' : 'default'}>
            {room.isFlexible ? T('flexible', locale) : room.type === 'female' ? T('female', locale) : T('mixed', locale)}
          </Badge>
          <Badge variant="outline">
            {room.availableBeds} {T('available', locale)}
          </Badge>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">{T('roomAmenities', locale)}</h4>
        <div className="grid grid-cols-2 gap-3">
          {getRoomAmenities().map((amenity, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xl">{amenity.icon}</span>
              <span className="text-sm text-gray-700">{amenity.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">{T('sharedAmenities', locale)}</h4>
        <div className="grid grid-cols-2 gap-3">
          {getSharedAmenities().map((amenity, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xl">{amenity.icon}</span>
              <span className="text-sm text-gray-700">{amenity.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-3">{T('pricing', locale)}</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{T('basePrice', locale)}:</span>
            <span className="font-medium">R$ {room.basePrice.toFixed(2)}/{T('bed', locale)}/{T('night', locale)}</span>
          </div>
          {nights > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">{nights} {nights === 1 ? T('night', locale) : T('nights', locale)}:</span>
              <span className="font-medium">R$ {(room.basePrice * nights).toFixed(2)}/{T('bed', locale)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">{T('policies', locale)}</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>✓ {T('policy1', locale)}</li>
          <li>✓ {T('policy4', locale)}</li>
          <li>✗ {T('policy2', locale)}</li>
          <li>✗ {T('policy3', locale)}</li>
          <li>✗ {T('policy5', locale)}</li>
          <li>✗ {T('policy6', locale)}</li>
        </ul>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">{T('importantInfo', locale)}</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• {T('checkIn', locale)}: 14:00</li>
          <li>• {T('checkOut', locale)}: 12:00</li>
          <li>• {T('minAge', locale)}: 18 {T('years', locale)}</li>
          <li>• {T('idRequired', locale)}</li>
        </ul>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      bed: 'cama',
      beds: 'camas',
      night: 'noite',
      nights: 'noites',
      capacity: 'Capacidade',
      mixed: 'Misto',
      female: 'Feminino',
      flexible: 'Flexível',
      available: 'disponíveis',
      roomAmenities: 'Comodidades do Quarto',
      bunkBeds: 'Beliches',
      lockers: 'Armários',
      outlets: 'Tomadas',
      readingLights: 'Luzes de leitura',
      airConditioning: 'Ar condicionado',
      windows: 'Janelas',
      privateBathroom: 'Banheiro privado',
      sharedAmenities: 'Áreas Compartilhadas',
      sharedKitchen: 'Cozinha',
      freeWifi: 'WiFi grátis',
      commonArea: 'Área comum',
      security24h: 'Segurança 24h',
      pricing: 'Preços',
      basePrice: 'Preço base',
      policies: 'Políticas',
      policy1: 'Lençóis inclusos',
      policy2: 'Café da manhã não incluído (disponível como oferta à parte)',
      policy3: 'Depósito não reembolsável em caso de cancelamento',
      policy4: 'Depósito de 30% na reserva',
      policy5: 'Animais não permitidos',
      policy6: 'Fumar não permitido',
      importantInfo: 'Informações Importantes',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      minAge: 'Idade mínima',
      years: 'anos',
      idRequired: 'Documento obrigatório'
    },
    es: {
      bed: 'cama',
      beds: 'camas',
      night: 'noche',
      nights: 'noches',
      capacity: 'Capacidad',
      mixed: 'Mixto',
      female: 'Femenino',
      flexible: 'Flexible',
      available: 'disponibles',
      roomAmenities: 'Comodidades de la Habitación',
      bunkBeds: 'Literas',
      lockers: 'Casilleros',
      outlets: 'Enchufes',
      readingLights: 'Luces de lectura',
      airConditioning: 'Aire acondicionado',
      windows: 'Ventanas',
      privateBathroom: 'Baño privado',
      sharedAmenities: 'Áreas Compartidas',
      sharedKitchen: 'Cocina',
      freeWifi: 'WiFi gratis',
      commonArea: 'Área común',
      security24h: 'Seguridad 24h',
      pricing: 'Precios',
      basePrice: 'Precio base',
      policies: 'Políticas',
      policy1: 'Sábanas incluidas',
      policy2: 'Desayuno no incluido (disponible como oferta aparte)',
      policy3: 'Depósito no reembolsable en caso de cancelación',
      policy4: 'Depósito del 30% en la reserva',
      policy5: 'No se permiten mascotas',
      policy6: 'No se permite fumar',
      importantInfo: 'Información Importante',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      minAge: 'Edad mínima',
      years: 'años',
      idRequired: 'Documento obligatorio'
    },
    en: {
      bed: 'bed',
      beds: 'beds',
      night: 'night',
      nights: 'nights',
      capacity: 'Capacity',
      mixed: 'Mixed',
      female: 'Female',
      flexible: 'Flexible',
      available: 'available',
      roomAmenities: 'Room Amenities',
      bunkBeds: 'Bunk beds',
      lockers: 'Lockers',
      outlets: 'Outlets',
      readingLights: 'Reading lights',
      airConditioning: 'Air conditioning',
      windows: 'Windows',
      privateBathroom: 'Private bathroom',
      sharedAmenities: 'Shared Areas',
      sharedKitchen: 'Kitchen',
      freeWifi: 'Free WiFi',
      commonArea: 'Common area',
      security24h: '24h security',
      pricing: 'Pricing',
      basePrice: 'Base price',
      policies: 'Policies',
      policy1: 'Sheets included',
      policy2: 'Breakfast not included (available as a separate add-on)',
      policy3: 'Deposit is non-refundable if you cancel',
      policy4: '30% deposit on booking',
      policy5: 'Pets not allowed',
      policy6: 'Smoking not allowed',
      importantInfo: 'Important Information',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      minAge: 'Minimum age',
      years: 'years',
      idRequired: 'ID required'
    },
    fr: {
      bed: 'lit',
      beds: 'lits',
      night: 'nuit',
      nights: 'nuits',
      capacity: 'Capacité',
      mixed: 'Mixte',
      female: 'Féminin',
      flexible: 'Flexible',
      available: 'disponibles',
      roomAmenities: 'Équipements de la Chambre',
      bunkBeds: 'Lits superposés',
      lockers: 'Casiers',
      outlets: 'Prises électriques',
      readingLights: 'Liseuses',
      airConditioning: 'Climatisation',
      windows: 'Fenêtres',
      privateBathroom: 'Salle de bain privée',
      sharedAmenities: 'Espaces Communs',
      sharedKitchen: 'Cuisine',
      freeWifi: 'WiFi gratuit',
      commonArea: 'Espace commun',
      security24h: 'Sécurité 24h/24',
      pricing: 'Tarifs',
      basePrice: 'Prix de base',
      policies: 'Politiques',
      policy1: 'Draps inclus',
      policy2: 'Petit-déjeuner non inclus (disponible en option)',
      policy3: 'Acompte non remboursable en cas d"annulation',
      policy4: 'Acompte de 30% à la réservation',
      policy5: 'Animaux non autorisés',
      policy6: 'Interdiction de fumer',
      importantInfo: 'Informations Importantes',
      checkIn: 'Arrivée',
      checkOut: 'Départ',
      minAge: 'Âge minimum',
      years: 'ans',
      idRequired: "Pièce d'identité requise"
    },
    de: {
      bed: 'Bett',
      beds: 'Betten',
      night: 'Nacht',
      nights: 'Nächte',
      capacity: 'Kapazität',
      mixed: 'Gemischt',
      female: 'Weiblich',
      flexible: 'Flexibel',
      available: 'verfügbar',
      roomAmenities: 'Zimmerausstattung',
      bunkBeds: 'Etagenbetten',
      lockers: 'Schließfächer',
      outlets: 'Steckdosen',
      readingLights: 'Leselampen',
      airConditioning: 'Klimaanlage',
      windows: 'Fenster',
      privateBathroom: 'Eigenes Badezimmer',
      sharedAmenities: 'Gemeinschaftsbereiche',
      sharedKitchen: 'Küche',
      freeWifi: 'Kostenloses WLAN',
      commonArea: 'Gemeinschaftsraum',
      security24h: '24h-Sicherheit',
      pricing: 'Preise',
      basePrice: 'Grundpreis',
      policies: 'Richtlinien',
      policy1: 'Bettwäsche inklusive',
      policy2: 'Frühstück nicht inklusive (separat buchbar)',
      policy3: 'Anzahlung bei Stornierung nicht erstattungsfähig',
      policy4: '30% Anzahlung bei Buchung',
      policy5: 'Haustiere nicht erlaubt',
      policy6: 'Rauchen nicht erlaubt',
      importantInfo: 'Wichtige Informationen',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      minAge: 'Mindestalter',
      years: 'Jahre',
      idRequired: 'Ausweis erforderlich'
    }
  };
  return t[locale]?.[key] || key;
}
