import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectCapabilities } from '../src/capabilities.mjs';

test('capability inventory discovers project OpenCode configuration without exposing values', async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agent-office-caps-'));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  await fs.promises.mkdir(path.join(dir, '.opencode', 'agents'), { recursive: true });
  await fs.promises.mkdir(path.join(dir, '.opencode', 'skills', 'release'), { recursive: true });
  await fs.promises.writeFile(path.join(dir, '.opencode', 'agents', 'frontend.md'), '---\ndescription: Frontend specialist\nmode: subagent\nmodel: test/model\n---\nSecret prompt body', 'utf8');
  await fs.promises.writeFile(path.join(dir, '.opencode', 'skills', 'release', 'SKILL.md'), '---\nname: release\ndescription: Release helper\n---\nSecret skill body', 'utf8');
  await fs.promises.writeFile(path.join(dir, 'opencode.json'), JSON.stringify({
    mcp: { internal: { type: 'local', environment: { TOKEN: 'must-not-leak' } } },
    plugin: ['company-plugin'], instructions: ['RULES.md'],
    agent: { reviewer: { mode: 'subagent', description: 'Review changes' } },
  }), 'utf8');
  const inventory = inspectCapabilities({ projectPath: dir, detected: { opencode: 'opencode.exe' }, adapters: { 'claude-samsung': { label: 'Claude Samsung', family: 'claude', executable: process.execPath, args: ['-p', '{prompt}'], env: { ANTHROPIC_BASE_URL: 'https://secret.internal', ANTHROPIC_AUTH_TOKEN: '{env:COMPANY_TOKEN}' } } } });
  const opencode = inventory.clients.find((client) => client.id === 'opencode');
  assert.equal(opencode.installed, true);
  assert.ok(opencode.items.some((item) => item.type === 'mcp' && item.name === 'internal' && item.scope === 'project'));
  assert.ok(opencode.items.some((item) => item.type === 'plugins' && item.name === 'company-plugin'));
  assert.ok(opencode.items.some((item) => item.type === 'skills' && item.name === 'release'));
  assert.ok(opencode.items.some((item) => item.type === 'subagents' && item.name === 'frontend'));
  const internal = inventory.clients.find((client) => client.id === 'claude-samsung');
  assert.equal(internal.installed, true);
  assert.ok(internal.items.some((item) => item.type === 'runtime' && item.name === 'ANTHROPIC_BASE_URL'));
  assert.doesNotMatch(JSON.stringify(inventory), /must-not-leak|Secret prompt body|Secret skill body|secret\.internal/);
});
