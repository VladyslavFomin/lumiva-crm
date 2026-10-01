-- ИИ-онлайн-консультант (роль chat_operator): подпись отправителя и пауза ИИ в диалоге.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "senderName" varchar(120) NULL;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS "aiPaused" boolean NOT NULL DEFAULT false;
