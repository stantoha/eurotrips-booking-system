// ============================================================
// EUROTRIPS — pages/TourNew.tsx
// Маршрут: /tours/new   Ролі: admin, ops, product_manager
// Повна форма створення туру — всі поля CreateTourSchema бекенду:
// основне / дати / комерція / операційне / маркетинг.
// Код туру (§8: [PREFIX][YYMMDD][SEQ]) автогенерується з префікса
// продукту та дати виїзду, лишається редагованим.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Save } from 'lucide-react';
import { useCreateTour } from '../hooks/useTours';
import { useStaffList } from '../hooks/useStaff';
import { useAuth } from '../hooks/useAuth';
import type { TourType } from '../types';

const TOUR_TYPES: { value: TourType; label: string }[] = [
  { value: 'bus', label: 'Автобусний' },
  { value: 'avia', label: 'Авіатур' },
  { value: 'combined', label: 'Комбінований' },
];

/** §8: LP + YYMMDD + SEQ (порядковий рейс — за замовчуванням 01, редагований) */
const genCode = (prefix: string, departureDate: string, seq: string): string => {
  if (!prefix || !departureDate) return '';
  return `${prefix.toUpperCase()}${departureDate.slice(2).replace(/-/g, '')}${seq.padStart(2, '0')}`;
};

/** Дістає message з AppError-відповіді бекенду */
const apiErrMsg = (err: unknown, fallback: string): string => {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
};

const TourNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { canSeeMargin } = useAuth();
  const createTour = useCreateTour();
  const { data: leaders } = useStaffList({ role: 'tour_leader' });

  // ── Основне ──
  const [prefix, setPrefix] = useState('');
  const [seq, setSeq] = useState('01');
  const [codeManual, setCodeManual] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [product, setProduct] = useState('');
  const [direction, setDirection] = useState('');
  const [countries, setCountries] = useState('');
  const [tourType, setTourType] = useState<TourType>('bus');
  const [format, setFormat] = useState('');

  // ── Дати / міста ──
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [departureCity, setDepartureCity] = useState('Львів');
  const [arrivalCity, setArrivalCity] = useState('');

  // ── Комерція ──
  const [basePrice, setBasePrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDeadline, setDepositDeadline] = useState('');
  const [commissionPct, setCommissionPct] = useState('14'); // у %, конвертується в 0.14

  // ── Операційне ──
  const [totalSeats, setTotalSeats] = useState('50');
  const [guideId, setGuideId] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [included, setIncluded] = useState('');
  const [notIncluded, setNotIncluded] = useState('');

  // ── Маркетинг ──
  const [tags, setTags] = useState('');
  const [audience, setAudience] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [isFamily, setIsFamily] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isCorporate, setIsCorporate] = useState(false);
  const [isFirstExperience, setIsFirstExperience] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const code = codeManual ?? genCode(prefix, departureDate, seq);

  // durationDays рахується з дат (включно з днем виїзду й повернення)
  const durationDays = useMemo(() => {
    if (!departureDate || !returnDate) return 0;
    const diff = Math.round((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / 86_400_000);
    return diff >= 0 ? diff + 1 : 0;
  }, [departureDate, returnDate]);

  // Автопідстановка returnDate при виборі дати виїзду (7 днів за замовчуванням)
  useEffect(() => {
    if (departureDate && !returnDate) {
      const d = new Date(departureDate);
      d.setDate(d.getDate() + 6);
      setReturnDate(d.toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureDate]);

  const isValid =
    /^[A-Z]{2,4}\d{8}$/.test(code) && name.length >= 3 && countries.trim() &&
    departureDate && returnDate && durationDays >= 1 &&
    Number(basePrice) > 0 && Number(totalSeats) >= 1 && Number(commissionPct) >= 0;

  const handleSave = async () => {
    setError(null);
    setWarnings([]);
    try {
      const res = await createTour.mutateAsync({
        code,
        name,
        product: product || undefined,
        direction: direction || undefined,
        countries: countries.split(',').map((c) => c.trim()).filter(Boolean),
        tourType,
        format: format || undefined,
        departureDate,
        returnDate,
        durationDays,
        departureCity: departureCity || undefined,
        arrivalCity: arrivalCity || undefined,
        basePrice: Number(basePrice),
        currency,
        depositAmount: depositAmount ? Number(depositAmount) : undefined,
        depositDeadline: depositDeadline || undefined,
        agentCommissionPct: Number(commissionPct) / 100,
        totalSeats: Number(totalSeats),
        guideId: guideId || undefined,
        costPrice: costPrice ? Number(costPrice) : undefined,
        included: included || undefined,
        notIncluded: notIncluded || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        audience: audience || undefined,
        difficulty: difficulty || undefined,
        isFamily, isPremium, isCorporate, isFirstExperience,
      });
      if (res.meta?.warnings?.length) {
        // BR §15: маржинальний ризик — показуємо, але тур створено
        setWarnings(res.meta.warnings);
        setTimeout(() => navigate(`/tours/${res.data.id}`), 2500);
      } else {
        navigate(`/tours/${res.data.id}`);
      }
    } catch (err) {
      setError(apiErrMsg(err, 'Не вдалося створити тур. Перевірте поля.'));
    }
  };

  const inp = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan';
  const lbl = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
  const sectionCls = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5';
  const h2Cls = 'text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/tours')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ArrowLeft size={15} /> До каталогу турів
      </button>

      <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-1">Новий тур</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Створюється зі статусом «Чернетка». Відкрити продажі можна після затвердження структури номерів (BR-09).
      </p>

      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-2 p-3 mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Тур створено, але: {w}
        </div>
      ))}

      <div className="space-y-5">

        {/* ── ОСНОВНЕ ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>Основне</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={lbl}>Назва туру *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Адріатичне море + Доломітові Альпи" className={inp} />
            </div>
            <div>
              <label className={lbl}>Префікс продукту (2–4 літери) *</label>
              <input value={prefix} onChange={(e) => { setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)); setCodeManual(null); }} placeholder="VD" className={inp} />
            </div>
            <div>
              <label className={lbl}>№ рейсу</label>
              <input value={seq} onChange={(e) => { setSeq(e.target.value.replace(/\D/g, '').slice(0, 2)); setCodeManual(null); }} className={inp} />
            </div>
            <div>
              <label className={lbl}>Код туру (§8, редагований)</label>
              <input value={code} onChange={(e) => setCodeManual(e.target.value.toUpperCase())} placeholder="VD26070301" className={`${inp} font-mono`} />
            </div>
            <div>
              <label className={lbl}>Тип туру *</label>
              <select value={tourType} onChange={(e) => setTourType(e.target.value as TourType)} className={inp}>
                {TOUR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Продукт (група виїздів)</label>
              <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Адріатичне море + Доломіти" className={inp} />
            </div>
            <div>
              <label className={lbl}>Напрямок</label>
              <input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Хорватія / Словенія" className={inp} />
            </div>
            <div>
              <label className={lbl}>Країни (через кому) *</label>
              <input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="Хорватія, Словенія, Австрія" className={inp} />
            </div>
            <div>
              <label className={lbl}>Формат</label>
              <input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="автобусний" className={inp} />
            </div>
          </div>
        </section>

        {/* ── ДАТИ / МІСТА ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>Дати та маршрут</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Дата виїзду *</label>
              <input type="date" value={departureDate} onChange={(e) => { setDepartureDate(e.target.value); setCodeManual(null); }} className={inp} />
            </div>
            <div>
              <label className={lbl}>Дата повернення *</label>
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Тривалість</label>
              <input value={durationDays ? `${durationDays} дн.` : '—'} disabled className={`${inp} opacity-60`} />
            </div>
            <div>
              <label className={lbl}>Місто виїзду</label>
              <input value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Місто прибуття</label>
              <input value={arrivalCity} onChange={(e) => setArrivalCity(e.target.value)} placeholder="= місто виїзду" className={inp} />
            </div>
          </div>
        </section>

        {/* ── КОМЕРЦІЯ ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>Комерційні умови</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Базова ціна *</label>
              <input type="number" min="1" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="840" className={inp} />
            </div>
            <div>
              <label className={lbl}>Валюта</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp}>
                <option value="EUR">EUR</option><option value="UAH">UAH</option><option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Комісія агента, % *</label>
              <input type="number" min="0" max="100" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Депозит</label>
              <input type="number" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="20% від ціни" className={inp} />
            </div>
            <div>
              <label className={lbl}>Дедлайн депозиту</label>
              <input type="date" value={depositDeadline} onChange={(e) => setDepositDeadline(e.target.value)} className={inp} />
            </div>
            {canSeeMargin && (
              <div>
                <label className={lbl}>Собівартість (BR-04)</label>
                <input type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="620" className={inp} />
              </div>
            )}
          </div>
        </section>

        {/* ── ОПЕРАЦІЙНЕ ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>Операційне</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Всього місць *</label>
              <input type="number" min="1" max="500" value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Турлідер</label>
              <select value={guideId} onChange={(e) => setGuideId(e.target.value)} className={inp}>
                <option value="">— не призначено —</option>
                {(leaders?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Включено у вартість</label>
              <textarea value={included} onChange={(e) => setIncluded(e.target.value)} rows={2} placeholder="Трансфер, готель 3*, сніданки, страховка, супровід турлідера" className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Не включено</label>
              <textarea value={notIncluded} onChange={(e) => setNotIncluded(e.target.value)} rows={2} placeholder="Особисті витрати, обіди/вечері, в'їзні збори" className={inp} />
            </div>
          </div>
        </section>

        {/* ── МАРКЕТИНГ ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>Маркетинг</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className={lbl}>Теги (через кому)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sea, mountains, summer" className={inp} />
            </div>
            <div>
              <label className={lbl}>Аудиторія</label>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="сім'ї, пари" className={inp} />
            </div>
            <div>
              <label className={lbl}>Складність</label>
              <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="легка" className={inp} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {([
              ['Сімейний', isFamily, setIsFamily],
              ['Преміум', isPremium, setIsPremium],
              ['Корпоративний', isCorporate, setIsCorporate],
              ['Перший досвід', isFirstExperience, setIsFirstExperience],
            ] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
              <label key={label} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="accent-brand-cyan" />
                {label}
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate('/tours')}
            className="px-4 py-2 text-sm rounded-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || createTour.isPending}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-pill font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-40 transition-colors"
          >
            <Save size={14} /> {createTour.isPending ? 'Створення…' : 'Створити тур'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourNewPage;
