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
  if (content.includes('ProjectsAnalyticsPage')) {
    fail('LeadsAnalyticsPageV2.tsx must keep the new standalone leads analytics design, not the old shared page.');
  }
  if (!content.includes("t('crm.leadsAnalytics.page.title')")) {
    fail('LeadsAnalyticsPageV2.tsx missing the leads analytics header.');
  }
  if (!content.includes('MainLayout')) {
    fail('LeadsAnalyticsPageV2.tsx must render inside the CRM MainLayout.');
  }
  for (const marker of ["fetchCustomFields('lead')", 'fetchProjects()', 'ConfigDrawer', 'AddBlockModal', 'onResizeStart', 'onMoveStart']) {
    if (!content.includes(marker)) {
      fail(`LeadsAnalyticsPageV2.tsx missing leads analytics marker: ${marker}.`);
    }
  }
  if (!/fetchLeadRoi\(\{\s*mode:\s*'sales'/s.test(content)) {
    fail("LeadsAnalyticsPageV2.tsx missing leads analytics marker: fetchLeadRoi({ mode: 'sales' }).");
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
  const ok = findInDist(distDir, 'Лиды — обзор') && findInDist(distDir, 'Режим редактирования') && findInDist(distDir, 'Добавить блок');
  if (!ok) {
    fail('Leads analytics markers missing in dist bundle. Analytics V2 may not be included.');
  }
}

if (mode === '--dist') {
  checkDist();
} else {
  checkSource();
}
