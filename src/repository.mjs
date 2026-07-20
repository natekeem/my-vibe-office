import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function git(projectPath, args, options = {}) {
  const result = await execFileAsync('git', ['-C', projectPath, ...args], {
    windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024, ...options,
  });
  return result.stdout.trim();
}

function parseWorktrees(text) {
  const rows = [];
  let current = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current) rows.push(current);
      current = { path: line.slice(9), head: '', branch: '', bare: false, detached: false };
    } else if (current && line.startsWith('HEAD ')) current.head = line.slice(5);
    else if (current && line.startsWith('branch ')) current.branch = line.slice(7).replace('refs/heads/', '');
    else if (current && line === 'bare') current.bare = true;
    else if (current && line === 'detached') current.detached = true;
  }
  if (current) rows.push(current);
  return rows;
}

export async function inspectRepository(projectPath) {
  const result = {
    valid: false, path: projectPath ? path.resolve(projectPath) : '', root: '', branch: '',
    upstream: '', ahead: 0, behind: 0, dirty: false, changes: [], branches: [], commits: [], remotes: [], worktrees: [], error: '',
    scannedAt: new Date().toISOString(),
  };
  if (!projectPath) { result.error = '로컬 Git repo 폴더를 선택하세요.'; return result; }
  try {
    result.root = path.resolve(await git(projectPath, ['rev-parse', '--show-toplevel']));
    result.path = result.root;
    result.valid = true;
    result.branch = await git(result.root, ['branch', '--show-current']);
    const status = await git(result.root, ['status', '--porcelain=v1', '--branch']);
    const lines = status.split(/\r?\n/).filter(Boolean);
    const header = lines.shift() || '';
    const upstream = header.match(/^## .*?\.\.\.([^ .]+)(?: \[(.*?)\])?$/);
    if (upstream) {
      result.upstream = upstream[1];
      for (const part of String(upstream[2] || '').split(', ')) {
        const match = part.match(/(ahead|behind) (\d+)/);
        if (match) result[match[1]] = Number(match[2]);
      }
    }
    result.changes = lines.slice(0, 100).map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }));
    result.dirty = result.changes.length > 0;
    const branchText = await git(result.root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)%1f%(HEAD)%1f%(upstream:short)%1f%(committerdate:iso8601-strict)', 'refs/heads', 'refs/remotes']);
    result.branches = branchText.split(/\r?\n/).filter(Boolean).slice(0, 100).map((line) => {
      const [name, head, branchUpstream, updatedAt] = line.split('\x1f');
      return { name, current: head === '*', upstream: branchUpstream || '', updatedAt: updatedAt || '', remote: name?.includes('/') && !name.startsWith('workpets/') };
    });
    const logText = await git(result.root, ['log', '-30', '--pretty=format:%H%x1f%h%x1f%an%x1f%aI%x1f%s']);
    result.commits = logText.split(/\r?\n/).filter(Boolean).map((line) => {
      const [hash, shortHash, author, authoredAt, subject] = line.split('\x1f');
      return { hash, shortHash, author, authoredAt, subject };
    });
    const remoteText = await git(result.root, ['remote', '-v']);
    result.remotes = [...new Map(remoteText.split(/\r?\n/).filter(Boolean).map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      return match ? [`${match[1]}|${match[2]}`, { name: match[1], url: match[2] }] : [line, null];
    }).filter(([, value]) => value)).values()];
    result.worktrees = parseWorktrees(await git(result.root, ['worktree', 'list', '--porcelain']));
  } catch (error) {
    result.error = String(error.stderr || error.message || 'Git 저장소를 확인할 수 없습니다.').trim().slice(0, 500);
  }
  return result;
}

function safeSegment(value) {
  return String(value || 'agent').toLowerCase().replace(/[^a-z0-9가-힣_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'agent';
}

export function agentWorktreePath(repoPath, agent) {
  const rootHash = crypto.createHash('sha1').update(path.resolve(repoPath).toLowerCase()).digest('hex').slice(0, 7);
  const rootName = `${safeSegment(path.basename(repoPath))}-${rootHash}`;
  const agentName = safeSegment(agent?.id || agent?.name);
  const base = process.env.WORKPETS_WORKTREE_ROOT || path.join(os.homedir(), '.workpets', 'worktrees');
  return path.join(base, rootName, `${agentName}-${String(agent?.id || '').slice(-8)}`);
}

export async function ensureAgentWorktree(repoPath, agent) {
  const inspected = await inspectRepository(repoPath);
  if (!inspected.valid) throw new Error(inspected.error || '유효한 Git repo가 필요합니다.');
  const target = agentWorktreePath(inspected.root, agent);
  const branch = `workpets/${safeSegment(agent?.id || agent?.name)}`;
  if (fs.existsSync(path.join(target, '.git'))) return { path: target, branch, created: false };
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  let exists = false;
  try { await git(inspected.root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]); exists = true; } catch {}
  await git(inspected.root, exists ? ['worktree', 'add', target, branch] : ['worktree', 'add', '-b', branch, target, 'HEAD'], { timeout: 60000 });
  return { path: target, branch, created: true };
}
