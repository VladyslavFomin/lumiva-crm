-- Bounded retry for marketing broadcast recipients (Medium finding, 2026-09-02).
--
-- Root cause: any transient send error (SMTP/SMS provider hiccup) permanently moved a recipient
-- to 'failed' with no retry path — the broadcast would report 'completed' while some recipients
-- silently never got a message. Adds a retry counter; processStepsForBroadcast()/maybeComplete()
-- (marketing-broadcasts.service.ts) now retry up to 3 times with a 30-minute backoff before
-- treating a recipient as terminally failed.

ALTER TABLE marketing_broadcast_recipients
  ADD COLUMN IF NOT EXISTS "retryCount" integer NOT NULL DEFAULT 0;
