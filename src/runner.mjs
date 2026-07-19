import { spawn } from 'node:child_process';
import fs from 'node:fs';

function resolveArgs(template, values) {
  return template.map((arg) => String(arg).replaceAll('{prompt}', values.prompt).replaceAll('{workdir}', values.workdir).replaceAll('{model}', values.model).replaceAll('{sessionId}', values.sessionId || ''));
}

export class Runner {
  constructor(store, emit) {
    this.store = store;
    this.emit = emit;
    this.processes = new Map();
    this.queue = [];
    this.buffers = new Map();
    this.shuttingDown = false;
  }

  runningCount() { return this.processes.size; }

  async enqueue(cardId) {
    if (this.processes.has(cardId) || this.queue.includes(cardId)) throw new Error('이미 실행 또는 대기 중인 작업입니다.');
    const settings = this.store.snapshot().settings;
    if (this.runningCount() >= settings.concurrency) {
      this.queue.push(cardId);
      const card = await this.store.updateCard(cardId, { status: 'queued', error: '' });
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
    const adapter = settings.adapters[agent.adapter];
    if (!adapter?.executable) throw new Error(`${agent.adapter} 실행 파일이 설정되지 않았습니다.`);
    const workdir = card.workdir || settings.defaultWorkdir || process.cwd();
    if (!fs.existsSync(workdir) || !fs.statSync(workdir).isDirectory()) throw new Error(`작업 폴더를 찾을 수 없습니다: ${workdir}`);
    const followups = (card.followups || []).map((item, index) => `후속 지시 ${index + 1}: ${item.text}`).join('\n');
    const isResume = agent.adapter === 'codex' && card.sessionId && card.pendingFollowup && adapter.resumeArgs;
    let prompt = agent.systemPrompt ? `${agent.systemPrompt}\n\n--- 작업 ---\n${card.prompt}` : card.prompt;
    if (isResume) prompt = card.pendingFollowup;
    else if (followups) prompt += `\n\n--- 후속 지시 ---\n${followups}`;
    const args = resolveArgs(isResume ? adapter.resumeArgs : adapter.args, { prompt, workdir, model: agent.model || '', sessionId: card.sessionId });
    await this.store.prepareRun(cardId);
    if (isResume) await this.store.updateCard(cardId, { pendingFollowup: null });
    this.emit('card', this.store.getCard(cardId));

    let child;
    try {
      child = spawn(adapter.executable, args, { cwd: workdir, windowsHide: true, shell: false, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
    } catch (error) {
      await this.fail(cardId, error.message);
      throw error;
    }
    this.processes.set(cardId, child);
    child.stdin?.end();
    this.buffers.set(cardId, '');
    await this.store.updateCard(cardId, { pid: child.pid || null });
    this.emit('card', this.store.getCard(cardId));

    const output = async (chunk) => this.handleChunk(cardId, chunk.toString('utf8'));
    child.stdout?.on('data', output);
    child.stderr?.on('data', output);
    child.on('error', async (error) => this.fail(cardId, error.message));
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
      this.emit('card', this.store.getCard(cardId));
      await this.pump();
    });
    return this.store.getCard(cardId);
  }

  async fail(cardId, message) {
    this.processes.delete(cardId);
    this.buffers.delete(cardId);
    await this.store.updateCard(cardId, { status: 'review', error: message, pid: null, finishedAt: new Date().toISOString() });
    this.emit('card', this.store.getCard(cardId));
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
      const next = this.queue.shift();
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
      return card;
    }
    this.processes.delete(cardId);
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    } else child.kill('SIGTERM');
    await this.store.updateCard(cardId, { status: 'review', error: '사용자가 작업을 중지했습니다.', pid: null, finishedAt: new Date().toISOString() });
    this.emit('card', this.store.getCard(cardId));
    await this.pump();
    return this.store.getCard(cardId);
  }

  async shutdown() {
    this.shuttingDown = true;
    this.queue.length = 0;
    for (const cardId of [...this.processes.keys()]) await this.stop(cardId).catch(() => {});
  }
}
