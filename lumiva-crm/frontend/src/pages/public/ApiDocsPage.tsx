import React from 'react';
import { PublicPageLayout } from './PublicPageLayout';

const BASE_URL = 'https://crm.lumiva.agency/v1';

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
    <code>{children}</code>
  </pre>
);

const Endpoint: React.FC<{
  method: string;
  path: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}> = ({ method, path, title, description, children }) => {
  const methodColor: Record<string, string> = {
    GET: 'bg-sky-100 text-sky-700',
    POST: 'bg-emerald-100 text-emerald-700',
    PATCH: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${methodColor[method] || 'bg-slate-100 text-slate-700'}`}>{method}</span>
        <code className="text-sm font-semibold text-slate-900">{path}</code>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {children}
    </div>
  );
};

export default function ApiDocsPage() {
  return (
    <PublicPageLayout pageKey="api" title="Справочник API" subtitle="Реальные, рабочие эндпоинты — без вымышленных примеров.">
      <div className="space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Авторизация</h2>
          <p className="mt-2 text-sm text-slate-600">
            Все запросы ниже требуют заголовок <code>X-Api-Token</code> с токеном вашей компании.
            Создать и отозвать токены можно в CRM: Настройки → API-токены.
          </p>
          <CodeBlock>{`curl ${BASE_URL}/public/ping \\\n  -H "X-Api-Token: YOUR_TOKEN"`}</CodeBlock>
          <p className="mt-3 text-xs text-slate-500">
            Лимиты: 20 запросов/сек, 100/10 сек, 400/мин на IP (общий лимит на все API, кроме
            эндпоинтов из раздела «Проверка соединения» — они не ограничены).
            Токен можно отозвать в любой момент — уже выданные запросы с отозванным токеном
            начнут получать 401 сразу.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Проверка соединения и данные компании</h2>
          <Endpoint method="POST" path="/public/ping" title="Проверить токен" description="Возвращает ok:true и tenantId, если токен валиден.">
            <CodeBlock>{`{"ok":true,"tenantId":"...","ts":"2026-08-05T12:00:00.000Z"}`}</CodeBlock>
          </Endpoint>
          <Endpoint method="GET" path="/public/tenant/info" title="Информация о компании" description="Базовые данные тенанта (название, план и т.п.)." />
          <Endpoint method="GET" path="/public/tenant/modules" title="Включённые модули" description="Какие модули CRM активны для вашей компании." />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Лиды</h2>
          <Endpoint
            method="POST"
            path="/public/inbound-lead"
            title="Создать лид"
            description="Приём заявок с сайта/форм — создаёт лид со статусом «Новый»."
          >
            <CodeBlock>{`curl -X POST ${BASE_URL}/public/inbound-lead \\\n  -H "X-Api-Token: YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Иван Петров",\n    "email": "ivan@example.com",\n    "phone": "+79991112233",\n    "source": "my-website.com",\n    "message": "Интересует бронирование",\n    "company": "ООО Ромашка"\n  }'`}</CodeBlock>
          </Endpoint>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Товары</h2>
          <Endpoint method="GET" path="/public/products" title="Список товаров" description="Все активные товары компании, с вариациями." />
          <Endpoint
            method="GET"
            path="/public/products/:externalIdOrSku"
            title="Один товар"
            description="Найти товар по SKU или externalId."
          />
          <Endpoint
            method="POST"
            path="/public/products/ingest"
            title="Создать/обновить товар"
            description="Сопоставление по sku или externalId — обязательно указать хотя бы одно из полей. Приходит заголовок X-Idempotency-Key — повторный вызов с тем же ключом не создаст дубликат."
          >
            <CodeBlock>{`curl -X POST ${BASE_URL}/public/products/ingest \\\n  -H "X-Api-Token: YOUR_TOKEN" \\\n  -H "X-Idempotency-Key: order-8842" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "sku": "ROOM-STD-01",\n    "name": "Стандартный номер",\n    "price": 4200,\n    "currency": "RUB",\n    "status": "active",\n    "lowStockThreshold": 3\n  }'`}</CodeBlock>
          </Endpoint>
          <Endpoint
            method="PATCH"
            path="/public/products/stock"
            title="Изменить остаток"
            description="sku или variantSku + delta (относительное изменение) или absolute (новое значение)."
          >
            <CodeBlock>{`{"sku": "ROOM-STD-01", "delta": -1}`}</CodeBlock>
          </Endpoint>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Бронирования</h2>
          <Endpoint
            method="POST"
            path="/public/bookings/ingest"
            title="Создать бронирование"
            description="Для виджета записи на внешнем сайте. locationId, startAt и endAt обязательны."
          >
            <CodeBlock>{`curl -X POST ${BASE_URL}/public/bookings/ingest \\\n  -H "X-Api-Token: YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "locationId": "...",\n    "serviceId": "...",\n    "startAt": "2026-09-01T10:00:00Z",\n    "endAt": "2026-09-01T11:00:00Z",\n    "participants": 2,\n    "customer": {"name": "Иван Петров", "phone": "+79991112233", "email": "ivan@example.com"}\n  }'`}</CodeBlock>
          </Endpoint>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">No-code объекты (Workspace)</h2>
          <Endpoint
            method="POST"
            path="/public/custom-objects/:slug/ingest"
            title="Загрузить записи в пользовательский объект"
            description="slug — идентификатор объекта, созданного в разделе Workspace. Тело запроса зависит от полей объекта."
          />
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Известные ограничения</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            <li>Публичного чтения контактов, продаж и сделок пока нет — только создание лидов и работа с товарами/бронированиями.</li>
            <li>OpenAPI/Swagger-схема существует, но не включена на проде по умолчанию — эта страница является основным источником правды по запросам и телам ответов.</li>
          </ul>
        </section>
      </div>
    </PublicPageLayout>
  );
}
