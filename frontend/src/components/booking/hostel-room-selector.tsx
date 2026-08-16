'use client';
// frontend/src/components/booking/hostel-room-selector.tsx
// Step 2 — Selección de cuartos con reveal progresivo y descuento de grupo.
// Componente puro de presentación: toda la lógica de estado queda en el orquestador.

import React from 'react';
import { Lang, RoomDef, T } from './hostel-engine.types';
import { groupDisc } from './hostel-engine.utils';

// ─── Props ────────────────────────────────────────────────
interface HostelRoomSelectorProps {
  lang: Lang;
  /** Cuartos ya filtrados (visibleRooms del orquestador) */
  rooms: RoomDef[];
  beds: Record<string, number>;
  revealed: { cuarto3: boolean; cuarto5: boolean };
  season: { mult: number; label: string; minNights: number };
  totalBeds: number;
  onChangeBeds: (id: string, delta: number) => void;
}

// ─── Component ────────────────────────────────────────────
export function HostelRoomSelector({
  lang, rooms, beds, revealed, season, totalBeds, onChangeBeds,
}: HostelRoomSelectorProps) {
  const t = T[lang];
  const disc = groupDisc(totalBeds);

  return (
    <div className="he-panel">
      <div className="he-panel-title">{t.p2title}</div>
      <div className="he-panel-sub">{t.p2sub}</div>

      <div className="he-rooms">
        {rooms.map(r => {
          const cnt = beds[r.id] ?? 0;
          const pbn = (r.price * season.mult).toFixed(2).replace('.', ',');

          const plusDisabled =
            r.id === 'cuarto1' ? (cnt >= r.available && revealed.cuarto3) :
            r.id === 'cuarto4' ? (cnt >= r.available && revealed.cuarto5) :
            cnt >= r.available;

          return (
            <div key={r.id} className={`he-room${cnt > 0 ? ' has-beds' : ''}`}>
              <div className={`he-stripe ${r.type === 'female' ? 'he-stripe-female' : 'he-stripe-mixed'}`} />
              <div className="he-ri">
                <div className="he-rn">{r.name}</div>
                <div className="he-rm">
                  <span className={`he-rbadge ${r.type === 'female' ? 'he-rbadge-f' : 'he-rbadge-m'}`}>
                    {r.id === 'cuarto6' ? 'Solo Mujeres' : r.type === 'female' ? 'Feminino' : 'Misto'}
                  </span>
                  <span className="he-ravail">{r.available} de {r.capacity} disp.</span>
                </div>
                <div className="he-rprice">R$ <strong>{pbn}</strong>/cama/noite</div>
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
          );
        })}
      </div>

      {/* Aviso cuarto flexible (Solo Mujeres) */}
      {(beds['cuarto6'] ?? 0) > 0 && (
        <div className="he-flex-notice">{t.flexibleNotice}</div>
      )}

      {/* Strip de descuento de grupo */}
      {totalBeds > 0 && disc > 0 && (
        <div className="he-disc-strip">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {disc * 100}% {t.discountActive} — {totalBeds} {t.tBeds}
        </div>
      )}
    </div>
  );
}
