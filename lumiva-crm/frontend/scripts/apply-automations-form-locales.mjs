/**
 * Builds crm.automations.form for en and tr from ru snippet + triplet map.
 * Run from frontend/: npm run locales:automations-form
 */
import fs from 'node:fs';
import { TRIPLETS as p1 } from './form-triplets/part01.mjs';
import { TRIPLETS as p2 } from './form-triplets/part02.mjs';
import { TRIPLETS as p3 } from './form-triplets/part03.mjs';
import { TRIPLETS as p4 } from './form-triplets/part04.mjs';
import { TRIPLETS as p5 } from './form-triplets/part05.mjs';

const root = new URL('..', import.meta.url).pathname;
const ruFormPath = `${root}src/locales/snippets/ru-automations-form.json`;
const enPath = `${root}src/locales/en/translation.json`;
const trPath = `${root}src/locales/tr/translation.json`;

const TRIPLETS = [...p1, ...p2, ...p3, ...p4, ...p5];
const toEn = new Map(TRIPLETS.map((t) => [t[0], t[1]]));
const toTr = new Map(TRIPLETS.map((t) => [t[0], t[2]]));

function translateTree(node, pick) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    const v = pick(node);
    if (v === undefined) throw new Error(`Missing translation for: ${JSON.stringify(node).slice(0, 120)}`);
    return v;
  }
  if (Array.isArray(node)) return node.map((x) => translateTree(x, pick));
  if (typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = translateTree(node[k], pick);
    return out;
  }
  return node;
}

function collectStrings(node, acc) {
  if (typeof node === 'string') acc.add(node);
  else if (Array.isArray(node)) node.forEach((x) => collectStrings(x, acc));
  else if (node && typeof node === 'object') Object.values(node).forEach((x) => collectStrings(x, acc));
}

const ruForm = JSON.parse(fs.readFileSync(ruFormPath, 'utf8'));
const used = new Set();
collectStrings(ruForm, used);
const missing = [...used].filter((s) => !toEn.has(s) || !toTr.has(s));
if (missing.length) {
  console.error('Strings in ru form not covered by triplets:', missing.slice(0, 20));
  process.exit(1);
}

const enForm = translateTree(ruForm, (s) => toEn.get(s));
const trForm = translateTree(ruForm, (s) => toTr.get(s));

/** Match ru: list → panel → form → …rest (integrationsCatalog, etc.) */
function insertFormAfterPanel(auto, formValue) {
  const keys = Object.keys(auto).filter((k) => k !== 'form');
  const pi = keys.indexOf('panel');
  if (pi === -1) return { ...auto, form: formValue };
  const out = {};
  for (let i = 0; i <= pi; i++) out[keys[i]] = auto[keys[i]];
  out.form = formValue;
  for (let i = pi + 1; i < keys.length; i++) out[keys[i]] = auto[keys[i]];
  return out;
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const tr = JSON.parse(fs.readFileSync(trPath, 'utf8'));
en.crm.automations = insertFormAfterPanel(en.crm.automations, enForm);
tr.crm.automations = insertFormAfterPanel(tr.crm.automations, trForm);

fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(trPath, `${JSON.stringify(tr, null, 2)}\n`);
console.log('Updated en.crm.automations.form and tr.crm.automations.form');
