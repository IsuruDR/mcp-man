import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateState } from '../src/validation.js';

describe('validateState', () => {
  it('accepts valid state with user-scope stdio server', () => {
    const state = {
      servers: { user: { test: { enabled: true, config: { type: 'stdio', command: 'npx', args: ['server'] } } }, projects: {} },
      claudeAiMcps: true
    };
    assert.deepStrictEqual(validateState(state), []);
  });

  it('accepts valid state with http server', () => {
    const state = {
      servers: { user: { test: { enabled: true, config: { type: 'http', url: 'https://example.com/mcp' } } }, projects: {} },
      claudeAiMcps: true
    };
    assert.deepStrictEqual(validateState(state), []);
  });

  it('accepts valid project-scope server', () => {
    const state = {
      servers: { user: {}, projects: { '/Users/test/project': { fs: { enabled: true, config: { type: 'stdio', command: 'npx' } } } } },
      claudeAiMcps: true
    };
    assert.deepStrictEqual(validateState(state), []);
  });

  it('rejects stdio server without command', () => {
    const state = {
      servers: { user: { bad: { enabled: true, config: { type: 'stdio' } } }, projects: {} },
      claudeAiMcps: true
    };
    const errors = validateState(state);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('command'));
  });

  it('rejects http server without url', () => {
    const state = {
      servers: { user: { bad: { enabled: true, config: { type: 'http' } } }, projects: {} },
      claudeAiMcps: true
    };
    const errors = validateState(state);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('url'));
  });

  it('rejects invalid server type', () => {
    const state = {
      servers: { user: { bad: { enabled: true, config: { type: 'grpc' } } }, projects: {} },
      claudeAiMcps: true
    };
    assert.ok(validateState(state).length > 0);
  });

  it('rejects project path that is not absolute', () => {
    const state = {
      servers: { user: {}, projects: { 'relative/path': { fs: { enabled: true, config: { type: 'stdio', command: 'npx' } } } } },
      claudeAiMcps: true
    };
    const errors = validateState(state);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('absolute'));
  });
});
