-- Дозагрузка истории отзывов по запросу (Отели → Отзывы → «Догрузить историю»): сколько отзывов взять при следующем запуске.
ALTER TABLE hotel_review_sources ADD COLUMN IF NOT EXISTS "backfillMax" integer;
