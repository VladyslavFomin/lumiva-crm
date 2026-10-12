import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

const SEP = 'XLSEPX'
const CHUNK_LIMIT = 4800

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Flat string fields translated as-is.
const FLAT_FIELDS = [
  'industry', 'shortResult', 'segment', 'markets', 'duration', 'teamSize',
  'leadText', 'coverCaption', 'coverRibbon', 'beforeText', 'beforeDescription',
  'afterDescription', 'lineChartTitle', 'lineChartValue', 'lineChartDelta', 'nextCaseTitle',
  'seoTitle', 'seoDescription',
] as const

// Array fields: [column, subfields-to-translate]
const ARRAY_FIELDS: Array<[string, string[]]> = [
  ['services', []], // array of plain strings
  ['tags', []], // array of plain strings
  ['kpis', ['label', 'source']],
  ['chapters', ['title', 'lead']],
  ['testimonials', ['quote', 'authorRole']],
  ['challenges', ['category', 'title', 'body']],
  ['approachItems', ['title', 'body']],
  ['timeline', ['week', 'phase', 'description']],
  ['colors', ['label']],
  ['deliverables', ['name', 'category']],
  ['funnelData', ['name', 'label']],
  ['nextCaseMeta', ['label', 'value']],
]

@Injectable()
export class CaseTranslateService {
  private readonly logger = new Logger(CaseTranslateService.name)

  private async callGoogle(text: string, from: string, to: string): Promise<string> {
    if (!text?.trim()) return text
    const url = 'https://translate.googleapis.com/translate_a/single'
    const { data } = await axios.get(url, {
      params: { client: 'gtx', sl: from, tl: to, dt: 't', q: text },
      timeout: 12000,
    })
    if (Array.isArray(data?.[0])) {
      return data[0].map((chunk: any[]) => chunk[0] || '').join('')
    }
    throw new Error('Unexpected Google Translate response')
  }

  private splitText(text: string): string[] {
    if (text.length <= CHUNK_LIMIT) return [text]
    const chunks: string[] = []
    const paragraphs = text.split(/\n{2,}/)
    let cur = ''
    for (const para of paragraphs) {
      if (cur.length + para.length + 2 > CHUNK_LIMIT) {
        if (cur) chunks.push(cur.trim())
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
      const upperSep = SEP.toUpperCase()
      const lowerSep = SEP.toLowerCase()
      const parts = translated
        .replace(new RegExp(upperSep, 'g'), SEP)
        .replace(new RegExp(lowerSep, 'g'), SEP)
        .split(`\n${SEP}\n`)
      const actualParts = parts.length >= texts.length ? parts : translated.split(SEP)
      return texts.map((orig, i) => actualParts[i]?.trim() || orig || '')
    }

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

  async translateContent(content: Record<string, any>, from: string, to: string, existing: Record<string, any> = {}) {
    const result: Record<string, any> = { ...existing }

    // ── Flat fields — batched in one request ──
    const flatMissing = FLAT_FIELDS.filter(f => !result[f]?.trim?.())
    if (flatMissing.length) {
      const values = await this.translateBatch(flatMissing.map(f => content[f] ?? ''), from, to)
      flatMissing.forEach((f, i) => { result[f] = values[i] })
      await sleep(80)
    }

    // ── Array fields ──
    for (const [field, subfields] of ARRAY_FIELDS) {
      const src = Array.isArray(content[field]) ? content[field] : []
      if (!src.length) continue
      const existingArr = Array.isArray(result[field]) ? result[field] : []
      if (existingArr.length === src.length) continue // already translated

      if (subfields.length === 0) {
        // plain string array (services, tags)
        result[field] = await this.translateBatch(src, from, to)
        await sleep(60)
        continue
      }

      // object array — batch each subfield across all rows in one request
      const translatedRows = src.map((row: any) => ({ ...row }))
      for (const sub of subfields) {
        const values = await this.translateBatch(src.map((row: any) => row?.[sub] ?? ''), from, to)
        translatedRows.forEach((row: any, i: number) => { row[sub] = values[i] })
        await sleep(60)
      }
      result[field] = translatedRows
    }

    return result
  }
}
