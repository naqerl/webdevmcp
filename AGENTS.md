# AGENTS.md

Development and maintenance guide for `webviewmcp`.

## Requirements

- Node.js 24+
- npm 11+
- Bun (for building companion release binary)

## Setup

```bash
make install
npx playwright install chromium firefox
```

For CI-equivalent dependency install:

```bash
make ci-install
```

## Build

Build extension bundle + manifests:

```bash
make build-extension
```

Build companion (Node dist):

```bash
make build-companion
```

Run companion locally:

```bash
make run-companion
```

## Packaging

Create extension release zips:

```bash
make package-extensions
```

Artifacts:

- `artifacts/extensions/webviewmcp-chromium.zip`
- `artifacts/extensions/webviewmcp-firefox.zip`

Companion release binary is built in CI with Bun:

- `webviewmcp-companion-linux-x64`

## Testing

```bash
make lint
make typecheck
make test-unit
make test-integration
make test-e2e
make test
```

Fast CI-style verification:

```bash
make verify
```

Run Chromium extension E2E test:

```bash
E2E_RUN_EXTENSION=1 make test-e2e-local
```

## CI/CD

Workflow: `.github/workflows/release.yml`

On push:

- lint
- typecheck
- unit + integration tests
- package extension zips
- build companion linux binary
- upload build artifacts

On tag push (`v*`):

- create GitHub release
- attach:
  - `webviewmcp-chromium.zip`
  - `webviewmcp-firefox.zip`
  - `webviewmcp-companion-linux-x64`
  - `install.sh`

## Release

```bash
git tag v0.2.0
git push origin v0.2.0
```
