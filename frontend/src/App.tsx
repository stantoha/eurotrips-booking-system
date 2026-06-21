// ============================================================
// EUROTRIPS — App.tsx
// Точка входу. Ініціалізація auth + маршрутизація.
// ============================================================

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { useAuth } from './hooks/useAuth';

// ─── LAZY PAGES ───────────────────────────────────────────────
// Завантажуємо сторінки ліниво для кращої продуктивності

const Dashboard       = React.lazy(() => import('./pages/Dashboard'));
const ToursPage       = React.lazy(() => import('./pages/Tours'));
const BookingsPage    = React.lazy(() => import('./pages/Bookings'));
const BookingDetail   = React.lazy(() => import('./pages/BookingDetail'));
const AgentCabinet    = React.lazy(() => import('./pages/agent/AgentCabinet'));
const FinancePage     = React.lazy(() => import('./pages/Finance'));
const OperationsPage  = React.lazy(() => import('./pages/Operations'));

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

const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <LoginForm onSuccess={() => window.location.replace('/dashboard')} />
    </div>
  );
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
            <Route path="/tours"         element={<ToursPage />} />
            <Route path="/bookings"      element={<BookingsPage />} />
            <Route path="/operations"    element={<OperationsPage />} />
          </Route>

          {/* ── Booking detail — всі ролі, RBAC на рівні API ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'director', 'manager', 'ops', 'accountant', 'agent']} />}>
            <Route path="/bookings/:id"  element={<BookingDetailRoute />} />
          </Route>

          {/* ── Agent cabinet ──────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
            <Route path="/agent/*" element={<AgentCabinet />} />
          </Route>

          {/* ── Redirects ──────────────────────────────────── */}
          <Route path="/"    element={<Navigate to="/dashboard" replace />} />
          <Route path="*"    element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </AppInitializer>
  </BrowserRouter>
);

export default App;
