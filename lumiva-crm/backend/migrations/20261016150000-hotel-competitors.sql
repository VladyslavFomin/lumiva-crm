-- Конкуренты отеля: их отзывы собираются теми же скрейперами, но только для сравнения
-- (без ответов, алертов, задач ИИ-менеджеру и без попадания в собственную аналитику).
-- Пока конкурент не добавлен, ничего не собирается и не оплачивается.

CREATE TABLE IF NOT EXISTS hotel_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "hotelId" uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_competitors_hotel" ON hotel_competitors ("tenantId", "hotelId");

CREATE TABLE IF NOT EXISTS hotel_competitor_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "competitorId" uuid NOT NULL REFERENCES hotel_competitors(id) ON DELETE CASCADE,
  platform varchar(24) NOT NULL,
  url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  "lastSyncAt" timestamptz,
  "lastSuccessAt" timestamptz,
  "lastError" text,
  "platformRating" numeric(4,2),
  "platformCount" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_hotel_competitor_sources_platform" UNIQUE ("competitorId", platform)
);

CREATE TABLE IF NOT EXISTS hotel_competitor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "competitorId" uuid NOT NULL REFERENCES hotel_competitors(id) ON DELETE CASCADE,
  "sourceId" uuid NOT NULL REFERENCES hotel_competitor_sources(id) ON DELETE CASCADE,
  platform varchar(24) NOT NULL,
  "externalReviewId" varchar(300) NOT NULL,
  author varchar(255),
  lang varchar(8),
  title text,
  "textOriginal" text,
  "ratingRaw" numeric(5,2),
  "ratingScale" smallint,
  rating10 numeric(4,2),
  "publishedAt" timestamptz,
  "authorCountry" varchar(2),
  sentiment varchar(10),
  -- темы ИИ: [{topic, label, sentiment, quote}] — отдельной таблицы не нужно, это только для сравнения
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  "analyzedAt" timestamptz,
  "analysisError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_hotel_competitor_reviews_ext" UNIQUE ("sourceId", "externalReviewId")
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_competitor_reviews_comp" ON hotel_competitor_reviews ("tenantId", "competitorId", "publishedAt");
CREATE INDEX IF NOT EXISTS "IDX_hotel_competitor_reviews_backlog" ON hotel_competitor_reviews ("tenantId") WHERE "analyzedAt" IS NULL;

-- Связь отзыва с бронированием (гость → номер, даты проживания). auto — найдено системой с полной уверенностью,
-- suggested — похоже, ждёт подтверждения человека, confirmed / rejected — решение человека.
ALTER TABLE hotel_reviews ADD COLUMN IF NOT EXISTS "reservationId" uuid REFERENCES hotel_reservations(id) ON DELETE SET NULL;
ALTER TABLE hotel_reviews ADD COLUMN IF NOT EXISTS "reservationMatch" varchar(12);
CREATE INDEX IF NOT EXISTS "IDX_hotel_reviews_reservation" ON hotel_reviews ("reservationId") WHERE "reservationId" IS NOT NULL;
