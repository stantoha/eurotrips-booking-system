// ============================================================
// EUROTRIPS — pages/errors/NotFound.tsx
// Маршрут: * (будь-який невідомий шлях)
// ============================================================

import React from 'react';
import { Compass } from 'lucide-react';

const NotFoundPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4 text-center">
    <Compass size={40} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
    <div>
      <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">
        Сторінку не знайдено
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        Помилка 404 — перевірте адресу або поверніться на дашборд.
      </p>
    </div>
    <a
      href="/dashboard"
      className="px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
    >
      На дашборд
    </a>
  </div>
);

export default NotFoundPage;
