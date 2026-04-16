# Google-интеграции Lumiva CRM: полная инструкция (платформа + клиент)

Документ описывает **одно OAuth-приложение Google (Client ID / Client Secret)** на стороне Lumiva и **что делаете вы** (владелец платформы / DevOps) и **что делает конечный клиент** (тенант CRM) для подключения инструментов Google в продукте.

---

## 1. Откуда берётся «полная ссылка» для Authorized redirect URIs

В коде CRM используется переменная окружения **`PUBLIC_API_URL`** — это **публичный базовый URL вашего API** без слэша в конце.

**Пример:** если API доступен по адресу `https://api.lumiva.example`, то:

```text
PUBLIC_API_URL=https://api.lumiva.example
```

Тогда **любой** redirect URI собирается так:

```text
{PUBLIC_API_URL}/v1/<путь_из_таблицы_ниже>
```

То есть вы **не «ищете» ссылку в интерфейсе Google** — вы **сами составляете** её из вашего реального домена API + фиксированного пути из таблицы.

---

## 2. Все callback-URL, которые нужно добавить в Google Cloud (один OAuth client)

В **Google Cloud Console → APIs & Services → Credentials → ваш OAuth 2.0 Client ID → Authorized redirect URIs** добавьте **каждую** строку ниже, подставив **ваш** `{PUBLIC_API_URL}` (без завершающего `/`).

| Назначение | Полный redirect URI (шаблон) |
|------------|--------------------------------|
| **Search Console (SEO)** в CRM | `{PUBLIC_API_URL}/v1/marketing/seo/google/callback` |
| **Google Ads** — мастер «Подключить через Google» (маркетинг) | `{PUBLIC_API_URL}/v1/marketing/integrations/google-ads/oauth/callback` |
| **Google Analytics 4** — мастер «Подключить GA4 через Google» (маркетинг) | `{PUBLIC_API_URL}/v1/marketing/integrations/ga4/oauth/callback` |
| **Google Calendar** — хаб интеграций («Подключить через Google») | `{PUBLIC_API_URL}/v1/integrations/google-calendar/oauth/callback` *(вызывается браузером Google **без** JWT CRM; защита — подписанный `state`)* |
| **Gmail** — подключение почты (OAuth) | `{PUBLIC_API_URL}/v1/email/oauth/google/callback` |

**Учебный пример** (вымышленный домен `api.lumiva.example`):

```text
https://api.lumiva.example/v1/marketing/seo/google/callback
https://api.lumiva.example/v1/marketing/integrations/google-ads/oauth/callback
https://api.lumiva.example/v1/marketing/integrations/ga4/oauth/callback
https://api.lumiva.example/v1/integrations/google-calendar/oauth/callback
https://api.lumiva.example/v1/email/oauth/google/callback
```

**Готовые URI для текущего значения из репозитория** (`lumiva-crm/backend/.env`: `PUBLIC_API_URL=https://crm.lumiva.agency`). Их можно **копировать в Google Cloud** как есть — **если** ваш продакшен действительно отдаёт API с того же хоста, что и в этом файле. Если API вынесен на другой домен — замените только префикс на ваш актуальный `PUBLIC_API_URL`.

```text
https://crm.lumiva.agency/v1/marketing/seo/google/callback
https://crm.lumiva.agency/v1/marketing/integrations/google-ads/oauth/callback
https://crm.lumiva.agency/v1/marketing/integrations/ga4/oauth/callback
https://crm.lumiva.agency/v1/integrations/google-calendar/oauth/callback
https://crm.lumiva.agency/v1/email/oauth/google/callback
```

Ошибка **`redirect_uri_mismatch`** почти всегда значит: в Google Cloud **нет в точности той же строки**, что отправляет API (см. колонку таблицы), либо **`PUBLIC_API_URL` в `.env` API** не совпадает с доменом, который вы зарегистрировали (лишний/пропущенный слэш, `http` вместо `https`, другой поддомен).

Других «скрытых» redirect для этого же клиента в рамках описанных флоу нет — если позже добавятся новые, их нужно будет добавить в эту же таблицу и в Google Console.

---

## 3. Один ли Client ID и Secret на все Google-инструменты?

**Да, по задумке Lumiva:** один **OAuth 2.0 Client** типа *Web application* в Google Cloud с **одной парой** Client ID + Client Secret хранится на **платформе** (pl1 **«Настройки»** → поля Google OAuth, либо fallback через env `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` на сервере API).

Этот **один и тот же** клиент используется для:

- входа в Google при **GSC** (scope `webmasters.readonly`);
- входа при **Google Ads** (scope `adwords`);
- входа при **GA4** маркетинговой интеграции (scope `analytics.readonly`);
- входа при **Gmail** в модуле почты (свои scope’ы в email-модуле).

Различаются не ключи, а **запрашиваемые scope** и **redirect URI** в момент авторизации — всё это уже зашито в соответствующие эндпоинты CRM.

**Важно:** в Google Cloud для этого проекта должны быть **включены нужные API** (Google Ads API, Google Analytics Data API / Admin API, Search Console API, Gmail API и т.д. — по факту используемых фич) и в **OAuth consent screen** разрешены соответствующие scope (или тип приложения Internal/External согласно вашей политике).

---

## 4. Что делаете **вы** (платформа / администратор)

### 4.1. Google Cloud Console (один раз на окружение: prod / staging)

1. Создайте проект или выберите существующий.
2. **APIs & Services → Library** — подключите API, которые реально используете (минимум под ваши сценарии):
   - Google Ads API  
   - Google Analytics Data API, Google Analytics Admin API  
   - Google Search Console API  
   - Gmail API (если используете почтовый OAuth)  
   - при необходимости Google Calendar API / Google Sheets API для интеграций хаба.
3. **OAuth consent screen** — заполните приложение (название, домены, политика при External).
   - **Публикация и ошибка `403: access_denied`:** если статус **Testing**, Google пускает **только** аккаунты из списка **Test users** (внизу того же экрана **OAuth consent screen** → раздел *Test users* → *Add users*). Сообщение вроде «приложение не прошло проверку Google», «доступ только для одобренных тестировщиков» — это оно: добавьте **точный** Google-аккаунт того, кто входит в CRM (например `user@gmail.com`), сохраните и повторите вход. Либо переведите приложение в **In production** (для **External** и чувствительных scope Google может потребовать отдельную верификацию приложения — смотрите подсказки в консоли). Для **Internal** (только организация Google Workspace) тестовый список не используется — входят только пользователи домена организации.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - в **Authorized redirect URIs** вставьте **все** URI из раздела 2 (со своим `PUBLIC_API_URL`), **построчно, без пробелов**;
   - при необходимости укажите **Authorized JavaScript origins** для вашего фронта CRM (домен, где открывается SPA), если Google это запрашивает для вашего типа клиента.
5. Скопируйте **Client ID** и **Client secret**.

### 4.2. Сервер API CRM (Docker / env)

Задайте как минимум:

| Переменная | Назначение |
|------------|------------|
| `PUBLIC_API_URL` | База API **без** завершающего `/` — из неё собираются все redirect URI выше. |
| `FRONTEND_URL` | База CRM-фронта (куда редиректит браузер после OAuth), без завершающего `/`. |
| `JWT_SECRET` | Секрет подписи `state` в OAuth (должен быть длинным и уникальным в prod). |

Опционально (если не хотите хранить ключи только в pl1):

| Переменная | Назначение |
|------------|------------|
| `GOOGLE_OAUTH_CLIENT_ID` | Fallback, если в БД платформы не заданы ключи. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | То же. |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token для **Google Ads API** (синхронизация рекламы); часто один на платформу. |

### 4.3. pl1 — «Настройки» (`/settings`)

1. Откройте **pl1** → в меню **«Настройки»**.
2. Блок **«Google OAuth (платформа)»**:
   - вставьте **OAuth Client ID** и **OAuth Client Secret** из Google Cloud (те же, что для всех перечисленных redirect).
3. Сохраните настройки.

Внизу на той же странице в подсказке перечислены шаблоны redirect — они совпадают с разделом 2 документа.

### 4.4. JSON «CRM: OAuth приложения интеграций» (pl1)

Отдельные **другие** client id/secret для Slack, Microsoft, **Google Calendar / Google Sheets** в каталоге интеграций задаются **там**, если для хаба нужны не платформенные Google-ключи, а отдельное приложение. Это **не** замена пары для GSC/Ads/GA4/Gmail из блока выше, если вы сознательно не выносите всё в один клиент.

---

## 5. Что делает **клиент** (пользователь тенанта CRM)

Ниже — по продуктам. Везде предполагается, что **вы уже** выполнили раздел 4.

### 5.1. Google Search Console (SEO в CRM)

**Клиент:**

1. В CRM откройте раздел **маркетинга / SEO**, где подключается GSC.
2. Нажмите действие вроде «Подключить Google» / получите ссылку авторизации (зависит от UI).
3. Войдёт в Google, выберет аккаунт с доступом к нужному сайту в Search Console.
4. После возврата в CRM привяжет свойство (URL и т.д. — по экранам CRM).

**Со стороны клиента в Google:** аккаунт должен иметь доступ к ресурсу в Search Console.

---

### 5.2. Google Ads (маркетинговые интеграции)

**Клиент:**

1. **Интеграции** → вкладка **«Реклама и счётчики»** (или экран маркетинговых интеграций).
2. Выберет провайдер **Google Ads**, введёт **название** и **Customer ID** (рекламный клиент).
3. Нажмёт **«Подключить через Google»**, войдёт в Google и даст доступ приложению Lumiva.
4. После редиректа интеграция появится в списке; **refresh token** хранится в интеграции **этого тенанта** (не общий на всех).

**Альтернатива (продвинутый режим):** вручную ввести developer token / client id / secret / refresh — если вы не используете платформенные значения или клиент использует свой OAuth-клиент.

**Со стороны Google:** у пользователя Google должен быть доступ к указанному Ads customer id; в Ads API у вашего developer token — соответствующий уровень доступа (как у вас настроено в Google).

---

### 5.3. Google Analytics 4 (маркетинговые интеграции)

**Вариант A — «одна кнопка» (OAuth), рекомендуемый UX**

1. Там же, маркетинговые интеграции → **Google Analytics 4**.
2. Название + **Property ID** (числовой ID ресурса GA4 из Admin или URL).
3. **«Подключить GA4 через Google»** → вход в Google → доступ к аналитике этого свойства.
4. Интеграция создаётся, refresh token только у этого тенанта.

**Вариант B — сервисный аккаунт (классика, максимальная изоляция ключей)**

1. Клиент в Google Cloud **своего** проекта создаёт Service Account, выдаёт JSON ключ.
2. В **GA4 Admin** добавляет email сервисного аккаунта в **Property access** (роль с чтением аналитики).
3. В CRM вставляет **JSON** в поле (или в блок «Вручную», если включён OAuth-мастер).

**Со стороны Google:** либо пользователь с правами на свойство (OAuth), либо SA с приглашением в свойство (JSON).

---

### 5.4. Gmail (почта в CRM)

**Клиент:**

1. В модуле почты запускает подключение Gmail / OAuth.
2. Подтверждает доступ в окне Google.
3. Возвращается в CRM — аккаунт привязан.

Redirect для этого флоу — строка **Gmail** из таблицы в разделе 2.

---

### 5.5. Google Calendar / Google Sheets (хаб интеграций CRM)

**Google Calendar (OAuth из хаба):** используется та же пара **`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`**, что и для GA4/GSC (платформенный клиент). В Google Cloud Console для этого клиента включите **Google Calendar API** и добавьте redirect URI:

- `{PUBLIC_API_URL}/v1/integrations/google-calendar/oauth/callback`

Scope при входе: `https://www.googleapis.com/auth/calendar.events`. После успешного входа подключение появляется на вкладке «Подключения»; встречи из календаря лидов синхронизируются с выбранным календарём Google (по умолчанию `primary`).

**Google Sheets** и ручной ввод токенов для Calendar — по-прежнему **строго по подсказкам UI** экрана подключения.

**Отдельный per-app OAuth** для календаря (`INTEGRATION_OAUTH_GOOGLE_CALENDAR_*`) остаётся опцией каталога, если не используете общую пару.

---

## 6. Краткий чеклист перед сдачей клиенту

- [ ] В Google OAuth client добавлены **все** redirect URI из раздела 2.  
- [ ] При статусе consent screen **Testing** в Google добавлены **все** нужные аккаунты в **Test users** (иначе `403: access_denied`).  
- [ ] `PUBLIC_API_URL` и `FRONTEND_URL` на API совпадают с реальными HTTPS-адресами.  
- [ ] В pl1 сохранены **Client ID** и **Client Secret**.  
- [ ] `JWT_SECRET` в prod не дефолтный.  
- [ ] Для Ads при необходимости задан `GOOGLE_ADS_DEVELOPER_TOKEN`.  
- [ ] Включены нужные **Google APIs** в проекте GCP.  
- [ ] Пройден тест: GSC, Ads OAuth, GA4 OAuth, Google Calendar (хаб), Gmail (что используете).

---

## 7. Где лежит этот файл в репозитории

Путь: **`lumiva-crm/docs/google-integrations-polnoe-podklyuchenie.md`**

Его можно копировать в внутреннюю wiki или отдавать клиенту урезанную версию (раздел 5 без внутренних env).

---

*Документ согласован с кодовой базой Lumiva CRM на момент создания; при добавлении новых OAuth-маршрутов обновите раздел 2 и pl1-подсказку.*
