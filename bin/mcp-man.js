#!/usr/bin/env node

import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { StateManager } from '../src/state.js';
import { createApp } from '../src/server.js';
import { acquireLock, releaseLock } from '../src/lock.js';

const DEFAULT_PORT_START = 4242;

// Parse args
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  ⚡ mcp-man — Visual MCP server manager for Claude Code

  Usage:
    npx mcp-man [options]

  Options:
    --project <path>   Add a project directory to manage (can be repeated)
    --help, -h         Show this help message

  Examples:
    npx mcp-man
    npx mcp-man --project /path/to/my-project
    npx mcp-man --project ./project-a --project ./project-b
  `);
  process.exit(0);
}

let projectPaths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    projectPaths.push(path.resolve(args[i + 1]));
    i++;
  }
}

const homeDir = os.homedir();
const stateDir = path.join(homeDir, '.mcp-man');
const claudeJsonPath = path.join(homeDir, '.claude.json');
const settingsJsonPath = path.join(homeDir, '.claude', 'settings.json');
const token = crypto.randomBytes(24).toString('hex');

// Single instance check
const lockResult = await acquireLock(stateDir, { port: 0, token });
if (!lockResult.acquired) {
  const url = `http://localhost:${lockResult.existingPort}?token=${lockResult.existingToken}`;
  console.log(`mcp-man is already running at ${url}`);
  const open = (await import('open')).default;
  await open(url);
  process.exit(0);
}

// Create state manager and server
const manager = new StateManager({ stateDir, claudeJsonPath, settingsJsonPath, projectPaths });
await manager.load();
await manager.importFromConfig();

const app = createApp({ manager, token });

// Find available port
function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server))
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT_START + 100) {
          resolve(listen(app, port + 1));
        } else {
          reject(err);
        }
      });
  });
}

const server = await listen(app, DEFAULT_PORT_START);
const port = server.address().port;

// Update lock with actual port
await acquireLock(stateDir, { port, token });

const url = `http://localhost:${port}?token=${token}`;
console.log(`\n  ⚡ mcp-man running at ${url}\n`);

// Auto-open browser
const open = (await import('open')).default;
await open(url);

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  await releaseLock(stateDir);
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
