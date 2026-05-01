/**
 * Builds projects-en-1..4.json and projects-tr-1..4.json from parallel line files
 * (same order as unique strings in ru crm.projects).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readLines(p) {
  const t = fs.readFileSync(p, 'utf8');
  const a = t.split(/\r?\n/);
  if (a.length && a[a.length - 1] === '') a.pop();
  return a;
}

function chunkObject(obj, parts) {
  const keys = Object.keys(obj);
  const n = keys.length;
  const size = Math.ceil(n / parts);
  const out = [];
  for (let i = 0; i < parts; i++) {
    const slice = {};
    const start = i * size;
    const end = Math.min(start + size, n);
    for (let j = start; j < end; j++) {
      const k = keys[j];
      slice[k] = obj[k];
    }
    out.push(slice);
  }
  return out;
}

const ru = readLines(path.join(root, 'src/locales/_projects_unique_strings_ru.txt'));
const en = readLines(path.join(root, 'src/locales/projects_strings_en.txt'));
const tr = readLines(path.join(root, 'src/locales/projects_strings_tr.txt'));

if (ru.length !== en.length || ru.length !== tr.length) {
  console.error('Line count mismatch', ru.length, en.length, tr.length);
  process.exit(1);
}

const enMap = {};
const trMap = {};
for (let i = 0; i < ru.length; i++) {
  enMap[ru[i]] = en[i];
  trMap[ru[i]] = tr[i];
}

const mapsDir = path.join(root, 'src/locales/projects/maps');
fs.mkdirSync(mapsDir, { recursive: true });

const enChunks = chunkObject(enMap, 4);
const trChunks = chunkObject(trMap, 4);
for (let i = 0; i < 4; i++) {
  fs.writeFileSync(
    path.join(mapsDir, `projects-en-${i + 1}.json`),
    JSON.stringify(enChunks[i], null, 2) + '\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(mapsDir, `projects-tr-${i + 1}.json`),
    JSON.stringify(trChunks[i], null, 2) + '\n',
    'utf8',
  );
}

console.log('Wrote', mapsDir, 'projects-en-1..4.json, projects-tr-1..4.json');
