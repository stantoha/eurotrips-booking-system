// ============================================================
// EUROTRIPS — busLayoutTemplates.ts
// Схеми розташування місць в автобусі (OPS-03 розсадка).
// Реальний парк перевізників (див. Carriers.tsx / модель Bus) —
// це ~60 різних моделей (Setra, Mercedes, Neoplan, VanHool...) із
// нестандартними задніми рядами, другим поверхом тощо (видно з
// довідника "Транспортні засоби": "49 Setra ВС4693НК", "GrandBus
// VanHool 58", записи з приміткою "2 поверх", "тут водій" і т.д.).
// Замість ручного опису кожної моделі — 4 "сімейства" схем, кожне
// генерує рядки під конкретну кількість місць автобуса. Ops обирає
// сімейство, що відповідає реальній компоновці конкретного авто.
// ============================================================

export type BusSlotKind = 'seat' | 'aisle' | 'gap' | 'driver' | 'door' | 'wc' | 'stairs';

export interface BusSlot {
  kind: BusSlotKind;
  seatNumber?: number;
}

export type BusRow = BusSlot[];

export interface BusLayoutSection {
  /** Підпис секції — напр. "1 поверх" / "2 поверх" (для double-decker) */
  label?: string;
  rows: BusRow[];
}

export interface BusLayoutResult {
  totalSeats: number;
  sections: BusLayoutSection[];
}

export type BusLayoutFamilyKey = 'standard' | 'standard-bench' | 'minivan' | 'double-decker';

export interface BusLayoutFamilyMeta {
  key: BusLayoutFamilyKey;
  label: string;
  description: string;
  /** Орієнтовний діапазон місткості, для якого сімейство типове */
  typicalRange: [number, number];
}

export const BUS_LAYOUT_FAMILIES: BusLayoutFamilyMeta[] = [
  {
    key: 'standard',
    label: 'Стандарт 2+2',
    description: 'Рівні ряди по 2 місця з кожного боку проходу, без виділеного заднього ряду',
    typicalRange: [40, 64],
  },
  {
    key: 'standard-bench',
    label: '2+2 з задньою лавкою',
    description: 'Ряди 2+2, останній ряд — суцільна лавка на всю ширину (типово для "+1" моделей)',
    typicalRange: [45, 65],
  },
  {
    key: 'minivan',
    label: 'Мінівен 2+1',
    description: 'Вузький прохід, ряди по 2 місця зліва + 1 справа — для малих автобусів/мікроавтобусів',
    typicalRange: [16, 35],
  },
  {
    key: 'double-decker',
    label: 'Два поверхи',
    description: 'Основний салон знизу + виділений задній/верхній сектор ("2 поверх") — для великих 65–80-місних автобусів',
    typicalRange: [65, 80],
  },
];

// ─── ROW BUILDERS ────────────────────────────────────────────

function seatRow2plus2(startNumber: number): { row: BusRow; nextNumber: number } {
  const row: BusRow = [
    { kind: 'seat', seatNumber: startNumber },
    { kind: 'seat', seatNumber: startNumber + 1 },
    { kind: 'aisle' },
    { kind: 'seat', seatNumber: startNumber + 2 },
    { kind: 'seat', seatNumber: startNumber + 3 },
  ];
  return { row, nextNumber: startNumber + 4 };
}

function seatRow2plus1(startNumber: number): { row: BusRow; nextNumber: number } {
  const row: BusRow = [
    { kind: 'seat', seatNumber: startNumber },
    { kind: 'seat', seatNumber: startNumber + 1 },
    { kind: 'aisle' },
    { kind: 'seat', seatNumber: startNumber + 2 },
  ];
  return { row, nextNumber: startNumber + 3 };
}

function benchRow(startNumber: number, size: number): { row: BusRow; nextNumber: number } {
  const row: BusRow = Array.from({ length: size }, (_, i) => ({ kind: 'seat' as const, seatNumber: startNumber + i }));
  return { row, nextNumber: startNumber + size };
}

/** Ряд 2+2 з відсутнім одним місцем (напр. вихід/двері) — для нерівного залишку. */
function partialRow(startNumber: number, count: 1 | 2 | 3): { row: BusRow; nextNumber: number } {
  const seats: BusSlot[] = Array.from({ length: count }, (_, i) => ({ kind: 'seat' as const, seatNumber: startNumber + i }));
  const row: BusRow = count >= 3
    ? [seats[0], seats[1], { kind: 'aisle' }, seats[2]]
    : [{ kind: 'gap' }, ...seats, { kind: 'gap' }];
  return { row, nextNumber: startNumber + count };
}

// ─── FAMILY GENERATORS ───────────────────────────────────────

function buildStandard(totalSeats: number): BusLayoutSection[] {
  const rows: BusRow[] = [];
  let n = 1;
  const fullRows = Math.floor(totalSeats / 4);
  const remainder = totalSeats % 4;
  for (let i = 0; i < fullRows; i++) {
    const { row, nextNumber } = seatRow2plus2(n);
    rows.push(row);
    n = nextNumber;
  }
  if (remainder > 0) {
    const { row } = partialRow(n, remainder as 1 | 2 | 3);
    rows.push(row);
  }
  return [{ rows }];
}

function buildStandardBench(totalSeats: number): BusLayoutSection[] {
  // Задня лавка типово 5 місць (рідше 6-7 у великих моделях)
  const benchSize = totalSeats >= 50 ? 5 : Math.max(3, totalSeats % 4 === 0 ? 5 : totalSeats % 4 + 4);
  const fullRowsSeats = Math.max(0, totalSeats - benchSize);
  const fullRows = Math.floor(fullRowsSeats / 4);
  const rows: BusRow[] = [];
  let n = 1;
  for (let i = 0; i < fullRows; i++) {
    const { row, nextNumber } = seatRow2plus2(n);
    rows.push(row);
    n = nextNumber;
  }
  const leftover = totalSeats - (n - 1);
  const { row } = benchRow(n, leftover);
  rows.push(row);
  return [{ rows }];
}

function buildMinivan(totalSeats: number): BusLayoutSection[] {
  const rows: BusRow[] = [];
  let n = 1;
  const fullRows = Math.floor(totalSeats / 3);
  const remainder = totalSeats % 3;
  for (let i = 0; i < fullRows; i++) {
    const { row, nextNumber } = seatRow2plus1(n);
    rows.push(row);
    n = nextNumber;
  }
  if (remainder > 0) {
    const { row } = benchRow(n, remainder);
    rows.push(row);
  }
  return [{ rows }];
}

function buildDoubleDecker(totalSeats: number): BusLayoutSection[] {
  const upperCount = totalSeats > 70 ? 12 : 8;
  const lowerCount = totalSeats - upperCount;
  const lowerSections = buildStandardBench(lowerCount);
  const lowerRows = lowerSections[0].rows;

  const upperRows: BusRow[] = [];
  let n = lowerCount + 1;
  const fullRows = Math.floor(upperCount / 4);
  const remainder = upperCount % 4;
  for (let i = 0; i < fullRows; i++) {
    const { row, nextNumber } = seatRow2plus2(n);
    upperRows.push(row);
    n = nextNumber;
  }
  if (remainder > 0) {
    const { row } = benchRow(n, remainder);
    upperRows.push(row);
  }

  return [
    { label: '1 поверх', rows: lowerRows },
    { label: '2 поверх', rows: [[{ kind: 'stairs' }], ...upperRows] },
  ];
}

/** Генерує схему салону під задане сімейство та фактичну кількість місць автобуса. */
export function generateBusLayout(totalSeats: number, family: BusLayoutFamilyKey): BusLayoutResult {
  const builders: Record<BusLayoutFamilyKey, (n: number) => BusLayoutSection[]> = {
    standard: buildStandard,
    'standard-bench': buildStandardBench,
    minivan: buildMinivan,
    'double-decker': buildDoubleDecker,
  };
  return { totalSeats, sections: builders[family](totalSeats) };
}

/** Евристика вибору сімейства за замовчуванням із кількості місць (ops завжди може змінити вручну). */
export function suggestBusLayoutFamily(totalSeats: number): BusLayoutFamilyKey {
  if (totalSeats >= 66) return 'double-decker';
  if (totalSeats <= 32) return 'minivan';
  return totalSeats % 4 === 0 ? 'standard' : 'standard-bench';
}
