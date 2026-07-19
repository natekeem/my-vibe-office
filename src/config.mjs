import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = Object.freeze({
  root: ROOT,
  webDir: path.join(ROOT, 'web'),
  dataFile: process.env.AGENT_OFFICE_DATA || path.join(ROOT, 'data', 'state.json'),
  logDir: path.join(ROOT, 'data', 'logs'),
  host: process.env.AGENT_OFFICE_HOST || '127.0.0.1',
  port: Number(process.env.AGENT_OFFICE_PORT || 4317),
  maxBodyBytes: 1024 * 1024,
  maxLogBytes: 2 * 1024 * 1024,
});
