-- Структурированный список юр./банковских реквизитов (замена одного текстового поля
-- "Реквизиты компании" на список {id, type, value}[], тип из фиксированного каталога —
-- см. backend/src/common/legal-requisites.ts). Используется в документах ("Мои документы")
-- как {ORG_TAX} (своя компания, tenants) и {COMPANY_REQUISITES} (компания клиента, companies).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "legalRequisites" JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "legalRequisites" JSONB;
