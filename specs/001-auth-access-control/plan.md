# Implementation Plan: Модель доступа, защита учётных записей и наблюдаемость

**Branch**: `001-auth-access-control` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auth-access-control/spec.md`

## Summary

Дополняем менеджер задач из ЛР №2 (Express 5 + PostgreSQL + React SPA) четырьмя возможностями:

1. **RBAC на временных ключах**: JWT-ключ доступа (HS256, 15 мин) в заголовке
   `Authorization: Bearer` + непрозрачный ротируемый ключ обновления (7 дней) в
   `HttpOnly; SameSite=Strict` cookie. Роли `viewer ⊂ editor ⊂ admin`. Каждый запрос сверяет
   сеанс и роль с БД — отзыв сеанса и смена роли действуют мгновенно.
2. **HTTP-семантика**: единый обработчик ошибок в формате `application/problem+json`
   (RFC 9457), полный набор кодов 400/401/403/404/405/409/413/415/422/429/500/503 со
   стандартными заголовками (`WWW-Authenticate`, `Allow`, `Retry-After`, `Location`).
3. **Защита**: ограничитель попыток в PostgreSQL (по e-mail и по IP), таблица сеансов с лимитом 5,
   детект повторного использования refresh-ключа, восстановление пароля одноразовой ссылкой
   через SMTP (Mailpit в Docker для разработки).
4. **Логи**: `pino` + `pino-http`, JSON-строки, `X-Request-Id`, `userId` в каждой записи,
   события безопасности с полем `event`, маскирование секретов.

На клиенте: `AuthProvider`, тихое обновление ключа (single-flight + Web Locks между вкладками),
страницы входа/регистрации/восстановления, «Мои сеансы», «Пользователи» (админ), ролевой UI.

## Technical Context

**Language/Version**: Node.js 22 (сервер, CommonJS), JavaScript ES2022 + JSX (клиент)

**Primary Dependencies**: Express 5, express-validator, multer, pg (без изменений);
новые — `jsonwebtoken` (подпись/проверка ключей), `pino` + `pino-http` (структурированные логи),
`nodemailer` (SMTP); dev — `supertest`. Клиент: React 19, React Router 7, Vite 7 (без новых
зависимостей).

**Storage**: PostgreSQL 17; новые таблицы `users`, `sessions`, `rate_limits`,
`password_reset_tokens` в идемпотентном `schema.sql`.

**Testing**: `node:test` + `supertest`, интеграционные тесты против реальной PostgreSQL
(`TEST_DATABASE_URL`), почта — `MemoryMailer` через DI.

**Target Platform**: Linux-контейнеры (Docker Compose), современные браузеры.

**Project Type**: Web application (SPA `client/` + REST API `server/`).

**Performance Goals**: накладные расходы аутентификации ≤ 1 запрос к БД на HTTP-запрос
(JOIN сеанса и пользователя по PK).

**Constraints**: без изменения контракта задач/вложений, кроме кодов ошибок валидации
(400 → 422) и добавления `Location`; запуск одной командой `docker compose up --build`.

**Scale/Scope**: учебный проект, единицы–десятки пользователей, один экземпляр API.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Как выполняется | Статус |
|---|---|---|
| I. Безопасность по умолчанию | `router.use(authenticate)` на `/api/tasks` и `/api/admin`; публичны только `/api/health` и `/api/auth/{register,login,refresh,logout,forgot-password,reset-password}`; scrypt для паролей, SHA-256 для токенов; единые ответы без раскрытия e-mail; секреты из env | ✅ |
| II. Семантика HTTP | Централизованный `errorHandler` → `problem+json`; `methodNotAllowed` с `Allow`; `requireJson` → 415; валидация → 422; 201 + `Location` | ✅ |
| III. Структурированные логи | `pino-http` с `genReqId`, `customProps` (`userId`, `role`), `redact`; `securityEvent()` | ✅ |
| IV. Тесты на поведение | Интеграционные тесты на матрицу ролей, каждый код ответа, блокировки, сеансы, сброс пароля, логи | ✅ |
| V. Простота, архитектура ЛР №2 | Те же слои и `container.js`; пароли — встроенный `crypto.scrypt`, cookie — ручной разбор без `cookie-parser`; 4 новые зависимости обоснованы в research.md | ✅ |
| VI. Понятный интерфейс | Тексты ошибок на русском, обратный отсчёт при 429, тихий refresh, существующая дизайн-система | ✅ |

**Post-design re-check (после Phase 1)**: нарушений нет, Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-access-control/
├── plan.md              # этот файл
├── research.md          # Phase 0 — решения и альтернативы
├── data-model.md        # Phase 1 — сущности, поля, переходы состояний
├── quickstart.md        # Phase 1 — сценарии ручной проверки
├── contracts/
│   ├── openapi.yaml     # Phase 1 — контракт REST API
│   └── errors.md        # Phase 1 — каталог ошибок и кодов
├── checklists/
│   └── requirements.md  # качество спецификации
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── app.js                      # + logger, auth/admin роутеры, 405, problem+json
│   ├── container.js                # + сервисы auth/sessions/limits/mailer
│   ├── server.js                   # + сид пользователей, логгер вместо console
│   ├── config/index.js             # + JWT, TTL, лимиты, SMTP, сид
│   ├── logger.js                   # NEW pino + pino-http
│   ├── db/schema.sql               # + users, sessions, rate_limits, password_reset_tokens
│   ├── errors/AppError.js          # + type/headers/extensions
│   ├── errors/httpErrors.js        # NEW фабрики 401/403/405/409/415/429
│   ├── middlewares/
│   │   ├── authenticate.js         # NEW Bearer → сеанс + пользователь
│   │   ├── requireRole.js          # NEW иерархия ролей
│   │   ├── requireContentType.js   # NEW 415
│   │   ├── methodNotAllowed.js     # NEW 405 + Allow
│   │   ├── errorHandler.js         # problem+json, 503, 413, 415
│   │   ├── validate.js             # 400 → 422
│   │   └── authValidators.js       # NEW правила для auth/admin
│   ├── models/User.js              # NEW роли, toJSON без хеша
│   ├── repositories/
│   │   ├── UserRepository.js       # NEW
│   │   ├── SessionRepository.js    # NEW
│   │   ├── RateLimitRepository.js  # NEW
│   │   └── PasswordResetRepository.js # NEW
│   ├── services/
│   │   ├── PasswordHasher.js       # NEW scrypt
│   │   ├── TokenService.js         # NEW JWT + refresh-ключи
│   │   ├── LoginThrottle.js        # NEW защита от подбора
│   │   ├── AuthService.js          # NEW регистрация/вход/refresh/выход/сброс
│   │   ├── SessionService.js       # NEW сеансы пользователя и админа
│   │   ├── UserService.js          # NEW роли, сид
│   │   └── Mailer.js               # NEW SMTP / Memory + шаблоны писем
│   ├── controllers/AuthController.js, AdminController.js  # NEW
│   └── routes/authRoutes.js, adminRoutes.js, taskRoutes.js # NEW / изменён
└── test/                            # NEW интеграционные тесты node:test

client/src/
├── api/HttpClient.js     # NEW Bearer, тихий refresh, problem+json → ApiError
├── api/AuthApi.js, AdminApi.js       # NEW
├── api/TasksApi.js       # переведён на HttpClient
├── auth/AuthContext.jsx  # NEW AuthProvider, useAuth, RequireAuth, RequireRole
├── components/Layout.jsx, AuthLayout.jsx, RoleBadge.jsx, Banners.jsx
├── pages/LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage,
│         SessionsPage, AdminUsersPage, ForbiddenPage  # NEW
└── styles.css            # + стили auth/таблиц/ролей

docker-compose.yml        # + mailpit, переменные окружения
```

**Structure Decision**: сохраняем двухпроектную структуру `server/` + `client/` из ЛР №2,
расширяя существующие слои; тесты — `server/test/`.

## Complexity Tracking

Нарушений конституции нет.
