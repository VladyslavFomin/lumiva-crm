-- Напоминание об истечении OAuth-доступа (Meta Ads): какое уведомление уже отправлено (soon / expired);
-- сбрасывается при переподключении.
ALTER TABLE marketing_oauth_tokens ADD COLUMN IF NOT EXISTS "expiryNotice" varchar(16);
