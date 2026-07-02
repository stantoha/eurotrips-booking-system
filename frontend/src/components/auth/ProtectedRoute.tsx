// ============================================================
// EUROTRIPS — ProtectedRoute
// Захищає маршрути від неавторизованого доступу.
// Чекає на ініціалізацію (перевірку Cookie) перед рендером.
// RBAC: allowedRoles — масив ролей що мають доступ.
// ============================================================

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Layout } from '../layout/Layout';
import type { UserRole } from '../../types';

// ─── PROPS ───────────────────────────────────────────────────

interface ProtectedRouteProps {
  /** Ролі що мають доступ. Відсутність = будь-яка авторизована роль. */
  allowedRoles?: UserRole[];
  /** Куди редіректити якщо не авторизований. За замовч. /login */
  loginPath?: string;
  /** Куди редіректити якщо немає прав (403). За замовч. /403 */
  forbiddenPath?: string;
  children?: React.ReactNode;
}

// ─── LOADING SCREEN ──────────────────────────────────────────

const InitializingScreen: React.FC = () => (
  <div
    role="status"
    aria-label="Завантаження системи"
    className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-950 z-50"
  >
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 bg-slate-900 dark:bg-slate-100 rounded-xl flex items-center justify-center">
        <span className="text-white dark:text-slate-900 font-bold text-sm">ET</span>
      </div>
      <Loader2
        size={20}
        className="animate-spin text-slate-400"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-400 animate-pulse">
        Перевірка сесії...
      </p>
    </div>
  </div>
);

// ─── 403 PAGE (inline fallback) ───────────────────────────────

const ForbiddenScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <ShieldOff size={40} className="text-slate-300 dark:text-slate-600" />
    <h1 className="text-xl font-medium text-slate-700 dark:text-slate-300">
      Доступ заборонено
    </h1>
    <p className="text-sm text-slate-500 text-center max-w-xs">
      У вас немає прав для перегляду цієї сторінки. Зверніться до адміністратора.
    </p>
  </div>
);

// ─── PROTECTED ROUTE ─────────────────────────────────────────

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  loginPath = '/login',
  forbiddenPath,
  children,
}) => {
  const { isAuthenticated, isInitialized, isLoading, user } = useAuth();
  const location = useLocation();

  // 1. Ще ініціалізуємось (перевіряємо Cookie на сервері)
  if (!isInitialized || isLoading) {
    return <InitializingScreen />;
  }

  // 2. Не авторизований → Login (зберігаємо поточний шлях для redirect після логіну)
  if (!isAuthenticated) {
    return (
      <Navigate
        to={loginPath}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // 3. Перевіряємо роль
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (forbiddenPath) {
      return <Navigate to={forbiddenPath} replace />;
    }
    return <ForbiddenScreen />;
  }

  // 4. Авторизований + правильна роль → рендеримо дочірні маршрути в шеллі навігації
  return <Layout>{children ? children : <Outlet />}</Layout>;
};

// ─── USAGE EXAMPLES ──────────────────────────────────────────
//
// Захист будь-якого авторизованого маршруту:
//   <Route element={<ProtectedRoute />}>
//     <Route path="/dashboard" element={<Dashboard />} />
//   </Route>
//
// Тільки для менеджера та адміна:
//   <Route element={<ProtectedRoute allowedRoles={['manager','admin']} />}>
//     <Route path="/bookings" element={<Bookings />} />
//   </Route>
//
// Тільки для агента:
//   <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
//     <Route path="/agent" element={<AgentCabinet />} />
//   </Route>
//
// Тільки для фінансиста/адміна:
//   <Route element={<ProtectedRoute allowedRoles={['accountant','admin','director']} />}>
//     <Route path="/finance" element={<Finance />} />
//   </Route>

export default ProtectedRoute;
