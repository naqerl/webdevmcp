# webviewmcp

`webviewmcp` is an MCP bridge for real browsers. It ships a browser extension plus a local companion binary so agents can inspect pages, interact with UI elements, and debug web apps over HTTP.

## Features

- MCP HTTP endpoint for browser automation/debugging
- Project-based startup config via `webdev.toml`
- Auto launch browser and open project tabs on start
- Isolated browser profiles per project
- Page structure inspection (DOM snapshot/query)
- Element interaction (click, type, keypress, scroll)
- Screenshot capture
- Chromium and Firefox extension builds

## Install

```bash
curl -fsSL https://github.com/naqerl/webdevmcp/releases/latest/download/install.sh | bash
```

Installer output includes local extension payload paths for manual browser installation.

## Workflow

1. Go to your project directory:
```bash
cd /path/to/project
```
2. Run tool:
```bash
webdev
```
3. If `webdev.toml` is missing, companion prompts for:
- Browser (`chromium` / `firefox` / `webkit`)
- Links to open (array)
- Project profile name
- Headless mode
4. Companion writes `webdev.toml`, launches browser with isolated project profile, opens configured tabs, and starts MCP server.

If you run browsers manually, install extension manually from installer output paths.

MCP endpoint:
- `http://127.0.0.1:8787/mcp`

Example `webdev.toml`:

```toml
browser = "chromium"
project = "my-app"
headless = false
links = ["http://localhost:3000", "http://localhost:5173"]
```

Development notes are in `AGENTS.md`.
