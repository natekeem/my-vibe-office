import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendCapabilityPolicy } from '../src/tool-policy.mjs';

test('tool policy always keeps rules and selects role-matched tools', () => {
  const items = [
    { type: 'rules', name: 'AGENTS.md', scope: 'project', enabled: true },
    { type: 'skills', name: 'control-in-app-browser', scope: 'plugin', enabled: true },
    { type: 'mcp', name: 'node_repl', scope: 'global', enabled: true },
    { type: 'skills', name: 'financial-budget', scope: 'plugin', enabled: true },
  ];
  const selected = recommendCapabilityPolicy(items, 'codex', { toolHints: ['browser', 'node_repl'] });
  assert.deepEqual(selected.map((item) => item.name), ['AGENTS.md', 'control-in-app-browser', 'node_repl']);
});

test('tool policy excludes disabled matches', () => {
  const selected = recommendCapabilityPolicy([
    { type: 'skills', name: 'review-agent', scope: 'global', enabled: false },
  ], 'codex', { toolHints: ['review'] });
  assert.deepEqual(selected, []);
});
