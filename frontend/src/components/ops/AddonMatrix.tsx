// ============================================================
// EUROTRIPS — AddonMatrix Component (OPS UX C-3)
// Таблиця турист × ДОП з ✅/❌, підрахунок по колонках.
//
// Презентаційний компонент. Реліз 2 (див. Eurotrips_OPS_PM_Part_B):
// backend-модель TouristAddon (М:N турист↔ДОП з ознакою "придбано")
// ще не існує — tour_extras зараз описує лише витрати туру, без
// прив'язки до конкретного туриста. Компонент готовий до підключення,
// коли з'явиться відповідний ендпоінт.
// ============================================================

import React from 'react';
import { Check, X } from 'lucide-react';

export interface AddonMatrixTourist {
  id: string;
  name: string;
}

export interface AddonMatrixAddon {
  id: string;
  label: string;
}

export interface AddonMatrixProps {
  tourists: AddonMatrixTourist[];
  addons: AddonMatrixAddon[];
  /** purchased.has(`${touristId}:${addonId}`) === true → ✅ */
  purchased: Set<string>;
}

export const AddonMatrix: React.FC<AddonMatrixProps> = ({ tourists, addons, purchased }) => {
  if (tourists.length === 0 || addons.length === 0) {
    return <p className="text-sm text-slate-400 py-6">Немає даних для матриці ДОПів.</p>;
  }

  const columnTotal = (addonId: string) =>
    tourists.filter((t) => purchased.has(`${t.id}:${addonId}`)).length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-1.5 pr-3 sticky left-0 bg-white dark:bg-slate-900">Турист</th>
            {addons.map((a) => (
              <th key={a.id} className="py-1.5 px-2 text-center whitespace-nowrap">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tourists.map((t) => (
            <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-1.5 pr-3 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-900">{t.name}</td>
              {addons.map((a) => {
                const has = purchased.has(`${t.id}:${a.id}`);
                return (
                  <td key={a.id} className="py-1.5 px-2 text-center">
                    {has ? (
                      <Check size={14} className="inline text-emerald-600" />
                    ) : (
                      <X size={14} className="inline text-slate-300 dark:text-slate-600" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
            <td className="py-1.5 pr-3 text-xs text-slate-400 sticky left-0 bg-white dark:bg-slate-900">Разом</td>
            {addons.map((a) => (
              <td key={a.id} className="py-1.5 px-2 text-center text-xs text-slate-600 dark:text-slate-300">
                {columnTotal(a.id)}/{tourists.length}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default AddonMatrix;
