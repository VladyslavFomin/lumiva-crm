# Задача: подготовить данные API Lumiva CRM для интеграции с внешним Yii2-сайтом

Мне нужно подключить мою CRM Lumiva к внешнему сайту NSM.

Сайт НЕ WordPress.
Сайт написан на PHP/Yii2 и уже имеет REST API.

Нужна двусторонняя интеграция:

- сайт -> Lumiva CRM;
- Lumiva CRM -> сайт.

Через CRM нужно иметь возможность получать, создавать и редактировать данные сайта:

- клиентов;
- менеджеров;
- счета клиентов;
- балансы/суммы;
- переводы;
- транзакции;
- валюты;
- статусы;
- другие связанные данные, если они есть.

Подготовь, пожалуйста, техническое описание API Lumiva CRM, чтобы другой разработчик смог реализовать коннектор на стороне Yii2-сайта.

## 1. Общая информация

Укажи:

- Base URL API Lumiva CRM;
- версию API;
- формат запросов: JSON, form-data или другой;
- формат ответов;
- есть ли Swagger/OpenAPI/Postman collection;
- есть ли sandbox/test окружение;
- rate limits, если есть.

## 2. Авторизация

Опиши:

- тип авторизации: Bearer token, API key, Basic Auth, OAuth или другое;
- где передается токен: header, query, body;
- пример авторизованного запроса;
- срок жизни токена;
- как обновлять токен;
- какие права нужны токену для полной синхронизации.

Пример формата:

```http
Authorization: Bearer YOUR_TOKEN
```

## 3. Webhook-и из Lumiva CRM

Нужно узнать и описать:

- поддерживает ли Lumiva CRM webhook-и;
- как добавить внешний webhook URL;
- какие события можно отправлять наружу;
- есть ли подпись webhook-а;
- как проверять подпись;
- есть ли повторная отправка при ошибке;
- пример webhook payload.

Нужный URL на сайте будет примерно:

```text
POST https://nsm-swissconsulting.com/api/v1/crm/webhook
```

Нужные события:

```text
client.created
client.updated
client.deleted
manager.created
manager.updated
account.created
account.updated
transaction.created
transaction.updated
transfer.created
transfer.updated
status.updated
currency.updated
```

Если названия событий в Lumiva другие, укажи реальные названия.

## 4. Клиенты

Дай endpoint-ы для клиентов:

- получить список клиентов;
- получить клиента по ID;
- создать клиента;
- обновить клиента;
- удалить/деактивировать клиента;
- найти клиента по email;
- найти клиента по external_id, если поддерживается.

Для каждого endpoint-а укажи:

- URL;
- HTTP method;
- headers;
- query params;
- request body;
- response body;
- обязательные поля;
- необязательные поля;
- возможные ошибки.

Нужен маппинг полей:

```text
site.user.id          <-> crm.client.id
site.user.email       <-> ?
site.user.firstName   <-> ?
site.user.lastName    <-> ?
site.user.phone       <-> ?
site.user.address     <-> ?
site.user.status      <-> ?
site.user.status_id   <-> ?
site.user.verified    <-> ?
site.user.manager_id  <-> ?
site.user.created     <-> ?
```

## 5. Менеджеры

Дай endpoint-ы для менеджеров:

- получить список менеджеров;
- получить менеджера по ID;
- создать менеджера;
- обновить менеджера;
- удалить/деактивировать менеджера.

Нужен маппинг:

```text
site.user.id
site.user.email
site.user.firstName
site.user.lastName
site.user.phone
site.user.role = manager
```

## 6. Счета клиентов

Дай endpoint-ы для счетов:

- получить счета клиента;
- получить счет по ID;
- создать счет;
- обновить счет;
- изменить баланс;
- заблокировать/разблокировать счет;
- удалить/деактивировать счет, если поддерживается.

Нужно описать точную структуру счета в Lumiva CRM.

Маппинг с сайта:

```text
site.account.id
site.account.user_id
site.account.currency_id
site.account.amount / balance
site.account.status
site.account.created
```

Если в Lumiva CRM используются другие поля, укажи их.

## 7. Транзакции и переводы

Дай endpoint-ы для:

- списка транзакций;
- транзакций по клиенту;
- транзакций по счету;
- создания транзакции;
- обновления транзакции;
- отмены транзакции;
- создания перевода;
- подтверждения перевода;
- отклонения перевода.

Маппинг с сайта:

```text
site.transaction.id
site.transaction.account_id
site.transaction.manager_id
site.transaction.asset_id
site.transaction.transaction_type_id
site.transaction.currency_id
site.transaction.sum
site.transaction.status
site.transaction.accepted
site.transaction.created
```

Также нужно описание типов операций:

```text
deposit
withdrawal
transfer
investment
profit
fee
internal_transfer
manual_adjustment
```

Если в Lumiva CRM другие типы, укажи реальные.

## 8. Валюты

Дай endpoint-ы для валют:

- список валют;
- получить валюту по ID;
- создать валюту, если можно;
- обновить валюту, если можно.

Маппинг:

```text
site.currency.id
site.currency.name
site.currency.shortName
site.currency.sign
```

## 9. Статусы

Опиши статусы:

- клиента;
- счета;
- транзакции;
- перевода.

Нужен маппинг:

```text
site.status_id
site.status
site.verified
crm.status_id
crm.status
crm.active
crm.verified
```

## 10. Внешние ID и синхронизация

Очень важно узнать:

- есть ли в Lumiva CRM поле external_id;
- можно ли сохранять ID сайта внутри CRM;
- можно ли искать объект по external_id;
- что будет при повторной отправке одного и того же объекта;
- поддерживается ли idempotency key;
- есть ли поле updated_at для проверки изменений.

Нужно, чтобы Yii2-сайт мог хранить связь:

```text
local_entity
local_id
crm_entity
crm_id
external_id
last_synced_at
```

## 11. Ошибки API

Дай формат ошибок API.

Нужны примеры для:

- validation error;
- unauthorized;
- forbidden;
- not found;
- duplicate entity;
- rate limit;
- server error.

Пример желаемого формата:

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

## 12. Конфликты данных

Нужно определить правила конфликтов:

- если клиент изменен и на сайте, и в CRM, кто главный?
- если счет изменен и на сайте, и в CRM, кто главный?
- если транзакция изменена и на сайте, и в CRM, кто главный?
- какие поля разрешено менять из CRM;
- какие поля разрешено менять с сайта;
- какие поля нельзя менять после создания.

Предпочтительная логика:

```text
CRM главнее для финансовых данных, счетов, балансов, переводов, статусов и менеджеров.
Сайт может создавать клиентов/заявки, но CRM подтверждает и редактирует основные данные.
```

## 13. Что вернуть в ответе

Верни результат строго в таком формате:

```text
## 1. Base URL API

## 2. Авторизация

## 3. Endpoint-ы

Сделай таблицу:

| Сущность | Действие | Method | URL | Auth | Описание |
|---|---|---|---|---|---|

## 4. JSON-примеры

Для каждой сущности дай:

- create request;
- create response;
- update request;
- update response;
- list response;
- error response.

## 5. Webhook events

Таблица:

| Event | Когда срабатывает | Payload | Нужно ли подтверждение |
|---|---|---|---|

## 6. Маппинг полей Lumiva CRM <-> Yii2-сайт

Таблица:

| Yii2 поле | Lumiva CRM поле | Тип | Обязательное | Комментарий |
|---|---|---|---|---|

## 7. Правила синхронизации

Опиши:

- сайт -> CRM;
- CRM -> сайт;
- кто главный при конфликте;
- как избегать дублей;
- как обрабатывать ошибки.

## 8. Ограничения API

Опиши:

- rate limits;
- лимиты payload;
- обязательные задержки;
- ограничения на редактирование финансовых данных.

## 9. Особенности счетов, балансов и транзакций

Подробно опиши, как правильно редактировать счета клиентов, суммы, переводы и транзакции через API Lumiva CRM.
```

Важно: ответ должен быть техническим и пригодным для передачи разработчику, который будет писать Yii2-коннектор.
