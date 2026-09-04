/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main() {
  loadEnvFile();
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error('Missing DB_HOST / DB_USER / DB_NAME in environment or .env');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, '../migrations/20260831180000-department-code.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    host: DB_HOST,
    port: parseInt(String(DB_PORT || '5432'), 10),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration 20260831180000-department-code applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
