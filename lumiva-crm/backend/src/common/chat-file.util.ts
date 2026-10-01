import { BadRequestException } from '@nestjs/common';

/**
 * Файлы, которые сотрудник может отправить клиенту в WhatsApp/Telegram из CRM.
 * Список по расширению, а не по mime из браузера: для .docx/.xlsx браузеры иногда присылают
 * application/octet-stream, а мессенджеры показывают файл по тому mime, который передали мы.
 */
const ALLOWED: Record<string, { mime: string; kind: 'image' | 'document' }> = {
  pdf: { mime: 'application/pdf', kind: 'document' },
  doc: { mime: 'application/msword', kind: 'document' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document' },
  xls: { mime: 'application/vnd.ms-excel', kind: 'document' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'document' },
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  png: { mime: 'image/png', kind: 'image' },
};

/** Потолок Telegram Bot API на отправку файла — 50 МБ; у WhatsApp документы до 100 МБ, так что общий потолок — 50. */
export const CHAT_FILE_MAX_BYTES = 50 * 1024 * 1024;

export type ChatUpload = { buffer: Buffer; originalname: string; mimetype?: string; size: number };

export type ChatFile = { buffer: Buffer; fileName: string; mime: string; kind: 'image' | 'document'; size: number };

/** Проверить загруженный файл и вернуть нормализованные имя/mime/вид. */
export function normalizeChatFile(file: ChatUpload | undefined): ChatFile {
  if (!file?.buffer?.length) throw new BadRequestException('Файл не передан');
  if (file.size > CHAT_FILE_MAX_BYTES) throw new BadRequestException('Файл больше 50 МБ');
  // multer отдаёт имя в latin1 — кириллица в имени иначе превращается в «Ð¡Ñ…»
  const fileName = Buffer.from(file.originalname || 'file', 'latin1').toString('utf8').slice(0, 200);
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const rule = ALLOWED[ext];
  if (!rule) throw new BadRequestException('Можно отправлять только PDF, Word, Excel, JPEG и PNG');
  return { buffer: file.buffer, fileName, mime: rule.mime, kind: rule.kind, size: file.size };
}
