# Каталог ошибок API

Все ошибки — `Content-Type: application/problem+json` (RFC 9457):

```json
{
  "type": "/problems/validation-error",
  "title": "Unprocessable Content",
  "status": 422,
  "detail": "Проверьте введённые данные",
  "instance": "/api/tasks",
  "requestId": "6c1f7e1e-0b55-4c3e-9f0f-1d6a2f1c5b11",
  "fields": { "title": "Название задачи обязательно" }
}
```

| Статус | `type` | Когда | Доп. заголовки / поля |
|---|---|---|---|
| 400 | `/problems/malformed-request` | Тело не разбирается как JSON | — |
| 401 | `/problems/unauthorized` | Нет ключа доступа | `WWW-Authenticate: Bearer realm="tasks"` |
| 401 | `/problems/invalid-token` | Ключ искажён, просрочен, сеанс завершён | `WWW-Authenticate: Bearer realm="tasks", error="invalid_token", error_description="…"` |
| 401 | `/problems/invalid-credentials` | Неверный e-mail или пароль | `WWW-Authenticate`, `attemptsLeft` |
| 401 | `/problems/invalid-refresh-token` | Нет/недействителен ключ обновления | `WWW-Authenticate`, cookie очищается |
| 403 | `/problems/insufficient-role` | Роль ниже требуемой | `WWW-Authenticate: … error="insufficient_scope"`, `requiredRole` |
| 404 | `/problems/not-found` | Ресурс или адрес не существует | — |
| 405 | `/problems/method-not-allowed` | Метод не поддерживается адресом | `Allow: GET, POST` |
| 409 | `/problems/email-taken` | Регистрация с занятым e-mail | — |
| 409 | `/problems/self-demotion` | Админ понижает сам себя | — |
| 413 | `/problems/payload-too-large` | JSON > 1 МБ или файл > 10 МБ | `fields.file` |
| 415 | `/problems/unsupported-media-type` | Не JSON / не multipart | — |
| 422 | `/problems/validation-error` | Нарушены правила полей | `fields` |
| 422 | `/problems/invalid-reset-token` | Ссылка сброса недействительна/просрочена | `fields.token` |
| 429 | `/problems/too-many-attempts` | Блокировка подбора / лимит запросов | `Retry-After: <сек>`, `retryAfter` |
| 500 | `/problems/internal` | Непредвиденная ошибка (детали только в логе) | — |
| 503 | `/problems/service-unavailable` | Недоступна БД | `Retry-After: 5` |

Успешные ответы: `200` чтение/изменение, `201` создание + `Location`, `202` принято
(восстановление пароля), `204` удаление/действие без тела.
