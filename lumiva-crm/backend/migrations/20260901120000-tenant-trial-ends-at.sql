-- 14-дневный бесплатный Enterprise-триал при self-service регистрации: дата его окончания,
-- отдельно от activeUntil (который billing.service.ts продлевает при реальной оплате).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
