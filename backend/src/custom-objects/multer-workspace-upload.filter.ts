import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { WORKSPACE_ATTACHMENT_MAX_BYTES } from './workspace-attachment.constants';

/** Ответ при превышении limits.fileSize у FileInterceptor — понятный JSON для клиента. */
@Catch(MulterError)
export class MulterWorkspaceUploadFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'Payload Too Large',
        message: 'FILE_TOO_LARGE',
        maxBytes: WORKSPACE_ATTACHMENT_MAX_BYTES,
      });
    }
    return res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message || 'Upload failed',
    });
  }
}
