'use client';
// frontend/src/components/booking/hostel-room-selector.tsx
// Step 2 — Selección de cuartos con reveal progresivo y descuento de grupo.
// Componente puro de presentación: toda la lógica de estado queda en el orquestador.

import React from 'react';
import type { BookingLocale } from '@/types/global';
import { type RoomDef, OVERFLOW_PAIRS, T } from './hostel-engine.types';
import { HostelPhotoGallery } from './hostel-photo-gallery';

// ─── Props ────────────────────────────────────────────────
interface HostelRoomSelectorProps {
  lang: BookingLocale;
  /** Cuartos ya filtrados (visibleRooms del orquestador) */
  rooms: RoomDef[];
  beds: Record<string, number>;
  revealed: Record<string, boolean>;
  onChangeBeds: (id: string, delta: number) => void;
}

// ─── Component ────────────────────────────────────────────
export function HostelRoomSelector({
  lang, rooms, beds, revealed, onChangeBeds,
}: HostelRoomSelectorProps) {
  const t = T[lang];

  return (
    <div className="he-panel">
      <div className="he-panel-title">{t.p2title}</div>
      <div className="he-panel-sub">{t.p2sub}</div>

      <HostelPhotoGallery lang={lang} />

      <div className="he-rooms">
        {rooms.map(r => {
          const cnt = beds[r.id] ?? 0;
          const pbn = r.price.toFixed(2).replace('.', ',');

          const overflowId = r.id === 'cuarto1' ? 'cuarto3' : r.id === 'cuarto4' ? 'cuarto5' : null;
          // !r.realId: la API de disponibilidad no devolvió esta habitación para
          // las fechas elegidas (código renombrado/borrado, anomalía de datos) --
          // sin esto el usuario podía seguir sumando camas a un cuarto que nunca
          // va a poder cotizarse ni reservarse, y quedar trabado en el paso 4.
          const plusDisabled = !r.realId || (overflowId
            ? (cnt >= r.available && !!revealed[overflowId])
            : cnt >= r.available);

          const overflowPair = OVERFLOW_PAIRS.find((p) => p.overflow === r.id);
          const primaryRoom = overflowPair ? rooms.find((pr) => pr.id === overflowPair.primary) : null;
          const showOverflowNotice = !!(primaryRoom && revealed[r.id]);

          return (
            <React.Fragment key={r.id}>
              {showOverflowNotice && primaryRoom && (
                <div className="he-overflow-notice">
                  {t.overflowNotice.replace('{primary}', primaryRoom.name).replace('{overflow}', r.name)}
                </div>
              )}
              <div className={`he-room${cnt > 0 ? ' has-beds' : ''}`}>
                <div className={`he-stripe ${r.type === 'female' ? 'he-stripe-female' : 'he-stripe-mixed'}`} />
                <div className="he-ri">
                  <div className="he-rn">{r.name}</div>
                  <div className="he-rm">
                    <span className={`he-rbadge ${r.type === 'female' ? 'he-rbadge-f' : 'he-rbadge-m'}`}>
                      {r.id === 'cuarto6' ? t.roomFemaleOnly : r.type === 'female' ? t.roomFemale : t.roomMixed}
                    </span>
                    <span className="he-ravail">{r.available} {t.roomAvailOf} {r.capacity} {t.roomAvailLabel}</span>
                  </div>
                  <div className="he-rprice">R$ <strong>{pbn}</strong>{t.roomPerBedNight}</div>
                </div>
                <div className="he-stepper">
                  <button
                    className="he-sbtn"
                    onClick={() => onChangeBeds(r.id, -1)}
                    disabled={cnt === 0}
                    aria-label="−"
                  >−</button>
                  <span className="he-scnt">{cnt}</span>
                  <button
                    className="he-sbtn"
                    onClick={() => onChangeBeds(r.id, 1)}
                    disabled={plusDisabled}
                    aria-label="+"
                  >+</button>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Aviso cuarto flexible (Solo Mujeres) */}
      {(beds['cuarto6'] ?? 0) > 0 && (
        <div className="he-flex-notice">{t.flexibleNotice}</div>
      )}
    </div>
  );
}
