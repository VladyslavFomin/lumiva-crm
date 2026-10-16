-- Ящик клиента, с которого CRM отправляет уведомления, отчёты и письма его клиентам (а не с адреса платформы).
-- Не выбран — берётся единственный общий (не личный) рабочий ящик; иначе письма не уходят, пока не выберут.
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS "useForNotifications" boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_accounts_notifications_per_tenant" ON email_accounts ("tenantId") WHERE "useForNotifications";
