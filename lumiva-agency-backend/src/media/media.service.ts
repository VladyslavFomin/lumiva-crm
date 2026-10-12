import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { readdirSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import * as sharp from 'sharp'

@Injectable()
export class MediaService {
  constructor(private cfg: ConfigService) {}

  async processUpload(file: Express.Multer.File) {
    const publicUrl = this.cfg.get('PUBLIC_URL', 'https://pl2.lumiva.agency')
    const isImage = /jpg|jpeg|png|webp/i.test(file.originalname)

    if (isImage) {
      try {
        await (sharp as any)(file.path)
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .toFile(file.path + '.resized')
        const { unlinkSync, renameSync } = require('fs')
        unlinkSync(file.path)
        renameSync(file.path + '.resized', file.path)
        await (sharp as any)(file.path)
          .resize(400, 400, { fit: 'cover' })
          .toFile(join('./uploads/thumbs', file.filename))
      } catch {}
    }

    return {
      url: `${publicUrl}/uploads/${file.filename}`,
      thumb: isImage ? `${publicUrl}/uploads/thumbs/${file.filename}` : null,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    }
  }

  list() {
    const publicUrl = this.cfg.get('PUBLIC_URL', 'https://pl2.lumiva.agency')
    try {
      return readdirSync('./uploads')
        .filter(f => !f.startsWith('.') && statSync(`./uploads/${f}`).isFile())
        .map(f => ({
          filename: f,
          url: `${publicUrl}/uploads/${f}`,
          size: statSync(`./uploads/${f}`).size,
        }))
    } catch { return [] }
  }

  remove(filename: string) {
    try { unlinkSync(`./uploads/${filename}`) } catch {}
    try { unlinkSync(`./uploads/thumbs/${filename}`) } catch {}
    return { ok: true }
  }
}
