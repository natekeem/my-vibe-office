import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

export function nextScheduleAt(schedule, after = new Date()) {
  if (schedule.type === 'once') return schedule.runAt ? new Date(schedule.runAt).toISOString() : null;
  if (schedule.type === 'interval') return new Date(after.getTime() + Number(schedule.intervalMinutes || 60) * 60000).toISOString();
  const [hour, minute] = String(schedule.time || '09:00').split(':').map(Number);
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (schedule.type === 'daily') {
    if (next <= after) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  const weekday = Math.max(0, Math.min(6, Number(schedule.weekday ?? 1)));
  let delta = (weekday - next.getDay() + 7) % 7;
  if (delta === 0 && next <= after) delta = 7;
  next.setDate(next.getDate() + delta);
  return next.toISOString();
}

export const DEFAULT_STATE = Object.freeze({
  version: 1,
  settings: {
    concurrency: 2,
    defaultWorkdir: '',
    projects: [],
    adapters: {
      codex: {
        label: 'Codex', executable: 'codex',
        args: ['exec', '--json', '--color', 'never', '--skip-git-repo-check', '{prompt}'],
        resumeArgs: ['exec', 'resume', '--json', '--skip-git-repo-check', '{sessionId}', '{prompt}'],
      },
      claude: { label: 'Claude Code', executable: 'claude', args: ['-p', '{prompt}'] },
      custom: { label: '사용자 지정', executable: '', args: ['{prompt}'] },
    },
  },
  agents: [],
  cards: [],
  schedules: [],
});

function clone(value) {
  return structuredClone(value);
}

export class Store {
  constructor(file) {
    this.file = file;
    this.state = clone(DEFAULT_STATE);
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.promises.readFile(this.file, 'utf8'));
      this.state = {
        ...clone(DEFAULT_STATE),
        ...parsed,
        settings: { ...clone(DEFAULT_STATE.settings), ...(parsed.settings || {}) },
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        const backup = `${this.file}.broken-${Date.now()}`;
        await fs.promises.copyFile(this.file, backup).catch(() => {});
      }
      await this.persist();
    }
    this.recoverInterruptedCards();
    await this.persist();
    return this.snapshot();
  }

  recoverInterruptedCards() {
    for (const card of this.state.cards) {
      if (card.status === 'running' || card.status === 'queued') {
        card.status = 'review';
        card.error = '앱이 종료되어 실행 상태를 복구했습니다.';
        card.finishedAt = now();
        card.updatedAt = now();
      }
    }
  }

  snapshot() {
    return clone(this.state);
  }

  async persist() {
    const content = JSON.stringify(this.state, null, 2);
    const tmp = `${this.file}.tmp`;
    this.writeChain = this.writeChain.then(async () => {
      await fs.promises.writeFile(tmp, content, 'utf8');
      await fs.promises.rename(tmp, this.file);
    });
    return this.writeChain;
  }

  listAgents() { return clone(this.state.agents); }
  getAgent(agentId) { return clone(this.state.agents.find((a) => a.id === agentId) || null); }

  async saveAgent(input) {
    const stamp = now();
    const clean = {
      name: String(input.name || '').trim(),
      role: String(input.role || '').trim(),
      adapter: ['codex', 'claude', 'custom'].includes(input.adapter) ? input.adapter : 'codex',
      model: String(input.model || '').trim(),
      color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#7c6ff7',
      systemPrompt: String(input.systemPrompt || '').trim(),
      presetId: String(input.presetId || '').trim(),
    };
    if (!clean.name) throw new Error('에이전트 이름이 필요합니다.');
    const found = input.id && this.state.agents.find((a) => a.id === input.id);
    if (found) Object.assign(found, clean, { updatedAt: stamp });
    else this.state.agents.push({ id: id('agent'), ...clean, createdAt: stamp, updatedAt: stamp });
    await this.persist();
    return clone(found || this.state.agents.at(-1));
  }

  async deleteAgent(agentId) {
    if (this.state.cards.some((c) => c.agentId === agentId && c.status === 'running')) {
      throw new Error('실행 중인 작업을 가진 에이전트는 삭제할 수 없습니다.');
    }
    const before = this.state.agents.length;
    this.state.agents = this.state.agents.filter((a) => a.id !== agentId);
    await this.persist();
    return before !== this.state.agents.length;
  }

  listCards() { return clone(this.state.cards).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  getCard(cardId) { return clone(this.state.cards.find((c) => c.id === cardId) || null); }

  async createCard(input) {
    const title = String(input.title || '').trim();
    const prompt = String(input.prompt || '').trim();
    if (!title || !prompt) throw new Error('제목과 작업 지시가 필요합니다.');
    if (!this.state.agents.some((a) => a.id === input.agentId)) throw new Error('에이전트를 선택하세요.');
    const stamp = now();
    const card = {
      id: id('card'), title, prompt, agentId: input.agentId,
      workdir: String(input.workdir || '').trim(), status: 'todo',
      output: '', error: '', exitCode: null, pid: null, events: [], runs: [], followups: [], sessionId: null, pendingFollowup: null,
      createdAt: stamp, updatedAt: stamp, startedAt: null, finishedAt: null,
    };
    this.state.cards.push(card);
    await this.persist();
    return clone(card);
  }

  async updateCard(cardId, patch) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) throw new Error('작업을 찾을 수 없습니다.');
    const allowed = ['status', 'output', 'error', 'exitCode', 'pid', 'startedAt', 'finishedAt', 'title', 'prompt', 'workdir', 'events', 'runs', 'followups', 'durationMs', 'sessionId', 'pendingFollowup'];
    for (const key of allowed) if (Object.hasOwn(patch, key)) card[key] = patch[key];
    card.updatedAt = now();
    await this.persist();
    return clone(card);
  }

  async appendOutput(cardId, chunk) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) return null;
    card.output = `${card.output || ''}${chunk}`.slice(-2 * 1024 * 1024);
    card.updatedAt = now();
    await this.persist();
    return clone(card);
  }

  async appendEvent(cardId, event) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) return null;
    card.events ||= [];
    card.events.push({ at: now(), ...event });
    if (card.events.length > 1000) card.events = card.events.slice(-1000);
    card.updatedAt = now();
    await this.persist();
    return clone(card);
  }

  async prepareRun(cardId) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) throw new Error('작업을 찾을 수 없습니다.');
    card.runs ||= [];
    if (card.startedAt || card.output) {
      card.runs.push({
        startedAt: card.startedAt, finishedAt: card.finishedAt, exitCode: card.exitCode,
        error: card.error, output: card.output, durationMs: card.durationMs, events: card.events || [],
      });
      if (card.runs.length > 20) card.runs = card.runs.slice(-20);
    }
    Object.assign(card, { status: 'running', output: '', events: [], error: '', exitCode: null, pid: null, startedAt: now(), finishedAt: null, durationMs: null, updatedAt: now() });
    await this.persist();
    return clone(card);
  }

  async editCard(cardId, input) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) throw new Error('작업을 찾을 수 없습니다.');
    if (card.status === 'running') throw new Error('실행 중인 작업은 편집할 수 없습니다.');
    const title = String(input.title ?? card.title).trim();
    const prompt = String(input.prompt ?? card.prompt).trim();
    if (!title || !prompt) throw new Error('제목과 작업 지시가 필요합니다.');
    Object.assign(card, { title, prompt, workdir: String(input.workdir ?? card.workdir).trim(), updatedAt: now() });
    await this.persist();
    return clone(card);
  }

  async addFollowup(cardId, text) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) throw new Error('작업을 찾을 수 없습니다.');
    const content = String(text || '').trim();
    if (!content) throw new Error('후속 지시를 입력하세요.');
    card.followups ||= [];
    card.followups.push({ at: now(), text: content });
    card.pendingFollowup = content;
    card.updatedAt = now();
    await this.persist();
    return clone(card);
  }

  async removeCard(cardId) {
    const card = this.state.cards.find((c) => c.id === cardId);
    if (card?.status === 'running') throw new Error('실행 중인 작업은 먼저 중지하세요.');
    const before = this.state.cards.length;
    this.state.cards = this.state.cards.filter((c) => c.id !== cardId);
    await this.persist();
    return before !== this.state.cards.length;
  }

  async saveSettings(input) {
    const concurrency = Math.max(1, Math.min(8, Number(input.concurrency || 2)));
    const adapters = clone(this.state.settings.adapters);
    for (const key of Object.keys(adapters)) {
      const next = input.adapters?.[key];
      if (!next) continue;
      adapters[key] = {
        ...adapters[key],
        executable: String(next.executable || '').trim(),
        args: Array.isArray(next.args) ? next.args.map(String) : adapters[key].args,
        resumeArgs: Array.isArray(next.resumeArgs) ? next.resumeArgs.map(String) : adapters[key].resumeArgs,
      };
    }
    this.state.settings = { ...this.state.settings, concurrency, defaultWorkdir: String(input.defaultWorkdir || '').trim(), adapters };
    await this.persist();
    return clone(this.state.settings);
  }

  listProjects() { return clone(this.state.settings.projects || []); }

  async saveProject(input) {
    const name = String(input.name || '').trim();
    const projectPath = path.resolve(String(input.path || '').trim());
    if (!name || !input.path) throw new Error('프로젝트 이름과 폴더가 필요합니다.');
    try { if (!(await fs.promises.stat(projectPath)).isDirectory()) throw new Error(); }
    catch { throw new Error(`프로젝트 폴더를 찾을 수 없습니다: ${projectPath}`); }
    this.state.settings.projects ||= [];
    const found = input.id && this.state.settings.projects.find((p) => p.id === input.id);
    const clean = { name, path: projectPath, description: String(input.description || '').trim(), updatedAt: now() };
    if (found) Object.assign(found, clean);
    else this.state.settings.projects.push({ id: id('project'), ...clean, createdAt: now() });
    await this.persist();
    return clone(found || this.state.settings.projects.at(-1));
  }

  async removeProject(projectId) {
    const before = (this.state.settings.projects || []).length;
    this.state.settings.projects = (this.state.settings.projects || []).filter((p) => p.id !== projectId);
    await this.persist();
    return before !== this.state.settings.projects.length;
  }

  listSchedules() { return clone(this.state.schedules || []); }

  async saveSchedule(input) {
    const stamp = now();
    const type = ['once', 'interval', 'daily', 'weekly'].includes(input.type) ? input.type : 'once';
    const intervalMinutes = Math.max(1, Math.min(10080, Number(input.intervalMinutes || 60)));
    const requestedRunAt = type === 'once' ? new Date(input.runAt) : null;
    if (type === 'once' && Number.isNaN(requestedRunAt.getTime())) throw new Error('올바른 1회 실행 시각이 필요합니다.');
    const runAt = type === 'once' ? requestedRunAt.toISOString() : null;
    const time = /^\d{2}:\d{2}$/.test(input.time || '') ? input.time : '09:00';
    const weekday = Math.max(0, Math.min(6, Number(input.weekday ?? 1)));
    if (!this.state.agents.some((a) => a.id === input.agentId)) throw new Error('에이전트를 선택하세요.');
    const clean = {
      name: String(input.name || '').trim(), agentId: input.agentId,
      prompt: String(input.prompt || '').trim(), workdir: String(input.workdir || '').trim(),
      type, intervalMinutes, runAt, time, weekday, enabled: input.enabled !== false,
    };
    clean.nextRunAt = nextScheduleAt(clean, new Date());
    if (!clean.name || !clean.prompt) throw new Error('일정 이름과 작업 지시가 필요합니다.');
    const found = input.id && (this.state.schedules || []).find((s) => s.id === input.id);
    if (found) Object.assign(found, clean, { updatedAt: stamp });
    else {
      this.state.schedules ||= [];
      this.state.schedules.push({ id: id('schedule'), ...clean, lastRunAt: null, lastCardId: null, error: '', createdAt: stamp, updatedAt: stamp });
    }
    await this.persist();
    return clone(found || this.state.schedules.at(-1));
  }

  async markScheduleRun(scheduleId, patch) {
    const schedule = (this.state.schedules || []).find((s) => s.id === scheduleId);
    if (!schedule) return null;
    Object.assign(schedule, patch, { updatedAt: now() });
    await this.persist();
    return clone(schedule);
  }

  async removeSchedule(scheduleId) {
    const before = (this.state.schedules || []).length;
    this.state.schedules = (this.state.schedules || []).filter((s) => s.id !== scheduleId);
    await this.persist();
    return before !== this.state.schedules.length;
  }

  async applyDetectedAdapters(detected) {
    let changed = false;
    for (const key of ['codex', 'claude']) {
      const current = this.state.settings.adapters[key];
      const found = detected[key];
      if (!found || !current) continue;
      const isDefault = !current.executable || current.executable === key || /WindowsApps/i.test(current.executable);
      if (isDefault && current.executable !== found) {
        current.executable = found;
        changed = true;
      }
      if (key === 'codex' && JSON.stringify(current.args) === JSON.stringify(['exec', '--json', '{prompt}'])) {
        current.args = clone(DEFAULT_STATE.settings.adapters.codex.args);
        changed = true;
      }
      if (key === 'codex' && !Array.isArray(current.resumeArgs)) {
        current.resumeArgs = clone(DEFAULT_STATE.settings.adapters.codex.resumeArgs);
        changed = true;
      }
    }
    this.state.settings.detected = detected;
    if (changed) await this.persist();
    return clone(this.state.settings);
  }
}
