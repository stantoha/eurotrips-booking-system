# CLAUDE.md — Eurotrips Frontend

## Project
Ukrainian tour operator booking & operations platform — Frontend.
**Language**: Ukrainian (all UI labels, notifications, validation messages, documents).

## Stack
- Framework: React 18 + TypeScript + Vite
- Styling: Tailwind CSS (dark mode: class strategy)
- Icons: Lucide React
- State: TanStack Query v5 (server state) + Zustand (client state)
- Forms: React Hook Form + Zod validation
- Tables: TanStack Table v8
- HTTP: Axios with interceptors (JWT auto-refresh)
- Testing: Vitest + Testing Library

## Architecture
```
src/
├── components/
│   ├── ui/           # Базові UI компоненти (StatusBadge, PaymentBlock, CommissionBadge)
│   ├── tours/        # Тури (TourCard, TourFilters, TourCalendar)
│   ├── bookings/     # Бронювання (BookingRow, BookingForm, BookingDetail)
│   ├── agent/        # Кабінет агента (AgentDashboard, CommissionReport)
│   ├── crm/          # CRM / ліди (LeadCard, LeadForm, LeadKanban)
│   ├── finance/      # Фінанси (PaymentJournal, CommissionRegistry)
│   └── layouts/      # AppLayout, AgentLayout, AuthLayout
├── pages/            # Next.js-style page components
├── hooks/            # useAuth, useBookings, useTours, useCommission
├── services/         # api.ts, auth.ts — Axios instances
├── types/            # index.ts — всі TypeScript типи
├── constants/        # statuses.ts, routes.ts
├── mocks/            # Моки для розробки до підключення API
└── utils/            # formatCurrency, formatDate, rbac.ts
```

## API
- Base: `https://api.eurotrips.ua/api/v1/`
- Auth: `Bearer <JWT>` header (access token 15min)
- Refresh: POST /auth/refresh (HttpOnly Cookie, 30 days)
- All responses: `{ data, meta?, error? }`

## RBAC Rules
Roles: admin | director | manager | ops_manager | accountant | agent | tourist
```
// Ніколи НЕ показуємо агенту:
// - cost_price (BR-04)
// - margin/net_profit
// - інші агентські заявки та комісії
// - внутрішні фінансові звіти
```

## Key Domain Rules
- `agent_type: 'standard' | 'network'` — network has royalty_rate + co_commission_pct
- All amounts in EUR (DECIMAL 10,2). Display: toLocaleString('uk-UA')
- Tour IDs: [CODE][YEAR][MONTH][DAY][SEQ] → e.g. `LP26010301`
- Booking numbers: `ET-YYYY-NNNNN`
- Commission paid ONLY after tour_status = 'completed' (BR-03)
- BR-01: available_seats decremented only after deposit paid
- BR-02: commission = tour_price × rate (no DOPs)
- BR-07: royalty processed only after sub-agent commissions paid

## Status Types
- `BookingStatus` — 15 values (see src/constants/statuses.ts)
- `TourStatus` — 8 values
- `PaymentStatus` — 5 values (unpaid/deposit_paid/partially_paid/fully_paid/overdue)
- `CommissionStatus` — 5 values (pending/frozen/to_pay/paid/cancelled)

## Naming Conventions
- Components: PascalCase — `TourCard.tsx`, `BookingRow.tsx`
- Hooks: camelCase with "use" — `useTours.ts`, `useBookings.ts`
- Types: PascalCase — `BookingStatus`, `CommissionInfo`
- API functions: camelCase — `getTours()`, `createBooking()`
- Constants: SCREAMING_SNAKE — `BOOKING_STATUS_CONFIG`
- Ukrainian UI strings: always in component, never hardcoded in logic

## Mock → Real API Switch
Files in `src/mocks/` mirror real API shapes.
Switch: change `src/services/api.ts` import from mock to real Axios call.
Keep `MOCK_*` exports for Storybook / unit tests.

## Важливо
- Вся система україномовна. Жодних hardcoded EN рядків у UI.
- Агент НІКОЛИ не бачить: собівартість, маржу, чужі комісії (BR-04).
- available_seats — optimistic update, підтвердження від API.
- Dark mode обов'язковий (class strategy в Tailwind).
