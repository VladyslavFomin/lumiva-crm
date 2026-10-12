import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const BASE_URL = 'https://lumiva.agency'
const INDEXNOW_KEY = '60f450c1d1aea31b6c03be5e21e23569'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

function readSitemapUrls() {
  const sitemapPath = path.join(root, 'public', 'sitemap.xml')
  const xml = fs.readFileSync(sitemapPath, 'utf-8')
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  return [...new Set(matches)]
}

async function submitBatch(urlList) {
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'lumiva.agency',
      key: INDEXNOW_KEY,
      keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  })
  return res
}

async function main() {
  const explicitUrls = process.argv.slice(2)
  const urls = explicitUrls.length > 0 ? explicitUrls : readSitemapUrls()

  if (urls.length === 0) {
    console.log('No URLs to submit.')
    return
  }

  console.log(`Submitting ${urls.length} URL(s) to IndexNow...`)

  // IndexNow accepts up to 10,000 URLs per request
  const BATCH_SIZE = 10000
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    try {
      const res = await submitBatch(batch)
      console.log(`  Batch ${i / BATCH_SIZE + 1}: HTTP ${res.status}`)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.warn(`  Response: ${text}`)
      }
    } catch (err) {
      console.error(`  Batch ${i / BATCH_SIZE + 1} failed:`, err.message)
    }
  }

  console.log('Done.')
}

main()
