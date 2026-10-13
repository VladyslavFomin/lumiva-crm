-- Кто подготовил черновик ответа: ИИ-менеджер отзывов (id сотрудника) или null (сгенерирован вручную в карточке).
ALTER TABLE hotel_reviews ADD COLUMN IF NOT EXISTS "aiDraftAgentId" uuid;
