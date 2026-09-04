-- Fixes a duplicate-record race on the WhatsApp inbound webhook (Meta Cloud API).
--
-- recordInboundMessage() (whatsapp-crm.service.ts) does check-then-insert on waMessageId
-- (dedup of retried webhook deliveries) and on waPhoneDigits (find-or-create contact), with no
-- DB-level backstop. Unlike Telegram (which has a real unique constraint on
-- (chatId, waMessageId)/messages and a fire-and-forget webhook controller), WhatsApp's webhook
-- used to await the full handler before responding, which is exactly the slow-response
-- condition that makes Meta retry delivery — landing two concurrent requests in the race
-- window. The controller is now fire-and-forget too (closes the window at the source); these
-- constraints are the hard backstop in case two deliveries still interleave.
--
-- No existing duplicates as of this migration (verified via GROUP BY ... HAVING count(*) > 1
-- on both tables before writing this), so a plain unique index applies cleanly.

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_messages_tenant_wamessageid"
  ON whatsapp_messages ("tenantId", "waMessageId")
  WHERE "waMessageId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_contacts_tenant_phone"
  ON whatsapp_contacts ("tenantId", "waPhoneDigits");
