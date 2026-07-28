// ============================================================
// EUROTRIPS — TourRouteMap Component
// Карта маршруту туру (React Leaflet) на вкладці "Інфо" TourDetail.
// Двоколонковий layout: зліва — нумерований перелік зупинок (легенда),
// справа — інтерактивна карта + міні-картка обраного міста.
//
// UX за прототипом "Маршрут туру.dc.html":
//  - endpoint-зупинки (старт/фініш) — рожеві, проміжні — cyan;
//  - клік на зупинку в легенді або на маркер → вибір + підсвітка + картка;
//  - ДОП-екскурсії (RouteExcursion) — золотий пунктир-відросток від хабу;
//  - 🌙 badge ночівель (рендериться лише за наявності даних).
//
// Дані: data/tourRoutes.ts (parseRoute) + data/geoCoordinates.ts.
// Свідомо НЕ переноситься з прототипу: демо-перемикач турів/ролей і
// режим редагування маршруту (немає backend-сховища маршрутів — Tour
// зіставляється зі статичним довідником за назвою).
// ============================================================

import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { parseRoute, type TourRoute, type RouteStop, type ResolvedExcursion } from '../../data/tourRoutes';
import type { LatLng } from '../../data/geoCoordinates';

export interface TourRouteMapProps {
  route: TourRoute;
  className?: string;
  /** Висота карти в px */
  height?: number;
}

type SelectedKey = { kind: 'main' | 'opt'; name: string } | null;

// ─── MARKER ICONS ────────────────────────────────────────────

function mainIcon(order: number, isEndpoint: boolean, isSelected: boolean): L.DivIcon {
  const base = isEndpoint
    ? 'background:#f0366d;border:2px solid #f0366d;color:#fff;'
    : 'background:#fff;border:2px solid #53c7d6;color:#3fb4c3;';
  const ring = isSelected ? 'box-shadow:0 0 0 4px rgba(83,199,214,.35),0 1px 4px rgba(0,0,0,.35);' : 'box-shadow:0 1px 4px rgba(0,0,0,.35);';
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;${base}${ring}">${order}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function excursionIcon(isSelected: boolean): L.DivIcon {
  const ring = isSelected ? 'box-shadow:0 0 0 4px rgba(224,170,16,.3),0 1px 3px rgba(0,0,0,.25);' : 'box-shadow:0 1px 3px rgba(0,0,0,.25);';
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:999px;background:#fff;border:2px dashed #e0aa10;${ring}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// ─── FIT BOUNDS ──────────────────────────────────────────────

const FitToRoute: React.FC<{ positions: LatLng[] }> = ({ positions }) => {
  const map = useMap();
  React.useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) { map.setView(positions[0], 6); return; }
    map.fitBounds(L.latLngBounds(positions), { padding: [28, 28], maxZoom: 8 });
  }, [map, positions]);
  return null;
};

// ─── LEGEND SIDEBAR ──────────────────────────────────────────

const StopRow: React.FC<{
  stop: RouteStop;
  excursions: ResolvedExcursion[];
  selected: SelectedKey;
  onSelectMain: (name: string) => void;
  onSelectOpt: (name: string) => void;
}> = ({ stop, excursions, selected, onSelectMain, onSelectOpt }) => {
  const isSelected = selected?.kind === 'main' && selected.name === stop.name;
  const hubExcursions = excursions.filter((e) => e.hub === stop.name);

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => onSelectMain(stop.name)}
        className={`w-full flex items-center gap-2 px-1 py-1.5 rounded-lg text-left transition-colors ${
          isSelected ? 'bg-brand-cyan/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <span
          className="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold border-2"
          style={
            stop.isEndpoint
              ? { background: '#f0366d', color: '#fff', borderColor: '#f0366d' }
              : { background: 'transparent', color: '#3fb4c3', borderColor: '#53c7d6' }
          }
        >
          {stop.order}
        </span>
        <span className={`flex-1 text-sm font-medium ${stop.coords ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
          {stop.name}
        </span>
        {stop.nights > 0 && (
          <span className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
            🌙 {stop.nights}
          </span>
        )}
      </button>

      {hubExcursions.map((ex) => {
        const optSelected = selected?.kind === 'opt' && selected.name === ex.name;
        return (
          <button
            key={ex.name}
            type="button"
            onClick={() => onSelectOpt(ex.name)}
            className={`w-full flex items-center gap-2 pl-[30px] pr-1 py-1 rounded-lg text-left transition-colors ${
              optSelected ? 'bg-brand-gold/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="shrink-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-dashed" style={{ borderColor: '#e0aa10' }} />
            <span className={`flex-1 text-xs italic ${ex.coords ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>{ex.name}</span>
            <span className="text-[9px] font-bold tracking-wide" style={{ color: '#e0aa10' }}>ДОП</span>
          </button>
        );
      })}
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

export const TourRouteMap: React.FC<TourRouteMapProps> = ({ route, className = '', height = 420 }) => {
  const parsed = useMemo(() => parseRoute(route), [route]);
  const [selected, setSelected] = useState<SelectedKey>(null);

  const mainWithCoords = parsed.main.filter((s) => s.coords) as (RouteStop & { coords: LatLng })[];
  const allPositions = useMemo<LatLng[]>(
    () => [
      ...mainWithCoords.map((s) => s.coords),
      ...parsed.excursions.filter((e) => e.coords).map((e) => e.coords as LatLng),
    ],
    [parsed],
  );

  const selectedInfo = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === 'main') {
      const s = parsed.main.find((m) => m.name === selected.name);
      if (!s) return null;
      return {
        name: s.name,
        isOptional: false,
        subtitle: s.nights > 0
          ? `Ночівля: ${s.nights} ${s.nights === 1 ? 'ніч' : s.nights < 5 ? 'ночі' : 'ночей'}.`
          : 'Проїзна зупинка маршруту.',
      };
    }
    const e = parsed.excursions.find((x) => x.name === selected.name);
    if (!e) return null;
    return {
      name: e.name,
      isOptional: true,
      subtitle: `Додаткова екскурсія від зупинки «${e.hub}» — платна опція (ДОП), пропонується турлідером на місці.`,
    };
  }, [selected, parsed]);

  if (mainWithCoords.length < 2) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center ${className}`}>
        <MapPin size={20} className="mx-auto text-slate-300 mb-2" aria-hidden="true" />
        <p className="text-xs text-slate-400">Недостатньо даних для побудови карти маршруту</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start ${className}`}>
      {/* Легенда — нумерований перелік зупинок */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2.5">
          Маршрут · {parsed.main.length} зупинок
        </p>
        {parsed.main.map((stop) => (
          <StopRow
            key={stop.name + stop.order}
            stop={stop}
            excursions={parsed.excursions}
            selected={selected}
            onSelectMain={(name) => setSelected({ kind: 'main', name })}
            onSelectOpt={(name) => setSelected({ kind: 'opt', name })}
          />
        ))}
        {parsed.unresolvedCount > 0 && (
          <p className="text-[11px] text-slate-400 mt-2">
            {parsed.unresolvedCount} {parsed.unresolvedCount === 1 ? 'пункт' : 'пункти'} без координат — не показано на карті.
          </p>
        )}
      </div>

      {/* Карта + міні-картка обраного міста */}
      <div>
        <div
          className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
          style={{ height }}
        >
          <MapContainer center={mainWithCoords[0].coords} zoom={5} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Основний маршрут — суцільна cyan-лінія */}
            {mainWithCoords.length > 1 && (
              <Polyline positions={mainWithCoords.map((s) => s.coords)} pathOptions={{ color: '#53c7d6', weight: 4, opacity: 0.9 }} />
            )}
            {/* ДОП-екскурсії — золотий пунктир від хабу */}
            {parsed.excursions.map((ex) =>
              ex.coords && ex.hubCoords ? (
                <Polyline
                  key={`spur-${ex.name}`}
                  positions={[ex.hubCoords, ex.coords]}
                  pathOptions={{ color: '#e0aa10', weight: 3, dashArray: '5 7', opacity: 0.85 }}
                />
              ) : null,
            )}
            {/* Маркери основних зупинок */}
            {mainWithCoords.map((s) => (
              <Marker
                key={`m-${s.name}-${s.order}`}
                position={s.coords}
                icon={mainIcon(s.order, s.isEndpoint, selected?.kind === 'main' && selected.name === s.name)}
                eventHandlers={{ click: () => setSelected({ kind: 'main', name: s.name }) }}
              >
                <Tooltip direction="top" offset={[0, -12]}>{s.name}{s.nights > 0 ? ` · 🌙 ${s.nights}` : ''}</Tooltip>
              </Marker>
            ))}
            {/* Маркери ДОП-екскурсій */}
            {parsed.excursions.map((ex) =>
              ex.coords ? (
                <Marker
                  key={`e-${ex.name}`}
                  position={ex.coords}
                  icon={excursionIcon(selected?.kind === 'opt' && selected.name === ex.name)}
                  eventHandlers={{ click: () => setSelected({ kind: 'opt', name: ex.name }) }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>{ex.name} · ДОП екскурсія</Tooltip>
                </Marker>
              ) : null,
            )}
            <FitToRoute positions={allPositions} />
          </MapContainer>
        </div>

        {/* Міні-картка обраного пункту */}
        {selectedInfo && (
          <div className="flex gap-3 mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <div className="shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <MapPin size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-slate-900 dark:text-slate-100 text-[15px]">{selectedInfo.name}</h3>
                {selectedInfo.isOptional && (
                  <span className="text-[9px] font-bold rounded-full px-2 py-0.5 border" style={{ color: '#e0aa10', borderColor: '#e0aa10' }}>
                    ДОП екскурсія
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedInfo.subtitle}</p>
              <button
                onClick={() => setSelected(null)}
                className="mt-1.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Закрити
              </button>
            </div>
          </div>
        )}

        {/* Легенда типів ліній */}
        <div className="flex flex-wrap gap-3.5 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-[3px] rounded" style={{ background: '#53c7d6' }} />основний маршрут
          </span>
          {parsed.excursions.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-[3px] rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#e0aa10 0 4px,transparent 4px 7px)' }} />
              ДОП екскурсія (платна опція)
            </span>
          )}
          <span className="flex items-center gap-1.5">🌙 — ночівля</span>
        </div>
      </div>
    </div>
  );
};

export default TourRouteMap;
