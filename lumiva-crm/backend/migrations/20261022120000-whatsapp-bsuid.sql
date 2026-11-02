-- WhatsApp usernames (Meta, 2026): у пользователя с включённым username вебхук не содержит номер
-- (msg.from / contacts[].wa_id), только business-scoped user id (from_user_id / user_id, вида "TR.123…").
-- Такие сообщения раньше молча терялись. Контакт теперь можно опознать по BSUID, номер — необязателен.

ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS "waUserId" varchar(160);
ALTER TABLE whatsapp_contacts ALTER COLUMN "waPhoneDigits" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_contacts_tenant_userid"
  ON whatsapp_contacts ("tenantId", "waUserId")
  WHERE "waUserId" IS NOT NULL;
