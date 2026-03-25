import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readConfigFile, writeConfigFile } from '../src/config-io.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('readConfigFile', () => {
  it('extracts mcpServers from a valid config file', async () => {
    const fixturePath = path.join(import.meta.dirname, 'fixtures/claude-home.json');
    const result = await readConfigFile(fixturePath);
    assert.deepStrictEqual(result.servers, {
      context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
      mermaid: { type: 'stdio', command: 'npx', args: ['-y', '@mermaid-js/mermaid-mcp-server'] }
    });
    assert.strictEqual(result.error, null);
  });

  it('returns empty servers for missing file', async () => {
    const result = await readConfigFile('/nonexistent/path.json');
    assert.deepStrictEqual(result.servers, {});
    assert.strictEqual(result.error, null);
  });

  it('returns error for malformed JSON', async () => {
    const tmpFile = path.join(os.tmpdir(), `mcp-man-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, '{bad json');
    try {
      const result = await readConfigFile(tmpFile);
      assert.deepStrictEqual(result.servers, {});
      assert.ok(result.error);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('returns empty servers when mcpServers key is missing', async () => {
    const tmpFile = path.join(os.tmpdir(), `mcp-man-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ otherStuff: true }));
    try {
      const result = await readConfigFile(tmpFile);
      assert.deepStrictEqual(result.servers, {});
      assert.strictEqual(result.error, null);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe('writeConfigFile', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `mcp-man-test-${Date.now()}.json`);
  });

  afterEach(() => {
    try { fs.unlinkSync(tmpFile); } catch {}
  });

  it('writes mcpServers to a new file', async () => {
    const servers = {
      test: { type: 'http', url: 'https://example.com' }
    };
    await writeConfigFile(tmpFile, servers);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    assert.deepStrictEqual(result.mcpServers, servers);
  });

  it('preserves non-MCP content in existing file', async () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      mcpServers: { old: { type: 'http', url: 'http://old' } },
      otherStuff: { keep: 'this' }
    }, null, 2));

    const servers = { newServer: { type: 'http', url: 'http://new' } };
    await writeConfigFile(tmpFile, servers);

    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    assert.deepStrictEqual(result.mcpServers, servers);
    assert.deepStrictEqual(result.otherStuff, { keep: 'this' });
  });

  it('writes empty mcpServers when given empty object', async () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ mcpServers: { old: {} } }));
    await writeConfigFile(tmpFile, {});
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    assert.deepStrictEqual(result.mcpServers, {});
  });
});
