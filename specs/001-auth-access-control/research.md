# Research: Модель доступа, защита учётных записей и наблюдаемость

Каждое решение: **Decision / Rationale / Alternatives considered**.

## R1. Формат временных ключей

- **Decision**: ключ доступа — JWT HS256 (`sub`, `sid`, `role`, `iss`, `iat`, `exp`), 15 минут,
  передаётся в `Authorization: Bearer`. Ключ обновления — непрозрачная строка
  `<sessionId>.<32 байта base64url>`, хранится в БД только как SHA-256, живёт 7 дней,
  ротируется при каждом `/refresh`.
- **Rationale**: короткий JWT ограничивает ущерб от утечки; хранение refresh в
  `HttpOnly; SameSite=Strict; Path=/api/auth` cookie закрывает его от XSS и CSRF; ключ доступа
  клиент держит только в памяти. Префикс `sessionId` позволяет найти сеанс и при несовпадении
  хеша распознать повторное использование украденного ключа.
- **Alternatives**: серверные сессии в cookie (не «временные ключи» в духе задания);
  JWT в `localStorage` (уязвим к XSS); долгоживущий JWT без refresh (нельзя отозвать).

## R2. Мгновенный отзыв и смена роли

- **Decision**: `authenticate` после проверки подписи делает один запрос
  `sessions JOIN users` по `sid`: сеанс не отозван и не истёк, роль берётся из `users`.
- **Rationale**: требование FR-027/US1-5 — изменения действуют «со следующего запроса».
  Стоимость — один запрос по первичному ключу.
- **Alternatives**: чёрный список `jti` (сложнее, роль всё равно устаревает до 15 минут).

## R3. Хеширование паролей

- **Decision**: встроенный `crypto.scrypt` (N=16384, r=8, p=1, 64 байта, соль 16 байт),
  формат `scrypt$N$r$p$salt$hash`, сравнение `timingSafeEqual`. Для несуществующего e-mail
  проверяется заранее вычисленный «пустой» хеш — время ответа одинаковое.
- **Rationale**: рекомендован OWASP, не требует нативных модулей (alpine-образ), принцип V.
- **Alternatives**: `bcrypt` (нативная сборка), `argon2` (нативная сборка).

## R4. Защита от подбора

- **Decision**: таблица `rate_limits(key, hits, window_started_at, locked_until)`.
  Ключи `login:email:<email>` (5 неудач / 15 мин → блок 15 мин),
  `login:ip:<ip>` (20 / 15 мин → 15 мин), `forgot:ip:<ip>` (5 / 15 мин → 15 мин).
  Счётчик обновляется одним `INSERT … ON CONFLICT DO UPDATE` (атомарно).
  Успешный вход сбрасывает ключ e-mail; сброс пароля — тоже. Ответ при блокировке — 429
  с `Retry-After` (секунды) и расширением `retryAfter`; при неудаче — 401 с `attemptsLeft`.
- **Rationale**: блокировка по e-mail защищает конкретную учётку (в т.ч. от распределённого
  подбора), по IP — от перебора многих учёток; учёт для несуществующих e-mail исключает
  перечисление. БД вместо памяти — переживает перезапуск, один экземпляр (Assumptions).
- **Alternatives**: `express-rate-limit` (память процесса, только IP), CAPTCHA (вне рамок).

## R5. Контроль сеансов

- **Decision**: таблица `sessions`; при входе — вставка и отзыв всех активных сверх 5 новейших
  (`revoke_reason = 'session_limit'`). `last_used_at` обновляется не чаще раза в минуту
  (условный `UPDATE`). Причины отзыва: `logout`, `user_revoked`, `admin_revoked`,
  `session_limit`, `refresh_reuse`, `password_reset`.
- **Rationale**: прозрачная история, понятные причины в логах и UI.
- **Alternatives**: хранение сеансов в Redis — лишняя инфраструктура.

## R6. Гонка обновления между вкладками

- **Decision**: клиент выполняет refresh в режиме single-flight внутри вкладки и под
  `navigator.locks.request('auth-refresh')` между вкладками; браузер разделяет cookie, поэтому
  следующая вкладка отправит уже новый ключ.
- **Rationale**: без этого две вкладки отправят один ключ, второй запрос будет принят за кражу
  и сеанс закроется.
- **Alternatives**: «льготное окно» для предыдущего хеша на сервере — ослабляет детект кражи.

## R7. Формат ошибок

- **Decision**: RFC 9457 `application/problem+json`:
  `{type, title, status, detail, instance, requestId, fields?, retryAfter?, attemptsLeft?}`.
  `type` — относительный URI `/problems/<slug>` (каталог в `contracts/errors.md`),
  `title` — стандартная фраза статуса, `detail` — русский текст для пользователя.
- **Rationale**: стандарт, машиночитаемый `type`, совместимость с инструментами.
- **Alternatives**: прежний `{message, fields}` — не стандарт; поле `message` убрано,
  клиент переведён на `detail`.

## R8. 400 vs 422, 415, 405

- **Decision**: 400 — тело не разбирается (битый JSON) или параметры синтаксически неверны;
  422 — JSON корректен, но значения нарушают правила (RFC 9110 §15.5.21).
  415 — для JSON-маршрутов тело не `application/json`, для загрузки — не `multipart/form-data`.
  405 — `router.route(...).all(methodNotAllowed([...]))`, `OPTIONS` → 204 + `Allow`.
- **Rationale**: точная семантика стандарта — прямое требование задания.

## R9. Логирование

- **Decision**: `pino` (JSON, уровни, `redact`) + `pino-http` (лог запроса по завершении).
  `genReqId`: берём `X-Request-Id`, если он соответствует `^[A-Za-z0-9._-]{1,128}$`, иначе
  `crypto.randomUUID()`; ставим заголовок ответа. Уровень: 5xx → `error`, 4xx → `warn`.
  `customProps` добавляет `userId`, `role`. События: `req.log.info({ event, ... })`.
  Маскируются `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`,
  `*.password`, `*.token`, `*.refreshToken`, `*.accessToken`. Логи статики не пишутся.
- **Rationale**: де-факто стандарт для Node, минимальные накладные расходы.
- **Alternatives**: `winston` (тяжелее, медленнее), `morgan` (не структурированный — удалён).

## R10. Почта

- **Decision**: `nodemailer` SMTP; в Docker — `axllent/mailpit` (SMTP :1025, веб-UI :8025).
  Интерфейс `mailer.send({to, subject, text, html})`; в тестах — `MemoryMailer`.
  Ошибка отправки логируется, но пользователю всё равно 202 (не раскрываем наличие e-mail).
- **Rationale**: письма можно показать на защите, не отправляя их в интернет.

## R11. Обоснование новых зависимостей (принцип V)

| Пакет | Почему нельзя stdlib |
|---|---|
| `jsonwebtoken` | Самописная криптография токенов — антипаттерн безопасности |
| `pino`, `pino-http` | Redaction, уровни, сериализаторы, корреляция — стандартное решение |
| `nodemailer` | SMTP-протокол, MIME, кодировки |
| `supertest` (dev) | HTTP-тесты без поднятия порта |

`morgan` удаляется (заменён `pino-http`).
