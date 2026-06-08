# Eurotrips — E2E Тести (Playwright)

## Структура

```
frontend/
├── playwright.config.ts          ← конфігурація: браузери, проекти, auth state
├── .env.test                     ← URL та тестові credentials (не комітити реальні!)
├── package.json
└── tests/
    ├── .auth/                    ← збережені сесії (git-ignored)
    │   ├── manager.json
    │   └── agent.json
    ├── fixtures/
    │   └── auth.fixtures.ts      ← credentials, apiLogin(), test.extend()
    ├── pages/
    │   └── login.page.ts         ← Page Object Model для /login
    ├── global.setup.ts           ← зберігає auth state менеджера
    ├── agent.setup.ts            ← зберігає auth state агента
    ├── auth.spec.ts              ← 15 тестів: логін, logout, захист маршрутів
    └── rbac.spec.ts              ← 17 тестів: агент → /finance, costPrice, ізоляція
```

## Запуск

### Передумови

```bash
# 1. Backend запущено (Docker або локально)
cd backend && npm run docker:up && npm run dev

# 2. Frontend запущено
cd frontend && npm run dev

# 3. Seed даних завантажено
cd backend && npm run db:seed
```

### Встановлення

```bash
cd frontend
npm init playwright@latest   # якщо ще не ініціалізовано
# або
npm install --save-dev @playwright/test
npx playwright install chromium firefox
```

### Команди

```bash
# Всі тести (headless)
npm run test:e2e

# З видимим браузером
npm run test:e2e:headed

# Інтерактивний UI-режим (рекомендовано при розробці)
npm run test:e2e:ui

# Тільки auth тести
npm run test:auth

# Тільки RBAC тести
npm run test:rbac

# Debug конкретного тесту
npx playwright test tests/auth.spec.ts --debug

# Тільки тести з певним ім'ям
npx playwright test --grep "TC-AUTH-001"

# Звіт після запуску
npm run test:report

# Записати новий тест через UI-рекордер
npm run codegen
```

### CI (GitHub Actions)

```yaml
- name: Run Playwright E2E
  run: npm run test:e2e:ci
  env:
    CI: true
    PLAYWRIGHT_BASE_URL: http://localhost:5173
    PLAYWRIGHT_API_URL: http://localhost:3000/api/v1
```

## Архітектурні рішення

### Auth State (збережені сесії)
Playwright логіниться ОДИН РАЗ через `global.setup.ts` → зберігає cookies у
`tests/.auth/*.json` → наступні тести завантажують сесію без повторного логіну.
**Результат**: сюїт з 32 тестів виконується ~3× швидше.

### Page Object Model
`tests/pages/login.page.ts` інкапсулює всі селектори та дії.
Зміна DOM → правимо тільки Page Object, не кожен тест.

### API-level assertions (без UI)
RBAC тести перевіряють безпеку на рівні API (`page.request.get/post`).
Це швидше, надійніше та незалежне від UI-рендерингу.

### Проекти Playwright
- `setup:manager` / `setup:agent` → зберігають auth state (dependency)
- `auth` → завжди свіжа сесія (без storageState)
- `rbac` → завантажує auth state агента
- `chromium` → основний браузер для решти тестів

## Покриття тестів

| Spec | Тестів | Покриває |
|------|--------|---------|
| `auth.spec.ts` | 15 | Логін happy path, невірні credentials, валідація форми, guard маршрутів, logout |
| `rbac.spec.ts` | 17 | Агент→/finance (403), BR-04 (costPrice прихований), ізоляція бронювань, IDOR |
| **Разом** | **32** | |

## Бізнес-правила що перевіряються

| Правило | Тест |
|---------|------|
| BR-04: агент не бачить costPrice/margin | TC-RBAC-005, TC-RBAC-006, TC-RBAC-008 |
| RBAC: агент не бачить /finance | TC-RBAC-001, TC-RBAC-002, TC-RBAC-003 |
| RBAC: агент бачить тільки свої бронювання | TC-RBAC-009, TC-RBAC-010 |
| IDOR: агент не отримує чужі бронювання | TC-RBAC-011 |
| Auth guard: неавторизований → /login | TC-AUTH-011, TC-AUTH-012 |
| Logout: сесія очищена | TC-AUTH-014, TC-AUTH-015 |
