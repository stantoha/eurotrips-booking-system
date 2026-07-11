// ============================================================
// EUROTRIPS — pages/Carriers.tsx
// Маршрут: /carriers   Ролі: admin, logist
// Перевізники + автобуси (nested CRUD)
// ============================================================

import React, { useState } from 'react';
import { Plus, Search, X, Phone, Mail, ChevronDown, ChevronRight, Bus as BusIcon } from 'lucide-react';
import {
  useCarriersList, useCreateCarrier, usePatchCarrier, useCreateBus, usePatchBus,
  type Carrier, type CarrierPayload, type BusPayload,
} from '../hooks/useCarriers';

// ─── CARRIER FORM MODAL ─────────────────────────────────────────

const CarrierFormModal: React.FC<{ carrier: Carrier | null; onClose: () => void }> = ({ carrier, onClose }) => {
  const isEdit = !!carrier;
  const createCarrier = useCreateCarrier();
  const patchCarrier = usePatchCarrier();

  const [name, setName] = useState(carrier?.name ?? '');
  const [contactName, setContactName] = useState(carrier?.contact_name ?? '');
  const [phone, setPhone] = useState(carrier?.phone ?? '');
  const [email, setEmail] = useState(carrier?.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const isSaving = createCarrier.isPending || patchCarrier.isPending;

  const handleSave = async () => {
    setError(null);
    const payload: CarrierPayload = {
      name,
      contactName: contactName || undefined,
      phone: phone || undefined,
      email: email || undefined,
    };
    try {
      if (isEdit) {
        await patchCarrier.mutateAsync({ id: carrier.id, payload });
      } else {
        await createCarrier.mutateAsync(payload);
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
            {isEdit ? 'Редагувати перевізника' : 'Новий перевізник'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Назва перевізника"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Контактна особа"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
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
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            Скасувати
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name}
            className="px-4 py-2 text-sm rounded-pill font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Збереження…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── BUS ADD FORM (inline) ──────────────────────────────────────

const BusAddForm: React.FC<{ carrierId: string; onDone: () => void }> = ({ carrierId, onDone }) => {
  const createBus = useCreateBus();
  const [brand, setBrand] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [seatsCount, setSeatsCount] = useState('');

  const handleSave = async () => {
    const payload: BusPayload = { brand, plateNumber, seatsCount: Number(seatsCount) };
    await createBus.mutateAsync({ carrierId, payload });
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <input
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="Марка"
        className="px-2 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-32"
      />
      <input
        value={plateNumber}
        onChange={(e) => setPlateNumber(e.target.value)}
        placeholder="Держ. номер"
        className="px-2 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-28"
      />
      <input
        type="number"
        min="1"
        value={seatsCount}
        onChange={(e) => setSeatsCount(e.target.value)}
        placeholder="Місць"
        className="px-2 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-20"
      />
      <button
        onClick={handleSave}
        disabled={!brand || !plateNumber || !seatsCount || createBus.isPending}
        className="px-3 py-1.5 text-xs rounded-pill font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-40 transition-colors"
      >
        Додати
      </button>
      <button onClick={onDone} className="text-xs text-slate-400 hover:text-slate-600">Скасувати</button>
    </div>
  );
};

// ─── CARRIER ROW (expandable) ───────────────────────────────────

const CarrierRow: React.FC<{ carrier: Carrier; onEdit: () => void }> = ({ carrier, onEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const [showBusForm, setShowBusForm] = useState(false);
  const patchBus = usePatchBus();

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <button onClick={() => setExpanded((v) => !v)} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{carrier.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
            {carrier.contact_name && <span>{carrier.contact_name}</span>}
            {carrier.phone && <span className="flex items-center gap-1"><Phone size={11} />{carrier.phone}</span>}
            {carrier.email && <span className="flex items-center gap-1"><Mail size={11} />{carrier.email}</span>}
          </p>
        </div>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <BusIcon size={13} /> {carrier.buses.length}
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pl-11">
          {carrier.buses.map((bus) => (
            <div key={bus.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-slate-700 dark:text-slate-300">
                {bus.brand} · {bus.plate_number} · {bus.seats_count} місць
              </span>
              {bus.status === 'active' ? (
                <button
                  onClick={() => patchBus.mutate({ id: bus.id, payload: { status: 'inactive' } })}
                  className="text-xs text-brand-red hover:underline"
                >
                  Деактивувати
                </button>
              ) : (
                <span className="text-xs text-slate-400">неактивний</span>
              )}
            </div>
          ))}
          {carrier.buses.length === 0 && (
            <p className="text-xs text-slate-400 py-1">Автобусів ще не додано.</p>
          )}
          {showBusForm ? (
            <BusAddForm carrierId={carrier.id} onDone={() => setShowBusForm(false)} />
          ) : (
            <button onClick={() => setShowBusForm(true)} className="text-xs text-brand-cyan-dark dark:text-brand-cyan hover:underline mt-1">
              + Додати автобус
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

const CarriersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [modalCarrier, setModalCarrier] = useState<Carrier | 'new' | null>(null);

  const { data, isLoading, isError } = useCarriersList({ search: search || undefined });
  const carriers = data?.data ?? [];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">Перевізники</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isLoading ? 'Завантаження…' : `${carriers.length} перевізників`}
          </p>
        </div>
        <button
          onClick={() => setModalCarrier('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
        >
          <Plus size={14} aria-hidden="true" /> Додати
        </button>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук за назвою..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-brand-cyan">
          <div className="h-8 w-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mr-3" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Завантаження…</span>
        </div>
      )}

      {isError && !isLoading && (
        <p className="text-sm text-brand-red py-8 text-center">Не вдалося завантажити перевізників.</p>
      )}

      {!isLoading && !isError && (
        carriers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <p className="text-sm">Перевізників не знайдено.</p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {carriers.map((c) => (
              <CarrierRow key={c.id} carrier={c} onEdit={() => setModalCarrier(c)} />
            ))}
          </div>
        )
      )}

      {modalCarrier && (
        <CarrierFormModal
          carrier={modalCarrier === 'new' ? null : modalCarrier}
          onClose={() => setModalCarrier(null)}
        />
      )}
    </div>
  );
};

export default CarriersPage;
