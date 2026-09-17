# CAPI Service

Node.js/Express сервис для нескольких проектов сразу: принимает вебхуки от CRM и пересылает события в Meta Conversions API (Facebook CAPI). У каждого проекта — свой пиксель, токен и свой URL вебхука. Управление проектами — через простую веб-панель.

## Запуск

```bash
npm install
cp .env.example .env
# задайте ADMIN_PASSWORD в .env — этим паролем защищена панель /admin
npm start
```

Сервис поднимется на `http://localhost:3000` (порт задаётся через `PORT` в `.env`).

Данные о проектах (пиксели, токены) хранятся в SQLite-файле `data/projects.db`, создаётся автоматически при первом запуске. Файл в `.gitignore` — не коммитится.

## Админ-панель

Откройте `http://localhost:3000/admin` — браузер спросит логин/пароль (Basic Auth). Логин — `ADMIN_USERNAME` (по умолчанию `admin`), пароль — `ADMIN_PASSWORD` из `.env`.

В панели можно:
- добавить проект: ID (используется в URL вебхука), название, `PIXEL_ID`, `ACCESS_TOKEN`, опционально `TEST_EVENT_CODE`;
- увидеть готовый URL вебхука для каждого проекта и скопировать его одной кнопкой;
- отредактировать проект (токен можно оставить пустым, чтобы не менять текущий);
- удалить проект.

## Эндпоинты

### GET /health

Проверка, что сервис жив.

```bash
curl http://localhost:3000/health
```

### POST /webhook/lead/:projectId

Принимает JSON от CRM и отправляет событие в Meta для конкретного проекта. `:projectId` — это ID, который вы задали при создании проекта в панели (виден в списке проектов вместе с готовым URL).

Обязательно нужен `event_name`, а также хотя бы одно из `email` / `phone`. Если проект с таким ID не найден — вернётся `404`.

Если в запросе есть `ctwa_clid` или `source: "whatsapp"` — событие уходит с `action_source: "business_messaging"` и `messaging_channel: "whatsapp"` (лид из Click-to-WhatsApp рекламы). Иначе — `action_source: "system_generated"`.

Email и телефон хешируются через SHA256 перед отправкой в Meta (телефон предварительно нормализуется — оставляются только цифры).

Пример запроса (обычный лид с сайта, проект с ID `my-shop`):

```bash
curl -X POST http://localhost:3000/webhook/lead/my-shop \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "Lead",
    "email": "test@example.com",
    "phone": "+7 700 123 45 67",
    "value": 15000,
    "currency": "KZT",
    "source": "website"
  }'
```

Пример запроса (лид из Click-to-WhatsApp рекламы):

```bash
curl -X POST http://localhost:3000/webhook/lead/my-shop \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "Lead",
    "phone": "+77001234567",
    "ctwa_clid": "AbCdEfGh123",
    "source": "whatsapp"
  }'
```

Успешный ответ:

```json
{
  "success": true,
  "event_id": "Lead_1737000000000",
  "meta_response": { "events_received": 1, "messages": [], "fbtrace_id": "..." }
}
```

Если у проекта не задан `TEST_EVENT_CODE`, события пойдут в боевую статистику пикселя. Для тестирования заполните это поле в панели (значение берётся из Events Manager → Test Events) — тогда события будут видны там же, во вкладке Test Events.

## Управление проектами через API (опционально)

Панель — это тонкая обёртка над JSON API под `/admin/api/projects` (тоже защищён тем же Basic Auth):

```bash
# список проектов (токен в ответе маскируется)
curl -u admin:PASSWORD http://localhost:3000/admin/api/projects

# создать проект
curl -u admin:PASSWORD -X POST http://localhost:3000/admin/api/projects \
  -H "Content-Type: application/json" \
  -d '{"id":"my-shop","name":"My Shop","pixel_id":"123456789012345","access_token":"EAAG...","test_event_code":"TEST12345"}'

# обновить проект (access_token можно не передавать — останется прежним)
curl -u admin:PASSWORD -X PUT http://localhost:3000/admin/api/projects/my-shop \
  -H "Content-Type: application/json" \
  -d '{"name":"My Shop (renamed)"}'

# удалить проект
curl -u admin:PASSWORD -X DELETE http://localhost:3000/admin/api/projects/my-shop
```

## Ошибки

- Нет `event_name`, либо нет ни `email`, ни `phone` — `400`.
- Проект с указанным `:projectId` не найден — `404`.
- Meta Conversions API вернула ошибку — сервис залогирует детали и вернёт `502` с телом ошибки от Meta.

## Заметки по безопасности

- `data/projects.db` хранит токены доступа Meta в открытом виде — храните сервер и бэкапы файла в доверенном окружении.
- Панель и её API защищены только Basic Auth — для продакшена рекомендуется держать сервис за HTTPS (например, за reverse proxy) и не открывать `/admin` наружу без необходимости.
