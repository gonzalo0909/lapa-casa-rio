'use client';
// frontend/src/components/booking/hostel-info-banner.tsx
// Banner fijo de "información importante" (check-in/check-out, documento, edad mínima).
// Independiente del wizard: se muestra siempre, en cualquier phase/step.

import React from 'react';
import {
  AlertTriangle,
  KeyRound,
  DoorOpen,
  FileText,
  Ban,
  CigaretteOff,
  Accessibility,
} from 'lucide-react';
import type { Lang } from './hostel-engine.types';

const INFO_RULES: Record<string, Array<{ Icon: React.ElementType; text: React.ReactNode }>> = {
  pt: [
    {
      Icon: KeyRound,
      text: (
        <>
          Check-in (entrada): <strong>14h às 22h</strong> — para chegar antes, reserve também o dia
          anterior
        </>
      ),
    },
    {
      Icon: DoorOpen,
      text: (
        <>
          Check-out (saída): até as <strong>12h</strong> — para sair mais tarde, reserve um dia a
          mais
        </>
      ),
    },
    {
      Icon: FileText,
      text: (
        <>
          O envio da foto do documento é <strong>obrigatório</strong>, sem exceção
        </>
      ),
    },
    { Icon: CigaretteOff, text: <>Proibido fumar no hostel e nas áreas comuns</> },
    {
      Icon: Ban,
      text: (
        <>
          Somente para <strong>maiores de 18 anos</strong>
        </>
      ),
    },
    {
      Icon: Accessibility,
      text: (
        <>
          Camas beliches de três andares — não recomendadas para <strong>maiores de 50 anos</strong>{' '}
          ou pessoas com mobilidade reduzida
        </>
      ),
    },
  ],
  es: [
    {
      Icon: KeyRound,
      text: (
        <>
          Check-in (entrada): <strong>14h a 22h</strong> — para llegar antes, reserva también el día
          anterior
        </>
      ),
    },
    {
      Icon: DoorOpen,
      text: (
        <>
          Check-out (salida): hasta las <strong>12h</strong> — para salir más tarde, mejor reserva
          un día más
        </>
      ),
    },
    {
      Icon: FileText,
      text: (
        <>
          El envío de la foto del documento es <strong>obligatorio</strong>, sin excepción
        </>
      ),
    },
    { Icon: CigaretteOff, text: <>Prohibido fumar en el hostel y en las áreas comunes</> },
    {
      Icon: Ban,
      text: (
        <>
          Solo para <strong>mayores de 18 años</strong>
        </>
      ),
    },
    {
      Icon: Accessibility,
      text: (
        <>
          Camas literas de tres pisos — no recomendadas para <strong>mayores de 50 años</strong> ni
          personas con movilidad reducida
        </>
      ),
    },
  ],
  en: [
    {
      Icon: KeyRound,
      text: (
        <>
          Check-in: <strong>2 pm to 10 pm</strong> — arriving earlier? Book the previous night
        </>
      ),
    },
    {
      Icon: DoorOpen,
      text: (
        <>
          Check-out: by <strong>12 pm</strong> — need more time? Book one extra night
        </>
      ),
    },
    {
      Icon: FileText,
      text: (
        <>
          Sending a photo of your ID is <strong>mandatory</strong>, no exceptions
        </>
      ),
    },
    { Icon: CigaretteOff, text: <>Smoking in the hostel and common areas is prohibited</> },
    {
      Icon: Ban,
      text: (
        <>
          Guests must be <strong>18 or older</strong>
        </>
      ),
    },
    {
      Icon: Accessibility,
      text: (
        <>
          Triple-decker bunk beds — not recommended for guests <strong>over 50</strong> or with
          reduced mobility
        </>
      ),
    },
  ],
  de: [
    {
      Icon: KeyRound,
      text: (
        <>
          Check-in: <strong>14 bis 22 Uhr</strong> — früher ankommen? Buchen Sie auch die Vornacht
        </>
      ),
    },
    {
      Icon: DoorOpen,
      text: (
        <>
          Check-out: bis <strong>12 Uhr</strong> — mehr Zeit nötig? Buchen Sie eine zusätzliche
          Nacht
        </>
      ),
    },
    {
      Icon: FileText,
      text: (
        <>
          Das Hochladen eines Ausweisfotos ist <strong>verpflichtend</strong>, ohne Ausnahme
        </>
      ),
    },
    {
      Icon: CigaretteOff,
      text: <>Rauchen im Hostel und in den Gemeinschaftsbereichen ist verboten</>,
    },
    {
      Icon: Ban,
      text: (
        <>
          Nur für Gäste ab <strong>18 Jahren</strong>
        </>
      ),
    },
    {
      Icon: Accessibility,
      text: (
        <>
          Dreistöckige Etagenbetten — nicht empfohlen für Gäste <strong>über 50</strong> oder mit
          eingeschränkter Mobilität
        </>
      ),
    },
  ],
  fr: [
    {
      Icon: KeyRound,
      text: (
        <>
          Arrivée : <strong>14h à 22h</strong> — arrivée plus tôt ? Réservez aussi la nuit
          précédente
        </>
      ),
    },
    {
      Icon: DoorOpen,
      text: (
        <>
          Départ : avant <strong>12h</strong> — besoin de plus de temps ? Réservez une nuit
          supplémentaire
        </>
      ),
    },
    {
      Icon: FileText,
      text: (
        <>
          {'L\'envoi d\'une photo de pièce d\'identité est'} <strong>obligatoire</strong>{', sans exception'}
        </>
      ),
    },
    { Icon: CigaretteOff, text: <>Interdiction de fumer dans le hostel et les espaces communs</> },
    {
      Icon: Ban,
      text: (
        <>
          Réservé aux personnes de <strong>18 ans et plus</strong>
        </>
      ),
    },
    {
      Icon: Accessibility,
      text: (
        <>
          Lits superposés à trois niveaux — déconseillés aux personnes de{' '}
          <strong>plus de 50 ans</strong> ou à mobilité réduite
        </>
      ),
    },
  ],
  it: [
    {
      Icon: KeyRound,
      text: (
        <>
          Check-in: <strong>dalle 14 alle 22</strong> — arrivo anticipato? Prenota anche la notte
          precedente
        </>
      ),
    },
    {
      Icon: DoorOpen,
      text: (
        <>
          Check-out: entro le <strong>12</strong> — hai bisogno di più tempo? Prenota una notte in
          più
        </>
      ),
    },
    {
      Icon: FileText,
      text: (
        <>
          {'L\'invio della foto del documento è'} <strong>obbligatorio</strong>{', senza eccezioni'}
        </>
      ),
    },
    { Icon: CigaretteOff, text: <>{'Vietato fumare nell\'hostel e nelle aree comuni'}</> },
    {
      Icon: Ban,
      text: (
        <>
          Solo per ospiti <strong>maggiorenni (18+)</strong>
        </>
      ),
    },
    {
      Icon: Accessibility,
      text: (
        <>
          Letti a castello a tre livelli — sconsigliati per ospiti <strong>over 50</strong> o con
          mobilità ridotta
        </>
      ),
    },
  ],
};
const INFO_TITLE: Record<string, string> = {
  pt: 'INFORMAÇÃO IMPORTANTE',
  es: 'INFORMACIÓN IMPORTANTE',
  en: 'IMPORTANT INFORMATION',
  de: 'WICHTIGE INFORMATION',
  fr: 'INFORMATION IMPORTANTE',
  it: 'INFORMAZIONE IMPORTANTE',
};

interface HostelInfoBannerProps {
  lang: Lang;
}

export function HostelInfoBanner({ lang }: HostelInfoBannerProps) {
  return (
    <div className="he-info-box">
      <div className="he-info-title">
        <AlertTriangle size={13} aria-hidden />
        {INFO_TITLE[lang]}
      </div>
      <div className="he-info-grid">
        {(INFO_RULES[lang] ?? []).map(({ Icon, text }, i) => (
          <div key={i} className="he-info-item">
            <Icon size={14} aria-hidden />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
