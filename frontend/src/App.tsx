// ============================================================
// EUROTRIPS — App.tsx
// Точка входу. Ініціалізація auth + маршрутизація.
// ============================================================

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import type { UserRole } from './types';

// ─── LAZY PAGES ───────────────────────────────────────────────
// Завантажуємо сторінки ліниво для кращої продуктивності

const Dashboard       = React.lazy(() => import('./pages/Dashboard'));
const ToursPage       = React.lazy(() => import('./pages/Tours'));
const TourDetail      = React.lazy(() => import('./pages/TourDetail'));
const BookingsPage    = React.lazy(() => import('./pages/Bookings'));
const BookingNew      = React.lazy(() => import('./pages/BookingNew'));
const BookingDetail   = React.lazy(() => import('./pages/BookingDetail'));
const LeadsList       = React.lazy(() => import('./pages/LeadsList'));
const AgentCabinet    = React.lazy(() => import('./pages/agent/AgentCabinet'));
const MyBooking       = React.lazy(() => import('./pages/my/MyBooking'));
const MyPreferences   = React.lazy(() => import('./pages/my/MyPreferences'));
const FinancePage     = React.lazy(() => import('./pages/Finance'));
const OperationsPage  = React.lazy(() => import('./pages/Operations'));
const StaffPage       = React.lazy(() => import('./pages/Staff'));
const CarriersPage    = React.lazy(() => import('./pages/Carriers'));
const AnalyticsPage   = React.lazy(() => import('./pages/Analytics'));
const TourNewPage     = React.lazy(() => import('./pages/TourNew'));
const NotFoundPage    = React.lazy(() => import('./pages/errors/NotFound'));

// Wrapper — дістає :id з URL та передає пропсами в BookingDetail
const BookingDetailRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <Navigate to="/bookings" replace />;
  return (
    <React.Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" /></div>}>
      <BookingDetail bookingId={id} onBack={() => navigate('/bookings')} />
    </React.Suspense>
  );
};

// ─── LOGIN PAGE ───────────────────────────────────────────────

// Дефолтна "домашня" сторінка після логіну — залежить від ролі,
// бо не всі ролі мають доступ до /dashboard (agent → ForbiddenScreen).
const roleHome = (role?: UserRole): string => {
  if (role === 'agent') return '/agent';
  if (role === 'tourist') return '/my/booking';
  if (role === 'product_manager') return '/tours';
  if (role === 'logist') return '/operations';
  return '/dashboard';
};

const LoginPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Куди повернутись після логіну — сторінка, з якої ProtectedRoute
  // скинув неавторизованого користувача (state.from), інакше — домівка ролі
  const explicitFrom = (location.state as { from?: string } | null)?.from;

  if (isAuthenticated) {
    return <Navigate to={explicitFrom ?? roleHome(user?.role)} replace />;
  }

  const handleSuccess = () => {
    // Читаємо роль напряму зі store — signIn() щойно оновив її,
    // а замикання цього рендеру могло лишитись зі старим user=null
    const role = useAuthStore.getState().user?.role;
    navigate(explicitFrom ?? roleHome(role), { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <LoginForm onSuccess={handleSuccess} />
    </div>
  );
};

// ─── ROOT REDIRECT ────────────────────────────────────────────
// "/" мав жорсткий редірект на /dashboard незалежно від ролі — агент чи
// турист побачили б ForbiddenScreen там. Ведемо на домівку конкретної ролі.

const RootRedirect: React.FC = () => {
  const { user, isInitialized, isLoading } = useAuth();
  // Чекаємо на перевірку Cookie — інакше роль ще не відома і редірект
  // вихопить дефолт /dashboard раніше, ніж AppInitializer встигне його оновити.
  if (!isInitialized || isLoading) return null;
  return <Navigate to={roleHome(user?.role)} replace />;
};

// ─── APP INIT ─────────────────────────────────────────────────

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { initialize } = useAuth();

  useEffect(() => {
    // Викликаємо один раз при старті — перевіряємо Cookie
    initialize();
  }, [initialize]);

  return <>{children}</>;
};

// ─── ROUTES ───────────────────────────────────────────────────

export const App: React.FC = () => (
  <BrowserRouter>
    <ErrorBoundary>
    <AppInitializer>
      <React.Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" /></div>}>
        <Routes>
          {/* ── Public ─────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Admin / Director ───────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'director']} />}>
            <Route path="/finance" element={<FinancePage />} />
          </Route>

          {/* ── Internal team (manager, ops, accountant, admin) */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'director', 'manager', 'ops', 'accountant']} />}>
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/bookings"      element={<BookingsPage />} />
          </Route>

          {/* ── Тури / Операції — + product_manager (CRUD турів, персонал, ДОПи), + logist (готелі/румінг/транспорт) ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'director', 'manager', 'ops', 'accountant', 'product_manager', 'logist']} />}>
            <Route path="/tours"         element={<ToursPage />} />
            <Route path="/tours/:id"     element={<TourDetail />} />
            <Route path="/operations"    element={<OperationsPage />} />
          </Route>

          {/* ── Створення туру — ті ж ролі, що POST /tours на бекенді ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'ops', 'product_manager']} />}>
            <Route path="/tours/new" element={<TourNewPage />} />
          </Route>

          {/* ── Персонал (турлідери/гіди/водії/координатори) — product_manager ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'product_manager']} />}>
            <Route path="/staff" element={<StaffPage />} />
          </Route>

          {/* ── Перевізники/автобуси — logist ────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'logist']} />}>
            <Route path="/carriers" element={<CarriersPage />} />
          </Route>

          {/* ── CRM / Leads — admin, director, manager ─────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'director', 'manager']} />}>
            <Route path="/leads" element={<LeadsList />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>

          {/* ── Нове бронювання — той самий доступ, що й POST /bookings ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'agent']} />}>
            <Route path="/bookings/new" element={<BookingNew />} />
          </Route>

          {/* ── Booking detail — всі ролі, RBAC на рівні API ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'director', 'manager', 'ops', 'accountant', 'agent']} />}>
            <Route path="/bookings/:id"  element={<BookingDetailRoute />} />
          </Route>

          {/* ── Agent cabinet ──────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
            <Route path="/agent/*" element={<AgentCabinet />} />
          </Route>

          {/* ── Кабінет туриста (C4, WF5, OPS-03) ──────────── */}
          <Route element={<ProtectedRoute allowedRoles={['tourist']} />}>
            <Route path="/my/booking"     element={<MyBooking />} />
            <Route path="/my/preferences" element={<MyPreferences />} />
            <Route path="/my" element={<Navigate to="/my/booking" replace />} />
          </Route>

          {/* ── Redirects ──────────────────────────────────── */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </React.Suspense>
    </AppInitializer>
    </ErrorBoundary>
  </BrowserRouter>
);

export default App;
