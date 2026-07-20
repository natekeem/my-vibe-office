import test from 'node:test';
import assert from 'node:assert/strict';
import { detectWorkflow, resolveMissionRoute } from '../src/routing.mjs';

const agents = [
  { id: 'pm', modeId: 'planner' },
  { id: 'fe', modeId: 'frontend' },
  { id: 'debug', modeId: 'debugger' },
  { id: 'qa', modeId: 'qa' },
  { id: 'review', modeId: 'reviewer' },
];
const project = { agentIds: agents.map((agent) => agent.id), masterAgentId: 'pm', pipeline: ['pm', 'fe', 'qa'], routingMode: 'adaptive', workflowId: 'auto' };

test('intent detector routes a UI fix without forcing PM first', () => {
  assert.equal(detectWorkflow('모바일 화면의 버튼 레이아웃과 CSS를 수정해줘'), 'frontend-change');
  const route = resolveMissionRoute(project, agents, '모바일 화면의 버튼 레이아웃을 개선해줘');
  assert.equal(route.workflowId, 'frontend-change');
  assert.deepEqual(route.pipeline, ['fe', 'qa']);
});

test('quick fix selects available debugger and reviewer modes', () => {
  const route = resolveMissionRoute(project, agents, '로그인 오류 버그를 재현하고 고쳐줘');
  assert.equal(route.workflowId, 'quick-fix');
  assert.deepEqual(route.pipeline, ['debug', 'review']);
});

test('manual routing gives work only to the master', () => {
  const route = resolveMissionRoute({ ...project, routingMode: 'manual' }, agents, '아무 작업');
  assert.deepEqual(route.pipeline, ['pm']);
});

test('sequential routing preserves explicitly configured order', () => {
  const route = resolveMissionRoute({ ...project, routingMode: 'sequential' }, agents, '아무 작업');
  assert.deepEqual(route.pipeline, ['pm', 'fe', 'qa']);
});

test('adaptive routing falls back to master when no requested mode is staffed', () => {
  const route = resolveMissionRoute({ ...project, agentIds: ['pm'] }, agents, '백엔드 API와 DB를 구현해줘');
  assert.deepEqual(route.pipeline, ['pm']);
});

test('a general coder can cover an unstaffed frontend mode before review', () => {
  const flexibleAgents = [{ id: 'dev', modeId: 'coder' }, { id: 'review', modeId: 'reviewer' }];
  const route = resolveMissionRoute({ ...project, agentIds: ['dev', 'review'], masterAgentId: 'dev' }, flexibleAgents, '버튼 UI를 수정해줘');
  assert.deepEqual(route.pipeline, ['dev', 'review']);
});
