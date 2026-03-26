# MCP Man

Visual MCP server manager for Claude Code. Toggle, configure, and manage your MCP servers from a browser UI instead of editing JSON files by hand.

> **Runs entirely on your machine.** MCP Man is a local web server that reads and writes your local Claude Code config files. No data leaves your computer.

<p align="center">
  <img src="https://raw.githubusercontent.com/IsuruDR/mcp-man/main/docs/screenshots/main-view.png" width="360" alt="MCP Man main view" />
  <img src="https://raw.githubusercontent.com/IsuruDR/mcp-man/main/docs/screenshots/detail-view.png" width="360" alt="MCP Man detail view" />
</p>

## Quick Start

```bash
npx @isurur/mcp-man
```

This opens a local web UI where you can manage all your MCP servers. On first run, it automatically installs [portless](https://www.npmjs.com/package/portless) for a clean URL: `http://mcp-man.localhost:1355`

## Features

- **Toggle servers on/off** — enable or disable MCP servers with a single click, changes save instantly
- **Edit server config** — modify commands, args, env vars, headers, and URLs from the detail view
- **Secret masking** — API keys, tokens, and sensitive values are masked by default with reveal toggles
- **Claude.ai MCP overview** — see which Claude.ai servers (Gmail, Slack, Linear, etc.) are connected
- **Multi-scope support** — manage both user-level (`~/.claude.json`) and project-level (`.mcp.json`) servers
- **Restart reminder** — a banner reminds you to restart Claude after saving config changes
- **Single instance** — only one mcp-man runs at a time; re-running opens the existing session
- **Portless integration** — automatically uses `mcp-man.localhost` instead of a random port

## CLI Options

```
npx @isurur/mcp-man [options]

Options:
  --project <path>   Add a project directory to manage (can be repeated)
  --no-portless      Skip portless integration, use localhost with port
  --help, -h         Show help
```

## Examples

```bash
# Basic usage
npx @isurur/mcp-man

# Manage project-specific MCP servers
npx @isurur/mcp-man --project /path/to/my-project

# Multiple projects
npx @isurur/mcp-man --project ./project-a --project ./project-b

# Without portless
npx @isurur/mcp-man --no-portless
```

## How It Works

MCP Man reads and writes the same config files Claude Code uses:

- **User servers** — `~/.claude.json` → `mcpServers`
- **Project servers** — `.mcp.json` in project directories
- **Claude.ai toggle** — `~/.claude/settings.json` → `ENABLE_CLAUDEAI_MCP_SERVERS`

Changes are written directly to these files, so they take effect on the next Claude Code restart.

## License

MIT
