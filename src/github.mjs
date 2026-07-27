import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function run(file, args, options = {}) {
  const result = await execFileAsync(file, args, { windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024, ...options });
  return result.stdout.trim();
}

function slugFromRemote(remote) {
  const value = String(remote || '').trim().replace(/\.git$/, '');
  const match = value.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  return match ? `${match[1]}/${match[2]}` : '';
}

export async function inspectGithub(projectPath) {
  const result = { available: false, authenticated: false, slug: '', issues: [], pullRequests: [], projects: [], error: '', scannedAt: new Date().toISOString() };
  if (!projectPath) return result;
  try {
    result.slug = slugFromRemote(await run('git', ['-C', projectPath, 'remote', 'get-url', 'origin']));
    if (!result.slug) throw new Error('GitHub origin 원격 저장소를 찾을 수 없습니다.');
    result.available = true;
    await run('gh', ['auth', 'status']);
    result.authenticated = true;
    result.issues = JSON.parse(await run('gh', ['issue', 'list', '--repo', result.slug, '--state', 'all', '--limit', '50', '--json', 'number,title,state,url,labels,assignees,updatedAt']));
    result.pullRequests = JSON.parse(await run('gh', ['pr', 'list', '--repo', result.slug, '--state', 'all', '--limit', '30', '--json', 'number,title,state,url,headRefName,baseRefName,isDraft,updatedAt,statusCheckRollup']));
    const owner = result.slug.split('/')[0];
    try {
      const raw = JSON.parse(await run('gh', ['project', 'list', '--owner', owner, '--limit', '20', '--format', 'json']));
      result.projects = raw.projects || raw || [];
      for (const board of result.projects.slice(0, 8)) {
        try {
          const detail = JSON.parse(await run('gh', ['project', 'item-list', String(board.number), '--owner', owner, '--limit', '50', '--format', 'json']));
          board.items = detail.items || [];
        } catch (error) { board.itemError = String(error.stderr || error.message || '').trim().slice(0, 200); }
      }
    } catch (error) {
      result.projectError = String(error.stderr || error.message || '').trim().slice(0, 300);
      result.projectPermissionMissing = /missing required scopes?[\s\S]*read:project|read:project[\s\S]*scope/i.test(result.projectError);
    }
  } catch (error) {
    result.error = String(error.stderr || error.message || '').trim().slice(0, 500);
  }
  return result;
}

export async function createGithubIssue(projectPath, { title, body = '' }) {
  const current = await inspectGithub(projectPath);
  if (!current.authenticated || !current.slug) throw new Error(current.error || 'GitHub CLI 인증 또는 origin 설정이 필요합니다.');
  const url = await run('gh', ['issue', 'create', '--repo', current.slug, '--title', String(title), '--body', String(body)]);
  const number = Number(url.match(/\/(\d+)$/)?.[1] || 0);
  return { number, title: String(title), url, state: 'OPEN', repo: current.slug };
}

export async function getGithubIssue(projectPath, issueNumber) {
  const current = await inspectGithub(projectPath);
  if (!current.authenticated || !current.slug) throw new Error(current.error || 'GitHub CLI 인증 또는 origin 설정이 필요합니다.');
  const number = Number(issueNumber);
  if (!Number.isInteger(number) || number < 1) throw new Error('올바른 GitHub Issue 번호가 필요합니다.');
  return JSON.parse(await run('gh', ['issue', 'view', String(number), '--repo', current.slug, '--json', 'number,title,body,state,url,labels,assignees']));
}

export async function setGithubIssueState(projectPath, issueNumber, state) {
  const current = await inspectGithub(projectPath);
  if (!current.authenticated || !current.slug) throw new Error(current.error || 'GitHub CLI 인증 또는 origin 설정이 필요합니다.');
  const number = Number(issueNumber);
  if (!Number.isInteger(number) || number < 1) throw new Error('올바른 GitHub Issue 번호가 필요합니다.');
  const action = state === 'OPEN' ? 'reopen' : 'close';
  await run('gh', ['issue', action, String(number), '--repo', current.slug]);
  return getGithubIssue(projectPath, number);
}
