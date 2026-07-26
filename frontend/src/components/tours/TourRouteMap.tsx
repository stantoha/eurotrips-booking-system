// ============================================================
// EUROTRIPS — TourRouteMap Component
// Карта маршруту туру (React Leaflet). Підключається на вкладці
// "Інфо" сторінки TourDetail.tsx — показується одразу при відкритті
// картки туру. Дані маршруту: data/tourRoutes.ts (зіставлення за
// tour.name) + data/geoCoordinates.ts (статичний словник координат).
//
// "/" у маршруті — прикордонний перехід/транзит без власних
// координат: на карті не малюється, але лишається в текстовому
// переліку зупинок як окремий пункт.
// ============================================================

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Milestone } from 'lucide-react';
import { getCoordinates, type LatLng } from '../../data/geoCoordinates';

export interface TourRouteMapProps {
  /** Впорядкований список пунктів маршруту, напр. з TourRoute.waypoints ('/' = кордон/транзит) */
  waypoints: string[];
  className?: string;
  /** Висота карти в px (за замовчуванням компактна — під вкладку "Інфо") */
  height?: number;
}

interface ResolvedStop {
  index: number;
  name: string;
  position: LatLng;
}

// ─── HELPERS ─────────────────────────────────────────────────

/** Кастомна кругла мітка з номером зупинки — без залежності від дефолтних PNG-іконок Leaflet. */
function stopIcon(order: number, kind: 'start' | 'end' | 'mid'): L.DivIcon {
  const palette = kind === 'mid'
    ? 'bg-white border-brand-cyan text-brand-cyan-dark dark:bg-slate-800'
    : 'bg-brand-red border-brand-red text-white';
  return L.divIcon({
    className: '',
    html: `<div class="${palette}" style="
      width:22px;height:22px;border-radius:9999px;border:2px solid;
      display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.3);
      ${kind === 'mid' ? 'color:#0891b2;border-color:#0891b2;' : 'color:#fff;background:#dc2626;border-color:#dc2626;'}
    ">${order}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Підганяє межі карти під усі точки маршруту при монтуванні/зміні маршруту. */
const FitToRoute: React.FC<{ positions: LatLng[] }> = ({ positions }) => {
  const map = useMap();
  React.useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 6);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [24, 24], maxZoom: 8 });
  }, [map, positions]);
  return null;
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

export const TourRouteMap: React.FC<TourRouteMapProps> = ({ waypoints, className = '', height = 260 }) => {
  const stops = useMemo<ResolvedStop[]>(() => {
    const resolved: ResolvedStop[] = [];
    waypoints.forEach((name, index) => {
      if (name === '/') return;
      const position = getCoordinates(name);
      if (!position) return;
      // Пропускаємо послідовний дубль тієї самої точки (напр. Неаполь як хаб між екскурсіями)
      const prev = resolved[resolved.length - 1];
      if (prev && prev.position[0] === position[0] && prev.position[1] === position[1]) return;
      resolved.push({ index, name, position });
    });
    return resolved;
  }, [waypoints]);

  const positions = useMemo(() => stops.map((s) => s.position), [stops]);
  const unresolvedCount = waypoints.filter((w) => w !== '/').length - stops.length;

  if (stops.length < 2) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center ${className}`}>
        <MapPin size={20} className="mx-auto text-slate-300 mb-2" aria-hidden="true" />
        <p className="text-xs text-slate-400">Недостатньо даних для побудови карти маршруту</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ height }}
      >
        <MapContainer
          center={positions[0]}
          zoom={5}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline
            positions={positions}
            pathOptions={{ color: '#0891b2', weight: 3, dashArray: '6 6', opacity: 0.85 }}
          />
          {stops.map((stop, i) => (
            <Marker
              key={`${stop.index}-${stop.name}`}
              position={stop.position}
              icon={stopIcon(i + 1, i === 0 || i === stops.length - 1 ? (i === 0 ? 'start' : 'end') : 'mid')}
            >
              <Tooltip direction="top" offset={[0, -10]}>{stop.name}</Tooltip>
            </Marker>
          ))}
          <FitToRoute positions={positions} />
        </MapContainer>
      </div>

      {/* Текстовий перелік зупинок — включно з "/" (кордон/транзит), яких немає на карті */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
        {waypoints.map((w, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300 dark:text-slate-600">→</span>}
            {w === '/' ? (
              <span className="flex items-center gap-0.5 text-slate-400" title="Прикордонний перехід / транзит">
                <Milestone size={11} aria-hidden="true" />
              </span>
            ) : (
              <span className={!getCoordinates(w) ? 'italic text-slate-400' : undefined}>{w}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      {unresolvedCount > 0 && (
        <p className="text-[11px] text-slate-400 mt-1">
          {unresolvedCount} {unresolvedCount === 1 ? 'пункт' : 'пункти'} без координат — не показано на карті
        </p>
      )}
    </div>
  );
};

export default TourRouteMap;
