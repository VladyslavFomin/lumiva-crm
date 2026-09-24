-- Множественные ответственные для карточек компании/контакта (группировка по отделам в
-- новом дизайне company-page.html/contact-page.html). assignedUserId/assignedTo остаются
-- "основным" ответственным для списков и bulk-операций.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "assignedUserIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "assignedUserIds" TEXT[] NOT NULL DEFAULT '{}';
