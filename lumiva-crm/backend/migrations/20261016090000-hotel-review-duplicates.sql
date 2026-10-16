-- Отзывы: дубликаты между площадками (один гость — один и тот же отзыв на Google и Tripadvisor),
-- страна автора (Booking отдаёт её в профиле) и журнал отправленных PDF-отчётов.

ALTER TABLE hotel_reviews ADD COLUMN IF NOT EXISTS "duplicateOfId" uuid REFERENCES hotel_reviews(id) ON DELETE SET NULL;
ALTER TABLE hotel_reviews ADD COLUMN IF NOT EXISTS "authorCountry" varchar(2);
CREATE INDEX IF NOT EXISTS "IDX_hotel_reviews_duplicate_of" ON hotel_reviews ("duplicateOfId") WHERE "duplicateOfId" IS NOT NULL;

-- Кандидаты, найденные системой: пара хранится один раз (reviewId < candidateId).
-- suggested — ждёт решения человека; confirmed — дубликат; dismissed — «не дубликат», больше не предлагать.
CREATE TABLE IF NOT EXISTS hotel_review_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "hotelId" uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  "reviewId" uuid NOT NULL REFERENCES hotel_reviews(id) ON DELETE CASCADE,
  "candidateId" uuid NOT NULL REFERENCES hotel_reviews(id) ON DELETE CASCADE,
  score numeric(4,3) NOT NULL,
  reason varchar(40) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'suggested',
  "decidedBy" uuid,
  "decidedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_hotel_review_duplicates_pair" UNIQUE ("reviewId", "candidateId")
);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_duplicates_tenant" ON hotel_review_duplicates ("tenantId", status);
CREATE INDEX IF NOT EXISTS "IDX_hotel_review_duplicates_candidate" ON hotel_review_duplicates ("candidateId");
