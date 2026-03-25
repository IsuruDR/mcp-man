import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { acquireLock, releaseLock, readLock } from '../src/lock.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Lock', () => {
  let tmpDir, lockDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-man-lock-'));
    lockDir = path.join(tmpDir, '.mcp-man');
  });

  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('acquires lock when no lock exists', async () => {
    const result = await acquireLock(lockDir, { port: 4242, token: 'abc' });
    assert.strictEqual(result.acquired, true);
  });

  it('reads lock info after acquiring', async () => {
    await acquireLock(lockDir, { port: 4242, token: 'abc' });
    const info = await readLock(lockDir);
    assert.strictEqual(info.port, 4242);
    assert.strictEqual(info.token, 'abc');
  });

  it('fails to acquire when lock already exists with running pid', async () => {
    await acquireLock(lockDir, { port: 4242, token: 'abc', pid: process.pid });
    const result = await acquireLock(lockDir, { port: 5000, token: 'def' });
    assert.strictEqual(result.acquired, false);
    assert.strictEqual(result.existingPort, 4242);
  });

  it('steals stale lock when pid is dead', async () => {
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(path.join(lockDir, '.lock'), JSON.stringify({ port: 4242, token: 'old', pid: 999999 }));
    const result = await acquireLock(lockDir, { port: 5000, token: 'new' });
    assert.strictEqual(result.acquired, true);
  });

  it('releases lock by removing file', async () => {
    await acquireLock(lockDir, { port: 4242, token: 'abc' });
    await releaseLock(lockDir);
    const info = await readLock(lockDir);
    assert.strictEqual(info, null);
  });
});
