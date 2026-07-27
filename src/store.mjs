import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inspectRepository } from './repository.mjs';

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
    activeProjectId: '',
    adapters: {
      codex: {
        label: 'Codex', family: 'codex', builtIn: true, executable: 'codex', env: {},
        args: ['exec', '--json', '--color', 'never', '--skip-git-repo-check', '--', '{prompt}'],
        resumeArgs: ['exec', 'resume', '--json', '--skip-git-repo-check', '{sessionId}', '--', '{prompt}'],
      },
      claude: { label: 'Claude Code', family: 'claude', builtIn: true, executable: 'claude', args: ['-p', '{prompt}'], env: {} },
      opencode: { label: 'OpenCode', family: 'opencode', builtIn: true, executable: 'opencode', args: ['run', '--format', 'json', '{prompt}'], env: {} },
      custom: { label: '사용자 지정', family: 'custom', builtIn: true, executable: '', args: ['{prompt}'], env: {} },
    },
  },
  agents: [],
  cards: [],
  schedules: [],
  missions: [],
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
        settings: {
          ...clone(DEFAULT_STATE.settings), ...(parsed.settings || {}),
          adapters: { ...clone(DEFAULT_STATE.settings.adapters), ...(parsed.settings?.adapters || {}) },
        },
      };
      for (const [key, adapter] of Object.entries(this.state.settings.adapters || {})) {
        this.state.settings.adapters[key] = { ...(clone(DEFAULT_STATE.settings.adapters[key] || {})), id: key, env: {}, ...adapter, env: { ...(adapter.env || {}) } };
      }
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
    for (const mission of this.state.missions || []) {
      if (mission.status === 'running') {
        mission.status = 'review';
        mission.error = '앱이 종료되어 멀티 에이전트 미션을 검토 상태로 복구했습니다.';
        mission.updatedAt = now();
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
      adapter: Object.hasOwn(this.state.settings.adapters || {}, input.adapter) ? input.adapter : 'codex',
      model: String(input.model || '').trim(),
      color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#7c6ff7',
      systemPrompt: String(input.systemPrompt || '').trim(),
      userPrompt: String(input.userPrompt || '').trim(),
      presetId: String(input.presetId || '').trim(),
      modeId: String(input.modeId || '').trim(),
      specialties: Array.isArray(input.specialties) ? [...new Set(input.specialties.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 12) : [],
      capabilityMode: input.capabilityMode === 'manual' || (!input.capabilityMode && Array.isArray(input.capabilities) && input.capabilities.length) ? 'manual' : 'auto',
      capabilities: Array.isArray(input.capabilities) ? input.capabilities.slice(0, 100).map((item) => ({
        clientId: String(item?.clientId || '').slice(0, 80),
        type: String(item?.type || '').slice(0, 40),
        name: String(item?.name || '').slice(0, 160),
        scope: String(item?.scope || '').slice(0, 40),
      })).filter((item) => item.clientId && item.type && item.name) : [],
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
    for (const project of this.state.settings.projects || []) {
      project.agentIds = (project.agentIds || []).filter((id) => id !== agentId);
      project.pipeline = (project.pipeline || []).filter((id) => id !== agentId);
      if (project.masterAgentId === agentId) project.masterAgentId = project.pipeline[0] || project.agentIds[0] || '';
      for (const team of project.teams || []) {
        team.agentIds = (team.agentIds || []).filter((id) => id !== agentId);
        team.pipeline = (team.pipeline || []).filter((id) => id !== agentId);
        if (team.leadAgentId === agentId) team.leadAgentId = team.agentIds[0] || '';
      }
      project.teams = (project.teams || []).filter((team) => team.leadAgentId);
      if (!project.teams.some((team) => team.id === project.defaultTeamId)) project.defaultTeamId = project.teams[0]?.id || '';
      project.updatedAt = now();
    }
    await this.persist();
    return before !== this.state.agents.length;
  }

  async assignAgentToProject(projectId, agentId) {
    const project = this.state.settings.projects?.find((item) => item.id === projectId);
    if (!project || !this.state.agents.some((agent) => agent.id === agentId)) throw new Error('Office 또는 에이전트를 찾을 수 없습니다.');
    project.agentIds ||= [];
    project.pipeline ||= [];
    if (!project.agentIds.includes(agentId)) project.agentIds.push(agentId);
    if (!project.pipeline.includes(agentId)) project.pipeline.push(agentId);
    if (!project.masterAgentId) project.masterAgentId = agentId;
    project.updatedAt = now();
    await this.persist();
    return clone(project);
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
      workdir: String(input.workdir || '').trim(), projectId: String(input.projectId || '').trim(),
      teamId: String(input.teamId || '').trim(),
      missionId: String(input.missionId || '').trim(), missionStep: Number.isFinite(Number(input.missionStep)) ? Number(input.missionStep) : null,
      parentCardId: String(input.parentCardId || '').trim(), status: 'todo', queueReason: '',
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
    const allowed = ['status', 'output', 'error', 'exitCode', 'pid', 'startedAt', 'finishedAt', 'title', 'prompt', 'workdir', 'projectId', 'teamId', 'missionId', 'missionStep', 'parentCardId', 'queueReason', 'events', 'runs', 'followups', 'durationMs', 'sessionId', 'pendingFollowup', 'githubIssue'];
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
    Object.assign(card, { status: 'running', queueReason: '', output: '', events: [], error: '', exitCode: null, pid: null, startedAt: now(), finishedAt: null, durationMs: null, updatedAt: now() });
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
    const concurrency = Object.hasOwn(input, 'concurrency')
      ? Math.max(1, Math.min(8, Number(input.concurrency || 2)))
      : this.state.settings.concurrency;
    const adapters = clone(this.state.settings.adapters);
    for (const key of Object.keys(adapters)) {
      const next = input.adapters?.[key];
      if (!next) continue;
      adapters[key] = {
        ...adapters[key],
        executable: String(next.executable || '').trim(),
        args: Array.isArray(next.args) ? next.args.map(String) : adapters[key].args,
        resumeArgs: Array.isArray(next.resumeArgs) ? next.resumeArgs.map(String) : adapters[key].resumeArgs,
        env: next.env && typeof next.env === 'object' ? Object.fromEntries(Object.entries(next.env).map(([name, value]) => [String(name).trim(), String(value)]).filter(([name]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) : (adapters[key].env || {}),
      };
    }
    const defaultWorkdir = Object.hasOwn(input, 'defaultWorkdir') ? String(input.defaultWorkdir || '').trim() : this.state.settings.defaultWorkdir;
    const projectIds = new Set((this.state.settings.projects || []).map((project) => project.id));
    const activeProjectId = Object.hasOwn(input, 'activeProjectId')
      ? (projectIds.has(input.activeProjectId) ? input.activeProjectId : '')
      : (this.state.settings.activeProjectId || '');
    this.state.settings = { ...this.state.settings, concurrency, defaultWorkdir, activeProjectId, adapters };
    await this.persist();
    return clone(this.state.settings);
  }

  async saveAdapter(input) {
    const requestedId = String(input.id || input.label || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!requestedId) throw new Error('CLI 프로필 ID가 필요합니다.');
    const existing = this.state.settings.adapters?.[requestedId];
    if (existing?.builtIn && input.create) throw new Error('기본 CLI 프로필 ID는 사용할 수 없습니다.');
    const family = ['codex', 'claude', 'opencode', 'custom'].includes(input.family) ? input.family : 'custom';
    const env = input.env && typeof input.env === 'object'
      ? Object.fromEntries(Object.entries(input.env).map(([name, value]) => [String(name).trim(), String(value)]).filter(([name]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)))
      : {};
    this.state.settings.adapters ||= {};
    this.state.settings.adapters[requestedId] = {
      ...(existing || {}), id: requestedId, label: String(input.label || requestedId).trim(), family,
      builtIn: Boolean(existing?.builtIn), executable: String(input.executable || '').trim(),
      args: Array.isArray(input.args) ? input.args.map(String) : ['{prompt}'], env,
    };
    await this.persist();
    return clone(this.state.settings.adapters[requestedId]);
  }

  async removeAdapter(adapterId) {
    const adapter = this.state.settings.adapters?.[adapterId];
    if (!adapter) return false;
    if (adapter.builtIn || ['codex', 'claude', 'opencode', 'custom'].includes(adapterId)) throw new Error('기본 CLI 프로필은 삭제할 수 없습니다.');
    if (this.state.agents.some((agent) => agent.adapter === adapterId)) throw new Error('이 CLI 프로필을 사용하는 에이전트를 먼저 변경하세요.');
    delete this.state.settings.adapters[adapterId];
    await this.persist();
    return true;
  }

  listProjects() { return clone(this.state.settings.projects || []); }
  getProject(projectId) { return clone((this.state.settings.projects || []).find((project) => project.id === projectId) || null); }

  cleanProjectTeam(input, projectAgentIds, existingId = '') {
    const valid = new Set(projectAgentIds || []);
    const agentIds = [...new Set((Array.isArray(input.agentIds) ? input.agentIds : []).filter((agentId) => valid.has(agentId)))];
    const leadAgentId = valid.has(input.leadAgentId) ? input.leadAgentId : '';
    if (leadAgentId && !agentIds.includes(leadAgentId)) agentIds.unshift(leadAgentId);
    const pipeline = [...new Set((Array.isArray(input.pipeline) ? input.pipeline : []).filter((agentId) => agentIds.includes(agentId)))];
    if (leadAgentId && !pipeline.includes(leadAgentId)) pipeline.unshift(leadAgentId);
    for (const agentId of agentIds) if (!pipeline.includes(agentId)) pipeline.push(agentId);
    const name = String(input.name || '').trim();
    if (!name) throw new Error('팀 이름이 필요합니다.');
    if (!leadAgentId) throw new Error('팀 리드(마스터)를 선택하세요.');
    return {
      id: existingId || id('team'), name,
      description: String(input.description || '').trim(),
      instructions: String(input.instructions || '').trim(),
      leadAgentId, agentIds, pipeline,
      routingMode: ['manual', 'sequential'].includes(input.routingMode) ? input.routingMode : 'adaptive',
      workflowId: String(input.workflowId || 'auto').trim() || 'auto',
      updatedAt: now(),
    };
  }

  async saveProject(input) {
    const name = String(input.name || '').trim();
    if (!name || !input.path) throw new Error('프로젝트 이름과 폴더가 필요합니다.');
    const inspected = await inspectRepository(String(input.path || '').trim());
    if (!inspected.valid) throw new Error(`작업 폴더를 확인할 수 없습니다: ${inspected.error}`);
    const projectPath = inspected.path;
    this.state.settings.projects ||= [];
    const found = input.id && this.state.settings.projects.find((p) => p.id === input.id);
    const validAgents = new Set(this.state.agents.map((agent) => agent.id));
    const agentIds = [...new Set((Array.isArray(input.agentIds) ? input.agentIds : []).filter((agentId) => validAgents.has(agentId)))];
    const masterAgentId = validAgents.has(input.masterAgentId) ? input.masterAgentId : '';
    if (masterAgentId && !agentIds.includes(masterAgentId)) agentIds.unshift(masterAgentId);
    const requestedPipeline = Array.isArray(input.pipeline) ? input.pipeline : [];
    const pipeline = [...new Set(requestedPipeline.filter((agentId) => agentIds.includes(agentId)))];
    if (masterAgentId && !pipeline.includes(masterAgentId)) pipeline.unshift(masterAgentId);
    for (const agentId of agentIds) if (!pipeline.includes(agentId)) pipeline.push(agentId);
    const clean = {
      name, path: projectPath, description: String(input.description || '').trim(),
      agentIds, masterAgentId, pipeline,
      teams: Array.isArray(input.teams)
        ? input.teams.map((team) => this.cleanProjectTeam(team, agentIds, String(team.id || '')))
        : (found?.teams || []).map((team) => this.cleanProjectTeam(team, agentIds, team.id)),
      defaultTeamId: String(input.defaultTeamId ?? found?.defaultTeamId ?? '').trim(),
      gitRemote: inspected.remotes.find((remote) => remote.name === 'origin')?.url || '',
      executionMode: inspected.git && input.executionMode === 'isolated-worktrees' ? 'isolated-worktrees' : 'shared-serial',
      routingMode: ['manual', 'sequential'].includes(input.routingMode) ? input.routingMode : 'adaptive',
      workflowId: String(input.workflowId || 'auto').trim() || 'auto',
      updatedAt: now(),
    };
    if (found) Object.assign(found, clean);
    else this.state.settings.projects.push({ id: id('project'), ...clean, createdAt: now() });
    const saved = found || this.state.settings.projects.at(-1);
    if (!saved.teams.some((team) => team.id === saved.defaultTeamId)) saved.defaultTeamId = saved.teams[0]?.id || '';
    if (!this.state.settings.activeProjectId) this.state.settings.activeProjectId = saved.id;
    await this.persist();
    return clone(saved);
  }

  async saveProjectTeam(projectId, input) {
    const project = this.state.settings.projects?.find((item) => item.id === projectId);
    if (!project) throw new Error('Office를 찾을 수 없습니다.');
    project.teams ||= [];
    const found = input.id && project.teams.find((team) => team.id === input.id);
    const clean = this.cleanProjectTeam(input, project.agentIds || [], found?.id || '');
    if (found) Object.assign(found, clean);
    else project.teams.push({ ...clean, createdAt: now() });
    if (!project.defaultTeamId) project.defaultTeamId = (found || project.teams.at(-1)).id;
    project.updatedAt = now();
    await this.persist();
    return clone(found || project.teams.at(-1));
  }

  async removeProjectTeam(projectId, teamId) {
    const project = this.state.settings.projects?.find((item) => item.id === projectId);
    if (!project) throw new Error('Office를 찾을 수 없습니다.');
    const before = (project.teams || []).length;
    project.teams = (project.teams || []).filter((team) => team.id !== teamId);
    if (project.defaultTeamId === teamId) project.defaultTeamId = project.teams[0]?.id || '';
    project.updatedAt = now();
    await this.persist();
    return before !== project.teams.length;
  }

  async removeProject(projectId) {
    const before = (this.state.settings.projects || []).length;
    this.state.settings.projects = (this.state.settings.projects || []).filter((p) => p.id !== projectId);
    if (this.state.settings.activeProjectId === projectId) this.state.settings.activeProjectId = '';
    await this.persist();
    return before !== this.state.settings.projects.length;
  }

  listMissions() { return clone(this.state.missions || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  getMission(missionId) { return clone((this.state.missions || []).find((mission) => mission.id === missionId) || null); }

  async createMission(input) {
    const project = this.getProject(input.projectId);
    if (!project) throw new Error('미션을 실행할 repo를 선택하세요.');
    const assignedAgents = project.agentIds || [];
    const pipeline = (Array.isArray(input.pipeline) && input.pipeline.length ? input.pipeline : project.pipeline || [])
      .filter((agentId) => assignedAgents.includes(agentId) && this.state.agents.some((agent) => agent.id === agentId));
    if (!pipeline.length) throw new Error('repo에 마스터 또는 파이프라인 에이전트를 배치하세요.');
    const title = String(input.title || '').trim();
    const prompt = String(input.prompt || '').trim();
    if (!title || !prompt) throw new Error('미션 제목과 작업 지시가 필요합니다.');
    const stamp = now();
    const mission = {
      id: id('mission'), projectId: project.id, teamId: String(input.teamId || ''), teamName: String(input.teamName || ''), title, prompt, pipeline,
      routingMode: String(input.routingMode || project.routingMode || 'adaptive'),
      workflowId: String(input.workflowId || project.workflowId || 'auto'),
      masterAgentId: String(input.masterAgentId || project.masterAgentId || pipeline[0]), status: 'running', stepIndex: 0,
      cardIds: [], currentCardId: '', finalOutput: '', error: '',
      createdAt: stamp, updatedAt: stamp, finishedAt: null,
    };
    this.state.missions ||= [];
    this.state.missions.push(mission);
    await this.persist();
    return clone(mission);
  }

  async updateMission(missionId, patch) {
    const mission = (this.state.missions || []).find((item) => item.id === missionId);
    if (!mission) throw new Error('멀티 에이전트 미션을 찾을 수 없습니다.');
    const allowed = ['status', 'stepIndex', 'cardIds', 'currentCardId', 'finalOutput', 'error', 'finishedAt'];
    for (const key of allowed) if (Object.hasOwn(patch, key)) mission[key] = patch[key];
    mission.updatedAt = now();
    await this.persist();
    return clone(mission);
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
    const projectId = String(input.projectId || this.state.settings.activeProjectId || '');
    const project = this.getProject(projectId);
    if (!project) throw new Error('예약 작업을 실행할 Git repo Office를 선택하세요.');
    if (!project.agentIds?.includes(input.agentId)) throw new Error('현재 Office에 배치된 에이전트를 선택하세요.');
    const clean = {
      name: String(input.name || '').trim(), agentId: input.agentId,
      prompt: String(input.prompt || '').trim(), workdir: project.path, projectId: project.id,
      templateId: input.templateId === 'daily-report' ? 'daily-report' : '',
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
    for (const key of ['codex', 'claude', 'opencode']) {
      const current = this.state.settings.adapters[key];
      const found = detected[key];
      if (!found || !current) continue;
      const configured = String(current.executable || '');
      const missingAbsolute = path.isAbsolute(configured) && !fs.existsSync(configured);
      const isDefault = !configured || configured === key || /WindowsApps/i.test(configured) || missingAbsolute;
      if (isDefault && current.executable !== found) {
        current.executable = found;
        changed = true;
      }
      if (key === 'codex' && JSON.stringify(current.args) === JSON.stringify(['exec', '--json', '{prompt}'])) {
        current.args = clone(DEFAULT_STATE.settings.adapters.codex.args);
        changed = true;
      }
      if (key === 'codex' && JSON.stringify(current.args) === JSON.stringify(['exec', '--json', '--color', 'never', '--skip-git-repo-check', '{prompt}'])) {
        current.args = clone(DEFAULT_STATE.settings.adapters.codex.args);
        changed = true;
      }
      if (key === 'codex' && !Array.isArray(current.resumeArgs)) {
        current.resumeArgs = clone(DEFAULT_STATE.settings.adapters.codex.resumeArgs);
        changed = true;
      }
      if (key === 'codex' && JSON.stringify(current.resumeArgs) === JSON.stringify(['exec', 'resume', '--json', '--skip-git-repo-check', '{sessionId}', '{prompt}'])) {
        current.resumeArgs = clone(DEFAULT_STATE.settings.adapters.codex.resumeArgs);
        changed = true;
      }
    }
    this.state.settings.detected = detected;
    if (changed) await this.persist();
    return clone(this.state.settings);
  }
}
