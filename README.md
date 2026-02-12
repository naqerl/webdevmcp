# webviewmcp

`webviewmcp` is a browser extension + local companion service that exposes web page debugging and interaction tools over MCP HTTP. It lets agents inspect pages, interact with elements, and capture screenshots in real browsers.

## Features

- Cross-browser support (Chromium + Firefox builds)
- MCP HTTP endpoint for agent tooling
- DOM inspection and page structure querying
- Element interaction (click/type/keypress/scroll)
- Screenshot capture
- Local-first debugging workflow

## Install

1. Open the Releases page and download latest artifacts:
   - `webviewmcp-chromium-v*.zip`
   - `webviewmcp-firefox-v*.zip`
2. Extract each zip locally.

### Chromium

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the extracted Chromium extension folder (contains `manifest.json`)

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select `manifest.json` from the extracted Firefox extension folder

## Companion Service

Run the local companion service to expose MCP over HTTP:

- HTTP MCP: `http://127.0.0.1:8787/mcp`
- Extension bridge: `ws://127.0.0.1:8788/bridge`

See `AGENTS.md` for development and build details.
