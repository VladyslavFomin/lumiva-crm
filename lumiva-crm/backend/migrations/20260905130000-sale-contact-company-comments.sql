-- Комментарии/@упоминания (см. MOBILE_DATA_PARITY_PLAN.md §17): Lead/Project уже имели
-- jsonb-колонку comments (треды с mentions/likedBy/parentId), у Sale/Contact/Company её не было.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "comments" jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "comments" jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "comments" jsonb;
