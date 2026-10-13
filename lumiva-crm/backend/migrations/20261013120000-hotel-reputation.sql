-- Репутация отелей: отзывы с 7 площадок в одной базе (Отели → Отзывы).
-- Бренды отелей, привязка отеля к площадкам, отзывы + версии + ответы + темы ИИ, журнал синхронизаций,
-- настройки модуля и журнал отправленных алертов (защита от повторов).

CREATE TABLE IF NOT EXISTS hotel_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  color varchar(16),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_brands_tenant" ON hotel_brands ("tenantId");

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS "brandId" uuid REFERENCES hotel_brands(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS hotel_review_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "hotelId" uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  platform varchar(24) NOT NULL,
  "externalId" varchar(300),
  url text,
  "apiKeyEnc" text,
  active boolean NOT NULL DEFAULT true,
  "lastSyncAt" timestamptz,
  "lastSuccessAt" timestamptz,
  "lastNewAt" timestamptz,
  "lastError" text,
  "platformRating" numeric(4,2),
  "platformCount" integer,
  "useFallback" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("hotelId", platform)
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_sources_tenant" ON hotel_review_sources ("tenantId");

CREATE TABLE IF NOT EXISTS hotel_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "hotelId" uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  "sourceId" uuid REFERENCES hotel_review_sources(id) ON DELETE SET NULL,
  platform varchar(24) NOT NULL,
  "externalReviewId" varchar(300) NOT NULL,
  author varchar(255),
  "authorPhoto" text,
  lang varchar(12),
  title text,
  "textOriginal" text,
  "textTranslated" text,
  "translatedLang" varchar(8),
  "ratingRaw" numeric(5,2),
  "ratingScale" smallint,
  "rating10" numeric(4,2),
  "subRatings" jsonb,
  "travelDate" date,
  "publishedAt" timestamptz,
  "platformUpdatedAt" timestamptz,
  status varchar(12) NOT NULL DEFAULT 'active',
  "reviewUrl" text,
  "hasReply" boolean NOT NULL DEFAULT false,
  "repliedAt" timestamptz,
  "replyText" text,
  "replyMarkedManually" boolean NOT NULL DEFAULT false,
  "aiDraft" text,
  sentiment varchar(10),
  "analyzedAt" timestamptz,
  "analysisHash" varchar(64),
  "analysisError" text,
  "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenantId", platform, "externalReviewId")
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_reviews_feed" ON hotel_reviews ("tenantId", "publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_hotel_reviews_hotel" ON hotel_reviews ("hotelId", platform, "publishedAt" DESC);

CREATE TABLE IF NOT EXISTS hotel_review_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reviewId" uuid NOT NULL REFERENCES hotel_reviews(id) ON DELETE CASCADE,
  "rating10" numeric(4,2),
  "ratingRaw" numeric(5,2),
  text text,
  "capturedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_versions_review" ON hotel_review_versions ("reviewId");

CREATE TABLE IF NOT EXISTS hotel_review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "reviewId" uuid NOT NULL REFERENCES hotel_reviews(id) ON DELETE CASCADE,
  text text NOT NULL,
  "authorUserId" uuid,
  source varchar(12) NOT NULL,
  status varchar(12) NOT NULL,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamptz,
  "postedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_replies_review" ON hotel_review_replies ("reviewId");
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_replies_queue" ON hotel_review_replies (status, "nextAttemptAt");

CREATE TABLE IF NOT EXISTS hotel_review_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "reviewId" uuid NOT NULL REFERENCES hotel_reviews(id) ON DELETE CASCADE,
  "hotelId" uuid NOT NULL,
  topic varchar(40) NOT NULL,
  "otherLabel" varchar(80),
  sentiment varchar(10) NOT NULL,
  quote text,
  "publishedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_topics_review" ON hotel_review_topics ("reviewId");
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_topics_hotel" ON hotel_review_topics ("tenantId", "hotelId", "publishedAt");

CREATE TABLE IF NOT EXISTS hotel_review_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform varchar(24) NOT NULL,
  "hotelId" uuid,
  "sourceId" uuid,
  trigger varchar(16) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'running',
  "actorId" varchar(200),
  "externalRunId" varchar(100),
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "finishedAt" timestamptz,
  fetched integer NOT NULL DEFAULT 0,
  "new" integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  "errorText" text
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_sync_runs_tenant" ON hotel_review_sync_runs ("tenantId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_sync_runs_running" ON hotel_review_sync_runs (status) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS hotel_reputation_settings (
  "tenantId" uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}',
  secrets jsonb NOT NULL DEFAULT '{}',
  "pushToken" varchar(64),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_review_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind varchar(32) NOT NULL,
  "dedupKey" varchar(300) NOT NULL,
  "hotelId" uuid,
  "reviewId" uuid,
  title text,
  body text,
  channels jsonb,
  "sentAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenantId", "dedupKey")
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_alerts_tenant" ON hotel_review_alerts ("tenantId", "sentAt" DESC);
