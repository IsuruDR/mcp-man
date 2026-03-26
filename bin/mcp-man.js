#!/usr/bin/env node

import path from 'node:path';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';
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

// Auto-detect .mcp.json in current working directory
const cwd = process.cwd();
try {
  await import('node:fs/promises').then(fs => fs.access(path.join(cwd, '.mcp.json')));
  if (!projectPaths.includes(cwd)) {
    projectPaths.push(cwd);
  }
} catch {}


// Re-exec through portless if available and not already running under it
const runningUnderPortless = !!process.env.PORTLESS_URL;

if (!runningUnderPortless && !args.includes('--no-portless')) {
  let hasPortless = false;
  try {
    execSync('portless --version', { stdio: 'ignore' });
    hasPortless = true;
  } catch {
    // portless not installed — install it
    console.log('  Installing portless for a nice local URL...');
    try {
      execSync('npm install -g portless', { stdio: 'inherit' });
      hasPortless = true;
    } catch {
      console.log('  Could not install portless, using default localhost URL.\n');
    }
  }

  if (hasPortless) {
    const scriptPath = path.resolve(new URL(import.meta.url).pathname);
    const child = spawn('portless', ['mcp-man', 'node', scriptPath, ...process.argv.slice(2)], {
      stdio: ['inherit', 'pipe', 'inherit'],
      env: process.env,
    });
    // Filter out portless banner lines, forward our app's output
    let seenOutput = false;
    child.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        if (/^(portless|--|Starting|HTTP proxy|Proxy started|Running:|Using port|\s*->)/.test(line.trim())) continue;
        if (line.trim() === '' && !seenOutput) continue;
        seenOutput = true;
        process.stdout.write(line + '\n');
      }
    });
    child.on('exit', (code) => process.exit(code ?? 0));
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    await new Promise(() => {});
  }
}

const homeDir = os.homedir();
const stateDir = path.join(homeDir, '.mcp-man');
const claudeJsonPath = path.join(homeDir, '.claude.json');
const settingsJsonPath = path.join(homeDir, '.claude', 'settings.json');
// Single instance check
const lockResult = await acquireLock(stateDir, { port: 0 });
if (!lockResult.acquired) {
  const url = `http://localhost:${lockResult.existingPort}`;
  console.log(`mcp-man is already running at ${url}`);
  const open = (await import('open')).default;
  await open(url);
  process.exit(0);
}

// Create state manager and server
const manager = new StateManager({ stateDir, claudeJsonPath, settingsJsonPath, projectPaths });
await manager.load();
await manager.importFromConfig();

const app = createApp({ manager });

// Use PORT from portless if available, otherwise find available port
const assignedPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server))
      .on('error', (err) => {
        if (!assignedPort && err.code === 'EADDRINUSE' && port < DEFAULT_PORT_START + 100) {
          resolve(listen(app, port + 1));
        } else {
          reject(err);
        }
      });
  });
}

const server = await listen(app, assignedPort || DEFAULT_PORT_START);
const port = server.address().port;

// Update lock with actual port
await acquireLock(stateDir, { port });

const portlessBaseUrl = process.env.PORTLESS_URL;
const url = portlessBaseUrl || `http://localhost:${port}`;
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
