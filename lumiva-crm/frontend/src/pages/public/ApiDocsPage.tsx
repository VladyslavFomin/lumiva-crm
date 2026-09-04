import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const ad = (key: string) => t(`publicPages.apiDocs.${key}`);

  return (
    <PublicPageLayout pageKey="api" title={ad('pageTitle')} subtitle={ad('pageSubtitle')}>
      <div className="space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">{ad('auth.title')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {ad('auth.bodyPrefix')} <code>X-Api-Token</code> {ad('auth.bodySuffix')}
          </p>
          <CodeBlock>{`curl ${BASE_URL}/public/ping \\\n  -H "X-Api-Token: YOUR_TOKEN"`}</CodeBlock>
          <p className="mt-3 text-xs text-slate-500">
            {ad('auth.limitsHint')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{ad('sections.ping.heading')}</h2>
          <Endpoint method="POST" path="/public/ping" title={ad('sections.ping.pingTitle')} description={ad('sections.ping.pingDesc')}>
            <CodeBlock>{`{"ok":true,"tenantId":"...","ts":"2026-08-05T12:00:00.000Z"}`}</CodeBlock>
          </Endpoint>
          <Endpoint method="GET" path="/public/tenant/info" title={ad('sections.ping.tenantInfoTitle')} description={ad('sections.ping.tenantInfoDesc')} />
          <Endpoint method="GET" path="/public/tenant/modules" title={ad('sections.ping.modulesTitle')} description={ad('sections.ping.modulesDesc')} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{ad('sections.leads.heading')}</h2>
          <Endpoint
            method="POST"
            path="/public/inbound-lead"
            title={ad('sections.leads.createTitle')}
            description={ad('sections.leads.createDesc')}
          >
            <CodeBlock>{`curl -X POST ${BASE_URL}/public/inbound-lead \\\n  -H "X-Api-Token: YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Иван Петров",\n    "email": "ivan@example.com",\n    "phone": "+79991112233",\n    "source": "my-website.com",\n    "message": "Интересует бронирование",\n    "company": "ООО Ромашка"\n  }'`}</CodeBlock>
          </Endpoint>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{ad('sections.products.heading')}</h2>
          <Endpoint method="GET" path="/public/products" title={ad('sections.products.listTitle')} description={ad('sections.products.listDesc')} />
          <Endpoint
            method="GET"
            path="/public/products/:externalIdOrSku"
            title={ad('sections.products.oneTitle')}
            description={ad('sections.products.oneDesc')}
          />
          <Endpoint
            method="POST"
            path="/public/products/ingest"
            title={ad('sections.products.ingestTitle')}
            description={ad('sections.products.ingestDesc')}
          >
            <CodeBlock>{`curl -X POST ${BASE_URL}/public/products/ingest \\\n  -H "X-Api-Token: YOUR_TOKEN" \\\n  -H "X-Idempotency-Key: order-8842" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "sku": "ROOM-STD-01",\n    "name": "Стандартный номер",\n    "price": 4200,\n    "currency": "RUB",\n    "status": "active",\n    "lowStockThreshold": 3\n  }'`}</CodeBlock>
          </Endpoint>
          <Endpoint
            method="PATCH"
            path="/public/products/stock"
            title={ad('sections.products.stockTitle')}
            description={ad('sections.products.stockDesc')}
          >
            <CodeBlock>{`{"sku": "ROOM-STD-01", "delta": -1}`}</CodeBlock>
          </Endpoint>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{ad('sections.bookings.heading')}</h2>
          <Endpoint
            method="POST"
            path="/public/bookings/ingest"
            title={ad('sections.bookings.createTitle')}
            description={ad('sections.bookings.createDesc')}
          >
            <CodeBlock>{`curl -X POST ${BASE_URL}/public/bookings/ingest \\\n  -H "X-Api-Token: YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "locationId": "...",\n    "serviceId": "...",\n    "startAt": "2026-09-01T10:00:00Z",\n    "endAt": "2026-09-01T11:00:00Z",\n    "participants": 2,\n    "customer": {"name": "Иван Петров", "phone": "+79991112233", "email": "ivan@example.com"}\n  }'`}</CodeBlock>
          </Endpoint>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{ad('sections.customObjects.heading')}</h2>
          <Endpoint
            method="POST"
            path="/public/custom-objects/:slug/ingest"
            title={ad('sections.customObjects.ingestTitle')}
            description={ad('sections.customObjects.ingestDesc')}
          />
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">{ad('limitations.title')}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            <li>{ad('limitations.item1')}</li>
            <li>{ad('limitations.item2')}</li>
          </ul>
        </section>
      </div>
    </PublicPageLayout>
  );
}
