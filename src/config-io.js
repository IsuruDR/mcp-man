import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Reads a Claude Code config file and extracts the mcpServers block.
 *
 * @param {string} filePath - Absolute path to the config file
 * @returns {Promise<{servers: Object, error: string|null}>}
 *   - servers: the mcpServers object (empty {} if missing/unreadable)
 *   - error: null on success, descriptive string on failure
 */
export async function readConfigFile(filePath) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { servers: {}, error: null };
    }
    return { servers: {}, error: `Cannot read ${filePath}: ${err.message}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return { servers: {}, error: `Malformed JSON in ${filePath}: ${err.message}` };
  }

  const servers = parsed.mcpServers && typeof parsed.mcpServers === 'object'
    ? parsed.mcpServers
    : {};

  return { servers, error: null };
}

/**
 * Writes an mcpServers block into a Claude Code config file,
 * preserving any other top-level keys that already exist.
 *
 * @param {string} filePath - Absolute path to the config file
 * @param {Object} servers  - The mcpServers object to write
 */
export async function writeConfigFile(filePath, servers) {
  let existing = {};
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    existing = JSON.parse(content);
  } catch {
    // File doesn't exist or is malformed — start fresh
  }

  existing.mcpServers = servers;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(existing, null, 2) + '\n');
}
