import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { joinUploadsAbsolute } from '../common/uploads-root.util';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
  '.rtf',
  '.odt',
  '.ods',
  '.odp',
  '.png',
  '.jpg',
  '.jpeg',
]);

const REL_DIR = 'sales-panel-attachments';

export interface SalesAttachmentRef {
  filename: string;
  relativePath: string;
  sizeBytes: number;
}

@Injectable()
export class SalesAttachmentsService {
  async upload(file: { buffer: Buffer; originalname?: string }): Promise<SalesAttachmentRef> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    const baseName = (file.originalname || 'file').replace(
      /[^a-zA-Z0-9._\-а-яёА-ЯЁ ]/gi,
      '_',
    );
    const ext = extname(baseName).toLowerCase() || '.bin';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        `Unsupported file type (${ext}). Use PDF, Word, Excel, PowerPoint, image or similar.`,
      );
    }
    const id = randomUUID();
    const relativePath = `${REL_DIR}/${id}${ext}`;
    await mkdir(joinUploadsAbsolute(REL_DIR), { recursive: true });
    await writeFile(joinUploadsAbsolute(relativePath), file.buffer);
    return { filename: baseName, relativePath, sizeBytes: file.buffer.length };
  }

  /** Reads a previously uploaded attachment back for inclusion in an outgoing email. */
  async readForSend(
    ref: SalesAttachmentRef,
  ): Promise<{ filename: string; content: string }> {
    if (!ref.relativePath.startsWith(`${REL_DIR}/`)) {
      // Defends against path traversal via a manipulated relativePath from the client.
      throw new BadRequestException('Invalid attachment reference');
    }
    const buffer = await readFile(joinUploadsAbsolute(ref.relativePath));
    return { filename: ref.filename, content: buffer.toString('base64') };
  }
}
