// ============================================================
// EUROTRIPS — busLayoutTemplates.ts
// Схеми розсадки туристичного автобуса (OPS-03).
//
// МОДЕЛЬ САЛОНУ: усі туристичні автобуси — компоновка 2+2
// (2 крісла · прохід · 2 крісла). Кожен ряд — це ФІКСОВАНА сітка з
// 5 колонок [0,1, прохід=2, 3,4]. Завдяки цьому будь-який ряд —
// звичайний 2+2, задня суцільна лавка на 5, чи частковий останній
// ряд — завжди вирівняний по ширині (немає "з'їжджання" рядів).
//
// Задня лавка на 5 місць заповнює й колонку-прохід (ззаду проходу
// немає) — тому вона рівно на всю ширину салону.
//
// Реальний парк (див. Carriers.tsx / 1С "Транспортні засоби") має
// десятки моделей; замість опису кожної — набір типових КОНФІГУРАЦІЙ,
// що генеруються під точну кількість місць автобуса. Ops обирає ту,
// що відповідає фактичній моделі.
// ============================================================

export type BusCellKind = 'seat' | 'aisle' | 'empty' | 'wc' | 'table' | 'guide' | 'driver' | 'stairs';

export interface BusCell {
  kind: BusCellKind;
  seatNumber?: number;
}

/** Ряд салону — завжди рівно 5 колонок; індекс 2 — прохід. */
export type BusGridRow = BusCell[];

export interface BusDeck {
  /** Підпис поверху для двоповерхових ("1 поверх" / "2 поверх") */
  label?: string;
  rows: BusGridRow[];
}

export interface BusLayoutResult {
  totalSeats: number;
  decks: BusDeck[];
}

export type BusLayoutFamilyKey =
  | 'standard'
  | 'rear-bench'
  | 'rear-wc'
  | 'salon-table'
  | 'guide-front'
  | 'double-decker';

export interface BusLayoutFamilyMeta {
  key: BusLayoutFamilyKey;
  label: string;
  description: string;
  /** Орієнтовний діапазон місткості, для якого конфігурація типова */
  typicalRange: [number, number];
}

export const BUS_LAYOUT_FAMILIES: BusLayoutFamilyMeta[] = [
  {
    key: 'standard',
    label: '2+2 стандарт',
    description: 'Рівні ряди 2+2 з проходом посередині; останній ряд — теж 2+2 (частковий, якщо місць не кратно 4)',
    typicalRange: [40, 64],
  },
  {
    key: 'rear-bench',
    label: '2+2 + задня лавка',
    description: 'Класичний автокар: ряди 2+2, останній ряд — суцільна лавка на 5 місць на всю ширину',
    typicalRange: [45, 65],
  },
  {
    key: 'rear-wc',
    label: '2+2 + туалет',
    description: 'Ряди 2+2 + задня лавка з туалетом/кухнею в кутку (WC замість крайнього місця)',
    typicalRange: [44, 60],
  },
  {
    key: 'salon-table',
    label: '2+2 зі столиком',
    description: 'Ряди 2+2 + переговорна зона: 4+4 місця обличчям один до одного зі столиком',
    typicalRange: [44, 60],
  },
  {
    key: 'guide-front',
    label: '2+2 + місце гіда',
    description: 'Ряди 2+2 + окреме переднє місце гіда/супроводу біля водія ("+1")',
    typicalRange: [40, 60],
  },
  {
    key: 'double-decker',
    label: 'Двоповерховий',
    description: 'Два салони 2+2 (нижній + верхній) — для великих 65–80-місних автобусів',
    typicalRange: [65, 80],
  },
];

const KNOWN_KEYS = new Set<string>(BUS_LAYOUT_FAMILIES.map((f) => f.key));

/** Чи дійсний ключ конфігурації (для валідації збереженого вибору). */
export function isBusLayoutFamily(key: string): key is BusLayoutFamilyKey {
  return KNOWN_KEYS.has(key);
}

// ─── КОНСТРУКТОРИ КОМІРОК ─────────────────────────────────────

const AISLE_COL = 2;
const seat = (n: number): BusCell => ({ kind: 'seat', seatNumber: n });
const empty = (): BusCell => ({ kind: 'empty' });
const aisle = (): BusCell => ({ kind: 'aisle' });
const blankRow = (): BusGridRow => [empty(), empty(), aisle(), empty(), empty()];

/** Один ряд 2+2 (count = 1..4 місць), заповнення зліва: кол.0,1 → прохід → кол.3,4. */
function row2plus2(start: number, count: number): { row: BusGridRow; next: number } {
  const row = blankRow();
  const order = [0, 1, 3, 4];
  for (let i = 0; i < count; i++) row[order[i]] = seat(start + i);
  return { row, next: start + count };
}

/** Суцільна лавка: `size` місць підряд від колонки 0 (заповнює й прохід, якщо size>2). */
function rowBench(start: number, size: number): { row: BusGridRow; next: number } {
  const row = blankRow();
  for (let i = 0; i < size && i < 5; i++) row[i] = seat(start + i);
  return { row, next: start + size };
}

/** Заповнює `n` місць рядами 2+2 (останній ряд частковий, якщо треба). */
function fill2plus2(n: number, start: number): { rows: BusGridRow[]; next: number } {
  const rows: BusGridRow[] = [];
  let num = start;
  let left = n;
  while (left >= 4) {
    const r = row2plus2(num, 4);
    rows.push(r.row);
    num = r.next;
    left -= 4;
  }
  if (left > 0) {
    const r = row2plus2(num, left);
    rows.push(r.row);
    num = r.next;
  }
  return { rows, next: num };
}

// ─── ГЕНЕРАТОРИ КОНФІГУРАЦІЙ ──────────────────────────────────

function buildStandard(n: number): BusDeck[] {
  return [{ rows: fill2plus2(n, 1).rows }];
}

function buildRearBench(n: number, startNum = 1): BusGridRow[] {
  if (n <= 5) return [rowBench(startNum, n).row];
  const front = fill2plus2(n - 5, startNum);
  return [...front.rows, rowBench(front.next, 5).row];
}

function buildRearWc(n: number): BusDeck[] {
  if (n <= 4) return [{ rows: [...fill2plus2(n, 1).rows, [empty(), empty(), aisle(), empty(), { kind: 'wc' }]] }];
  // Задня лавка на 4 + туалет у крайній колонці
  const front = fill2plus2(n - 4, 1);
  const bStart = front.next;
  const backRow: BusGridRow = [seat(bStart), seat(bStart + 1), seat(bStart + 2), seat(bStart + 3), { kind: 'wc' }];
  return [{ rows: [...front.rows, backRow] }];
}

function buildSalonTable(n: number): BusDeck[] {
  if (n < 8) return buildStandard(n);
  // Переговорна зона: 4 місця + столик + 4 місця обличчям
  const front = fill2plus2(n - 8, 1);
  const s1 = row2plus2(front.next, 4);
  const tableRow: BusGridRow = [empty(), { kind: 'table' }, { kind: 'table' }, { kind: 'table' }, empty()];
  const s2 = row2plus2(s1.next, 4);
  return [{ rows: [...front.rows, s1.row, tableRow, s2.row] }];
}

function buildGuideFront(n: number): BusDeck[] {
  const guideRow: BusGridRow = [{ kind: 'guide' }, empty(), aisle(), empty(), { kind: 'driver' }];
  return [{ rows: [guideRow, ...fill2plus2(n, 1).rows] }];
}

function buildDoubleDecker(n: number): BusDeck[] {
  const upper = n > 70 ? 16 : 8;
  const lower = n - upper;
  const lowerRows = buildRearBench(lower, 1);
  const upperFill = fill2plus2(upper, lower + 1);
  const stairsRow: BusGridRow = [{ kind: 'stairs' }, empty(), aisle(), empty(), empty()];
  return [
    { label: '1 поверх', rows: lowerRows },
    { label: '2 поверх', rows: [stairsRow, ...upperFill.rows] },
  ];
}

const BUILDERS: Record<BusLayoutFamilyKey, (n: number) => BusDeck[]> = {
  standard: buildStandard,
  'rear-bench': (n) => [{ rows: buildRearBench(n, 1) }],
  'rear-wc': buildRearWc,
  'salon-table': buildSalonTable,
  'guide-front': buildGuideFront,
  'double-decker': buildDoubleDecker,
};

/** Генерує схему салону під конфігурацію та фактичну кількість місць автобуса. */
export function generateBusLayout(totalSeats: number, family: BusLayoutFamilyKey): BusLayoutResult {
  const build = BUILDERS[family] ?? buildStandard;
  return { totalSeats, decks: build(totalSeats) };
}

/** Евристика вибору конфігурації за замовч. з кількості місць (ops завжди може змінити). */
export function suggestBusLayoutFamily(totalSeats: number): BusLayoutFamilyKey {
  if (totalSeats >= 66) return 'double-decker';
  if ((totalSeats - 5) % 4 === 0) return 'rear-bench'; // 49, 53, 57, 61…
  return 'standard';
}

export { AISLE_COL };
