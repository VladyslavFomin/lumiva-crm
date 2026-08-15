-- Sales Panel (pl1): business prospecting, outreach invitations, API usage guard, reply-poll state.

CREATE TABLE IF NOT EXISTS sales_prospects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "placeId"             VARCHAR(255) NOT NULL UNIQUE,
  name                  VARCHAR(255) NOT NULL,
  "formattedAddress"    TEXT,
  "searchCity"          VARCHAR(160),
  "searchBusinessType"  VARCHAR(160),
  phone                 VARCHAR(64),
  website               VARCHAR(500),
  email                 VARCHAR(255),
  "emailStatus"         VARCHAR(24) NOT NULL DEFAULT 'unknown',
  "emailScrapedAt"      TIMESTAMPTZ,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  rating                NUMERIC(2,1),
  "userRatingsTotal"    INT,
  "googleMapsUrl"       TEXT,
  "outreachStatus"      VARCHAR(24) NOT NULL DEFAULT 'not_contacted',
  "lastContactedAt"     TIMESTAMPTZ,
  "lastRepliedAt"       TIMESTAMPTZ,
  "rawPlaceDetails"     JSONB,
  "detailsFetchedAt"    TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_outreach ON sales_prospects ("outreachStatus");
CREATE INDEX IF NOT EXISTS idx_sales_prospects_city     ON sales_prospects ("searchCity");

CREATE TABLE IF NOT EXISTS sales_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "prospectId"        UUID REFERENCES sales_prospects(id) ON DELETE SET NULL,
  language            VARCHAR(8) NOT NULL,
  subject             TEXT NOT NULL,
  "bodyHtml"          TEXT NOT NULL,
  "toEmail"           VARCHAR(255) NOT NULL,
  "sentByAdminId"     UUID,
  "sentByAdminEmail"  VARCHAR(255),
  "trackingToken"     VARCHAR(64) NOT NULL UNIQUE,
  "outboundMessageId" VARCHAR(500),
  status              VARCHAR(24) NOT NULL DEFAULT 'sent',
  "sentAt"            TIMESTAMPTZ,
  "failedReason"      TEXT,
  "repliedAt"         TIMESTAMPTZ,
  "replySnippet"      TEXT,
  "replyMatchedBy"    VARCHAR(24),
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_invitations_prospect ON sales_invitations ("prospectId");
CREATE INDEX IF NOT EXISTS idx_sales_invitations_status   ON sales_invitations (status);

CREATE TABLE IF NOT EXISTS sales_api_usage (
  "usageDate"             DATE PRIMARY KEY,
  "placesTextSearchCalls" INT NOT NULL DEFAULT 0,
  "placesDetailsCalls"    INT NOT NULL DEFAULT 0,
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_reply_poll_state (
  key              VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  "lastPolledAt"   TIMESTAMPTZ,
  "lastMatchCount" INT,
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sales_reply_poll_state (key) VALUES ('default') ON CONFLICT DO NOTHING;
