import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

type MulterFile = {
  path: string;
  mimetype: string;
  size: number;
  originalname: string;
};

import { EmbedFormsService } from './embed-forms.service';

@Controller('public/embed')
export class PublicEmbedController {
  constructor(private readonly embedForms: EmbedFormsService) {}

  @Get(':publicId/config')
  getConfig(
    @Param('publicId') publicId: string,
    @Headers('x-embed-preview-token') previewToken?: string,
  ) {
    return this.embedForms.getPublicConfig(
      publicId,
      previewToken ? previewToken.trim() : undefined,
    );
  }

  @Post(':publicId/submit')
  submit(
    @Param('publicId') publicId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Headers('x-embed-preview-token') previewToken?: string,
  ) {
    return this.embedForms.submit(
      publicId,
      body,
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      typeof req.headers.referer === 'string' ? req.headers.referer : undefined,
      previewToken ? previewToken.trim() : undefined,
    );
  }

  @Post(':publicId/attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _f, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '') || '.bin';
          cb(null, `e_${Date.now()}_${randomBytes(6).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('publicId') publicId: string,
    @UploadedFile() file: MulterFile | undefined,
    @Req() req: Request,
    @Headers('x-embed-preview-token') previewToken?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.embedForms.savePublicUpload(
      publicId,
      {
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      typeof req.headers.referer === 'string' ? req.headers.referer : undefined,
      previewToken ? previewToken.trim() : undefined,
    );
  }
}
