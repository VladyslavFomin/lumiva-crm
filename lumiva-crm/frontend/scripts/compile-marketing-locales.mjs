/**
 * Builds src/locales/en/translation.json and tr/translation.json with crm.* marketing subtree.
 * Run from repo: node scripts/compile-marketing-locales.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(__dirname, 'data');

function deepMerge(a, b) {
  if (!b) return a;
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function mapDeep(obj, pick) {
  if (typeof obj === 'string') {
    const p = pairMap.get(obj);
    if (p) return pick === 'en' ? p.en : p.tr;
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((x) => mapDeep(x, pick));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, mapDeep(v, pick)]));
  }
  return obj;
}

const ruLines = fs.readFileSync(path.join(dataDir, 'marketing-cyrillic-only.txt'), 'utf8').trim().split('\n');
const pairs = JSON.parse(fs.readFileSync(path.join(dataDir, 'marketing-pairs-en-tr.json'), 'utf8'));
if (pairs.length !== ruLines.length) {
  throw new Error(`pairs ${pairs.length} !== ru ${ruLines.length}`);
}

const pairMap = new Map();
for (let i = 0; i < ruLines.length; i++) {
  const [en, tr] = pairs[i];
  pairMap.set(ruLines[i], { en, tr });
}

const bundle = JSON.parse(fs.readFileSync(path.join(dataDir, 'marketing-bundle-ru.json'), 'utf8'));
const baseCrm = bundle.crm;

const extraEn = JSON.parse(fs.readFileSync(path.join(dataDir, 'marketing-extra-en.json'), 'utf8'));
const extraTr = JSON.parse(fs.readFileSync(path.join(dataDir, 'marketing-extra-tr.json'), 'utf8'));

const crmEn = deepMerge(mapDeep(baseCrm, 'en'), extraEn);
const crmTr = deepMerge(mapDeep(baseCrm, 'tr'), extraTr);

fs.writeFileSync(path.join(root, 'src/locales/en/translation.json'), JSON.stringify({ crm: crmEn }, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'src/locales/tr/translation.json'), JSON.stringify({ crm: crmTr }, null, 2) + '\n');

console.log('Wrote en/tr marketing CRM locales. Keys under crm:', Object.keys(crmEn).length);
