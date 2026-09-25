-- ИИ-сотрудники: «упущенная работа» — события/передачи для ролей, которых нет в команде.
CREATE TABLE IF NOT EXISTS ai_missed_work_daily (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  role_key varchar(80) NOT NULL,
  day date NOT NULL,
  count int NOT NULL DEFAULT 0,
  by_event jsonb NOT NULL DEFAULT '{}',
  samples jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_missed_work_daily ON ai_missed_work_daily (tenant_id, role_key, day);
