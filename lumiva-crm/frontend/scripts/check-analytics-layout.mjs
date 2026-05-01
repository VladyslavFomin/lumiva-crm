import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] || '--source';
const srcPath = new URL('../src/pages/analytics/LeadsAnalyticsPageV2.tsx', import.meta.url);
const distDir = fileURLToPath(new URL('../dist', import.meta.url));

function fail(message) {
  console.error(`\n[analytics-check] ${message}\n`);
  process.exit(1);
}

function checkSource() {
  const content = readFileSync(srcPath, 'utf8');
  if (!content.includes('ProjectsAnalyticsPage')) {
    fail('LeadsAnalyticsPageV2.tsx must delegate to ProjectsAnalyticsPage.');
  }
  if (!content.includes('storageNamespace')) {
    fail('LeadsAnalyticsPageV2.tsx missing storageNamespace prop.');
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
  const ok = findInDist(distDir, 'storageNamespace');
  if (!ok) {
    fail('storageNamespace missing in dist bundle. Analytics V2 may not be included.');
  }
}

if (mode === '--dist') {
  checkDist();
} else {
  checkSource();
}
