# webviewmcp

Cross-browser MCP bridge for local web app interaction and debugging.

## Requirements

- Node.js 24+
- npm 11+

## Setup

```bash
make install
npx playwright install chromium firefox
```

## Build

Build extension bundle and manifests:

```bash
make build-extension
```

Package both browser builds as zip files:

```bash
make package-extensions
```

Output files are created in `artifacts/extensions/`:
- `webviewmcp-chromium-v<version>.zip`
- `webviewmcp-firefox-v<version>.zip`

## Run Companion

```bash
make run-companion
```

Companion endpoints:
- `http://127.0.0.1:8787/mcp` (HTTP MCP)
- `ws://127.0.0.1:8788/bridge` (extension bridge)

## Load Extension Locally

### Chromium

1. Run `make build-extension`
2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the `extension/` folder

### Firefox

1. Run `make build-extension`
2. Open `about:debugging#/runtime/this-firefox`
3. Click `Load Temporary Add-on...`
4. Select `extension/manifest.firefox.built.json`

Note: temporary Firefox add-ons are removed when Firefox restarts.

## Testing

```bash
make lint
make typecheck
make test-unit
make test-integration
make test-e2e
make test
```

Enable extension-loaded Chromium E2E test:

```bash
E2E_RUN_EXTENSION=1 make test-e2e-local
```

## CI/CD

GitHub workflow: `.github/workflows/build-and-release.yml`

- On every push: lint, typecheck, unit/integration tests, package extension artifacts
- On tag push matching `v*`: creates a GitHub release and attaches both extension zip files

## First Release

Create and push a semver tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the release job automatically.
