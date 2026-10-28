import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const variables = new Map();

try {
  const contents = await readFile(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || match[1].startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    variables.set(match[1], value);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function value(name, fallback) {
  return (process.env[name] ?? variables.get(name) ?? fallback).trim();
}

function integerValue(name, fallback, min, max) {
  const parsed = Number(value(name, String(fallback)));
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const config = {
  apiBaseUrl: value('KSONG_API_BASE_URL', ''),
  backgroundColor: value('KSONG_BACKGROUND_COLOR', '#000033'),
  accentColor: value('KSONG_ACCENT_COLOR', '#f2f2f2'),
  pageSize: integerValue('KSONG_PAGE_SIZE', 8, 1, 100),
  refreshBufferSeconds: integerValue('KSONG_REFRESH_BUFFER_SECONDS', 60, 0, 3600),
};
const script = `window.__KSONG_CONFIG__ = ${JSON.stringify(config)};\n`;
await writeFile(path.join(root, 'public', 'ksong-config.js'), script, 'utf8');
console.log('K-Song runtime configuration prepared.');
