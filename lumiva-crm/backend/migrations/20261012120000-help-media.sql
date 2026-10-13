-- Видео/gif к подсказкам-турам CRM (pl1 → «Контент»). Общие для платформы, без tenantId.
CREATE TABLE IF NOT EXISTS help_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic varchar(64) NOT NULL,
  "stepId" varchar(64) NOT NULL,
  kind varchar(16) NOT NULL,
  url text NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_help_media_topic_step" ON help_media (topic, "stepId");
