-- ИИ-менеджер отзывов: объекты Google и отзывы с разбором/черновиками ответов.
CREATE TABLE IF NOT EXISTS review_places (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" uuid NOT NULL,
  "placeId" varchar(255) NOT NULL,
  name text NOT NULL,
  address text,
  "mapsUrl" text,
  rating numeric(3,2),
  "totalReviews" int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  "syncHours" int NOT NULL DEFAULT 3,
  "alertThreshold" int NOT NULL DEFAULT 3,
  recipients jsonb NOT NULL DEFAULT '[]',
  "businessContext" text,
  signature varchar(200),
  "taskProjectId" uuid,
  "lastSyncAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_places_tenant_place ON review_places ("tenantId", "placeId");

CREATE TABLE IF NOT EXISTS review_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" uuid NOT NULL,
  "placeRowId" uuid NOT NULL,
  "externalKey" varchar(255) NOT NULL,
  "authorName" varchar(255),
  "authorUrl" text,
  "authorPhoto" text,
  rating int NOT NULL,
  text text,
  language varchar(16),
  "publishedAt" timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'new',
  sentiment varchar(16),
  topics jsonb NOT NULL DEFAULT '[]',
  summary text,
  "aiReply" text,
  "alertedAt" timestamptz,
  "repliedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_items_place_key ON review_items ("placeRowId", "externalKey");
CREATE INDEX IF NOT EXISTS ix_review_items_tenant_published ON review_items ("tenantId", "publishedAt");
