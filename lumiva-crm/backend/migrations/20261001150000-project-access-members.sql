-- Наблюдатели проекта: сотрудники, которые видят проект (reader) или могут его
-- редактировать (editor), не будучи ответственными. Действует в основной таблице проектов.
-- [{ "staffUserId": "<uuid>", "role": "reader" | "editor" }]
ALTER TABLE crm_projects ADD COLUMN IF NOT EXISTS "accessMembers" jsonb;
