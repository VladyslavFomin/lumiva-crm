-- Отдельная модель (и её цены) для ИИ-SEO-ассистента; пусто — общая модель платформы.
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS "seoAiModel" varchar(128);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS "seoAiPriceInputPerMtokUsd" varchar(32);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS "seoAiPriceOutputPerMtokUsd" varchar(32);
