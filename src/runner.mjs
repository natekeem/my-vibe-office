import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { agentWorktreePath, ensureAgentWorktree, inspectRepository } from './repository.mjs';
import { presets } from './presets.mjs';
import { inspectCapabilities } from './capabilities.mjs';
import { recommendCapabilityPolicy } from './tool-policy.mjs';

function resolveArgs(template, values, family = '') {
  const resolved = [];
  for (const raw of template) {
    const positionalPrompt = String(raw) === '{prompt}';
    const arg = String(raw).replaceAll('{prompt}', values.prompt).replaceAll('{workdir}', values.workdir).replaceAll('{model}', values.model).replaceAll('{sessionId}', values.sessionId || '');
    if (family === 'codex' && positionalPrompt && arg.startsWith('-') && resolved.at(-1) !== '--') resolved.push('--');
    resolved.push(arg);
  }
  return resolved;
}

function resolveEnvironment(configured = {}) {
  const resolved = {};
  for (const [name, value] of Object.entries(configured || {})) {
    const reference = String(value).match(/^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/);
    resolved[name] = reference ? (process.env[reference[1]] || '') : String(value);
  }
  return resolved;
}

export class Runner {
  constructor(store, emit) {
    this.store = store;
    this.emit = emit;
    this.processes = new Map();
    this.reservations = new Set();
    this.queue = [];
    this.buffers = new Map();
    this.shuttingDown = false;
    this.onComplete = async () => {};
  }

  runningCount() { return new Set([...this.processes.keys(), ...this.reservations]).size; }

  resourceKey(card) {
    const settings = this.store.snapshot().settings;
    const project = card?.projectId ? this.store.getProject(card.projectId) : null;
    const agent = card?.agentId ? this.store.getAgent(card.agentId) : null;
    if (project?.executionMode === 'isolated-worktrees' && agent) return path.resolve(agentWorktreePath(project.path, agent)).toLowerCase();
    return path.resolve(card?.workdir || settings.defaultWorkdir || process.cwd()).toLowerCase();
  }

  conflictReason(cardId) {
    const card = this.store.getCard(cardId);
    if (!card) return '';
    const key = this.resourceKey(card);
    for (const runningId of new Set([...this.processes.keys(), ...this.reservations])) {
      if (runningId !== cardId && this.resourceKey(this.store.getCard(runningId)) === key) {
        return '같은 작업 경로에서 다른 에이전트가 실행 중이라 안전하게 대기합니다.';
      }
    }
    return '';
  }

  async enqueue(cardId) {
    if (this.processes.has(cardId) || this.queue.includes(cardId)) throw new Error('이미 실행 또는 대기 중인 작업입니다.');
    const settings = this.store.snapshot().settings;
    const queueReason = this.runningCount() >= settings.concurrency
      ? `동시 실행 한도(${settings.concurrency})에 도달해 대기합니다.`
      : this.conflictReason(cardId);
    if (queueReason) {
      this.queue.push(cardId);
      const card = await this.store.updateCard(cardId, { status: 'queued', queueReason, error: '' });
      this.emit('card', card);
      return card;
    }
    return this.run(cardId);
  }

  async run(cardId) {
    if (this.processes.has(cardId)) throw new Error('이미 실행 중인 작업입니다.');
    const card = this.store.getCard(cardId);
    const agent = card && this.store.getAgent(card.agentId);
    if (!card || !agent) throw new Error('작업 또는 에이전트를 찾을 수 없습니다.');
    const settings = this.store.snapshot().settings;
    if (this.runningCount() >= settings.concurrency) throw new Error(`동시 실행 한도(${settings.concurrency})에 도달했습니다.`);
    const conflict = this.conflictReason(cardId);
    if (conflict) throw new Error(conflict);
    this.reservations.add(cardId);
    let adapter, workdir, isResume, args;
    try {
      const project = card.projectId ? this.store.getProject(card.projectId) : null;
      if (!project) throw new Error('작업을 실행할 Office 폴더가 연결되지 않았습니다.');
      const repository = await inspectRepository(project.path);
      if (!repository.valid) throw new Error(`Office 작업 폴더를 확인할 수 없습니다: ${repository.error}`);
      adapter = settings.adapters[agent.adapter];
      if (!adapter?.executable) throw new Error(`${agent.adapter} 실행 파일이 설정되지 않았습니다.`);
      if (path.isAbsolute(adapter.executable) && !fs.existsSync(adapter.executable)) throw new Error(`${agent.adapter} 실행 파일을 찾을 수 없습니다. Code Agents 설정에서 경로를 다시 확인하세요: ${adapter.executable}`);
      workdir = card.workdir || project.path;
      if (project.executionMode === 'isolated-worktrees') {
        const prepared = await ensureAgentWorktree(project.path, agent);
        workdir = prepared.path;
        if (card.workdir !== workdir) await this.store.updateCard(cardId, { workdir });
      }
      if (!fs.existsSync(workdir) || !fs.statSync(workdir).isDirectory()) throw new Error(`작업 폴더를 찾을 수 없습니다: ${workdir}`);
      const followups = (card.followups || []).map((item, index) => `후속 지시 ${index + 1}: ${item.text}`).join('\n');
      isResume = agent.adapter === 'codex' && card.sessionId && card.pendingFollowup && adapter.resumeArgs;
      const team = (project.teams || []).find((item) => item.id === card.teamId);
      const rolePreset = presets.roles.find((item) => item.id === agent.presetId);
      const rolePrompt = rolePreset?.prompt || agent.systemPrompt;
      let effectiveCapabilities = agent.capabilities || [];
      if (agent.capabilityMode !== 'manual' && rolePreset) {
        const inventory = inspectCapabilities({ projectPath: project.path, detected: settings.detected || {}, adapters: settings.adapters || {} });
        const client = inventory.clients.find((item) => item.id === agent.adapter) || inventory.clients.find((item) => item.id === (adapter.family || agent.adapter));
        effectiveCapabilities = recommendCapabilityPolicy(client?.items || [], client?.id || agent.adapter, rolePreset);
      }
      const promptLayers = [
        rolePrompt && `--- 역할 프리셋 ---\n${rolePrompt}`,
        agent.userPrompt && `--- 사용자 지정 에이전트 지시 ---\n${agent.userPrompt}`,
        effectiveCapabilities.length && `--- 이 에이전트에 지정된 도구 정책 ---\n아래 현재 설치된 자산을 우선 사용하되, 실행 환경에서 사용 불가하면 그 사실을 보고하세요.\n${effectiveCapabilities.map((item) => `- ${item.clientId} / ${item.type} / ${item.name} (${item.scope || 'unknown'})`).join('\n')}`,
        project.description && `--- Office / repo 규칙 ---\n${project.description}`,
        team?.instructions && `--- ${team.name} 팀 운영 지시 ---\n${team.instructions}`,
        `--- 현재 작업 ---\n${card.prompt}`,
      ].filter(Boolean);
      let prompt = promptLayers.join('\n\n');
      if (isResume) prompt = card.pendingFollowup;
      else if (followups) prompt += `\n\n--- 후속 지시 ---\n${followups}`;
      args = resolveArgs(isResume ? adapter.resumeArgs : adapter.args, { prompt, workdir, model: agent.model || '', sessionId: card.sessionId }, adapter.family || agent.adapter);
      await this.store.prepareRun(cardId);
    }
    catch (error) { this.reservations.delete(cardId); throw error; }
    if (isResume) await this.store.updateCard(cardId, { pendingFollowup: null });
    this.emit('card', this.store.getCard(cardId));

    let child;
    try {
      child = spawn(adapter.executable, args, { cwd: workdir, windowsHide: true, shell: false, env: { ...process.env, ...resolveEnvironment(adapter.env), FORCE_COLOR: '0', NO_COLOR: '1' } });
    } catch (error) {
      this.reservations.delete(cardId);
      await this.fail(cardId, error.message);
      throw error;
    }
    this.processes.set(cardId, child);
    this.reservations.delete(cardId);
    child.stdin?.end();
    this.buffers.set(cardId, '');
    await this.store.updateCard(cardId, { pid: child.pid || null });
    this.emit('card', this.store.getCard(cardId));

    const output = async (chunk) => this.handleChunk(cardId, chunk.toString('utf8'));
    child.stdout?.on('data', output);
    child.stderr?.on('data', output);
    child.on('error', (error) => { void this.fail(cardId, error.message).catch(() => {}); });
    child.on('close', async (code, signal) => {
      if (!this.processes.has(cardId)) return;
      await this.flushBuffer(cardId);
      const stopped = signal || code !== 0;
      const current = this.store.getCard(cardId);
      const finished = new Date();
      await this.store.updateCard(cardId, {
        status: 'review', exitCode: code, pid: null, finishedAt: finished.toISOString(),
        durationMs: current?.startedAt ? finished.getTime() - new Date(current.startedAt).getTime() : null,
        error: stopped ? `프로세스 종료: ${signal || `exit ${code}`}` : '',
      });
      this.processes.delete(cardId);
      const finalCard = this.store.getCard(cardId);
      this.emit('card', finalCard);
      await this.onComplete(finalCard).catch(async (error) => {
        await this.store.appendEvent(cardId, { type: 'orchestrator.error', message: error.message });
      });
      await this.pump();
    });
    return this.store.getCard(cardId);
  }

  async fail(cardId, message) {
    this.processes.delete(cardId);
    this.reservations.delete(cardId);
    this.buffers.delete(cardId);
    await this.store.updateCard(cardId, { status: 'review', error: message, pid: null, finishedAt: new Date().toISOString() });
    const finalCard = this.store.getCard(cardId);
    this.emit('card', finalCard);
    await this.onComplete(finalCard).catch(async (error) => {
      await this.store.appendEvent(cardId, { type: 'orchestrator.error', message: error.message });
    });
    await this.pump();
  }

  async handleChunk(cardId, chunk) {
    const combined = (this.buffers.get(cardId) || '') + chunk;
    const lines = combined.split(/\r?\n/);
    this.buffers.set(cardId, lines.pop() || '');
    let display = '';
    for (const line of lines) display += await this.formatLine(cardId, line);
    if (display) {
      await this.store.appendOutput(cardId, display);
      this.emit('log', { cardId, text: display });
    }
  }

  async flushBuffer(cardId) {
    const line = this.buffers.get(cardId) || '';
    this.buffers.delete(cardId);
    if (!line) return;
    const display = await this.formatLine(cardId, line);
    if (display) {
      await this.store.appendOutput(cardId, display);
      this.emit('log', { cardId, text: display });
    }
  }

  async formatLine(cardId, line) {
    if (!line.trim()) return '\n';
    if (line === 'Reading additional input from stdin...') return '';
    if (/ WARN codex_(?:core_skills::loader|core::shell_snapshot):/.test(line)) return '';
    let event;
    try { event = JSON.parse(line); } catch { return `${line}\n`; }
    await this.store.appendEvent(cardId, { type: event.type || 'json', data: event });
    const content = Array.isArray(event.message?.content) ? event.message.content : Array.isArray(event.content) ? event.content : [];
    let structuredText = '';
    for (const part of content) {
      if (part?.type === 'text' && part.text) structuredText += `${part.text}\n`;
      const toolName = String(part?.name || part?.tool || '');
      if (part?.type === 'tool_use' && /^(?:Agent|Task)$/i.test(toolName)) {
        const worker = part.input?.subagent_type || part.input?.agent_type || part.input?.name || 'subagent';
        await this.store.appendEvent(cardId, { type: 'subagent.started', name: worker, tool: toolName, description: part.input?.description || part.input?.prompt || '' });
        structuredText += `\n[ITO 고용] ${worker}${part.input?.description ? ` · ${part.input.description}` : ''}\n`;
      }
    }
    if (structuredText) return structuredText;
    if (event.type === 'text' && event.part?.text) return `${event.part.text}\n`;
    if (event.type === 'tool_use' && /(?:agent|task)/i.test(String(event.part?.tool || event.tool || ''))) {
      const worker = event.part?.state?.input?.subagent_type || event.part?.state?.input?.agent || event.agent || 'subagent';
      await this.store.appendEvent(cardId, { type: 'subagent.started', name: worker, tool: event.part?.tool || event.tool || 'task' });
      return `\n[ITO 고용] ${worker}\n`;
    }
    if (event.type === 'thread.started') {
      if (event.thread_id) await this.store.updateCard(cardId, { sessionId: event.thread_id });
      return `세션 시작 · ${event.thread_id || ''}\n`;
    }
    if (event.type === 'item.started' && event.item?.type === 'command_execution') return `\n› ${event.item.command || '명령 실행'}\n`;
    if (event.type === 'item.completed') {
      const item = event.item || {};
      if (item.type === 'agent_message') return `${item.text || ''}\n`;
      if (item.type === 'reasoning') return item.text ? `[생각] ${item.text}\n` : '';
      if (item.type === 'command_execution') {
        const out = item.aggregated_output || item.output || '';
        return `${out}${out && !out.endsWith('\n') ? '\n' : ''}[exit ${item.exit_code ?? '?'}]\n`;
      }
    }
    if (event.type === 'turn.completed' && event.usage) {
      return `\n토큰 · 입력 ${event.usage.input_tokens || 0} / 출력 ${event.usage.output_tokens || 0}\n`;
    }
    if (event.type === 'error' || event.type === 'turn.failed') return `[오류] ${event.message || event.error?.message || JSON.stringify(event.error || event)}\n`;
    return '';
  }

  async pump() {
    if (this.shuttingDown) return;
    const limit = this.store.snapshot().settings.concurrency;
    while (this.queue.length && this.runningCount() < limit) {
      const index = this.queue.findIndex((cardId) => !this.conflictReason(cardId));
      if (index < 0) break;
      const [next] = this.queue.splice(index, 1);
      await this.run(next).catch(async (error) => this.fail(next, error.message));
    }
  }

  async stop(cardId) {
    const child = this.processes.get(cardId);
    if (!child) {
      const index = this.queue.indexOf(cardId);
      if (index < 0) throw new Error('실행 또는 대기 중인 프로세스가 없습니다.');
      this.queue.splice(index, 1);
      const card = await this.store.updateCard(cardId, { status: 'review', error: '대기 중인 작업을 취소했습니다.', finishedAt: new Date().toISOString() });
      this.emit('card', card);
      await this.onComplete(card).catch(() => {});
      return card;
    }
    this.processes.delete(cardId);
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    } else child.kill('SIGTERM');
    await this.store.updateCard(cardId, { status: 'review', error: '사용자가 작업을 중지했습니다.', pid: null, finishedAt: new Date().toISOString() });
    const stoppedCard = this.store.getCard(cardId);
    this.emit('card', stoppedCard);
    await this.onComplete(stoppedCard).catch(() => {});
    await this.pump();
    return this.store.getCard(cardId);
  }

  async shutdown() {
    this.shuttingDown = true;
    this.queue.length = 0;
    for (const cardId of [...this.processes.keys()]) await this.stop(cardId).catch(() => {});
  }
}
