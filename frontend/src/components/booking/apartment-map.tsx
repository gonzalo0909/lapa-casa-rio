// frontend/src/components/booking/apartment-map.tsx
//
// Mapa de apartamentos — cargado solo en el cliente (Leaflet no soporta SSR).
// Muestra cada apartamento como un pin en el mapa de Río de Janeiro.
// Al hacer clic en un pin el huésped puede seleccionar el apartamento.
// La dirección exacta nunca se expone: solo se muestra la calle sin número.

'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { ApartmentAvailability } from '@/types/global';
import styles from './apartment-engine.module.css';

// Coordenadas aproximadas por barrio — fallback cuando el apartamento
// no tiene lat/lng configurados. Cubren los principales barrios de Río.
const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  'Lapa':           [-22.9122, -43.1791],
  'Cinelândia':     [-22.9082, -43.1764],
  'Centro':         [-22.9028, -43.1731],
  'Santa Teresa':   [-22.9186, -43.1727],
  'Glória':         [-22.9175, -43.1762],
  'Catete':         [-22.9262, -43.1752],
  'Flamengo':       [-22.9285, -43.1754],
  'Botafogo':       [-22.9405, -43.1840],
  'Urca':           [-22.9527, -43.1654],
  'Copacabana':     [-22.9714, -43.1847],
  'Ipanema':        [-22.9838, -43.1990],
  'Leblon':         [-22.9841, -43.2183],
  'Humaitá':        [-22.9478, -43.1882],
  'Laranjeiras':    [-22.9349, -43.1833],
  'Cosme Velho':    [-22.9396, -43.1954],
  'Alto da Boa Vista': [-22.9559, -43.2688],
  'Barra da Tijuca':   [-22.9993, -43.3658],
  'Praça Mauá':     [-22.8975, -43.1776],
  'Saúde':          [-22.8993, -43.1769],
  'Rio de Janeiro': [-22.9068, -43.1729],
};

const RIO_DEFAULT: [number, number] = [-22.9068, -43.1729];

function getCoords(apt: ApartmentAvailability): [number, number] {
  if (apt.lat !== undefined && apt.lng !== undefined) { return [apt.lat, apt.lng]; }
  if (apt.neighborhood) {
    const coords = NEIGHBORHOOD_COORDS[apt.neighborhood];
    if (coords) { return coords; }
  }
  return RIO_DEFAULT;
}

interface ApartmentMapProps {
  apartments: ApartmentAvailability[];
  selectedApartment: ApartmentAvailability | null;
  nights: number;
  onSelect: (apt: ApartmentAvailability) => void;
  locale: string;
}

export default function ApartmentMap({
  apartments,
  selectedApartment,
  nights,
  onSelect,
  locale,
}: ApartmentMapProps) {
  const t = useTranslations('apartments');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const currency = (n: number) =>
    new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(n);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) { return; }

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) { return; }

      // Centro inicial: promedio de coordenadas de los apartamentos
      const allCoords = apartments.map(getCoords);
      const avgLat = allCoords.reduce((s, c) => s + c[0], 0) / (allCoords.length || 1);
      const avgLng = allCoords.reduce((s, c) => s + c[1], 0) / (allCoords.length || 1);

      const map = L.default.map(mapRef.current, {
        center: [avgLat, avgLng],
        zoom: 14,
        scrollWheelZoom: false,
      });

      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      renderMarkers(L.default, map, apartments, selectedApartment);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) { return; }
    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) { return; }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      renderMarkers(L.default, mapInstanceRef.current, apartments, selectedApartment);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartments, selectedApartment]);

  function renderMarkers(L: any, map: any, apts: ApartmentAvailability[], selected: ApartmentAvailability | null) {
    markersRef.current = apts.map((apt) => {
      const [lat, lng] = getCoords(apt);
      const isSelected = selected?.id === apt.id;
      const isUnavail = !apt.available;

      const color = isSelected ? '#2C4A8C' : isUnavail ? '#888' : '#F0B429';
      const size = isSelected ? 38 : 32;

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${color};
          color:#fff;
          border:2.5px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          width:${size}px;height:${size}px;
          box-shadow:0 2px 8px rgba(0,0,0,.28);
          display:flex;align-items:center;justify-content:center;
        "><span style="transform:rotate(45deg);font-size:${isSelected ? 13 : 11}px;font-weight:700;line-height:1;text-align:center;padding:2px">${apt.name.split(' ')[0]}</span></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      });

      const locationLine = apt.street
        ? apt.street
        : apt.neighborhood ?? 'Rio de Janeiro';

      const priceHtml = isUnavail
        ? `<span style="color:#888;font-size:.78rem">${t('mapUnavailable')}</span>`
        : `<span style="color:#F0B429;font-weight:700">${currency(Math.round(apt.priceTotal / (nights || 1)))}<small style="font-weight:400;color:#555">${t('mapPerNight')}</small></span>`;

      const btnHtml = isUnavail
        ? ''
        : `<button id="map-select-${apt.id}" style="
            margin-top:6px;width:100%;padding:6px 0;
            background:#2C4A8C;color:#fff;border:none;border-radius:6px;
            font-size:.82rem;font-weight:700;cursor:pointer
          ">${isSelected ? t('mapSelected') : t('mapSelect')}</button>`;

      const popup = L.popup({ maxWidth: 220, minWidth: 180 }).setContent(`
        <div style="font-family:system-ui,sans-serif;font-size:.88rem;line-height:1.4">
          <strong style="font-size:.95rem;color:#111">${apt.name}</strong><br>
          <span style="color:#555;font-size:.78rem">📍 ${locationLine}</span><br>
          <div style="margin-top:4px">${priceHtml}</div>
          ${btnHtml}
        </div>
      `);

      const marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`map-select-${apt.id}`);
        if (btn) { btn.addEventListener('click', () => onSelect(apt)); }
      });

      return marker;
    });
  }

  return (
    <div className={styles.mapContainer}>
      <div ref={mapRef} className={styles.mapLeaflet} />
      <p className={styles.mapNote}>
        {t('mapNote')}
      </p>
    </div>
  );
}
