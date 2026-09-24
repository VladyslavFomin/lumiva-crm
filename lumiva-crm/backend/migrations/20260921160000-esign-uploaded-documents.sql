-- Uploaded (already signed, received from a counterparty) documents in "Мои документы".
ALTER TABLE esign_documents ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT 'generated';
ALTER TABLE esign_documents ADD COLUMN IF NOT EXISTS "notes" text NULL;
