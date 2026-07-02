// ============================================================
// EUROTRIPS — components/ErrorBoundary.tsx
// Ловить помилки рендеру (в т.ч. збій завантаження lazy-чанків),
// щоб замість порожнього білого екрана показати повідомлення.
// ============================================================

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-950 px-4 text-center">
          <AlertTriangle size={40} className="text-brand-red" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              Сталася помилка завантаження
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Спробуйте оновити сторінку. Якщо проблема повторюється — зверніться до адміністратора.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
          >
            Оновити сторінку
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
