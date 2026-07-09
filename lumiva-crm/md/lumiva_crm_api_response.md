# Lumiva CRM API response for Yii2 site connector

Документ подготовлен как технический ответ на запрос `lumiva_crm_api_request.md`.

Цель интеграции: связать внешний сайт NSM на PHP/Yii2 с Lumiva CRM в двух направлениях:

- сайт -> Lumiva CRM;
- Lumiva CRM -> сайт.

Важно: в текущей версии Lumiva CRM финансовый модуль клиентов, транзакций и переводов реализован через модуль `CCP`. Исторически он рассчитан на внешний REST сайта в формате WordPress CCP plugin (`/wp-json/ccp/v1`). Для Yii2 есть два варианта подключения:

1. Реализовать на Yii2 совместимый REST API с теми же endpoint-ами и payload-ами, которые ожидает Lumiva CRM.
2. Доработать Lumiva CRM и заменить WordPress-specific adapter на generic Yii2 REST adapter.

Ниже описан текущий API Lumiva CRM и рекомендуемый контракт для коннектора.

## 1. Base URL API

Production base URL:

```text
https://crm.lumiva.agency/v1
```

Если CRM развёрнута на другом домене, используется тот же глобальный префикс:

```text
{CRM_HOST}/v1
```

Версия API:

```text
v1
```

Формат запросов:

```http
Content-Type: application/json
Accept: application/json
```

Формат ответов:

```text
JSON
```

Swagger/OpenAPI:

```text
GET /v1/docs
```

Swagger доступен, если на окружении включён `SWAGGER_ENABLED=true` или окружение не production.

Sandbox/test окружение:

```text
Отдельного sandbox endpoint в коде нет.
Для тестирования рекомендуется использовать отдельный tenant / отдельный CRM instance / staging deployment.
```

Rate limits:

```text
Глобально включён throttling:
- 20 requests / second
- 100 requests / 10 seconds
- 400 requests / minute
```

Часть публичных inbound endpoint-ов может быть исключена из throttle через backend decorators.

## 2. Авторизация

Lumiva CRM поддерживает две основные схемы авторизации.

### 2.1. JWT Bearer token

Используется для основного CRM CRUD API:

- contacts;
- leads;
- companies;
- staff users / managers;
- CCP dashboard endpoints;
- sales;
- automations;
- settings.

Login:

```http
POST /v1/auth/login
Content-Type: application/json
```

Request:

```json
{
  "clientKey": "TENANT_CLIENT_KEY",
  "email": "admin@example.com",
  "password": "password"
}
```

Response:

```json
{
  "accessToken": "JWT_ACCESS_TOKEN",
  "tenantId": "crm_tenant_id",
  "user": {
    "id": "crm_user_id",
    "email": "admin@example.com",
    "role": "owner"
  }
}
```

Авторизованный запрос:

```http
GET /v1/contacts
Authorization: Bearer JWT_ACCESS_TOKEN
Accept: application/json
```

Срок жизни токена:

```text
Задаётся переменной JWT_EXPIRES_IN.
Default в коде: 7 дней.
```

Refresh token:

```text
Отдельного refresh endpoint в текущем API нет.
При истечении токена нужно выполнить повторный login.
```

Права для полной синхронизации:

```text
Рекомендуется service user с ролью owner или отдельная роль с правами:
- contacts:read/write/delete
- companies:read/write/delete
- leads read/write
- staff-users read/write
- ccp read/write
- automations read/write, если нужны outbound webhook-и
```

### 2.2. API token / server-to-server token

Используется для публичных inbound endpoint-ов, где внешний сайт отправляет данные в CRM без пользовательской JWT-сессии.

Header:

```http
X-Api-Token: CRM_API_TOKEN
```

Также поддерживается alias:

```http
X-Api-Key: CRM_API_TOKEN
```

Пример:

```http
POST /v1/ccp/ingest
X-Api-Token: CRM_API_TOKEN
Content-Type: application/json
Accept: application/json
```

Требования:

- token должен быть активен;
- tenant должен иметь `apiEnabled=true`;
- tenant не должен быть заблокирован или просрочен.

Управление API tokens:

```text
GET    /v1/api-tokens
POST   /v1/api-tokens
PATCH  /v1/api-tokens/:id
DELETE /v1/api-tokens/:id
```

Эти endpoint-ы требуют JWT Bearer авторизацию.

## 3. Endpoint-ы

### 3.1. Основные endpoint-ы Lumiva CRM

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Auth | Login | POST | `/v1/auth/login` | Public | Получить JWT access token |
| Health | Health check | GET | `/v1/health` | Public | Проверка доступности backend |
| Docs | Swagger | GET | `/v1/docs` | Public / env gated | OpenAPI документация, если включена |
| API tokens | List tokens | GET | `/v1/api-tokens` | Bearer JWT | Список server-to-server токенов |
| API tokens | Create token | POST | `/v1/api-tokens` | Bearer JWT | Создать API token |
| Public | Ping | POST | `/v1/public/ping` | X-Api-Token | Проверка API token и tenant |
| Public | Tenant meta | GET | `/v1/public/tenant/meta` | X-Api-Token | Метаданные tenant |

### 3.2. Клиенты сайта / финансовые клиенты через CCP

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| CCP site | List sites | GET | `/v1/ccp/sites` | Bearer JWT | Список подключённых сайтов |
| CCP site | Create site | POST | `/v1/ccp/sites` | Bearer JWT | Создать site connection |
| CCP site | Connect site | POST | `/v1/ccp/sites/connect` | Bearer JWT | Подключить внешний REST сайта |
| CCP site | Connect by token | POST | `/v1/ccp/sites/connect-by-token` | X-Api-Token | Подключение сайта через API token |
| CCP client | List clients | GET | `/v1/ccp/clients?siteId={siteId}&search={q}&page=1&per=50` | Bearer JWT | Список клиентов из локального CCP storage |
| CCP client | Get client | GET | `/v1/ccp/clients/:id` | Bearer JWT | Получить клиента |
| CCP client | Create client | POST | `/v1/ccp/clients?siteId={siteId}` | Bearer JWT | Создать клиента на сайте и сохранить в CRM |
| CCP client | Update client | PATCH | `/v1/ccp/clients/:id` | Bearer JWT | Обновить клиента на сайте и в CRM |
| CCP ingest | Ingest data | POST | `/v1/ccp/ingest` | X-Api-Token | Сайт отправляет client/txn/transfer upsert в CRM |

### 3.3. Транзакции и переводы через CCP

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Transaction | List transactions | GET | `/v1/ccp/txns?siteId={siteId}&wpUserId={externalUserId}&page=1&per=50&fresh=1` | Bearer JWT | Список транзакций. `fresh=1` запрашивает свежие данные с сайта |
| Transaction | Create transaction | POST | `/v1/ccp/txns?siteId={siteId}` | Bearer JWT | Создать транзакцию на сайте и сохранить в CRM |
| Transaction | Update transaction | PATCH | `/v1/ccp/txns/:siteId/:wpPostId` | Bearer JWT | Обновить транзакцию на сайте и в CRM |
| Transfer | List transfers | GET | `/v1/ccp/transfers?siteId={siteId}&wpUserId={externalUserId}&page=1&per=50&fresh=1` | Bearer JWT | Список переводов |
| Transfer | Create transfer | POST | `/v1/ccp/transfers?siteId={siteId}` | Bearer JWT | Создать перевод на сайте и сохранить в CRM |
| Transfer | Update transfer | PATCH | `/v1/ccp/transfers/:siteId/:wpPostId` | Bearer JWT | Обновить перевод на сайте и в CRM |

Примечание по названиям:

```text
В текущем CCP коде используются legacy-поля wpUserId и wpPostId.
Для Yii2 их нужно трактовать как externalUserId и externalRecordId.
Рекомендуется при доработке переименовать их в generic поля:
- externalUserId
- externalClientId
- externalTransactionId
- externalTransferId
```

### 3.4. CRM contacts

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Contact | List contacts | GET | `/v1/contacts?search={q}&status=active&limit=50&offset=0` | Bearer JWT | Список CRM-контактов |
| Contact | Get contact | GET | `/v1/contacts/:id?withRelations=true` | Bearer JWT | Получить контакт |
| Contact | Create contact | POST | `/v1/contacts` | Bearer JWT | Создать контакт |
| Contact | Update contact | PATCH | `/v1/contacts/:id` | Bearer JWT | Обновить контакт |
| Contact | Delete contact | DELETE | `/v1/contacts/:id` | Bearer JWT | Удалить / архивировать контакт |
| Contact | Bulk update | POST | `/v1/contacts/bulk-update` | Bearer JWT | Массовое обновление |

CRM contacts подходят для обычной CRM-коммуникации, но не являются полной заменой CCP-клиентам с балансами и финансовыми операциями.

### 3.5. Leads

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Lead | List leads | GET | `/v1/leads` | Bearer JWT | Список лидов |
| Lead | Search leads | GET | `/v1/leads/search?q={q}&limit=20` | Bearer JWT | Поиск лидов |
| Lead | Get lead | GET | `/v1/leads/:id` | Bearer JWT | Получить лид |
| Lead | Lead history | GET | `/v1/leads/:id/history` | Bearer JWT | История лида |
| Lead | Create lead | POST | `/v1/leads` | Bearer JWT | Создать лид |
| Lead | Update lead | PATCH | `/v1/leads/:id` | Bearer JWT | Обновить лид |
| Lead | Delete lead | DELETE | `/v1/leads/:id` | Bearer JWT owner | Удалить лид |
| Public lead | Create inbound lead | POST | `/v1/public/inbound-lead` | X-Api-Token | Сайт отправляет заявку/лид в CRM |
| Public lead | Create public lead | POST | `/v1/public/leads` | Site apiToken in body | Альтернативный публичный endpoint для лидов |

### 3.6. Менеджеры / сотрудники CRM

В Lumiva CRM менеджеры представлены как staff users.

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Staff user | List managers/users | GET | `/v1/staff-users` | Bearer JWT | Список сотрудников |
| Staff user | Get manager/user | GET | `/v1/staff-users/:id` | Bearer JWT | Получить сотрудника |
| Staff user | Create manager/user | POST | `/v1/staff-users` | Bearer JWT | Создать сотрудника |
| Staff user | Invite manager/user | POST | `/v1/staff-users/invite` | Bearer JWT | Пригласить сотрудника |
| Staff user | Update manager/user | PATCH | `/v1/staff-users/:id` | Bearer JWT | Обновить сотрудника |
| Staff user | Update role | PATCH | `/v1/staff-users/:id/role` | Bearer JWT | Изменить роль |
| Staff user | Activate | PATCH | `/v1/staff-users/:id/activate` | Bearer JWT | Активировать |
| Staff user | Deactivate | PATCH | `/v1/staff-users/:id/deactivate` | Bearer JWT | Деактивировать |
| Staff user | Delete | DELETE | `/v1/staff-users/:id` | Bearer JWT | Удалить сотрудника |

Роли:

```text
owner
manager
sales
finance
viewer
developer
support
```

### 3.7. Companies

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Company | List companies | GET | `/v1/companies` | Bearer JWT | Список компаний |
| Company | Get company | GET | `/v1/companies/:id` | Bearer JWT | Получить компанию |
| Company | Create company | POST | `/v1/companies` | Bearer JWT | Создать компанию |
| Company | Update company | PATCH | `/v1/companies/:id` | Bearer JWT | Обновить компанию |
| Company | Delete company | DELETE | `/v1/companies/:id` | Bearer JWT | Удалить / архивировать компанию |
| Company | Bulk update | POST | `/v1/companies/bulk-update` | Bearer JWT | Массовое обновление |

### 3.8. Валюты и статусы

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---:|---|---|---|
| Currency | List currencies | N/A | N/A | N/A | Отдельного endpoint-а валют сейчас нет |
| Currency | Create/update currency | N/A | N/A | N/A | Не поддерживается как справочник |
| Status | List statuses | N/A | N/A | N/A | Отдельного endpoint-а статусов сейчас нет |
| Status | Create/update status | N/A | N/A | N/A | Не поддерживается как справочник |

В текущем CCP модуле валюты используются как строковые значения:

```text
EUR
USD
```

Статусы также используются как строковые поля в соответствующих сущностях.

## 4. JSON-примеры

### 4.1. CCP site connect

Current request:

```json
{
  "siteId": "crm_ccp_site_id",
  "wpRestBase": "https://nsm-swissconsulting.com/wp-json/ccp/v1",
  "wpToken": "SITE_REST_TOKEN"
}
```

Recommended Yii2-compatible request after generic adapter:

```json
{
  "siteId": "crm_ccp_site_id",
  "restBase": "https://nsm-swissconsulting.com/api/v1/crm",
  "siteToken": "SITE_REST_TOKEN",
  "adapter": "yii2"
}
```

Response:

```json
{
  "ok": true,
  "site": {
    "id": "crm_ccp_site_id",
    "siteUrl": "https://nsm-swissconsulting.com",
    "status": "connected"
  }
}
```

### 4.2. Client create request

CRM -> site через CCP:

```http
POST /v1/ccp/clients?siteId=crm_ccp_site_id
Authorization: Bearer JWT_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "email": "client@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+41790000000",
  "status": "active",
  "managerId": "crm_staff_user_id",
  "externalId": "site_user_123",
  "balanceEur": 0,
  "balanceUsd": 0,
  "accountEur": "CH0000000000000000000",
  "accountUsd": "CH0000000000000000001",
  "meta": {
    "source": "yii2",
    "verified": true
  }
}
```

### 4.3. Client create response

```json
{
  "id": "crm_ccp_client_id",
  "siteId": "crm_ccp_site_id",
  "wpUserId": "site_user_123",
  "email": "client@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+41790000000",
  "status": "active",
  "balanceEur": 0,
  "balanceUsd": 0,
  "accountEur": "CH0000000000000000000",
  "accountUsd": "CH0000000000000000001",
  "createdAt": "2026-05-31T12:00:00.000Z",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

Для Yii2 `wpUserId` нужно воспринимать как `externalUserId`.

### 4.4. Client update request

```http
PATCH /v1/ccp/clients/crm_ccp_client_id
Authorization: Bearer JWT_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "phone": "+41791111111",
  "status": "active",
  "managerId": "crm_staff_user_id",
  "meta": {
    "verified": true
  }
}
```

### 4.5. Client list response

```json
{
  "items": [
    {
      "id": "crm_ccp_client_id",
      "siteId": "crm_ccp_site_id",
      "wpUserId": "site_user_123",
      "email": "client@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "status": "active",
      "balanceEur": 1200.5,
      "balanceUsd": 0,
      "createdAt": "2026-05-31T12:00:00.000Z",
      "updatedAt": "2026-05-31T12:10:00.000Z"
    }
  ],
  "page": 1,
  "per": 50,
  "total": 1
}
```

### 4.6. Site -> CRM client upsert

```http
POST /v1/ccp/ingest
X-Api-Token: CRM_API_TOKEN
Content-Type: application/json
```

```json
{
  "type": "client.upsert",
  "siteId": "crm_ccp_site_id",
  "externalId": "site_user_123",
  "payload": {
    "email": "client@example.com",
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+41790000000",
    "status": "active",
    "verified": true,
    "managerExternalId": "site_manager_55",
    "balanceEur": 1200.5,
    "balanceUsd": 0,
    "accountEur": "CH0000000000000000000",
    "accountUsd": "CH0000000000000000001",
    "updatedAt": "2026-05-31T12:10:00.000Z"
  }
}
```

Response:

```json
{
  "ok": true,
  "type": "client.upsert",
  "id": "crm_ccp_client_id"
}
```

### 4.7. Transaction create request

```http
POST /v1/ccp/txns?siteId=crm_ccp_site_id
Authorization: Bearer JWT_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "wpUserId": "site_user_123",
  "type": "deposit",
  "currency": "EUR",
  "sum": 500,
  "status": "pending",
  "accepted": false,
  "managerId": "crm_staff_user_id",
  "externalId": "site_transaction_9001",
  "meta": {
    "comment": "Initial deposit"
  }
}
```

Recommended Yii2 naming:

```json
{
  "externalUserId": "site_user_123",
  "type": "deposit",
  "currency": "EUR",
  "sum": 500,
  "status": "pending",
  "accepted": false,
  "managerId": "crm_staff_user_id",
  "externalId": "site_transaction_9001"
}
```

### 4.8. Transaction response

```json
{
  "id": "crm_ccp_txn_id",
  "siteId": "crm_ccp_site_id",
  "wpUserId": "site_user_123",
  "wpPostId": "site_transaction_9001",
  "type": "deposit",
  "currency": "EUR",
  "sum": 500,
  "ccpStatus": "pending",
  "accepted": false,
  "createdAt": "2026-05-31T12:00:00.000Z",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

### 4.9. Transfer create request

```http
POST /v1/ccp/transfers?siteId=crm_ccp_site_id
Authorization: Bearer JWT_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "wpUserId": "site_user_123",
  "fromAccountId": "site_account_eur_1",
  "toAccountId": "site_account_usd_1",
  "amount": 300,
  "currency": "EUR",
  "status": "pending",
  "externalId": "site_transfer_7001"
}
```

### 4.10. Transfer response

```json
{
  "id": "crm_ccp_transfer_id",
  "siteId": "crm_ccp_site_id",
  "wpUserId": "site_user_123",
  "wpPostId": "site_transfer_7001",
  "amount": 300,
  "currency": "EUR",
  "ccpStatus": "pending",
  "createdAt": "2026-05-31T12:00:00.000Z",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

### 4.11. Manager create request

```http
POST /v1/staff-users
Authorization: Bearer JWT_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "email": "manager@example.com",
  "firstName": "Anna",
  "lastName": "Manager",
  "phone": "+41792222222",
  "role": "manager",
  "externalId": "site_manager_55",
  "status": "active"
}
```

### 4.12. Manager response

```json
{
  "id": "crm_staff_user_id",
  "email": "manager@example.com",
  "firstName": "Anna",
  "lastName": "Manager",
  "phone": "+41792222222",
  "role": "manager",
  "externalId": "site_manager_55",
  "status": "active",
  "createdAt": "2026-05-31T12:00:00.000Z",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

### 4.13. Error response

Standard NestJS error:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

Validation error:

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "firstName should not be empty"
  ],
  "error": "Bad Request"
}
```

Tenant/API token error:

```json
{
  "statusCode": 403,
  "code": "TENANT_INACTIVE",
  "reason": "blocked",
  "message": "Tenant is not active"
}
```

Recommended connector-side normalized error format:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Email already exists",
  "fields": {
    "email": "Already exists"
  }
}
```

## 5. Webhook events

### 5.1. Текущее состояние

Lumiva CRM сейчас поддерживает inbound webhook-и в CRM, например:

```text
POST /v1/webhooks/site-forms/:connectionId
POST /v1/webhooks/amocrm/:connectionId
POST /v1/webhooks/whatsapp/:connectionId
POST /v1/billing/stripe/webhook
```

Для полноценного outbound webhook потока `CRM -> Yii2 site` по событиям `client.created`, `transaction.created`, `transfer.updated` отдельного системного webhook-модуля сейчас нет.

Доступный workaround:

```text
Lumiva Automations -> action trigger_webhook -> POST на внешний URL
```

Целевой URL сайта:

```text
POST https://nsm-swissconsulting.com/api/v1/crm/webhook
```

### 5.2. Рекомендуемые webhook events для доработки

| Event | Когда срабатывает | Payload | Нужно ли подтверждение |
|---|---|---|---|
| `client.created` | Создан клиент в CRM | `ClientWebhookPayload` | Да, HTTP 2xx |
| `client.updated` | Обновлён клиент в CRM | `ClientWebhookPayload` | Да, HTTP 2xx |
| `client.deleted` | Клиент деактивирован/удалён | `{ event, entity, id, externalId, deletedAt }` | Да, HTTP 2xx |
| `manager.created` | Создан staff user с ролью manager/sales/finance | `ManagerWebhookPayload` | Да, HTTP 2xx |
| `manager.updated` | Обновлён manager/staff user | `ManagerWebhookPayload` | Да, HTTP 2xx |
| `account.created` | Создан счёт клиента | `AccountWebhookPayload` | Да, HTTP 2xx |
| `account.updated` | Обновлён счёт/баланс/статус | `AccountWebhookPayload` | Да, HTTP 2xx |
| `transaction.created` | Создана транзакция | `TransactionWebhookPayload` | Да, HTTP 2xx |
| `transaction.updated` | Обновлена транзакция | `TransactionWebhookPayload` | Да, HTTP 2xx |
| `transfer.created` | Создан перевод | `TransferWebhookPayload` | Да, HTTP 2xx |
| `transfer.updated` | Обновлён перевод | `TransferWebhookPayload` | Да, HTTP 2xx |
| `status.updated` | Изменён статус клиента/счёта/операции | `{ event, entity, id, externalId, status }` | Да, HTTP 2xx |
| `currency.updated` | Изменена валюта/курс/справочник | `{ event, currency }` | Да, HTTP 2xx |

### 5.3. Recommended webhook headers

```http
Content-Type: application/json
X-Lumiva-Event: transaction.updated
X-Lumiva-Delivery-Id: uuid
X-Lumiva-Timestamp: 2026-05-31T12:00:00.000Z
X-Lumiva-Signature: sha256=HMAC_SHA256(rawBody, webhookSecret)
```

### 5.4. Recommended webhook payload

```json
{
  "event": "transaction.updated",
  "deliveryId": "delivery_uuid",
  "occurredAt": "2026-05-31T12:00:00.000Z",
  "tenantId": "crm_tenant_id",
  "siteId": "crm_ccp_site_id",
  "entity": "transaction",
  "id": "crm_ccp_txn_id",
  "externalId": "site_transaction_9001",
  "data": {
    "externalUserId": "site_user_123",
    "type": "deposit",
    "currency": "EUR",
    "sum": 500,
    "status": "accepted",
    "accepted": true,
    "updatedAt": "2026-05-31T12:00:00.000Z"
  }
}
```

### 5.5. Retry policy recommendation

Рекомендуется реализовать:

```text
Retry on: HTTP 408, 429, 500, 502, 503, 504, timeout
No retry on: HTTP 400, 401, 403, 404, 409, 422
Schedule: 1 min, 5 min, 15 min, 1 hour, 6 hours
Max attempts: 5
```

## 6. Маппинг полей Lumiva CRM <-> Yii2-сайт

### 6.1. Clients

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|
| `site.user.id` | `ccpClient.wpUserId` / recommended `externalUserId` | string | Да | Legacy name `wpUserId`; для Yii2 использовать как external user id |
| `site.user.email` | `ccpClient.email` / `contact.email` | string | Да | Использовать для поиска дублей |
| `site.user.firstName` | `ccpClient.firstName` / `contact.firstName` | string | Нет | Имя клиента |
| `site.user.lastName` | `ccpClient.lastName` / `contact.lastName` | string | Нет | Фамилия клиента |
| `site.user.phone` | `ccpClient.phone` / `contact.phone` | string | Нет | Телефон в E.164 желательно |
| `site.user.address` | `ccpClient.meta.address` / `contact.address` | string/object | Нет | В CCP лучше хранить в `meta` |
| `site.user.status` | `ccpClient.status` | string | Да | Например `active`, `inactive`, `blocked`, `archived` |
| `site.user.status_id` | `ccpClient.meta.statusId` | number/string | Нет | Если на сайте статусы числовые |
| `site.user.verified` | `ccpClient.meta.verified` | boolean | Нет | KYC/verification flag |
| `site.user.manager_id` | `ccpClient.managerId` or `meta.managerExternalId` | string | Нет | CRM staff id или внешний id менеджера |
| `site.user.created` | `ccpClient.createdAt` / `meta.siteCreatedAt` | datetime | Нет | Желательно ISO 8601 |
| `site.user.updated_at` | `ccpClient.updatedAt` / `meta.siteUpdatedAt` | datetime | Да | Нужно для conflict resolution |

### 6.2. Managers

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|
| `site.user.id` | `staffUser.externalId` | string | Да | ID менеджера на сайте |
| `site.user.email` | `staffUser.email` | string | Да | Уникальный email |
| `site.user.firstName` | `staffUser.firstName` | string | Нет | Имя |
| `site.user.lastName` | `staffUser.lastName` | string | Нет | Фамилия |
| `site.user.phone` | `staffUser.phone` | string | Нет | Телефон |
| `site.user.role` | `staffUser.role` | string | Да | `manager`, `sales`, `finance`, etc. |
| `site.user.status` | `staffUser.status` | string | Нет | `active`, `inactive`, `disabled` |

### 6.3. Accounts

В текущем CCP модуле отдельной сущности `account` как CRUD resource нет. Счета и балансы хранятся как поля клиента.

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|
| `site.account.id` | `ccpClient.meta.accounts[].externalId` | string | Да | Рекомендуется хранить в `meta`, если счетов больше двух |
| `site.account.user_id` | `ccpClient.wpUserId` / `externalUserId` | string | Да | Владелец счёта |
| `site.account.currency_id` | `ccpClient.meta.accounts[].currencyId` | string/number | Нет | Если на сайте есть справочник валют |
| `site.account.currency` | `ccpClient.accountEur/accountUsd` | string | Да | В текущем CCP явно есть EUR/USD поля |
| `site.account.amount` | `ccpClient.balanceEur/balanceUsd` | decimal | Да | Баланс |
| `site.account.balance` | `ccpClient.balanceEur/balanceUsd` | decimal | Да | Баланс |
| `site.account.status` | `ccpClient.meta.accounts[].status` | string | Нет | Например `active`, `blocked`, `closed` |
| `site.account.created` | `ccpClient.meta.accounts[].createdAt` | datetime | Нет | ISO 8601 |

Рекомендуемая доработка: вынести счета в отдельную CRM сущность `ccp_accounts` с собственными endpoint-ами.

### 6.4. Transactions

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|
| `site.transaction.id` | `ccpTxn.wpPostId` / recommended `externalTransactionId` | string | Да | Legacy name `wpPostId` |
| `site.transaction.account_id` | `ccpTxn.meta.accountId` | string | Нет | В текущей модели лучше хранить в `meta` |
| `site.transaction.manager_id` | `ccpTxn.managerId` / `meta.managerExternalId` | string | Нет | CRM manager id или external id |
| `site.transaction.asset_id` | `ccpTxn.meta.assetId` | string/number | Нет | Если применимо |
| `site.transaction.transaction_type_id` | `ccpTxn.meta.transactionTypeId` | string/number | Нет | Если на сайте числовые типы |
| `site.transaction.type` | `ccpTxn.type` | string | Да | `deposit`, `withdrawal`, etc. |
| `site.transaction.currency_id` | `ccpTxn.meta.currencyId` | string/number | Нет | Справочник сайта |
| `site.transaction.currency` | `ccpTxn.currency` | string | Да | `EUR`, `USD` |
| `site.transaction.sum` | `ccpTxn.sum` / amount field | decimal | Да | Сумма операции |
| `site.transaction.status` | `ccpTxn.ccpStatus` | string | Да | Статус операции |
| `site.transaction.accepted` | `ccpTxn.accepted` | boolean | Нет | Подтверждена ли операция |
| `site.transaction.created` | `ccpTxn.createdAt` / `meta.siteCreatedAt` | datetime | Нет | ISO 8601 |
| `site.transaction.updated_at` | `ccpTxn.updatedAt` / `meta.siteUpdatedAt` | datetime | Да | Для синхронизации |

### 6.5. Transfers

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|
| `site.transfer.id` | `ccpTransfer.wpPostId` / recommended `externalTransferId` | string | Да | Legacy name `wpPostId` |
| `site.transfer.user_id` | `ccpTransfer.wpUserId` / `externalUserId` | string | Да | Клиент |
| `site.transfer.from_account_id` | `ccpTransfer.meta.fromAccountId` | string | Да | Счёт списания |
| `site.transfer.to_account_id` | `ccpTransfer.meta.toAccountId` | string | Да | Счёт зачисления |
| `site.transfer.amount` | `ccpTransfer.amount` | decimal | Да | Сумма |
| `site.transfer.currency` | `ccpTransfer.currency` | string | Да | `EUR`, `USD` |
| `site.transfer.status` | `ccpTransfer.ccpStatus` | string | Да | Статус перевода |
| `site.transfer.created` | `ccpTransfer.createdAt` / `meta.siteCreatedAt` | datetime | Нет | ISO 8601 |

### 6.6. Currencies

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|
| `site.currency.id` | `meta.currencyId` | string/number | Нет | Отдельного CRM справочника валют нет |
| `site.currency.name` | `meta.currencyName` | string | Нет | Например `Euro` |
| `site.currency.shortName` | `currency` | string | Да | `EUR`, `USD` |
| `site.currency.sign` | `meta.currencySign` | string | Нет | `€`, `$` |

## 7. Правила синхронизации

### 7.1. Сайт -> CRM

Сайт должен отправлять изменения в CRM через:

```text
POST /v1/ccp/ingest
```

Supported ingest types:

```text
client.upsert
txn.upsert
transfer.upsert
```

Рекомендуемый алгоритм:

1. На сайте произошло создание/обновление клиента, транзакции или перевода.
2. Yii2 connector формирует payload с `externalId`, `updatedAt` и полным snapshot объекта.
3. Yii2 connector отправляет payload в Lumiva CRM через `X-Api-Token`.
4. CRM выполняет upsert по `(siteId, externalId)` или legacy `(siteId, wpUserId/wpPostId)`.
5. Yii2 сохраняет результат синхронизации в своей таблице связей.

Рекомендуемая таблица связей на сайте:

```text
local_entity
local_id
crm_entity
crm_id
external_id
last_synced_at
last_sync_status
last_sync_error
```

### 7.2. CRM -> сайт

Текущий вариант:

```text
CRM CCP endpoints вызывают внешний REST сайта при create/update clients/txns/transfers.
```

Для Yii2 сайт должен предоставить REST API, совместимый с тем, что ожидает CRM adapter:

```text
GET    /api/v1/crm/meta
GET    /api/v1/crm/clients
POST   /api/v1/crm/clients
PUT    /api/v1/crm/clients/{id}
GET    /api/v1/crm/txns
POST   /api/v1/crm/txns
PUT    /api/v1/crm/txns/{id}
GET    /api/v1/crm/transfers
POST   /api/v1/crm/transfers
PUT    /api/v1/crm/transfers/{id}
GET    /api/v1/crm/users/resolve?email={email}
POST   /api/v1/crm/webhook
```

Recommended site auth header:

```http
X-CCP-Token: SITE_REST_TOKEN
```

Для generic Yii2 adapter можно использовать:

```http
Authorization: Bearer SITE_REST_TOKEN
```

Но в текущем CRM CCP adapter ожидается именно `X-CCP-Token`.

### 7.3. Кто главный при конфликте

Рекомендуемое правило:

```text
CRM главнее для финансовых данных, счетов, балансов, переводов, статусов и менеджеров.
Сайт главнее только для первичной регистрации клиента, входа пользователя и полей профиля, которые пользователь редактирует самостоятельно.
```

Подробно:

| Данные | Source of truth |
|---|---|
| Client email | Сайт при регистрации, CRM после ручной верификации |
| Client phone/name/address | Last write wins с проверкой `updatedAt`, но CRM имеет приоритет при ручной правке |
| Verification/KYC status | CRM |
| Manager assignment | CRM |
| Account status | CRM |
| Balance | CRM / финансовая операция, не ручной PATCH |
| Transaction status | CRM |
| Transfer status | CRM |
| Currency dictionary | Сайт или отдельный справочник, пока в CRM нет endpoint-а |

### 7.4. Как избегать дублей

Для каждого объекта обязательно передавать:

```text
externalId
updatedAt
email, если это client/contact
```

Правила idempotency:

- client: upsert по `siteId + externalUserId`;
- transaction: upsert по `siteId + externalTransactionId`;
- transfer: upsert по `siteId + externalTransferId`;
- manager: upsert по `externalId` или `email`;
- contact: upsert по `email` или отдельному external id в `meta`.

Рекомендуемый header для будущей доработки:

```http
Idempotency-Key: entity-type:external-id:updated-at
```

В текущем API полноценный `Idempotency-Key` как отдельный механизм не реализован.

### 7.5. Как обрабатывать ошибки

Connector должен:

1. Логировать request/response без секретов.
2. Повторять только временные ошибки: timeout, 408, 429, 500, 502, 503, 504.
3. Не повторять validation/auth/conflict ошибки без исправления данных.
4. Сохранять `last_sync_error`.
5. Поднимать alert после 5 неудачных попыток.

## 8. Ограничения API

Rate limits:

```text
20 requests / second
100 requests / 10 seconds
400 requests / minute
```

Payload size:

```text
Явный лимит payload для CCP в документации кода не выделен.
Рекомендуется держать обычные JSON payload-ы до 1 MB.
Для bulk sync использовать пагинацию.
```

Pagination:

```text
page/per для CCP endpoints.
limit/offset для части CRM endpoints.
```

Recommended delays:

```text
Для массовой первичной синхронизации:
- batch size: 50-100 объектов
- delay между batch: 300-1000 ms
- retry backoff: exponential
```

Ограничения на редактирование финансовых данных:

- Баланс нельзя менять произвольным PATCH без финансовой операции.
- Изменение баланса должно идти через transaction/transfer.
- Транзакции после `accepted=true` нельзя редактировать без отдельной корректирующей операции.
- Удаление транзакций и переводов не рекомендуется; вместо этого использовать cancel/reject/reversal.
- Статусы `accepted`, `rejected`, `cancelled` должны быть финальными, если бизнес-логика NSM не разрешает reopen.

Текущие отсутствующие возможности:

```text
- Нет отдельного /currencies endpoint.
- Нет отдельного /statuses endpoint.
- Нет отдельного /accounts CRUD endpoint.
- Нет DELETE endpoint для CCP clients/txns/transfers.
- Нет native outbound webhook dispatcher для client/transaction/transfer events.
- Нет refresh token endpoint.
- Нет полноценного Idempotency-Key middleware.
```

## 9. Особенности счетов, балансов и транзакций

### 9.1. Счета

В текущем Lumiva CRM CCP модуле счета не являются отдельной сущностью. Они представлены на уровне клиента:

```text
accountEur
accountUsd
balanceEur
balanceUsd
investmentStyle
investmentAnnualPercent
creditLeverage
creditRepayMonthlyPercent
investmentProfitMonthlyPercent
accountDebitMonthlyPercent
```

Если на сайте NSM у клиента может быть больше двух счетов или больше двух валют, рекомендуется доработать CRM и добавить отдельную сущность:

```text
ccp_accounts
```

Рекомендуемая структура:

```json
{
  "id": "crm_account_id",
  "siteId": "crm_ccp_site_id",
  "clientId": "crm_ccp_client_id",
  "externalId": "site_account_id",
  "externalUserId": "site_user_id",
  "currency": "EUR",
  "balance": 1200.5,
  "status": "active",
  "blockedReason": null,
  "createdAt": "2026-05-31T12:00:00.000Z",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

Рекомендуемые account endpoint-ы для доработки:

```text
GET    /v1/ccp/accounts?siteId={siteId}&clientId={clientId}
GET    /v1/ccp/accounts/:id
POST   /v1/ccp/accounts?siteId={siteId}
PATCH  /v1/ccp/accounts/:id
POST   /v1/ccp/accounts/:id/block
POST   /v1/ccp/accounts/:id/unblock
```

### 9.1.1. Инвестиционные параметры клиента

Для аналитики внутри счета клиента CRM ожидает, что сайт будет отдавать инвестиционные параметры в `client.upsert` payload или `meta`:

```json
{
  "investmentStyle": "Стабильный",
  "investmentAnnualPercent": 12,
  "creditLeverage": 1000,
  "creditRepayMonthlyPercent": 0.41,
  "investmentProfitMonthlyPercent": 12,
  "accountDebitMonthlyPercent": 10,
  "meta": {
    "ccp_investment_style": "Стабильный",
    "ccp_investment_annual_percent": 12,
    "ccp_credit_leverage": 1000,
    "ccp_credit_repay_monthly_percent": 0.41,
    "ccp_investment_profit_monthly_percent": 12,
    "ccp_account_debit_monthly_percent": 10
  }
}
```

Если `investmentAnnualPercent` не передан явно, CRM использует процент по стилю: Консервативный 7%, Стабильный 12%, Растущий 14%, Сбалансированный 18%, Повышенный риск 24%.

### 9.2. Балансы

Баланс должен меняться только через:

- deposit;
- withdrawal;
- transfer;
- profit;
- fee;
- manual_adjustment;
- reversal/correction transaction.

Нельзя делать:

```text
PATCH client.balanceEur = 999999
```

Правильный flow:

```text
1. CRM создаёт transaction с типом manual_adjustment / deposit / withdrawal.
2. Сайт подтверждает или отклоняет операцию.
3. Сайт пересчитывает баланс.
4. Сайт отправляет transaction.updated и client.upsert обратно в CRM.
5. CRM сохраняет новый баланс как результат операции.
```

### 9.3. Транзакции

Рекомендуемые типы операций:

```text
deposit
withdrawal
transfer
investment
profit
fee
internal_transfer
manual_adjustment
reversal
```

Текущий CRM CCP модуль хранит тип как строку. Если на сайте используются числовые `transaction_type_id`, их нужно передавать в `meta.transactionTypeId`.

Рекомендуемые статусы:

```text
pending
accepted
rejected
cancelled
failed
processing
```

Правила:

- `pending` можно редактировать;
- `accepted` нельзя менять напрямую;
- `rejected` нельзя превращать в `accepted` без новой операции;
- отмена должна создавать корректирующую запись, если деньги уже повлияли на баланс;
- все суммы должны передаваться decimal/string-safe, без float rounding на стороне сайта.

### 9.4. Переводы

Transfer должен содержать:

```json
{
  "externalTransferId": "site_transfer_7001",
  "externalUserId": "site_user_123",
  "fromAccountId": "site_account_eur_1",
  "toAccountId": "site_account_usd_1",
  "amount": "300.00",
  "currency": "EUR",
  "status": "pending",
  "createdAt": "2026-05-31T12:00:00.000Z"
}
```

Рекомендуемый flow:

```text
1. CRM создаёт transfer pending.
2. Yii2 site проверяет счета, валюту, лимиты и баланс.
3. Yii2 site возвращает created/accepted/rejected status.
4. CRM сохраняет transfer и обновляет UI.
5. При изменении на сайте Yii2 отправляет transfer.upsert в /v1/ccp/ingest.
```

### 9.5. Что должен реализовать Yii2-сайт

Минимальный REST на стороне Yii2:

```text
GET    /api/v1/crm/meta
GET    /api/v1/crm/clients
POST   /api/v1/crm/clients
PUT    /api/v1/crm/clients/{id}
GET    /api/v1/crm/txns
POST   /api/v1/crm/txns
PUT    /api/v1/crm/txns/{id}
GET    /api/v1/crm/transfers
POST   /api/v1/crm/transfers
PUT    /api/v1/crm/transfers/{id}
GET    /api/v1/crm/users/resolve?email={email}
POST   /api/v1/crm/webhook
```

Минимальная авторизация сайта:

```http
X-CCP-Token: SITE_REST_TOKEN
```

Рекомендуемый response для всех write operations:

```json
{
  "ok": true,
  "id": "site_record_id",
  "externalId": "site_record_id",
  "status": "accepted",
  "updatedAt": "2026-05-31T12:00:00.000Z"
}
```

## 10. Рекомендуемый план подключения

1. Создать отдельный tenant или staging окружение CRM для тестов.
2. Создать service user в CRM с ролью `owner` или нужными правами.
3. Создать `X-Api-Token` для Yii2 -> CRM запросов.
4. На Yii2 реализовать endpoint `POST /api/v1/crm/webhook`.
5. На Yii2 реализовать совместимые REST endpoint-ы для clients/txns/transfers.
6. В CRM создать CCP site connection.
7. Проверить `POST /v1/public/ping` с `X-Api-Token`.
8. Проверить `POST /v1/ccp/ingest` с `client.upsert`.
9. Проверить CRM -> Yii2 create/update client.
10. Проверить transaction/transfer create/update.
11. Включить retry queue и таблицу sync log на стороне Yii2.
12. После тестов включить production token и production site connection.

## 11. Краткий вывод

Lumiva CRM уже имеет основу для интеграции:

- `/v1` API;
- JWT Bearer auth;
- `X-Api-Token` для server-to-server inbound;
- CCP module для клиентов, транзакций и переводов;
- contacts/leads/companies/staff-users CRUD.

Но для идеального подключения Yii2-сайта NSM нужно учесть ограничения текущей реализации:

- CCP adapter сейчас использует legacy WordPress naming (`wpRestBase`, `wpUserId`, `wpPostId`);
- нет отдельного accounts API;
- нет currencies/statuses API;
- нет системного outbound webhook dispatcher для `client.*`, `transaction.*`, `transfer.*`;
- нет полноценного idempotency middleware.

Самый быстрый путь подключения: реализовать на Yii2 REST API, совместимый с текущим CCP adapter, и использовать `/v1/ccp/ingest` для обратной синхронизации сайта в CRM.

