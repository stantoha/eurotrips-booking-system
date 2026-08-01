// ============================================================
// EUROTRIPS — osrmRouting.ts
// Побудова маршруту по реальних дорогах (як навігація Google Maps)
// через публічний OSRM demo-сервер. Повертає геометрію дороги для
// полілінії + покілометрові відрізки між пунктами.
//
// ⚠️ router.project-osrm.org — публічний demo-сервер (без ключа,
// rate-limited, без SLA). Достатньо для MVP-демо; у проді варто
// підняти власний OSRM або взяти ключ ORS/GraphHopper/Mapbox.
//
// Стратегія: спершу ОДИН багатоточковий запит (дешево). Якщо
// demo-сервер його не тягне (довгі маршрути → NoRoute), падаємо на
// запити ПО ВІДРІЗКАХ (кожна пара точок будується окремо й
// незалежно). Якщо якийсь відрізок недоступний (морський перехід) —
// для нього пряма лінія, решта лишається по дорогах.
// ============================================================

import type { LatLng } from './geoCoordinates';

export interface RoadRoute {
  /** Геометрія дороги [lat,lng] для полілінії */
  geometry: LatLng[];
  /** Відстані (метри) між послідовними вхідними точками; 0 = відрізок не збудовано */
  legDistances: number[];
  /** Сумарна відстань збудованих відрізків, метри */
  totalDistance: number;
  /** Сумарний час у дорозі, секунди */
  totalDuration: number;
  /** true, якщо всі відрізки збудовано дорогами (жодного fallback на пряму) */
  complete: boolean;
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving/';

interface OsrmLeg {
  geometry: LatLng[];
  distance: number;
  duration: number;
}

/** Один запит OSRM (2+ точки). null при будь-якій помилці. */
async function osrmRequest(coords: LatLng[], signal?: AbortSignal): Promise<{ geometry: LatLng[]; legs: { distance: number; duration: number }[]; distance: number; duration: number } | null> {
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(';'); // OSRM: lon,lat
  const url = `${OSRM_BASE}${path}?overview=simplified&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    const route = data.routes[0];
    return {
      geometry: (route.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]] as LatLng),
      legs: (route.legs ?? []).map((l: { distance?: number; duration?: number }) => ({ distance: l.distance ?? 0, duration: l.duration ?? 0 })),
      distance: route.distance ?? 0,
      duration: route.duration ?? 0,
    };
  } catch {
    return null; // мережа / abort
  }
}

/** Зшиває геометрію відрізків, уникаючи дублю спільної точки. */
function stitch(legs: (OsrmLeg | null)[], coords: LatLng[]): RoadRoute {
  const geometry: LatLng[] = [];
  const legDistances: number[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let complete = true;

  legs.forEach((leg, i) => {
    if (leg) {
      const g = geometry.length ? leg.geometry.slice(1) : leg.geometry;
      geometry.push(...g);
      legDistances.push(leg.distance);
      totalDistance += leg.distance;
      totalDuration += leg.duration;
    } else {
      // fallback: пряма між двома точками
      complete = false;
      if (!geometry.length) geometry.push(coords[i]);
      geometry.push(coords[i + 1]);
      legDistances.push(0);
    }
  });

  return { geometry, legDistances, totalDistance, totalDuration, complete };
}

/**
 * Будує автомобільний маршрут через задані точки.
 * Повертає null, лише якщо жоден відрізок не збудовано (повний fallback
 * на прямі лінії робить сам компонент).
 */
export async function fetchRoadRoute(coords: LatLng[], signal?: AbortSignal): Promise<RoadRoute | null> {
  if (coords.length < 2) return null;

  // 1) Спроба одним запитом (дешево для коротких маршрутів)
  const single = await osrmRequest(coords, signal);
  if (single && single.legs.length === coords.length - 1) {
    return {
      geometry: single.geometry,
      legDistances: single.legs.map((l) => l.distance),
      totalDistance: single.distance,
      totalDuration: single.duration,
      complete: true,
    };
  }
  if (signal?.aborted) return null;

  // 2) Fallback: по відрізках, паралельно
  const pairs: [LatLng, LatLng][] = [];
  for (let i = 0; i < coords.length - 1; i++) pairs.push([coords[i], coords[i + 1]]);

  const legs = await Promise.all(
    pairs.map(async ([a, b]): Promise<OsrmLeg | null> => {
      const r = await osrmRequest([a, b], signal);
      if (!r) return null;
      return { geometry: r.geometry, distance: r.distance, duration: r.duration };
    }),
  );
  if (signal?.aborted) return null;

  if (legs.every((l) => l === null)) return null; // нічого не збудовано → повний fallback у компоненті
  return stitch(legs, coords);
}

export function formatKm(meters: number): string {
  return `${Math.round(meters / 1000).toLocaleString('uk-UA')} км`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} хв`;
  return m === 0 ? `${h} год` : `${h} год ${m} хв`;
}
