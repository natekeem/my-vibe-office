import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { initGitRepo } from '../test-support/helpers.mjs';

async function tempStore() {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-'));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  return { store, dir };
}

test('agent and card lifecycle persists to disk', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const agent = await store.saveAgent({ name: 'Builder', role: 'developer', adapter: 'custom' });
  const card = await store.createCard({ title: 'Test task', prompt: 'Do the work', agentId: agent.id, workdir: dir });
  assert.equal(card.status, 'todo');
  await store.updateCard(card.id, { status: 'running', output: 'hello' });
  const reloaded = new Store(path.join(dir, 'state.json'));
  await reloaded.init();
  assert.equal(reloaded.getCard(card.id).status, 'review');
  assert.match(reloaded.getCard(card.id).error, /복구/);
});

test('deleting a busy agent is rejected', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const agent = await store.saveAgent({ name: 'Busy', adapter: 'codex' });
  const card = await store.createCard({ title: 'Busy task', prompt: 'work', agentId: agent.id });
  await store.updateCard(card.id, { status: 'running' });
  await assert.rejects(() => store.deleteAgent(agent.id), /실행 중/);
});

test('agent retains the assigned role preset id', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const agent = await store.saveAgent({ name: 'Preset agent', adapter: 'codex', role: 'developer', presetId: 'developer' });
  assert.equal(agent.presetId, 'developer');
  assert.equal(store.getAgent(agent.id).presetId, 'developer');
});

test('settings clamp concurrency and retain adapter defaults', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const settings = await store.saveSettings({ concurrency: 99, defaultWorkdir: dir, adapters: { codex: { executable: 'my-codex', args: ['exec', '{prompt}'] } } });
  assert.equal(settings.concurrency, 8);
  assert.equal(settings.adapters.codex.executable, 'my-codex');
  assert.equal(settings.adapters.claude.executable, 'claude');
  assert.equal(settings.adapters.opencode.executable, 'opencode');
});

test('OpenCode is a supported agent adapter', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const agent = await store.saveAgent({ name: 'Internal OpenCode', adapter: 'opencode' });
  assert.equal(agent.adapter, 'opencode');
});

test('custom Anthropic-compatible CLI profiles can be assigned and safely removed', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const profile = await store.saveAdapter({ id: 'claude-samsung', label: 'Claude Samsung', family: 'claude', executable: 'claude-samsung', args: ['-p', '{prompt}'], env: { ANTHROPIC_BASE_URL: 'https://llm.internal', ANTHROPIC_AUTH_TOKEN: '{env:COMPANY_TOKEN}' } });
  assert.equal(profile.family, 'claude');
  const agent = await store.saveAgent({ name: 'Samsung FE', adapter: 'claude-samsung' });
  assert.equal(agent.adapter, 'claude-samsung');
  await assert.rejects(() => store.removeAdapter('claude-samsung'), /사용하는 에이전트/);
  await store.saveAgent({ ...agent, adapter: 'codex' });
  assert.equal(await store.removeAdapter('claude-samsung'), true);
});

test('projects persist and can be removed', async (t) => {
  const { store, dir } = await tempStore();
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const project = await store.saveProject({ name: 'Local project', path: dir, description: 'test workspace' });
  assert.equal(store.listProjects()[0].path, path.resolve(dir));
  assert.equal(await store.removeProject(project.id), true);
  assert.deepEqual(store.listProjects(), []);
});

test('repo stores assigned agents, master and handoff pipeline', async (t) => {
  const { store, dir } = await tempStore();
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const pm = await store.saveAgent({ name: 'PM', adapter: 'custom' });
  const developer = await store.saveAgent({ name: 'Developer', adapter: 'custom' });
  const project = await store.saveProject({
    name: 'Team repo', path: dir, agentIds: [pm.id, developer.id],
    masterAgentId: pm.id, pipeline: [pm.id, developer.id], executionMode: 'shared-serial',
  });
  assert.deepEqual(project.agentIds, [pm.id, developer.id]);
  assert.equal(project.masterAgentId, pm.id);
  assert.deepEqual(project.pipeline, [pm.id, developer.id]);
  await store.saveSettings({ activeProjectId: project.id });
  assert.equal(store.snapshot().settings.activeProjectId, project.id);
});

test('one-time schedules reject an invalid execution time', async (t) => {
  const { store, dir } = await tempStore();
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const agent = await store.saveAgent({ name: 'Scheduler', adapter: 'custom' });
  await assert.rejects(
    () => store.saveSchedule({ name: 'Bad', agentId: agent.id, prompt: 'work', type: 'once', runAt: 'not-a-date' }),
    /실행 시각/,
  );
});
