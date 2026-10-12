import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

const SEP = 'XLSEPX'
const CHUNK_LIMIT = 4800

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

@Injectable()
export class BlogTranslateService {
  private readonly logger = new Logger(BlogTranslateService.name)

  // Google Translate unofficial API — no key needed, reliable, ~5000 chars/request
  private async callGoogle(text: string, from: string, to: string): Promise<string> {
    if (!text?.trim()) return text
    const url = 'https://translate.googleapis.com/translate_a/single'
    const { data } = await axios.get(url, {
      params: { client: 'gtx', sl: from, tl: to, dt: 't', q: text },
      timeout: 12000,
    })
    // Response: [[["translated", "original"], ...], ...]
    if (Array.isArray(data?.[0])) {
      return data[0].map((chunk: any[]) => chunk[0] || '').join('')
    }
    throw new Error('Unexpected Google Translate response')
  }

  // Split long text into ≤CHUNK_LIMIT chunks on sentence/newline boundaries
  private splitText(text: string): string[] {
    if (text.length <= CHUNK_LIMIT) return [text]
    const chunks: string[] = []
    // Try to split on paragraph breaks first, then sentences
    const paragraphs = text.split(/\n{2,}/)
    let cur = ''
    for (const para of paragraphs) {
      if (cur.length + para.length + 2 > CHUNK_LIMIT) {
        if (cur) chunks.push(cur.trim())
        // If single paragraph is too long, split by sentences
        if (para.length > CHUNK_LIMIT) {
          const sentences = para.split(/(?<=[.!?])\s+/)
          cur = ''
          for (const s of sentences) {
            if (cur.length + s.length + 1 > CHUNK_LIMIT) {
              if (cur) chunks.push(cur.trim())
              cur = s
            } else {
              cur = cur ? cur + ' ' + s : s
            }
          }
        } else {
          cur = para
        }
      } else {
        cur = cur ? cur + '\n\n' + para : para
      }
    }
    if (cur.trim()) chunks.push(cur.trim())
    return chunks.filter(Boolean)
  }

  private async translateLong(text: string, from: string, to: string): Promise<string> {
    if (!text?.trim()) return text
    const chunks = this.splitText(text)
    if (chunks.length === 1) return this.callGoogle(text, from, to)
    const results: string[] = []
    for (const chunk of chunks) {
      results.push(await this.callGoogle(chunk, from, to))
      await sleep(80)
    }
    return results.join('\n\n')
  }

  // Translate multiple short strings in one batched request using a separator
  private async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
    const cleaned = texts.map(t => (t ?? '').trim())
    if (!cleaned.some(t => t)) return texts

    const combined = cleaned.join(`\n${SEP}\n`)
    if (combined.length <= CHUNK_LIMIT) {
      const translated = await this.callGoogle(combined, from, to)
      // Split on separator — use simple string split, case-insensitive for Google mangling
      const upperSep = SEP.toUpperCase()
      const lowerSep = SEP.toLowerCase()
      const parts = translated
        .replace(new RegExp(upperSep, 'g'), SEP)
        .replace(new RegExp(lowerSep, 'g'), SEP)
        .split(`\n${SEP}\n`)
      // Fallback: also try splitting without newlines
      const actualParts = parts.length >= texts.length
        ? parts
        : translated.split(SEP)
      return texts.map((orig, i) => actualParts[i]?.trim() || orig || '')
    }

    // Too long — translate individually with small delay
    const results: string[] = []
    for (const text of texts) {
      if (text?.trim()) {
        results.push(await this.translateLong(text, from, to))
        await sleep(80)
      } else {
        results.push(text ?? '')
      }
    }
    return results
  }

  async translateBlocks(blocks: any[], from: string, to: string, existingBlocks: any[] = []): Promise<any[]> {
    if (!Array.isArray(blocks) || !blocks.length) return blocks
    const result = JSON.parse(JSON.stringify(blocks))

    // Copy already-translated blocks and continue from where we left off
    const startIndex = Math.min(existingBlocks.length, blocks.length)
    for (let i = 0; i < startIndex; i++) {
      result[i] = JSON.parse(JSON.stringify(existingBlocks[i]))
    }
    if (startIndex >= blocks.length) return result

    for (let i = startIndex; i < result.length; i++) {
      const block = result[i]
      try {
        switch (block.type) {
          case 'paragraph':
            block.data.text = await this.translateLong(block.data.text ?? '', from, to)
            await sleep(100)
            break
          case 'heading':
            block.data.text = await this.callGoogle(block.data.text ?? '', from, to)
            await sleep(80)
            break
          case 'image': {
            const [caption, alt] = await this.translateBatch(
              [block.data.caption ?? '', block.data.alt ?? ''], from, to,
            )
            block.data.caption = caption
            block.data.alt = alt
            break
          }
          case 'figure': {
            const [title, subtitle, caption, note] = await this.translateBatch(
              [block.data.title ?? '', block.data.subtitle ?? '', block.data.caption ?? '', block.data.note ?? ''],
              from, to,
            )
            block.data.title = title
            block.data.subtitle = subtitle
            block.data.caption = caption
            block.data.note = note
            if (Array.isArray(block.data.bars) && block.data.bars.length) {
              const labels = await this.translateBatch(
                block.data.bars.map((b: any) => b.label ?? ''), from, to,
              )
              block.data.bars.forEach((b: any, j: number) => { b.label = labels[j] })
            }
            break
          }
          case 'callout': {
            const [label, text] = await this.translateBatch(
              [block.data.label ?? '', block.data.text ?? ''], from, to,
            )
            block.data.label = label
            block.data.text = text
            break
          }
          case 'quote': {
            const [text, author] = await this.translateBatch(
              [block.data.text ?? '', block.data.author ?? ''], from, to,
            )
            block.data.text = text
            block.data.author = author
            break
          }
          case 'table': {
            block.data.headers = await this.translateBatch(block.data.headers ?? [], from, to)
            for (let r = 0; r < (block.data.rows?.length ?? 0); r++) {
              block.data.rows[r] = await this.translateBatch(block.data.rows[r] ?? [], from, to)
              await sleep(60)
            }
            break
          }
          case 'divider':
          default:
            break
        }
      } catch (e) {
        this.logger.error(`Block[${i}] translate error (${block.type}): ${e}`)
        // Keep original on error — don't lose the block
      }
    }

    return result
  }

  async translateContent(
    content: {
      title: string
      excerpt: string
      seoTitle: string
      seoDescription: string
      blocks: any[]
    },
    from: string,
    to: string,
    existing: { title?: string; excerpt?: string; seoTitle?: string; seoDescription?: string; blocks?: any[] } = {},
  ) {
    let title = existing.title?.trim() || ''
    let excerpt = existing.excerpt?.trim() || ''
    let seoTitle = existing.seoTitle?.trim() || ''
    let seoDescription = existing.seoDescription?.trim() || ''

    if (!title || !excerpt || !seoTitle || !seoDescription) {
      const batch = await this.translateBatch(
        [content.title ?? '', content.excerpt ?? '', content.seoTitle ?? '', content.seoDescription ?? ''],
        from,
        to,
      )
      if (!title) title = batch[0]
      if (!excerpt) excerpt = batch[1]
      if (!seoTitle) seoTitle = batch[2]
      if (!seoDescription) seoDescription = batch[3]
      await sleep(100)
    }

    const existingBlocks = Array.isArray(existing.blocks) ? existing.blocks : []
    const blocks = await this.translateBlocks(content.blocks ?? [], from, to, existingBlocks)
    return { title, excerpt, seoTitle, seoDescription, blocks }
  }
}
