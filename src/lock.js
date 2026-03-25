import fs from 'node:fs/promises';
import path from 'node:path';

const LOCK_FILE = '.lock';

function isProcessRunning(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export async function acquireLock(lockDir, { port, token, pid = process.pid }) {
  const lockPath = path.join(lockDir, LOCK_FILE);
  const existing = await readLock(lockDir);
  if (existing && isProcessRunning(existing.pid)) {
    return { acquired: false, existingPort: existing.port, existingToken: existing.token };
  }
  await fs.mkdir(lockDir, { recursive: true });
  await fs.writeFile(lockPath, JSON.stringify({ port, token, pid }));
  return { acquired: true };
}

export async function readLock(lockDir) {
  try {
    const content = await fs.readFile(path.join(lockDir, LOCK_FILE), 'utf-8');
    return JSON.parse(content);
  } catch { return null; }
}

export async function releaseLock(lockDir) {
  try { await fs.unlink(path.join(lockDir, LOCK_FILE)); } catch {}
}
