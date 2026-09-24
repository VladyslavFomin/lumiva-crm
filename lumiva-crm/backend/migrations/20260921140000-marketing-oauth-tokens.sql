-- OAuth-доступ клиента к рекламному кабинету (Meta Ads: подключение «одной кнопкой»).
CREATE TABLE IF NOT EXISTS marketing_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" uuid NOT NULL,
  provider varchar(40) NOT NULL,
  "accessToken" text NOT NULL,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_oauth_tokens_tenant_provider ON marketing_oauth_tokens ("tenantId", provider);
