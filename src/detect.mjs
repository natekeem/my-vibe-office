import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function executableOnPath(name) {
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    for (const ext of extensions) {
      const candidate = path.join(dir.replace(/^"|"$/g, ''), name + ext);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch {}
    }
  }
  return null;
}

function newestVersionedCodex(base) {
  try {
    return fs.readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(base, entry.name, 'codex.exe'))
      .filter((file) => fs.existsSync(file))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

export function detectCliAdapters() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const codexBase = path.join(local, 'OpenAI', 'Codex', 'bin');
  const codexCandidates = [
    newestVersionedCodex(codexBase),
    path.join(codexBase, 'codex.exe'),
    executableOnPath('codex'),
  ].filter(Boolean);
  const claudeCandidates = [executableOnPath('claude')].filter(Boolean);
  const usable = (items) => items.find((file) => {
    try { return fs.statSync(file).isFile(); } catch { return false; }
  }) || '';
  return {
    codex: usable(codexCandidates),
    claude: usable(claudeCandidates),
    checkedAt: new Date().toISOString(),
  };
}
