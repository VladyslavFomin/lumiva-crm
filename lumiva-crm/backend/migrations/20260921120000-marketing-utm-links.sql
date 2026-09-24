-- «Ссылки с метками»: хранилище созданных UTM-ссылок (шаблоны — marketing_utm_templates).
CREATE TABLE IF NOT EXISTS marketing_utm_links (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" uuid NOT NULL,
  name varchar(160) NOT NULL,
  "baseUrl" varchar(512) NOT NULL,
  "channelType" varchar(80),
  "utmSource" varchar(120),
  "utmMedium" varchar(120),
  "utmCampaign" varchar(160),
  "utmContent" varchar(160),
  "utmTerm" varchar(160),
  "createdByUserId" uuid,
  "createdByName" varchar(160),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_utm_links_tenant_created ON marketing_utm_links ("tenantId", "createdAt");
