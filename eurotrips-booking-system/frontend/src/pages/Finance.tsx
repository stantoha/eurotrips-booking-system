// ============================================================
// EUROTRIPS — pages/Finance.tsx
// Маршрут: /finance   Ролі: admin, director
//
// Секції:
//   1. Зведений фінансовий звіт (GET /finance/summary)
//   2. Дебіторська заборгованість (GET /finance/debts)
//   3. P&L по тур-продукту (GET /finance/tours/:id/pnl)
//
// TODO: реалізувати сторінку
// ============================================================

import React from 'react';

const Finance: React.FC = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">Фінанси</h1>
    <p className="text-slate-500">Розділ у розробці. API: GET /finance/summary, /finance/debts, /finance/tours/:id/pnl</p>
  </div>
);

export default Finance;
