import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Components that don't represent a real, prerenderable content page —
// redirects and the catch-all 404 are intentionally excluded from the comparison.
const IGNORED_COMPONENTS = new Set(['Navigate', 'NotFoundPage', 'Layout'])

/**
 * Extracts top-level English (no-prefix) page routes from a router definition file.
 * Only matches absolute paths (leading "/") without a dynamic ":param" segment —
 * the /ru and /tr blocks use relative paths (no leading "/"), so they're naturally
 * excluded. Dynamic routes (/blog/:slug, /cases/:slug) are generated from API data
 * at prerender time, not listed statically, so they're excluded here too.
 */
function extractRoutesFromRouterFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8')
  const routes = new Set()
  const pattern = /<Route\s+path="(\/[^"]*)"\s+element=\{<(\w+)/g
  let m
  while ((m = pattern.exec(text))) {
    const [, routePath, component] = m
    if (IGNORED_COMPONENTS.has(component)) continue
    if (routePath.includes(':')) continue
    routes.add(routePath)
  }
  return routes
}

/**
 * Extracts the BASE_ROUTES and EN_ONLY_ROUTES (or EN_ONLY_PAGES) array literals
 * from scripts/generate-sitemap.mjs and scripts/prerender.mjs.
 */
function extractRoutesFromArrayFile(filePath, arrayNames) {
  const text = fs.readFileSync(filePath, 'utf-8')
  const routes = new Set()
  for (const name of arrayNames) {
    const re = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\])`, 'm')
    const m = text.match(re)
    if (!m) continue
    // Entries are either bare strings ('/path') or [path, ...] tuples (sitemap STATIC_PAGES/EN_ONLY_PAGES).
    const stringMatches = [...m[1].matchAll(/'(\/[^']*)'/g)].map(x => x[1])
    for (const r of stringMatches) {
      if (!r.includes(':')) routes.add(r)
    }
  }
  return routes
}

function diff(setA, setB) {
  return [...setA].filter(x => !setB.has(x))
}

function main() {
  const appRoutes = extractRoutesFromRouterFile(path.join(root, 'src/App.tsx'))
  const ssrRoutes = extractRoutesFromRouterFile(path.join(root, 'src/entry-server.tsx'))
  const prerenderRoutes = extractRoutesFromArrayFile(
    path.join(root, 'scripts/prerender.mjs'),
    ['BASE_ROUTES', 'EN_ONLY_ROUTES']
  )

  const problems = []

  const missingInSsr = diff(appRoutes, ssrRoutes)
  if (missingInSsr.length > 0) {
    problems.push(`Routes in App.tsx but missing from entry-server.tsx (SSR will 404 these):\n  ${missingInSsr.join('\n  ')}`)
  }

  const missingInApp = diff(ssrRoutes, appRoutes)
  if (missingInApp.length > 0) {
    problems.push(`Routes in entry-server.tsx but missing from App.tsx (dead SSR-only routes):\n  ${missingInApp.join('\n  ')}`)
  }

  const missingInPrerender = diff(appRoutes, prerenderRoutes)
  if (missingInPrerender.length > 0) {
    problems.push(`Routes in App.tsx but missing from prerender.mjs (will never be statically generated):\n  ${missingInPrerender.join('\n  ')}`)
  }

  const extraInPrerender = diff(prerenderRoutes, appRoutes)
  if (extraInPrerender.length > 0) {
    problems.push(`Routes in prerender.mjs but missing from App.tsx (prerendering a route that doesn't exist):\n  ${extraInPrerender.join('\n  ')}`)
  }

  if (problems.length > 0) {
    console.error('\n✗ Route validation failed — App.tsx, entry-server.tsx and prerender.mjs are out of sync.\n')
    console.error(problems.join('\n\n'))
    console.error('\nFix: add the missing route(s) to the listed file(s), then re-run the build.\n')
    process.exit(1)
  }

  console.log(`✓  Routes in sync — ${appRoutes.size} page(s) across App.tsx, entry-server.tsx and prerender.mjs`)
}

main()
