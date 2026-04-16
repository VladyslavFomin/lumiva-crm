import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] || '--source';
const srcPath = new URL('../src/pages/analytics/LeadsAnalyticsPage.tsx', import.meta.url);
const distDir = fileURLToPath(new URL('../dist', import.meta.url));

function fail(message) {
  console.error(`\n[analytics-check] ${message}\n`);
  process.exit(1);
}

function checkSource() {
  const content = readFileSync(srcPath, 'utf8');
  if (content.includes('MAIN DASHBOARD')) {
    fail('Found legacy MAIN DASHBOARD block. Constructor must be used.');
  }
  if (!content.includes('Конструктор аналитики')) {
    fail('Constructor UI missing in LeadsAnalyticsPage.tsx.');
  }
  if (!content.includes('addOpen')) {
    fail('Constructor add modal missing in LeadsAnalyticsPage.tsx.');
  }
}

function findInDist(dir, needle) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findInDist(full, needle)) return true;
      continue;
    }
    try {
      const data = readFileSync(full, 'utf8');
      if (data.includes(needle)) return true;
    } catch {
      // ignore binary
    }
  }
  return false;
}

function checkDist() {
  const ok = findInDist(distDir, 'Конструктор аналитики');
  if (!ok) {
    fail('Constructor text missing in dist bundle. Build likely using old layout.');
  }
}

if (mode === '--dist') {
  checkDist();
} else {
  checkSource();
}

