import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md', 'AGENTS.md', 'CLAUDE.md',
  'docs/DOCUMENTATION_MAP.md', 'docs/HANDOFF.md', 'docs/ARCHITECTURE.md',
  'docs/DECISIONS.md', 'docs/OPERATIONS.md', 'docs/API.md',
  'docs/ROADMAP.md', 'docs/PRODUCT_SURFACES.md', 'docs/QA_REPORT.md',
];
const forbidden = [
  /리버스\s*엔지니어링/iu,
  /재구현/iu,
  /원본\s*(앱|프로그램|실행\s*파일|설치본)/iu,
  /agentsroom(?:\.dev)?/iu,
  /claw[- ]empire/iu,
  /appdata[\\/]local[\\/]programs[\\/]workpets/iu,
  /\bworkpets\b/iu,
];

const markdown = [];
for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
  const full = path.join(entry.parentPath || entry.path, entry.name);
  if (full.includes(`${path.sep}node_modules${path.sep}`) || full.includes(`${path.sep}.git${path.sep}`)) continue;
  markdown.push(full);
}

const errors = [];
for (const relative of required) if (!fs.existsSync(path.join(root, relative))) errors.push(`필수 문서 없음: ${relative}`);

const roadmaps = markdown.filter((file) => /roadmap/i.test(path.basename(file)));
if (roadmaps.length !== 1 || path.relative(root, roadmaps[0] || '') !== path.join('docs', 'ROADMAP.md')) {
  errors.push(`로드맵 정본은 docs/ROADMAP.md 하나여야 합니다: ${roadmaps.map((file) => path.relative(root, file)).join(', ')}`);
}

for (const file of markdown) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) if (pattern.test(content)) errors.push(`금지된 제품 기원 표현: ${relative} (${pattern})`);
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, '');
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    target = decodeURIComponent(target.split('#')[0]);
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) errors.push(`깨진 문서 링크: ${relative} -> ${match[1]}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`DOCS_OK ${markdown.length} markdown files`);
}
