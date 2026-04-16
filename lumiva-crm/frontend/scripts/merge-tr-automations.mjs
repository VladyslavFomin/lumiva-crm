/**
 * Merges en.crm.automations into tr.crm.automations, keeping existing Turkish
 * leaves in tr (e.g. integrationsCatalog.items, list.loading).
 * Run: node scripts/merge-tr-automations.mjs
 */
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const trPath = `${root}src/locales/tr/translation.json`;
const enPath = `${root}src/locales/en/translation.json`;

function mergePreferTarget(t, f) {
  if (f === undefined || f === null) return t;
  if (t === undefined || t === null) return structuredClone(f);
  if (typeof t !== 'object' || typeof f !== 'object') return t;
  if (Array.isArray(t) || Array.isArray(f)) return t;
  const out = {};
  const keys = new Set([...Object.keys(f), ...Object.keys(t)]);
  for (const k of keys) {
    if (!(k in t)) out[k] = structuredClone(f[k]);
    else if (!(k in f)) out[k] = t[k];
    else out[k] = mergePreferTarget(t[k], f[k]);
  }
  return out;
}

const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const prev = tr.crm.automations ?? {};
const merged = mergePreferTarget(prev, en.crm.automations);
tr.crm.automations = merged;

fs.writeFileSync(trPath, `${JSON.stringify(tr, null, 2)}\n`);
