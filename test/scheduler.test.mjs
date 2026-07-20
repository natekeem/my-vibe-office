import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextScheduleAt, Store } from '../src/store.mjs';
import { Scheduler } from '../src/scheduler.mjs';
import { initGitRepo } from '../test-support/helpers.mjs';

test('due one-time schedule creates and enqueues a card once', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-schedule-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  const agent = await store.saveAgent({ name: 'Scheduled agent', adapter: 'custom' });
  const project = await store.saveProject({ name: 'Schedule repo', path: dir, agentIds: [agent.id] });
  const schedule = await store.saveSchedule({
    name: 'One shot', agentId: agent.id, prompt: 'scheduled prompt', workdir: dir,
    projectId: project.id, type: 'once', runAt: new Date(Date.now() - 1000).toISOString(),
  });
  const enqueued = [];
  const scheduler = new Scheduler(store, { enqueue: async (cardId) => enqueued.push(cardId) });
  await scheduler.tick(new Date());
  assert.equal(enqueued.length, 1);
  assert.equal(store.listCards().length, 1);
  const updated = store.listSchedules().find((s) => s.id === schedule.id);
  assert.equal(updated.enabled, false);
  assert.equal(updated.nextRunAt, null);
  await scheduler.tick(new Date(Date.now() + 60000));
  assert.equal(enqueued.length, 1);
});

test('daily and weekly schedules calculate the next local occurrence', () => {
  const after = new Date(2026, 6, 20, 10, 30, 0, 0);
  const daily = new Date(nextScheduleAt({ type: 'daily', time: '09:15' }, after));
  assert.equal(daily.getDate(), 21);
  assert.equal(daily.getHours(), 9);
  assert.equal(daily.getMinutes(), 15);

  const weekly = new Date(nextScheduleAt({ type: 'weekly', time: '08:45', weekday: 1 }, after));
  assert.equal(weekly.getDay(), 1);
  assert.equal(weekly.getDate(), 27);
  assert.equal(weekly.getHours(), 8);
  assert.equal(weekly.getMinutes(), 45);
});
