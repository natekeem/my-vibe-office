import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { createServer } from '../src/server.mjs';

test('health, agent and card API work end to end', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-api-'));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  const runner = { emit: () => {}, runningCount: () => 0, run: async () => {}, stop: async () => {} };
  const config = { host: '127.0.0.1', maxBodyBytes: 1024 * 1024, webDir: path.resolve('web') };
  const revealed = [];
  const integrations = {
    pickFolder: async () => ({ path: dir, canceled: false }),
    revealFile: async (file) => revealed.push(file),
    getDesktopSettings: async () => ({ supported: true, autostart: false }),
    setAutoStart: async (on) => ({ supported: true, autostart: on }),
  };
  const { server } = createServer({ store, runner, integrations, config });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, localOnly: true, running: 0 });
  const presets = await (await fetch(`${base}/api/presets`)).json();
  assert.ok(presets.roles.length >= 3);
  assert.ok(presets.tasks.length >= 3);
  assert.deepEqual(await (await fetch(`${base}/api/pick-folder`, { method: 'POST' })).json(), { path: dir, canceled: false });
  assert.deepEqual(await (await fetch(`${base}/api/desktop`)).json(), { supported: true, autostart: false });
  assert.deepEqual(await (await fetch(`${base}/api/desktop/autostart`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: true }) })).json(), { supported: true, autostart: true });
  const project = await (await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'API project', path: dir }) })).json();
  assert.match(project.id, /^project_/);
  const agent = await (await fetch(`${base}/api/agents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'API agent', adapter: 'codex' }) })).json();
  assert.match(agent.id, /^agent_/);
  const assigned = await (await fetch(`${base}/api/agents/${agent.id}/preset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ presetId: 'reviewer' }) })).json();
  assert.equal(assigned.presetId, 'reviewer');
  assert.match(assigned.systemPrompt, /코드 리뷰어/);
  const cardRes = await fetch(`${base}/api/cards`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'API task', prompt: 'test', agentId: agent.id }) });
  assert.equal(cardRes.status, 201);
  const card = await cardRes.json();
  await store.editCard(card.id, { workdir: dir });
  await fs.promises.writeFile(path.join(dir, 'artifact.txt'), 'artifact preview', 'utf8');
  const preview = await (await fetch(`${base}/api/artifact?cardId=${card.id}&path=artifact.txt`)).json();
  assert.equal(preview.content, 'artifact preview');
  const reveal = await fetch(`${base}/api/artifact/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId: card.id, path: 'artifact.txt' }) });
  assert.equal(reveal.status, 200);
  assert.equal(revealed[0], path.join(dir, 'artifact.txt'));
  const traversal = await fetch(`${base}/api/artifact?cardId=${card.id}&path=..%2Foutside.txt`);
  assert.equal(traversal.status, 403);
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.agents.length, 1);
  assert.equal(state.cards.length, 1);
  assert.equal(state.settings.projects.length, 1);
});
