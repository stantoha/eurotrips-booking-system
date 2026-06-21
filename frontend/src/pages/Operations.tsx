// ============================================================
// EUROTRIPS — pages/Operations.tsx
// Маршрут: /operations   Ролі: admin, director, manager, ops, accountant
//
// Секції:
//   1. Готелі та розміщення (BR-09 — структура румінгів)
//   2. Транспортні маніфести
//   3. Страховки та документи
//
// TODO: реалізувати сторінку (BR-09..BR-12)
// ============================================================

import React from 'react';

const Operations: React.FC = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">Операційний відділ</h1>
    <p className="text-slate-500">Розділ у розробці. Бізнес-правила: BR-09 (структура румінгів), BR-10 (валідація), BR-11 (BullMQ), BR-12 (самосервіс туристів).</p>
  </div>
);

export default Operations;
