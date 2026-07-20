import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exists = (target) => { try { return fs.existsSync(target); } catch { return false; } };
const short = (value, max = 180) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

function readText(file, limit = 1024 * 1024) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > limit) return '';
    return fs.readFileSync(file, 'utf8');
  } catch { return ''; }
}

function resolveExecutable(value) {
  const command = String(value || '').trim();
  if (!command) return '';
  if (path.isAbsolute(command) && exists(command)) return command;
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(dir.replace(/^"|"$/g, ''), command + extension);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch {}
    }
  }
  return '';
}

function readJson(file) {
  const text = readText(file);
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    try { return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')); } catch { return null; }
  }
}

function frontmatter(file) {
  const text = readText(file, 128 * 1024);
  const block = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  const result = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (match) result[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return result;
}

function entries(dir, filter = () => true, limit = 200) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(filter).slice(0, limit); } catch { return []; }
}

function addFile(items, type, file, scope, name = path.basename(file), detail = '') {
  if (!exists(file)) return;
  items.push({ type, name, scope, source: file, detail: short(detail), enabled: true });
}

function addMarkdownDir(items, type, dir, scope, nestedSkill = false) {
  for (const entry of entries(dir)) {
    const file = entry.isDirectory()
      ? path.join(dir, entry.name, nestedSkill ? 'SKILL.md' : `${entry.name}.md`)
      : path.join(dir, entry.name);
    if (!exists(file) || !/\.md$/i.test(file)) continue;
    const meta = frontmatter(file);
    items.push({
      type, name: meta.name || entry.name.replace(/\.md$/i, ''), scope, source: file,
      detail: short(meta.description), mode: meta.mode || '', model: meta.model || '', enabled: meta.disable !== 'true',
    });
  }
}

function addSkillTree(items, root, scope, maxDepth = 5) {
  const stack = [{ dir: root, depth: 0 }];
  let found = 0;
  while (stack.length && found < 200) {
    const current = stack.pop();
    for (const entry of entries(current.dir, (item) => !['node_modules', '.git'].includes(item.name))) {
      const full = path.join(current.dir, entry.name);
      if (entry.isDirectory() && current.depth < maxDepth) stack.push({ dir: full, depth: current.depth + 1 });
      if (!entry.isFile() || entry.name !== 'SKILL.md') continue;
      const meta = frontmatter(full);
      items.push({ type: 'skills', name: meta.name || path.basename(path.dirname(full)), scope, source: full, detail: short(meta.description), enabled: true });
      found += 1;
    }
  }
}

function addPluginDir(items, dir, scope) {
  for (const entry of entries(dir, (item) => !item.name.startsWith('.'))) {
    if (!entry.isDirectory() && !/\.(?:js|ts|mjs|cjs)$/i.test(entry.name)) continue;
    items.push({ type: 'plugins', name: entry.name.replace(/\.[^.]+$/, ''), scope, source: path.join(dir, entry.name), enabled: true });
  }
}

function addJsonConfig(items, file, scope, flavor) {
  const config = readJson(file);
  if (!config) return;
  const mcp = config.mcpServers || config.mcp || {};
  for (const [name, value] of Object.entries(mcp)) {
    items.push({ type: 'mcp', name, scope, source: file, detail: short(value?.type || value?.transport || 'configured'), enabled: value?.enabled !== false && value?.disabled !== true });
  }
  const plugins = Array.isArray(config.plugin) ? config.plugin : Object.keys(config.enabledPlugins || {}).filter((key) => config.enabledPlugins[key] !== false);
  for (const name of plugins) items.push({ type: 'plugins', name: String(name), scope, source: file, enabled: true });
  const instructions = Array.isArray(config.instructions) ? config.instructions : config.instructions ? [config.instructions] : [];
  for (const rule of instructions) items.push({ type: 'rules', name: String(rule), scope, source: file, detail: 'instructions', enabled: true });
  if (flavor === 'opencode') {
    for (const [name, value] of Object.entries(config.agent || {})) {
      items.push({ type: value?.mode === 'subagent' ? 'subagents' : 'agents', name, scope, source: file, detail: short(value?.description), mode: value?.mode || 'all', model: value?.model || '', enabled: value?.disable !== true });
    }
  }
}

function inspectCodex(home, projectPath, executable) {
  const root = path.join(home, '.codex');
  const items = [];
  addFile(items, 'rules', path.join(root, 'AGENTS.md'), 'global', 'AGENTS.md');
  addFile(items, 'rules', path.join(projectPath, 'AGENTS.md'), 'project', 'AGENTS.md');
  addSkillTree(items, path.join(root, 'skills'), 'global', 4);
  addSkillTree(items, path.join(projectPath, '.codex', 'skills'), 'project', 4);
  addSkillTree(items, path.join(root, 'plugins', 'cache'), 'plugin', 7);
  addPluginDir(items, path.join(root, 'plugins', 'cache'), 'global');
  for (const entry of entries(path.join(root, 'rules'), (item) => item.isFile())) addFile(items, 'rules', path.join(root, 'rules', entry.name), 'global');
  const toml = readText(path.join(root, 'config.toml'));
  for (const match of toml.matchAll(/^\[mcp_servers\.([^\.\]]+)\]/gm)) items.push({ type: 'mcp', name: match[1], scope: 'global', source: path.join(root, 'config.toml'), enabled: true });
  return client('codex', 'Codex', executable, items);
}

function inspectClaude(home, projectPath, executable) {
  const root = path.join(home, '.claude');
  const items = [];
  for (const [name, detail] of [['Explore', '빠른 코드베이스 탐색'], ['Plan', '구현 계획과 조사'], ['general-purpose', '복합 작업용 범용 서브에이전트']]) items.push({ type: 'subagents', name, scope: 'built-in', source: 'Claude Code', detail, enabled: true });
  addFile(items, 'rules', path.join(home, 'CLAUDE.md'), 'global', 'CLAUDE.md');
  addFile(items, 'rules', path.join(projectPath, 'CLAUDE.md'), 'project', 'CLAUDE.md');
  addJsonConfig(items, path.join(root, 'settings.json'), 'global', 'claude');
  addJsonConfig(items, path.join(home, '.claude.json'), 'global', 'claude');
  addJsonConfig(items, path.join(projectPath, '.claude', 'settings.json'), 'project', 'claude');
  addJsonConfig(items, path.join(projectPath, '.mcp.json'), 'project', 'claude');
  addMarkdownDir(items, 'skills', path.join(root, 'skills'), 'global', true);
  addMarkdownDir(items, 'skills', path.join(projectPath, '.claude', 'skills'), 'project', true);
  addMarkdownDir(items, 'subagents', path.join(root, 'agents'), 'global');
  addMarkdownDir(items, 'subagents', path.join(projectPath, '.claude', 'agents'), 'project');
  addPluginDir(items, path.join(root, 'plugins'), 'global');
  return client('claude', 'Claude Code', executable, items);
}

function inspectOpenCode(home, projectPath, executable) {
  const globalRoot = process.env.OPENCODE_CONFIG_DIR || path.join(home, '.config', 'opencode');
  const projectRoot = path.join(projectPath, '.opencode');
  const items = [];
  for (const [name, detail] of [['General', '범용 위임 작업'], ['Explore', '빠른 코드베이스 탐색']]) items.push({ type: 'subagents', name, scope: 'built-in', source: 'OpenCode', detail, enabled: true });
  addJsonConfig(items, path.join(globalRoot, 'opencode.json'), 'global', 'opencode');
  addJsonConfig(items, path.join(projectPath, 'opencode.json'), 'project', 'opencode');
  addJsonConfig(items, path.join(projectPath, 'opencode.jsonc'), 'project', 'opencode');
  for (const [root, scope] of [[globalRoot, 'global'], [projectRoot, 'project']]) {
    addMarkdownDir(items, 'skills', path.join(root, 'skills'), scope, true);
    addMarkdownDir(items, 'subagents', path.join(root, 'agents'), scope);
    addPluginDir(items, path.join(root, 'plugins'), scope);
    for (const entry of entries(path.join(root, 'commands'), (item) => item.isFile())) addFile(items, 'commands', path.join(root, 'commands', entry.name), scope);
  }
  addMarkdownDir(items, 'skills', path.join(home, '.agents', 'skills'), 'global', true);
  addMarkdownDir(items, 'skills', path.join(projectPath, '.agents', 'skills'), 'project', true);
  return client('opencode', 'OpenCode', executable, items);
}

function client(id, label, executable, items, family = id) {
  const unique = [...new Map(items.map((item) => [`${item.type}|${item.scope}|${item.name}|${item.source}`, item])).values()];
  const counts = {};
  for (const item of unique) counts[item.type] = (counts[item.type] || 0) + 1;
  return { id, label, family, installed: Boolean(executable), executable: executable || '', counts, items: unique };
}

export function inspectCapabilities({ projectPath = '', detected = {}, adapters = {} } = {}) {
  const home = os.homedir();
  const root = projectPath && exists(projectPath) ? path.resolve(projectPath) : process.cwd();
  const core = [
    inspectCodex(home, root, detected.codex || resolveExecutable(adapters.codex?.executable)),
    inspectClaude(home, root, detected.claude || resolveExecutable(adapters.claude?.executable)),
    inspectOpenCode(home, root, detected.opencode || resolveExecutable(adapters.opencode?.executable)),
  ];
  const byFamily = Object.fromEntries(core.map((item) => [item.id, item]));
  const custom = Object.entries(adapters || {}).filter(([id]) => !['codex', 'claude', 'opencode', 'custom'].includes(id)).map(([id, adapter]) => {
    const inherited = byFamily[adapter.family]?.items || [];
    const items = inherited.map((item) => ({ ...item }));
    items.push({ type: 'runtime', name: '실행 명령', scope: 'profile', source: 'Workpets settings', detail: `${adapter.executable || '미설정'} ${(adapter.args || []).join(' ')}`.trim(), enabled: Boolean(adapter.executable) });
    for (const [name, value] of Object.entries(adapter.env || {})) {
      const reference = String(value).match(/^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/);
      items.push({ type: 'runtime', name, scope: 'profile', source: 'Workpets settings', detail: reference ? `환경 변수 ${reference[1]}에서 주입` : '프로필에 로컬 값 설정됨', enabled: true });
    }
    return client(id, adapter.label || id, resolveExecutable(adapter.executable), items, adapter.family || 'custom');
  });
  return {
    projectPath: root,
    scannedAt: new Date().toISOString(),
    clients: [...core, ...custom],
  };
}
