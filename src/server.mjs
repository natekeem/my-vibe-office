import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { presets } from './presets.mjs';
import { inspectCapabilities } from './capabilities.mjs';
import { createGithubIssue, getGithubIssue, inspectGithub, setGithubIssueState } from './github.mjs';
import { ensureAgentWorktree, inspectRepository } from './repository.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
}

async function body(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('요청 본문이 너무 큽니다.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('올바른 JSON이 아닙니다.'), { status: 400 }); }
}

export function createServer({ store, runner, scheduler, orchestrator, integrations = {}, config }) {
  const clients = new Set();
  const emit = (event, data) => {
    const packet = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) client.write(packet);
  };
  runner.emit = emit;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const method = req.method || 'GET';
    try {
      if (method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(`event: ready\ndata: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, localOnly: config.host === '127.0.0.1', running: runner.runningCount() });
      if (method === 'GET' && url.pathname === '/api/state') return send(res, 200, store.snapshot());
      if (method === 'GET' && url.pathname === '/api/presets') return send(res, 200, presets);
      if (method === 'GET' && url.pathname === '/api/usage') return send(res, 200, usageSummary(store.snapshot()));
      if (method === 'GET' && url.pathname === '/api/detect') return send(res, 200, store.snapshot().settings.detected || {});
      if (method === 'GET' && url.pathname === '/api/projects') return send(res, 200, store.listProjects());
      if (method === 'GET' && url.pathname === '/api/repository') {
        const project = store.getProject(url.searchParams.get('projectId'));
        return send(res, 200, await inspectRepository(project?.path || ''));
      }
      if (method === 'GET' && url.pathname === '/api/capabilities') {
        const project = store.getProject(url.searchParams.get('projectId'));
        const settings = store.snapshot().settings;
        return send(res, 200, inspectCapabilities({ projectPath: project?.path || settings.defaultWorkdir, detected: settings.detected || {}, adapters: settings.adapters || {} }));
      }
      if (method === 'GET' && url.pathname === '/api/github') {
        const project = store.getProject(url.searchParams.get('projectId'));
        if (!project) return send(res, 404, { error: 'GitHub 현황을 확인할 repo를 선택하세요.' });
        return send(res, 200, await inspectGithub(project.path));
      }
      if (method === 'POST' && url.pathname === '/api/github/issues') {
        const input = await body(req, config.maxBodyBytes);
        const project = store.getProject(input.projectId);
        if (!project) throw new Error('GitHub Issue를 만들 repo를 선택하세요.');
        const issue = await createGithubIssue(project.path, { title: input.title, body: input.body });
        if (input.cardId) await store.updateCard(input.cardId, { githubIssue: issue });
        emit('reload', { kind: 'github' });
        return send(res, 201, issue);
      }
      if (method === 'POST' && url.pathname === '/api/github/import') {
        const input = await body(req, config.maxBodyBytes);
        const project = store.getProject(input.projectId);
        if (!project) throw new Error('GitHub Issue를 가져올 repo를 선택하세요.');
        const issue = await getGithubIssue(project.path, input.issueNumber);
        const agentId = input.agentId || project.masterAgentId || project.agentIds?.[0];
        const prompt = [`GitHub Issue #${issue.number}: ${issue.title}`, issue.body || '본문 없음', `원문: ${issue.url}`, '완료 후 변경·검증 결과를 정리하고 Issue 상태 갱신 여부를 사용자에게 보고하세요.'].join('\n\n');
        const card = await store.createCard({ title: `#${issue.number} ${issue.title}`, prompt, agentId, workdir: project.path, projectId: project.id });
        const linked = await store.updateCard(card.id, { githubIssue: { number: issue.number, title: issue.title, url: issue.url, state: issue.state, repo: issue.url.split('/issues/')[0].replace('https://github.com/', '') } });
        emit('card', linked);
        return send(res, 201, linked);
      }
      if (method === 'POST' && url.pathname === '/api/github/issues/state') {
        const input = await body(req, config.maxBodyBytes);
        const project = store.getProject(input.projectId);
        if (!project) throw new Error('GitHub Issue 상태를 변경할 repo를 선택하세요.');
        const issue = await setGithubIssueState(project.path, input.issueNumber, input.state);
        for (const card of store.listCards().filter((item) => item.projectId === project.id && item.githubIssue?.number === issue.number)) {
          await store.updateCard(card.id, { githubIssue: { ...card.githubIssue, state: issue.state, title: issue.title, url: issue.url } });
        }
        emit('reload', { kind: 'github' });
        return send(res, 200, issue);
      }
      if (method === 'GET' && url.pathname === '/api/missions') return send(res, 200, store.listMissions());
      if (method === 'POST' && url.pathname === '/api/missions') {
        if (!orchestrator) throw new Error('멀티 에이전트 오케스트레이터가 준비되지 않았습니다.');
        return send(res, 202, await orchestrator.startMission(await body(req, config.maxBodyBytes)));
      }
      if (method === 'POST' && url.pathname === '/api/projects') {
        const project = await store.saveProject(await body(req, config.maxBodyBytes)); emit('reload', { kind: 'projects' }); return send(res, 201, project);
      }
      if (method === 'POST' && url.pathname === '/api/repository/worktrees') {
        const input = await body(req, config.maxBodyBytes);
        const project = store.getProject(input.projectId);
        const agent = store.getAgent(input.agentId);
        if (!project || !agent || !project.agentIds?.includes(agent.id)) throw new Error('Office에 배치된 에이전트를 선택하세요.');
        const worktree = await ensureAgentWorktree(project.path, agent);
        emit('reload', { kind: 'repository' });
        return send(res, 201, worktree);
      }
      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch && method === 'DELETE') {
        const removed = await store.removeProject(decodeURIComponent(projectMatch[1])); emit('reload', { kind: 'projects' }); return send(res, removed ? 200 : 404, { ok: removed });
      }
      if (method === 'POST' && url.pathname === '/api/pick-folder') {
        if (!integrations.pickFolder) throw Object.assign(new Error('데스크톱 앱에서만 폴더 선택기를 사용할 수 있습니다.'), { status: 400 });
        return send(res, 200, await integrations.pickFolder());
      }
      if (method === 'GET' && url.pathname === '/api/desktop') return send(res, 200, integrations.getDesktopSettings ? await integrations.getDesktopSettings() : { supported: false });
      if (method === 'POST' && url.pathname === '/api/desktop/autostart') {
        if (!integrations.setAutoStart) throw Object.assign(new Error('데스크톱 앱에서만 자동 시작을 설정할 수 있습니다.'), { status: 400 });
        const input = await body(req, config.maxBodyBytes); return send(res, 200, await integrations.setAutoStart(Boolean(input.on)));
      }
      if (method === 'GET' && url.pathname === '/api/agents') return send(res, 200, store.listAgents());
      if (method === 'POST' && url.pathname === '/api/agents') {
        const input = await body(req, config.maxBodyBytes);
        const activeProjectId = store.snapshot().settings.activeProjectId;
        if (!input.id && !activeProjectId) throw new Error('먼저 Git repo Office를 설정하세요.');
        const agent = await store.saveAgent(input);
        if (!input.id && activeProjectId) await store.assignAgentToProject(activeProjectId, agent.id);
        emit('agent', agent); return send(res, 201, agent);
      }
      const agentPresetMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/preset$/);
      if (agentPresetMatch && method === 'POST') {
        const current = store.getAgent(decodeURIComponent(agentPresetMatch[1]));
        if (!current) return send(res, 404, { error: '에이전트를 찾을 수 없습니다.' });
        const input = await body(req, config.maxBodyBytes);
        const preset = presets.roles.find((item) => item.id === input.presetId);
        if (!preset) throw Object.assign(new Error('역할 프리셋을 찾을 수 없습니다.'), { status: 404 });
        const agent = await store.saveAgent({
          ...current,
          presetId: preset.id,
          role: preset.role,
          modeId: preset.modeId,
          specialties: preset.tags,
          systemPrompt: preset.prompt,
          color: input.keepColor ? current.color : preset.color,
          name: input.usePresetName ? preset.name : current.name,
        });
        emit('agent', agent);
        return send(res, 200, agent);
      }
      const agentMatch = url.pathname.match(/^\/api\/agents\/([^/]+)$/);
      if (agentMatch && method === 'DELETE') {
        const removed = await store.deleteAgent(decodeURIComponent(agentMatch[1])); emit('reload', { kind: 'agents' }); return send(res, removed ? 200 : 404, { ok: removed });
      }
      if (method === 'GET' && url.pathname === '/api/cards') return send(res, 200, store.listCards());
      if (method === 'POST' && url.pathname === '/api/cards') {
        const input = await body(req, config.maxBodyBytes);
        const projectId = input.projectId || store.snapshot().settings.activeProjectId;
        const project = store.getProject(projectId);
        if (!project) throw new Error('먼저 Git repo Office를 설정하세요.');
        if (!project.agentIds?.includes(input.agentId)) throw new Error('현재 Office에 배치된 에이전트를 선택하세요.');
        const card = await store.createCard({ ...input, projectId: project.id, workdir: project.path }); emit('card', card); return send(res, 201, card);
      }
      if (method === 'GET' && url.pathname === '/api/artifacts') {
        const card = store.getCard(url.searchParams.get('cardId'));
        if (!card) return send(res, 404, { error: '작업을 찾을 수 없습니다.' });
        return send(res, 200, await listArtifacts(card, store.snapshot().settings.defaultWorkdir));
      }
      if (method === 'GET' && url.pathname === '/api/artifact') {
        const card = store.getCard(url.searchParams.get('cardId'));
        if (!card) return send(res, 404, { error: '작업을 찾을 수 없습니다.' });
        const file = safeArtifactPath(card, store.snapshot().settings.defaultWorkdir, url.searchParams.get('path'));
        const stat = await fs.promises.stat(file);
        if (!stat.isFile() || stat.size > 1024 * 1024) throw Object.assign(new Error('1 MiB 이하 텍스트 파일만 미리 볼 수 있습니다.'), { status: 400 });
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes('\u0000')) throw Object.assign(new Error('바이너리 파일은 미리 볼 수 없습니다.'), { status: 400 });
        return send(res, 200, { path: path.basename(file), content });
      }
      if (method === 'POST' && url.pathname === '/api/artifact/open') {
        const input = await body(req, config.maxBodyBytes);
        const card = store.getCard(input.cardId);
        if (!card) return send(res, 404, { error: '작업을 찾을 수 없습니다.' });
        const file = safeArtifactPath(card, store.snapshot().settings.defaultWorkdir, input.path);
        await fs.promises.access(file, fs.constants.R_OK);
        if (!integrations.revealFile) throw Object.assign(new Error('데스크톱 앱에서만 파일 위치를 열 수 있습니다.'), { status: 400 });
        await integrations.revealFile(file); return send(res, 200, { ok: true });
      }
      if (method === 'GET' && url.pathname === '/api/search') {
        const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
        const status = String(url.searchParams.get('status') || '');
        const cards = store.listCards().filter((card) => (!status || card.status === status) && (!q || `${card.title}\n${card.prompt}\n${card.output}\n${(card.followups || []).map((f) => f.text).join('\n')}`.toLowerCase().includes(q)));
        return send(res, 200, cards.slice(0, 200));
      }
      const cardMatch = url.pathname.match(/^\/api\/cards\/([^/]+)(?:\/(run|stop|done|move|followup))?$/);
      if (cardMatch) {
        const cardId = decodeURIComponent(cardMatch[1]);
        const action = cardMatch[2];
        if (method === 'GET' && !action) {
          const card = store.getCard(cardId); return send(res, card ? 200 : 404, card || { error: '작업을 찾을 수 없습니다.' });
        }
        if (method === 'DELETE' && !action) {
          const removed = await store.removeCard(cardId); emit('reload', { kind: 'cards' }); return send(res, removed ? 200 : 404, { ok: removed });
        }
        if (method === 'PUT' && !action) {
          const card = await store.editCard(cardId, await body(req, config.maxBodyBytes)); emit('card', card); return send(res, 200, card);
        }
        if (method === 'POST' && action === 'run') return send(res, 202, await runner.enqueue(cardId));
        if (method === 'POST' && action === 'stop') return send(res, 200, await runner.stop(cardId));
        if (method === 'POST' && action === 'followup') {
          const input = await body(req, config.maxBodyBytes);
          await store.addFollowup(cardId, input.text);
          return send(res, 202, await runner.enqueue(cardId));
        }
        if (method === 'POST' && action === 'done') {
          const card = await store.updateCard(cardId, { status: 'done', finishedAt: new Date().toISOString() }); emit('card', card); return send(res, 200, card);
        }
        if (method === 'POST' && action === 'move') {
          const input = await body(req, config.maxBodyBytes);
          if (!['todo', 'review', 'done'].includes(input.status)) throw Object.assign(new Error('허용되지 않는 상태입니다.'), { status: 400 });
          const card = await store.updateCard(cardId, { status: input.status }); emit('card', card); return send(res, 200, card);
        }
      }
      if (method === 'GET' && url.pathname === '/api/settings') return send(res, 200, store.snapshot().settings);
      if (method === 'PUT' && url.pathname === '/api/settings') {
        const settings = await store.saveSettings(await body(req, config.maxBodyBytes)); emit('settings', settings); return send(res, 200, settings);
      }
      if (method === 'POST' && url.pathname === '/api/adapters') {
        const adapter = await store.saveAdapter(await body(req, config.maxBodyBytes)); emit('reload', { kind: 'adapters' }); return send(res, 201, adapter);
      }
      const adapterMatch = url.pathname.match(/^\/api\/adapters\/([^/]+)$/);
      if (adapterMatch && method === 'DELETE') {
        const removed = await store.removeAdapter(decodeURIComponent(adapterMatch[1])); emit('reload', { kind: 'adapters' }); return send(res, removed ? 200 : 404, { ok: removed });
      }
      if (method === 'GET' && url.pathname === '/api/schedules') return send(res, 200, store.listSchedules());
      if (method === 'POST' && url.pathname === '/api/schedules') {
        const schedule = await store.saveSchedule(await body(req, config.maxBodyBytes)); emit('schedule', schedule); return send(res, 201, schedule);
      }
      const scheduleMatch = url.pathname.match(/^\/api\/schedules\/([^/]+)(?:\/(run))?$/);
      if (scheduleMatch && method === 'DELETE' && !scheduleMatch[2]) {
        const removed = await store.removeSchedule(decodeURIComponent(scheduleMatch[1])); emit('reload', { kind: 'schedules' }); return send(res, removed ? 200 : 404, { ok: removed });
      }
      if (scheduleMatch && method === 'POST' && scheduleMatch[2] === 'run') {
        const schedule = store.listSchedules().find((s) => s.id === decodeURIComponent(scheduleMatch[1]));
        if (!schedule) return send(res, 404, { error: '일정을 찾을 수 없습니다.' });
        if (!scheduler) throw new Error('스케줄러가 준비되지 않았습니다.');
        await scheduler.runSchedule(schedule, new Date()); return send(res, 202, { ok: true });
      }
      if (method === 'GET' && !url.pathname.startsWith('/api/')) return serveStatic(url.pathname, res, config.webDir);
      send(res, 404, { error: '경로를 찾을 수 없습니다.' });
    } catch (error) {
      send(res, error.status || 400, { error: error.message || '요청 처리 중 오류가 발생했습니다.' });
    }
  });
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  return { server, emit };
}

function usageSummary(state) {
  const summary = { inputTokens: 0, outputTokens: 0, durationMs: 0, completedRuns: 0, byAgent: {} };
  for (const card of state.cards || []) {
    const agent = (state.agents || []).find((a) => a.id === card.agentId);
    const key = agent?.name || '알 수 없음';
    summary.byAgent[key] ||= { inputTokens: 0, outputTokens: 0, durationMs: 0, runs: 0 };
    const allRuns = [...(card.runs || []), card];
    for (const run of allRuns) {
      if (!run.startedAt) continue;
      summary.completedRuns += run.finishedAt ? 1 : 0;
      summary.byAgent[key].runs += run.finishedAt ? 1 : 0;
      const duration = Number(run.durationMs || (run.finishedAt ? new Date(run.finishedAt) - new Date(run.startedAt) : 0));
      summary.durationMs += duration;
      summary.byAgent[key].durationMs += duration;
      for (const event of run.events || []) {
        const usage = event.data?.usage;
        if (!usage) continue;
        summary.inputTokens += Number(usage.input_tokens || 0);
        summary.outputTokens += Number(usage.output_tokens || 0);
        summary.byAgent[key].inputTokens += Number(usage.input_tokens || 0);
        summary.byAgent[key].outputTokens += Number(usage.output_tokens || 0);
      }
    }
  }
  return summary;
}

async function listArtifacts(card, defaultWorkdir) {
  const root = path.resolve(card.workdir || defaultWorkdir || '.');
  try { if (!(await fs.promises.stat(root)).isDirectory()) return []; } catch { return []; }
  const since = card.startedAt ? new Date(card.startedAt).getTime() : 0;
  const ignored = new Set(['.git', 'node_modules', '.next', '.astro', 'dist', 'build']);
  const stack = [root];
  const files = [];
  while (stack.length && files.length < 200) {
    const dir = stack.pop();
    let entries = [];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!entry.isFile()) continue;
      try {
        const stat = await fs.promises.stat(full);
        if (!since || stat.mtimeMs >= since) files.push({ path: path.relative(root, full), size: stat.size, modifiedAt: stat.mtime.toISOString() });
      } catch {}
      if (files.length >= 200) break;
    }
  }
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function safeArtifactPath(card, defaultWorkdir, relative) {
  const root = path.resolve(card.workdir || defaultWorkdir || '.');
  const file = path.resolve(root, String(relative || ''));
  if (file !== root && !file.startsWith(root + path.sep)) throw Object.assign(new Error('작업 폴더 밖의 파일에는 접근할 수 없습니다.'), { status: 403 });
  return file;
}

async function serveStatic(pathname, res, webDir) {
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const full = path.resolve(webDir, requested);
  const root = path.resolve(webDir) + path.sep;
  if (!(full + path.sep).startsWith(root) && full !== path.resolve(webDir)) return send(res, 403, { error: '접근할 수 없습니다.' });
  try {
    const stat = await fs.promises.stat(full);
    if (!stat.isFile()) throw Object.assign(new Error(), { code: 'ENOENT' });
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(full).pipe(res);
  } catch { send(res, 404, { error: '파일을 찾을 수 없습니다.' }); }
}
