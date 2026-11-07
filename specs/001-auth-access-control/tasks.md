---
description: "Task list for 001-auth-access-control"
---

# Tasks: Модель доступа, защита учётных записей и наблюдаемость

**Input**: Design documents from `/specs/001-auth-access-control/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: обязательны (конституция, принцип IV) — интеграционные `node:test` + `supertest`
против PostgreSQL. Тест пишется до реализации и должен сначала падать.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей)
- **[Story]**: US1…US6 из spec.md

## Phase 1: Setup

- [x] T001 Добавить зависимости `jsonwebtoken`, `pino`, `pino-http`, `nodemailer`, dev `supertest`, удалить `morgan`, скрипт `npm test` в server/package.json
- [x] T002 [P] Добавить сервис `mailpit` и переменные окружения (JWT, SMTP, сид, LOG_LEVEL) в docker-compose.yml
- [x] T003 [P] Расширить конфиг (TTL ключей, лимиты, SMTP, сид, trustProxy, cookieSecure) в server/src/config/index.js

## Phase 2: Foundational (блокирует все истории)

- [x] T004 Добавить таблицы `users`, `sessions`, `rate_limits`, `password_reset_tokens` в server/src/db/schema.sql
- [x] T005 [P] Структурированный логгер `createLogger`, `createHttpLogger` (reqId, redact, уровни по статусу) в server/src/logger.js
- [x] T006 [P] Расширить `AppError` (type, headers, extensions) и фабрики ошибок в server/src/errors/AppError.js, server/src/errors/httpErrors.js
- [x] T007 Обработчик ошибок в формате problem+json (400/413/415/500/503, `requestId`) в server/src/middlewares/errorHandler.js; 422 для валидации в server/src/middlewares/validate.js
- [x] T008 Тестовая инфраструктура: сборка приложения, очистка БД, `MemoryMailer`, хелперы входа в server/test/helpers.js
- [x] T009 Подключить логгер вместо `morgan`/`console` в server/src/app.js и server/src/server.js

**Checkpoint**: фундамент готов, истории можно делать.

## Phase 3: User Story 1 — Вход и роли (P1) 🎯 MVP

**Goal**: регистрация/вход/refresh/выход, RBAC на задачах, смена ролей админом.

**Independent Test**: матрица прав из data-model.md проходит тестами.

### Tests for User Story 1

- [x] T010 [P] [US1] Тесты регистрации, входа, `/me`, refresh-ротации, выхода в server/test/auth.test.js
- [x] T011 [P] [US1] Тесты матрицы ролей на задачах/вложениях и админ-смены роли в server/test/rbac.test.js

### Implementation for User Story 1

- [x] T012 [P] [US1] Модель `User` и иерархия ролей в server/src/models/User.js
- [x] T013 [P] [US1] `PasswordHasher` (scrypt) в server/src/services/PasswordHasher.js
- [x] T014 [P] [US1] `TokenService` (JWT, refresh-ключи, SHA-256) в server/src/services/TokenService.js
- [x] T015 [P] [US1] `UserRepository` в server/src/repositories/UserRepository.js
- [x] T016 [P] [US1] `SessionRepository` в server/src/repositories/SessionRepository.js
- [x] T017 [US1] `AuthService` (register/login/refresh/logout) в server/src/services/AuthService.js
- [x] T018 [US1] `UserService` (список, смена роли, сид) в server/src/services/UserService.js
- [x] T019 [US1] Middleware `authenticate`, `requireRole` в server/src/middlewares/authenticate.js, server/src/middlewares/requireRole.js
- [x] T020 [US1] Валидаторы auth/admin в server/src/middlewares/authValidators.js
- [x] T021 [US1] `AuthController`, `AdminController` и роутеры в server/src/controllers/, server/src/routes/authRoutes.js, server/src/routes/adminRoutes.js
- [x] T022 [US1] Защитить роутер задач (`authenticate`, viewer/editor) в server/src/routes/taskRoutes.js; сборка в server/src/container.js, server/src/app.js
- [x] T023 [US1] Сид администратора и демо-пользователей при старте в server/src/server.js
- [x] T024 [P] [US1] `HttpClient` (Bearer, single-flight refresh + Web Locks, problem+json) в client/src/api/HttpClient.js; перевод client/src/api/TasksApi.js
- [x] T025 [P] [US1] `AuthApi`, `AdminApi` в client/src/api/AuthApi.js, client/src/api/AdminApi.js
- [x] T026 [US1] `AuthProvider`, `useAuth`, `RequireAuth`, `RequireRole` в client/src/auth/AuthContext.jsx
- [x] T027 [US1] Страницы входа и регистрации, `AuthLayout` в client/src/pages/LoginPage.jsx, client/src/pages/RegisterPage.jsx, client/src/components/AuthLayout.jsx
- [x] T028 [US1] Шапка с навигацией, пользователем, ролью и выходом; ролевое скрытие кнопок в client/src/components/Layout.jsx, client/src/pages/Task*.jsx
- [x] T029 [US1] Страница пользователей (смена ролей) и 403-страница в client/src/pages/AdminUsersPage.jsx, client/src/pages/ForbiddenPage.jsx
- [x] T030 [US1] Маршруты в client/src/App.jsx, стили в client/src/styles.css

**Checkpoint**: MVP — модель доступа работает end-to-end.

## Phase 4: User Story 2 — Семантика HTTP (P1)

**Independent Test**: каждый код из contracts/errors.md воспроизводится тестом.

- [x] T031 [P] [US2] Тесты кодов 400/401/403/404/405/409/413/415/422/503 и формата problem+json в server/test/http-semantics.test.js
- [x] T032 [P] [US2] Middleware `methodNotAllowed` (405 + Allow, OPTIONS → 204) в server/src/middlewares/methodNotAllowed.js
- [x] T033 [P] [US2] Middleware `requireContentType` (415) в server/src/middlewares/requireContentType.js
- [x] T034 [US2] Перевести роутеры на `router.route().all(405)`, 201 + `Location` в server/src/routes/*.js, server/src/controllers/TaskController.js, AttachmentController.js
- [x] T035 [US2] 422 для ошибок валидации сервисов задач/вложений в server/src/services/TaskService.js, AttachmentService.js
- [x] T036 [US2] `ErrorBanner` с `requestId`, разбор `detail` в client/src/components/Banners.jsx, client/src/api/ApiError.js

## Phase 5: User Story 3 — Защита от подбора (P2)

**Independent Test**: 5 неудач → 429 + Retry-After даже с верным паролем.

- [x] T037 [P] [US3] Тесты блокировок e-mail/IP, сброса счётчика, неразличимости e-mail в server/test/brute-force.test.js
- [x] T038 [P] [US3] `RateLimitRepository` (атомарный upsert) в server/src/repositories/RateLimitRepository.js
- [x] T039 [US3] `LoginThrottle` и интеграция в `AuthService.login` (429, `attemptsLeft`, пустой хеш) в server/src/services/LoginThrottle.js, server/src/services/AuthService.js
- [x] T040 [US3] Обратный отсчёт блокировки и «осталось попыток» в client/src/pages/LoginPage.jsx

## Phase 6: User Story 4 — Контроль сеансов (P2)

**Independent Test**: отзыв сеанса → следующий запрос 401.

- [x] T041 [P] [US4] Тесты списка/отзыва сеансов, лимита 5, детекта повторного refresh, админ-сеансов в server/test/sessions.test.js
- [x] T042 [US4] `SessionService` (мои/все сеансы, отзыв, лимит) в server/src/services/SessionService.js; маршруты в authRoutes/adminRoutes
- [x] T043 [US4] Страница «Мои сеансы» и вкладка сеансов у администратора в client/src/pages/SessionsPage.jsx, client/src/pages/AdminUsersPage.jsx

## Phase 7: User Story 5 — Восстановление пароля (P2)

**Independent Test**: письмо → ссылка → новый пароль → старые сеансы мертвы.

- [x] T044 [P] [US5] Тесты forgot/reset (202 для любых e-mail, одноразовость, срок, отзыв сеансов, лимит 5/IP) в server/test/password-reset.test.js
- [x] T045 [P] [US5] `Mailer` (SMTP/Memory) и HTML-шаблоны писем в server/src/services/Mailer.js
- [x] T046 [P] [US5] `PasswordResetRepository` в server/src/repositories/PasswordResetRepository.js
- [x] T047 [US5] `AuthService.requestPasswordReset/resetPassword` и маршруты в server/src/services/AuthService.js, server/src/routes/authRoutes.js
- [x] T048 [US5] Страницы «Забыли пароль» и «Новый пароль» в client/src/pages/ForgotPasswordPage.jsx, client/src/pages/ResetPasswordPage.jsx

## Phase 8: User Story 6 — Структурированные логи (P3)

**Independent Test**: JSON-строки с reqId/userId, события, нет секретов.

- [x] T049 [P] [US6] Тесты: `X-Request-Id` (свой и сгенерированный), JSON-запись запроса с `userId`, события безопасности, отсутствие пароля/токена в логе в server/test/logging.test.js
- [x] T050 [US6] Функция `securityEvent` и вызовы во всех событиях из US6 в server/src/logger.js, сервисах и контроллерах

## Phase 9: Polish & Cross-Cutting

- [x] T051 Прогнать весь `npm test`, `npm run build` клиента
- [x] T052 `docker compose up --build` и прогон quickstart.md (curl-сценарии, письма в Mailpit)
- [x] T053 [P] Обновить ASSIGNMENT.md заданием ЛР №3

## Dependencies & Execution Order

- Setup (T001–T003) → Foundational (T004–T009) → US1 (MVP) → US2 → {US3, US4, US5} → US6 → Polish.
- US3, US4, US5 зависят от `AuthService`/`SessionRepository` из US1, между собой независимы
  (разные файлы, кроме точечных правок `AuthService`).
- US6 частично реализуется в Foundational (логгер), фаза 8 добавляет события и тесты.

## Parallel Example: User Story 1

```text
T010, T011 (тесты) — параллельно
T012, T013, T014, T015, T016 — параллельно (разные файлы)
T024, T025 (клиентские API) — параллельно с серверной частью
```

## Implementation Strategy

1. MVP = Phase 1–3: вход и роли end-to-end, проверка матрицы прав.
2. Затем US2 (единый формат ошибок затрагивает все маршруты).
3. US3–US5 инкрементально, каждый со своими тестами.
4. US6 и полировка; финальная проверка по quickstart.md.
