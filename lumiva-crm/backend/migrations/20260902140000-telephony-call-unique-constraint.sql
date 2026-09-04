-- Same duplicate-record race class as the WhatsApp inbound webhook fix (see
-- 20260902120000-whatsapp-unique-constraints.sql), narrower window: recordInboundCall()
-- (telephony.service.ts) does check-then-insert on twilioCallSid with only a non-unique index.
-- Twilio can retry a webhook on timeout/non-2xx, which would produce a duplicate Call row.
--
-- No existing duplicates as of this migration (verified via GROUP BY ... HAVING count(*) > 1).

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calls_tenant_twiliocallsid"
  ON calls ("tenantId", "twilioCallSid")
  WHERE "twilioCallSid" IS NOT NULL;
