/**
 * Merges ru.crm.projects string-by-string into en/tr using map files.
 * Map keys must match Russian strings exactly (as in ru locale).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function mergeMaps(parts) {
  const out = {};
  for (const p of parts) {
    const o = loadJson(p);
    Object.assign(out, o);
  }
  return out;
}

function applyMap(obj, map) {
  if (typeof obj === 'string') {
    if (Object.prototype.hasOwnProperty.call(map, obj)) return map[obj];
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((x) => applyMap(x, map));
  if (obj && typeof obj === 'object') {
    const next = {};
    for (const k of Object.keys(obj)) next[k] = applyMap(obj[k], map);
    return next;
  }
  return obj;
}

function main() {
  const ruPath = path.join(root, 'src/locales/ru/translation.json');
  const ru = loadJson(ruPath);
  const src = ru.crm.projects;
  if (!src) {
    console.error('ru.crm.projects missing');
    process.exit(1);
  }

  const enMap = mergeMaps([
    path.join(root, 'src/locales/projects/maps/projects-en-1.json'),
    path.join(root, 'src/locales/projects/maps/projects-en-2.json'),
    path.join(root, 'src/locales/projects/maps/projects-en-3.json'),
    path.join(root, 'src/locales/projects/maps/projects-en-4.json'),
  ]);
  const trMap = mergeMaps([
    path.join(root, 'src/locales/projects/maps/projects-tr-1.json'),
    path.join(root, 'src/locales/projects/maps/projects-tr-2.json'),
    path.join(root, 'src/locales/projects/maps/projects-tr-3.json'),
    path.join(root, 'src/locales/projects/maps/projects-tr-4.json'),
  ]);

  const enPath = path.join(root, 'src/locales/en/translation.json');
  const trPath = path.join(root, 'src/locales/tr/translation.json');
  const en = loadJson(enPath);
  const tr = loadJson(trPath);

  en.crm = en.crm || {};
  tr.crm = tr.crm || {};
  en.crm.projects = applyMap(JSON.parse(JSON.stringify(src)), enMap);
  tr.crm.projects = applyMap(JSON.parse(JSON.stringify(src)), trMap);

  fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
  fs.writeFileSync(trPath, JSON.stringify(tr, null, 2) + '\n', 'utf8');
  console.log('Updated en/tr crm.projects');
}

main();
