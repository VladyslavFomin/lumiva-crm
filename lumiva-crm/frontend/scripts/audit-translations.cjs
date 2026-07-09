#!/usr/bin/env node
/**
 * Translation audit: compares keys across EN, RU, TR locale files.
 * Uses the UNION of all keys as the canonical set (RU is the primary dev locale).
 * Usage: node scripts/audit-translations.cjs [--filter=<prefix>]
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../src/locales');
const LANGS = ['en', 'ru', 'tr'];

const filterArg = process.argv.find(a => a.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1] : null;

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function loadLocale(lang) {
  const file = path.join(LOCALES_DIR, lang, 'translation.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`ERROR: Cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
}

const locales = {};
for (const lang of LANGS) {
  const allKeys = new Set(flattenKeys(loadLocale(lang)));
  locales[lang] = filter ? new Set([...allKeys].filter(k => k.startsWith(filter))) : allKeys;
}

// Build union of all keys (RU is master, but we track all)
const allKeys = new Set([...locales['en'], ...locales['ru'], ...locales['tr']]);

console.log(`\nTranslation Audit${filter ? ` [filter: ${filter}]` : ''} — ${new Date().toLocaleDateString()}`);
console.log(`Total unique keys across all locales: ${allKeys.size}\n`);

let totalMissing = 0;

for (const lang of LANGS) {
  const langKeys = locales[lang];
  const missing = [...allKeys].filter(k => !langKeys.has(k));

  console.log(`${'─'.repeat(60)}`);
  console.log(`${lang.toUpperCase()}: ${langKeys.size} keys | Missing: ${missing.length}`);

  if (missing.length > 0) {
    totalMissing += missing.length;
    const grouped = {};
    for (const k of missing.sort()) {
      const section = k.split('.').slice(0, 3).join('.');
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(k);
    }
    for (const [section, keys] of Object.entries(grouped)) {
      console.log(`  [${section}] — ${keys.length} missing`);
      const show = keys.length <= 5 ? keys : keys.slice(0, 3);
      for (const k of show) console.log(`    - ${k}`);
      if (keys.length > 5) console.log(`    ... and ${keys.length - 3} more`);
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
if (totalMissing === 0) {
  console.log('✅ All locales are in sync!');
} else {
  console.log(`⚠️  Total missing translations: ${totalMissing}`);
  console.log('Fill gaps with: node scripts/audit-translations.cjs --filter=crm.integrationsHub');
}
