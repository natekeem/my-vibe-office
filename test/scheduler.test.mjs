import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextScheduleAt, Store } from '../src/store.mjs';
import { dailyReportPrompt, Scheduler } from '../src/scheduler.mjs';
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

test('daily report schedule creates a review-only Markdown draft with safe local context', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-daily-report-'));
  await initGitRepo(dir);
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'state.json'));
  await store.init();
  const agent = await store.saveAgent({ name: 'Writer', presetId: 'technical-writer', adapter: 'custom' });
  const project = await store.saveProject({ name: 'Report repo', path: dir, agentIds: [agent.id] });
  const at = new Date();
  await store.createCard({ title: '사용자 화면 검증', prompt: '절대 포함하면 안 되는 원문', agentId: agent.id, projectId: project.id, workdir: dir });
  const schedule = await store.saveSchedule({
    name: '데일리 업무 리포트', templateId: 'daily-report', agentId: agent.id,
    prompt: '오늘 작업을 정리하세요.', workdir: dir, projectId: project.id,
    type: 'daily', time: '18:00',
  });
  const prompt = dailyReportPrompt(store, schedule, at);
  assert.match(prompt, /자동 수집된 로컬 활동 요약/);
  assert.match(prompt, /사용자 화면 검증/);
  assert.doesNotMatch(prompt, /절대 포함하면 안 되는 원문/);
  assert.match(prompt, /Markdown 초안/);
  assert.match(prompt, /파일 수정·커밋·푸시·외부 게시는 하지 마세요/);

  const enqueued = [];
  const scheduler = new Scheduler(store, { enqueue: async (cardId) => enqueued.push(cardId) });
  await scheduler.runSchedule(schedule, at);
  const report = store.listCards().find((card) => card.id === enqueued[0]);
  assert.match(report.title, /^\[데일리 리포트\]/);
  assert.equal(store.listSchedules().find((item) => item.id === schedule.id).templateId, 'daily-report');
});
