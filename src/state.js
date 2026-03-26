import fs from 'node:fs/promises';
import path from 'node:path';
import { readConfigFile, writeConfigFile } from './config-io.js';

export class StateManager {
  #stateDir;
  #statePath;
  #claudeJsonPath;
  #projectPaths;
  #state;
  #settingsJsonPath;

  constructor({ stateDir, claudeJsonPath, settingsJsonPath, projectPaths = [] }) {
    this.#stateDir = stateDir;
    this.#statePath = path.join(stateDir, 'state.json');
    this.#claudeJsonPath = claudeJsonPath;
    this.#settingsJsonPath = settingsJsonPath;
    this.#projectPaths = projectPaths;
    this.#state = null;
  }

  async load() {
    try {
      const content = await fs.readFile(this.#statePath, 'utf-8');
      this.#state = JSON.parse(content);
    } catch {
      this.#state = { servers: { user: {}, projects: {} }, claudeAiMcps: true, lastImport: null };
    }
    this.#state.servers ??= { user: {}, projects: {} };
    this.#state.servers.user ??= {};
    this.#state.servers.projects ??= {};
    this.#state.claudeAiMcps ??= true;
    return this.#state;
  }

  async getState() {
    if (!this.#state) await this.load();
    return this.#state;
  }

  async #readClaudeJson() {
    try {
      const content = await fs.readFile(this.#claudeJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  async importFromConfig() {
    if (!this.#state) await this.load();
    const claudeJson = await this.#readClaudeJson();

    // Import user-scope servers from top-level mcpServers
    const userServers = claudeJson.mcpServers || {};
    for (const [name, config] of Object.entries(userServers)) {
      if (!this.#state.servers.user[name]) {
        this.#state.servers.user[name] = { enabled: true, config };
      }
    }

    // Import project-scope servers from ~/.claude.json projects entries
    const projects = claudeJson.projects || {};
    for (const [projectPath, projectData] of Object.entries(projects)) {
      const projectServers = projectData.mcpServers || {};
      if (Object.keys(projectServers).length === 0) continue;
      this.#state.servers.projects[projectPath] ??= {};
      for (const [name, config] of Object.entries(projectServers)) {
        if (!this.#state.servers.projects[projectPath][name]) {
          this.#state.servers.projects[projectPath][name] = { enabled: true, config };
        }
      }
    }

    // Import from .mcp.json files in explicit project paths
    for (const projectPath of this.#projectPaths) {
      const mcpPath = path.join(projectPath, '.mcp.json');
      const projectResult = await readConfigFile(mcpPath);
      this.#state.servers.projects[projectPath] ??= {};
      for (const [name, config] of Object.entries(projectResult.servers)) {
        if (!this.#state.servers.projects[projectPath][name]) {
          this.#state.servers.projects[projectPath][name] = { enabled: true, config };
        }
      }
    }

    this.#state.lastImport = new Date().toISOString();
    await this.#persist();
  }

  async save(newState) {
    this.#state = newState;
    const claudeJson = await this.#readClaudeJson();

    // Auto-merge externally-added user servers
    const currentUserServers = claudeJson.mcpServers || {};
    for (const [name, config] of Object.entries(currentUserServers)) {
      if (!this.#state.servers.user[name]) {
        this.#state.servers.user[name] = { enabled: true, config };
      }
    }

    // Auto-merge externally-added project servers
    const projects = claudeJson.projects || {};
    for (const [projectPath, projectData] of Object.entries(projects)) {
      const projectServers = projectData.mcpServers || {};
      if (this.#state.servers.projects[projectPath]) {
        for (const [name, config] of Object.entries(projectServers)) {
          if (!this.#state.servers.projects[projectPath][name]) {
            this.#state.servers.projects[projectPath][name] = { enabled: true, config };
          }
        }
      }
    }

    // Also merge from .mcp.json files
    for (const projectPath of Object.keys(this.#state.servers.projects)) {
      const mcpPath = path.join(projectPath, '.mcp.json');
      const projectResult = await readConfigFile(mcpPath);
      for (const [name, config] of Object.entries(projectResult.servers)) {
        if (!this.#state.servers.projects[projectPath][name]) {
          this.#state.servers.projects[projectPath][name] = { enabled: true, config };
        }
      }
    }

    // Write enabled user servers to ~/.claude.json mcpServers
    const enabledUserServers = {};
    for (const [name, entry] of Object.entries(this.#state.servers.user)) {
      if (entry.enabled) enabledUserServers[name] = entry.config;
    }
    claudeJson.mcpServers = enabledUserServers;

    // Write enabled project servers to ~/.claude.json projects[path].mcpServers
    // and also to .mcp.json files where they exist
    for (const [projectPath, servers] of Object.entries(this.#state.servers.projects)) {
      const enabledServers = {};
      for (const [name, entry] of Object.entries(servers)) {
        if (entry.enabled) enabledServers[name] = entry.config;
      }
      if (claudeJson.projects?.[projectPath]) {
        claudeJson.projects[projectPath].mcpServers = enabledServers;
      }
      // Also write .mcp.json for explicit project paths
      if (this.#projectPaths.includes(projectPath)) {
        await writeConfigFile(path.join(projectPath, '.mcp.json'), enabledServers);
      }
    }

    // Write back ~/.claude.json
    await fs.writeFile(this.#claudeJsonPath, JSON.stringify(claudeJson, null, 2) + '\n');

    // Write Claude.ai MCPs toggle to settings.json
    if (this.#settingsJsonPath) {
      let settings = {};
      try {
        const content = await fs.readFile(this.#settingsJsonPath, 'utf-8');
        settings = JSON.parse(content);
      } catch {}
      settings.env ??= {};
      if (!this.#state.claudeAiMcps) {
        settings.env.ENABLE_CLAUDEAI_MCP_SERVERS = 'false';
      } else {
        delete settings.env.ENABLE_CLAUDEAI_MCP_SERVERS;
      }
      if (Object.keys(settings.env).length === 0) delete settings.env;
      await fs.mkdir(path.dirname(this.#settingsJsonPath), { recursive: true });
      await fs.writeFile(this.#settingsJsonPath, JSON.stringify(settings, null, 2) + '\n');
    }

    await this.#persist();
  }

  async getConnectedClaudeAiMcps() {
    const data = await this.#readClaudeJson();
    return data.claudeAiMcpEverConnected || [];
  }

  async #persist() {
    await fs.mkdir(this.#stateDir, { recursive: true });
    await fs.writeFile(this.#statePath, JSON.stringify(this.#state, null, 2) + '\n');
  }
}
