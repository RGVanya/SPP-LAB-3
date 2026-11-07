# Quickstart: проверка фичи 001-auth-access-control

## Запуск

```bash
docker compose up --build
```

| Сервис | Адрес |
|---|---|
| Приложение (SPA + API) | http://localhost:3000 |
| Почтовый ящик разработки (Mailpit) | http://localhost:8025 |

Демо-учётные записи (создаются при старте, пароль `Passw0rd!`):

| Роль | E-mail |
|---|---|
| admin | `admin@example.com` |
| editor | `editor@example.com` |
| viewer | `viewer@example.com` |

## Автотесты (92 интеграционных теста)

```bash
docker run -d --name spp-test-db -p 55432:5432 \
  -e POSTGRES_USER=tasks -e POSTGRES_PASSWORD=tasks -e POSTGRES_DB=tasks_test postgres:17-alpine
cd server && npm install
TEST_DATABASE_URL=postgres://tasks:tasks@localhost:55432/tasks_test npm test
```

Ожидается: все тесты зелёные.

## Сценарии ручной проверки

### 1. Роли (US1)

1. Открыть http://localhost:3000 → редирект на «Вход».
2. Войти `viewer@example.com` → список задач без кнопок «Новая задача», «Удалить».
3. `curl` от имени viewer: `POST /api/tasks` → **403** `insufficient-role`.
4. Войти `admin@example.com` → «Пользователи» → сменить viewer на editor →
   у viewer (во второй вкладке/браузере) после обновления страницы появляются кнопки изменения.

### 2. Коды HTTP (US2)

```bash
B=http://localhost:3000/api
curl -i $B/tasks                                   # 401 + WWW-Authenticate
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d '{"email":"editor@example.com","password":"Passw0rd!"}' $B/auth/login | jq -r .accessToken)
curl -i -H "Authorization: Bearer $TOKEN" -X PATCH $B/tasks          # 405 + Allow: GET, HEAD, POST
curl -i -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{bad' $B/tasks  # 400
curl -i -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/plain' -d 'x' $B/tasks          # 415
curl -i -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' $B/tasks   # 422
curl -i -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Демо","status":"new"}' $B/tasks                                                 # 201 + Location
```

### 3. Подбор пароля (US3)

Ввести неверный пароль для `editor@example.com`: после 1–3 неудач форма предупреждает, сколько
попыток осталось; 5-я неудача включает блокировку — карточка «Вход временно заблокирован» с обратным
отсчётом 15:00, кнопка входа неактивна (даже с верным паролем); `curl` — **429** и `Retry-After: 900`.

### 4. Сеансы (US4)

Войти одним пользователем в двух браузерах → «Сеансы» → завершить второй → во втором браузере
следующее действие переводит на «Вход».

### 5. Восстановление пароля (US5)

«Вход» → «Забыли пароль?» → e-mail → открыть письмо в http://localhost:8025 → перейти по ссылке
→ задать новый пароль → войти с новым паролем; все прежние сеансы завершены, пришло
письмо-уведомление.

### 6. Логи (US6)

```bash
docker compose logs api | grep '"event"'          # события безопасности
docker compose logs api | grep '<requestId из ответа об ошибке>'
docker compose logs api | grep -c 'Passw0rd'      # 0 — пароли маскируются
```
