import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { StateManager } from '../src/state.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('StateManager', () => {
  let tmpDir, stateDir, claudeJsonPath, settingsJsonPath, projectDir, mcpJsonPath, manager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-man-test-'));
    stateDir = path.join(tmpDir, '.mcp-man');
    claudeJsonPath = path.join(tmpDir, '.claude.json');
    settingsJsonPath = path.join(tmpDir, '.claude', 'settings.json');
    projectDir = path.join(tmpDir, 'my-project');
    mcpJsonPath = path.join(projectDir, '.mcp.json');
    fs.mkdirSync(projectDir, { recursive: true });
    manager = new StateManager({ stateDir, claudeJsonPath, settingsJsonPath, projectPaths: [projectDir] });
  });

  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates empty state on first load', async () => {
    const state = await manager.load();
    assert.deepStrictEqual(state.servers.user, {});
    assert.deepStrictEqual(state.servers.projects, {});
    assert.strictEqual(state.claudeAiMcps, true);
  });

  it('imports user-scope servers from ~/.claude.json', async () => {
    fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } }));
    await manager.load();
    await manager.importFromConfig();
    const updated = await manager.getState();
    assert.strictEqual(updated.servers.user.context7.enabled, true);
    assert.strictEqual(updated.servers.user.context7.config.url, 'https://mcp.context7.com/mcp');
  });

  it('imports project-scope servers from .mcp.json', async () => {
    fs.writeFileSync(mcpJsonPath, JSON.stringify({ mcpServers: { filesystem: { type: 'stdio', command: 'npx', args: ['-y', 'fs-server'] } } }));
    await manager.load();
    await manager.importFromConfig();
    const state = await manager.getState();
    assert.strictEqual(state.servers.projects[projectDir].filesystem.enabled, true);
  });

  it('preserves disabled state on re-import', async () => {
    fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: { ctx: { type: 'http', url: 'https://example.com' } } }));
    await manager.load();
    await manager.importFromConfig();
    const state = await manager.getState();
    state.servers.user.ctx.enabled = false;
    await manager.save(state);
    await manager.importFromConfig();
    const updated = await manager.getState();
    assert.strictEqual(updated.servers.user.ctx.enabled, false);
  });

  it('picks up externally-added servers on import', async () => {
    await manager.load();
    fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: { newServer: { type: 'http', url: 'https://new.com' } } }));
    await manager.importFromConfig();
    const state = await manager.getState();
    assert.ok(state.servers.user.newServer);
    assert.strictEqual(state.servers.user.newServer.enabled, true);
  });

  it('save writes only enabled servers to claude.json', async () => {
    await manager.load();
    await manager.save({
      servers: { user: { enabled1: { enabled: true, config: { type: 'http', url: 'https://a.com' } }, disabled1: { enabled: false, config: { type: 'http', url: 'https://b.com' } } }, projects: {} },
      claudeAiMcps: true
    });
    const written = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
    assert.ok(written.mcpServers.enabled1);
    assert.strictEqual(written.mcpServers.disabled1, undefined);
  });

  it('save preserves non-MCP content in claude.json', async () => {
    fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: {}, otherConfig: { important: true } }));
    await manager.load();
    await manager.save({
      servers: { user: { s: { enabled: true, config: { type: 'http', url: 'https://a.com' } } }, projects: {} },
      claudeAiMcps: true
    });
    const written = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
    assert.deepStrictEqual(written.otherConfig, { important: true });
  });

  it('save writes enabled project servers to .mcp.json', async () => {
    await manager.load();
    await manager.save({
      servers: { user: {}, projects: { [projectDir]: { fs: { enabled: true, config: { type: 'stdio', command: 'npx' } }, off: { enabled: false, config: { type: 'stdio', command: 'other' } } } } },
      claudeAiMcps: true
    });
    const written = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
    assert.ok(written.mcpServers.fs);
    assert.strictEqual(written.mcpServers.off, undefined);
  });

  it('save sets ENABLE_CLAUDEAI_MCP_SERVERS=false in settings.json when claudeAiMcps is false', async () => {
    await manager.load();
    await manager.save({ servers: { user: {}, projects: {} }, claudeAiMcps: false });
    const settings = JSON.parse(fs.readFileSync(settingsJsonPath, 'utf-8'));
    assert.strictEqual(settings.env.ENABLE_CLAUDEAI_MCP_SERVERS, 'false');
  });

  it('save removes ENABLE_CLAUDEAI_MCP_SERVERS from settings.json when claudeAiMcps is true', async () => {
    await manager.load();
    await manager.save({ servers: { user: {}, projects: {} }, claudeAiMcps: false });
    await manager.save({ servers: { user: {}, projects: {} }, claudeAiMcps: true });
    const settings = JSON.parse(fs.readFileSync(settingsJsonPath, 'utf-8'));
    assert.strictEqual(settings.env, undefined);
  });
});
