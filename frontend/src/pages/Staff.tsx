// ============================================================
// EUROTRIPS — pages/Staff.tsx
// Маршрут: /staff   Ролі: admin, product_manager
// Персонал: турлідери, гіди, водії, координатори (CRUD)
// ============================================================

import React, { useState } from 'react';
import { Plus, Search, X, Phone, Mail, UserX } from 'lucide-react';
import {
  useStaffList, useCreateStaff, usePatchStaff, useDeactivateStaff,
  type Staff, type StaffRole, type StaffPayload,
} from '../hooks/useStaff';

const ROLE_LABELS: Record<StaffRole, string> = {
  tour_leader: 'Турлідер',
  guide: 'Гід',
  driver: 'Водій',
  coordinator: 'Координатор',
};

const ROLE_OPTIONS: StaffRole[] = ['tour_leader', 'guide', 'driver', 'coordinator'];

// ─── STAFF FORM MODAL ───────────────────────────────────────────

const StaffFormModal: React.FC<{
  staff: Staff | null;
  onClose: () => void;
}> = ({ staff, onClose }) => {
  const isEdit = !!staff;
  const createStaff = useCreateStaff();
  const patchStaff = usePatchStaff();

  const [firstName, setFirstName] = useState(staff?.first_name ?? '');
  const [lastName, setLastName] = useState(staff?.last_name ?? '');
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'driver');
  const [phone, setPhone] = useState(staff?.phone ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const isSaving = createStaff.isPending || patchStaff.isPending;

  const handleSave = async () => {
    setError(null);
    const payload: StaffPayload = {
      firstName, lastName, role,
      phone: phone || undefined,
      email: email || undefined,
    };
    try {
      if (isEdit) {
        await patchStaff.mutateAsync({ id: staff.id, payload });
      } else {
        await createStaff.mutateAsync(payload);
      }
      onClose();
    } catch {
      setError('Не вдалося зберегти. Перевірте дані.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">
            {isEdit ? 'Редагувати співробітника' : 'Новий співробітник'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ім'я"
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Прізвище"
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380XXXXXXXXX"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !firstName || !lastName}
            className="px-4 py-2 text-sm rounded-pill font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Збереження…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const StaffPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [roleF, setRoleF] = useState<StaffRole | 'all'>('all');
  const [modalStaff, setModalStaff] = useState<Staff | 'new' | null>(null);

  const { data, isLoading, isError } = useStaffList({
    search: search || undefined,
    role: roleF === 'all' ? undefined : roleF,
  });
  const deactivateStaff = useDeactivateStaff();

  const staff = data?.data ?? [];

  const handleDeactivate = async (s: Staff) => {
    if (!window.confirm(`Деактивувати ${s.first_name} ${s.last_name}?`)) return;
    await deactivateStaff.mutateAsync(s.id);
  };

  const selClass = 'px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer';

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">Персонал</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isLoading ? 'Завантаження…' : `${staff.length} співробітників`}
          </p>
        </div>
        <button
          onClick={() => setModalStaff('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
        >
          <Plus size={14} aria-hidden="true" /> Додати
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за іменем..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={roleF} onChange={(e) => setRoleF(e.target.value as StaffRole | 'all')} className={selClass}>
          <option value="all">Всі ролі</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-brand-cyan">
          <div className="h-8 w-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mr-3" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Завантаження…</span>
        </div>
      )}

      {isError && !isLoading && (
        <p className="text-sm text-brand-red py-8 text-center">Не вдалося завантажити персонал.</p>
      )}

      {!isLoading && !isError && (
        staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <p className="text-sm">Персоналу не знайдено.</p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => setModalStaff(s)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {s.first_name} {s.last_name}
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      {ROLE_LABELS[s.role]}
                    </span>
                    {s.status === 'inactive' && (
                      <span className="text-xs text-slate-400">неактивний</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
                    {s.phone && <span className="flex items-center gap-1"><Phone size={11} />{s.phone}</span>}
                    {s.email && <span className="flex items-center gap-1"><Mail size={11} />{s.email}</span>}
                  </p>
                </div>
                {s.status !== 'inactive' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeactivate(s); }}
                    aria-label="Деактивувати"
                    className="p-1.5 text-slate-400 hover:text-brand-red transition-colors"
                  >
                    <UserX size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {modalStaff && (
        <StaffFormModal
          staff={modalStaff === 'new' ? null : modalStaff}
          onClose={() => setModalStaff(null)}
        />
      )}
    </div>
  );
};

export default StaffPage;
