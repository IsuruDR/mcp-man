import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { StateManager } from '../src/state.js';
import supertest from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('API Server', () => {
  let tmpDir, stateDir, claudeJsonPath, app;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-man-server-'));
    stateDir = path.join(tmpDir, '.mcp-man');
    claudeJsonPath = path.join(tmpDir, '.claude.json');
    fs.writeFileSync(claudeJsonPath, JSON.stringify({
      mcpServers: { ctx: { type: 'http', url: 'https://example.com' } }
    }));
    const manager = new StateManager({ stateDir, claudeJsonPath, projectPaths: [] });
    app = createApp({ manager });
  });

  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('GET /api/servers returns state after import', async () => {
    const res = await supertest(app).get('/api/servers');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.servers);
  });

  it('PUT /api/servers validates and saves', async () => {
    const getRes = await supertest(app).get('/api/servers');
    const state = getRes.body;
    state.servers.user.ctx.enabled = false;
    const putRes = await supertest(app).put('/api/servers').send(state);
    assert.strictEqual(putRes.status, 200);
    assert.strictEqual(putRes.body.servers.user.ctx.enabled, false);
    const written = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
    assert.strictEqual(written.mcpServers.ctx, undefined);
  });

  it('PUT /api/servers rejects invalid payload', async () => {
    const res = await supertest(app).put('/api/servers')
      .send({ servers: { user: { bad: { enabled: true, config: { type: 'grpc' } } }, projects: {} }, claudeAiMcps: true });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /api/import re-imports servers', async () => {
    const res = await supertest(app).post('/api/import');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.servers.user.ctx);
  });

  it('GET /api/projects returns tracked project paths', async () => {
    await supertest(app).get('/api/servers');
    const res = await supertest(app).get('/api/projects');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.projects));
  });

  it('GET /api/claude-ai-mcps returns connected list', async () => {
    fs.writeFileSync(claudeJsonPath, JSON.stringify({
      mcpServers: {},
      claudeAiMcpEverConnected: ['claude.ai Gmail', 'claude.ai Slack']
    }));
    const res = await supertest(app).get('/api/claude-ai-mcps');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.connected, ['claude.ai Gmail', 'claude.ai Slack']);
  });
});
