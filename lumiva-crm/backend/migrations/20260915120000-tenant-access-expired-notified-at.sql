-- Отметка "клиенту уже отправлено уведомление о просроченной оплате/доступе" — чтобы
-- почасовой cron не слал письмо/in-app уведомление повторно на каждый прогон, пока тенант
-- не оплатит снова (тогда activatePaidCheckout сбрасывает поле в NULL).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS access_expired_notified_at TIMESTAMPTZ;
