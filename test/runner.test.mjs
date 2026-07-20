import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { Runner } from '../src/runner.mjs';
import { initGitRepo } from '../test-support/helpers.mjs';

test('runner streams output and moves a successful card to review', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-runner-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  await store.saveSettings({
    concurrency: 1,
    defaultWorkdir: dir,
    adapters: { custom: { executable: process.execPath, args: ['-e', 'console.log(process.argv[1])', '--', '{prompt}'] } },
  });
  const agent = await store.saveAgent({ name: 'Test runner', adapter: 'custom', systemPrompt: 'ROLE_SYSTEM', userPrompt: 'USER_INSTRUCTION' });
  const project = await store.saveProject({ name: 'Runner repo', path: dir, description: 'OFFICE_RULES', agentIds: [agent.id] });
  const team = await store.saveProjectTeam(project.id, { name: 'Frontend', leadAgentId: agent.id, instructions: 'TEAM_RULES' });
  const card = await store.createCard({ title: 'Run', prompt: 'CURRENT_TASK', agentId: agent.id, workdir: dir, projectId: project.id, teamId: team.id });
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const runner = new Runner(store, (event, value) => {
    if (event === 'card' && value.id === card.id && value.status === 'review') resolveDone(value);
  });
  await runner.run(card.id);
  let timeout;
  const timed = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('runner timeout')), 5000); });
  const result = await Promise.race([done, timed]);
  clearTimeout(timeout);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /역할 프리셋.*ROLE_SYSTEM/s);
  assert.match(result.output, /사용자 지정 에이전트 지시.*USER_INSTRUCTION/s);
  assert.match(result.output, /Office \/ repo 규칙.*OFFICE_RULES/s);
  assert.match(result.output, /Frontend 팀 운영 지시.*TEAM_RULES/s);
  assert.match(result.output, /현재 작업.*CURRENT_TASK/s);
  assert.equal(runner.runningCount(), 0);
});

test('runner queues work beyond concurrency and pumps it after completion', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-queue-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  await store.saveSettings({ concurrency: 1, defaultWorkdir: dir, adapters: { custom: { executable: process.execPath, args: ['-e', 'setTimeout(()=>console.log(process.argv[1]),80)', '{prompt}'] } } });
  const agent = await store.saveAgent({ name: 'Queue', adapter: 'custom' });
  const project = await store.saveProject({ name: 'Queue repo', path: dir, agentIds: [agent.id] });
  const one = await store.createCard({ title: 'one', prompt: 'ONE', agentId: agent.id, workdir: dir, projectId: project.id });
  const two = await store.createCard({ title: 'two', prompt: 'TWO', agentId: agent.id, workdir: dir, projectId: project.id });
  const runner = new Runner(store, () => {});
  const [, queued] = await Promise.all([runner.enqueue(one.id), runner.enqueue(two.id)]);
  assert.equal(queued.status, 'queued');
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && (store.getCard(two.id).status !== 'review' || runner.runningCount() !== 0)) await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(store.getCard(one.id).status, 'review');
  assert.equal(store.getCard(two.id).status, 'review');
  assert.match(store.getCard(two.id).output, /TWO/);
});

test('runner serializes agents that share the same repo path', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-lock-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  await store.saveSettings({ concurrency: 2, defaultWorkdir: dir, adapters: { custom: { executable: process.execPath, args: ['-e', 'setTimeout(()=>console.log(process.argv[1]),120)', '{prompt}'] } } });
  const agent = await store.saveAgent({ name: 'Safe writer', adapter: 'custom' });
  const project = await store.saveProject({ name: 'Lock repo', path: dir, agentIds: [agent.id] });
  const one = await store.createCard({ title: 'one', prompt: 'ONE', agentId: agent.id, workdir: dir, projectId: project.id });
  const two = await store.createCard({ title: 'two', prompt: 'TWO', agentId: agent.id, workdir: dir, projectId: project.id });
  const runner = new Runner(store, () => {});
  const [, queued] = await Promise.all([runner.enqueue(one.id), runner.enqueue(two.id)]);
  assert.equal(queued.status, 'queued');
  assert.match(queued.queueReason, /같은 작업 경로/);
  assert.equal(runner.runningCount(), 1);
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && (store.getCard(two.id).status !== 'review' || runner.runningCount() !== 0)) await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(store.getCard(two.id).output, /TWO/);
});

test('Codex follow-up resumes the captured session', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-resume-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  const fakeSession = '019f0000-0000-7000-8000-000000000001';
  await store.saveSettings({ concurrency: 1, defaultWorkdir: dir, adapters: { codex: {
    executable: process.execPath,
    args: ['-e', `console.log(JSON.stringify({type:'thread.started',thread_id:'${fakeSession}'}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'FIRST'}}))`],
    resumeArgs: ['-e', 'console.log(process.argv[1])', '{sessionId}|{prompt}'],
  } } });
  const agent = await store.saveAgent({ name: 'Resume', adapter: 'codex' });
  const project = await store.saveProject({ name: 'Resume repo', path: dir, agentIds: [agent.id] });
  const card = await store.createCard({ title: 'resume', prompt: 'first', agentId: agent.id, workdir: dir, projectId: project.id });
  const runner = new Runner(store, () => {});
  await runner.run(card.id);
  const firstDeadline = Date.now() + 3000;
  while (Date.now() < firstDeadline && (store.getCard(card.id).status !== 'review' || runner.runningCount() !== 0)) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(store.getCard(card.id).sessionId, fakeSession);
  await store.addFollowup(card.id, 'FOLLOW_UP');
  await runner.run(card.id);
  const secondDeadline = Date.now() + 3000;
  while (Date.now() < secondDeadline && (store.getCard(card.id).status !== 'review' || runner.runningCount() !== 0)) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(store.getCard(card.id).output, new RegExp(`${fakeSession}\\|FOLLOW_UP`));
  assert.equal(store.getCard(card.id).pendingFollowup, null);
});

test('runner records Claude-style subagent hiring events', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-subagent-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  const event = { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'frontend-helper', description: 'UI implementation' } }] } };
  await store.saveSettings({ concurrency: 1, defaultWorkdir: dir, adapters: { custom: { executable: process.execPath, args: ['-e', `console.log(${JSON.stringify(JSON.stringify(event))})`] } } });
  const agent = await store.saveAgent({ name: 'FE developer', adapter: 'custom' });
  const project = await store.saveProject({ name: 'Subagent repo', path: dir, agentIds: [agent.id] });
  const card = await store.createCard({ title: 'Hire helper', prompt: 'work', agentId: agent.id, workdir: dir, projectId: project.id });
  const runner = new Runner(store, () => {});
  await runner.run(card.id);
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && store.getCard(card.id).status !== 'review') await new Promise((resolve) => setTimeout(resolve, 20));
  const finished = store.getCard(card.id);
  assert.match(finished.output, /ITO 고용.*frontend-helper/);
  assert.ok(finished.events.some((item) => item.type === 'subagent.started' && item.name === 'frontend-helper'));
});
