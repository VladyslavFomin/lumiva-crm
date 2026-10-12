import { Controller, Post, Get, Delete, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { diskStorage } from 'multer'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { MediaService } from './media.service'
import { extname } from 'path'
import { mkdirSync } from 'fs'

mkdirSync('./uploads', { recursive: true })
mkdirSync('./uploads/thumbs', { recursive: true })

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private svc: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6)
        cb(null, unique + extname(file.originalname))
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpg|jpeg|png|webp|gif|svg|pdf/i
      cb(allowed.test(extname(file.originalname)) ? null : new BadRequestException('Invalid file type'), true)
    },
  }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.svc.processUpload(file)
  }

  @Get()
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  list() { return this.svc.list() }

  @Delete(':filename')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  remove(@Param('filename') filename: string) { return this.svc.remove(filename) }
}
