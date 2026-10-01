-- Конверсии и их ценность по данным рекламных площадок (Google Ads / Meta) — для CPA и ROI.
ALTER TABLE marketing_traffic ADD COLUMN IF NOT EXISTS conversions numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE marketing_traffic ADD COLUMN IF NOT EXISTS "conversionValue" numeric(16,2) NOT NULL DEFAULT 0;
