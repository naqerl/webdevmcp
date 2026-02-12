# webviewmcp

`webviewmcp` is an MCP bridge for real browsers. It ships a browser extension plus a local companion binary so agents can inspect pages, interact with UI elements, and debug web apps over HTTP.

## Features

- MCP HTTP endpoint for browser automation/debugging
- Page structure inspection (DOM snapshot/query)
- Element interaction (click, type, keypress, scroll)
- Screenshot capture
- Chromium and Firefox extension builds
- Local companion binary (`webviewmcp-companion`)
- Interactive installer with browser detection (including Flatpak browsers)

## Install

Install latest release with:

```bash
curl -fsSL https://github.com/naqerl/webdevmcp/releases/latest/download/install.sh | bash
```

Installer will:

1. Detect installed browsers (native and Flatpak)
2. Prompt which browsers to configure (one or multiple)
3. Install extension payloads under `~/.local/share/webviewmcp/extensions/`
4. Install companion binary to `~/.local/bin/webviewmcp-companion`
5. Create Chromium-family launcher wrappers in `~/.local/bin/` that load the extension automatically

Notes:

- Add `~/.local/bin` to `PATH` if needed.
- Firefox installation is attempted via profile XPI placement and can be limited by unsigned add-on policy on stable Firefox builds.

## Run

Start companion:

```bash
webviewmcp-companion
```

Endpoints:

- `http://127.0.0.1:8787/mcp`
- `ws://127.0.0.1:8788/bridge`

Development notes are in `AGENTS.md`.
