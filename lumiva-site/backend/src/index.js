import express from 'express'
import cors from 'cors'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')
const CONTACTS_FILE = join(DATA_DIR, 'contacts.json')
const NEWSLETTER_FILE = join(DATA_DIR, 'newsletter.json')

const PORT = 3020

const app = express()

app.use(cors({ origin: ['https://lumiva.agency', 'http://localhost:5173'] }))
app.use(express.json())

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
}

async function readJSON(file) {
  try {
    const data = await readFile(file, 'utf8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function appendJSON(file, item) {
  const arr = await readJSON(file)
  arr.push({ ...item, createdAt: new Date().toISOString() })
  await writeFile(file, JSON.stringify(arr, null, 2))
}

// Contact form
app.post('/api/contact', async (req, res) => {
  const { name, company, email, task, budget } = req.body
  if (!name || !email) return res.status(400).json({ error: 'name and email required' })

  await ensureDataDir()
  await appendJSON(CONTACTS_FILE, { name, company, email, task, budget })

  console.log(`[contact] ${name} <${email}> budget=${budget}`)
  res.json({ ok: true })
})

// Newsletter signup
app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  await ensureDataDir()
  const list = await readJSON(NEWSLETTER_FILE)
  if (list.find(e => e.email === email)) {
    return res.json({ ok: true, already: true })
  }
  await appendJSON(NEWSLETTER_FILE, { email })

  console.log(`[newsletter] +${email}`)
  res.json({ ok: true })
})

// List contacts (simple admin, no auth — add auth later)
app.get('/api/admin/contacts', async (req, res) => {
  const list = await readJSON(CONTACTS_FILE)
  res.json(list)
})

app.get('/api/admin/newsletter', async (req, res) => {
  const list = await readJSON(NEWSLETTER_FILE)
  res.json(list)
})

app.get('/api/health', (req, res) => res.json({ ok: true, port: PORT }))

app.listen(PORT, '127.0.0.1', () => {
  console.log(`lumiva-agency-backend running on port ${PORT}`)
})
