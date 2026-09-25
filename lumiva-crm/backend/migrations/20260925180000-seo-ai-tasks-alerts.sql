-- ИИ SEO-менеджер: задачи из рекомендаций и сигналы о проблемах.
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "tasksEnabled" boolean NOT NULL DEFAULT true;
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "taskProjectId" uuid;
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "taskAssigneeId" uuid;
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "alertsEnabled" boolean NOT NULL DEFAULT true;
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "taskLog" jsonb NOT NULL DEFAULT '{}';
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "alertState" jsonb NOT NULL DEFAULT '{}';
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "lastCheckAt" timestamptz;
