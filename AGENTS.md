# AGENTS.md

Development and maintenance guide for `webviewmcp`.

## Requirements

- Node.js 24+
- npm 11+

## Setup

```bash
make install
npx playwright install chromium firefox
```

## Build

Build extension bundle + manifests:

```bash
make build-extension
```

Build companion:

```bash
make build-companion
```

Run companion:

```bash
make run-companion
```

## Packaging

Create release zip artifacts:

```bash
make package-extensions
```

Artifacts:
- `artifacts/extensions/webviewmcp-chromium-v<version>.zip`
- `artifacts/extensions/webviewmcp-firefox-v<version>.zip`

## Testing

```bash
make lint
make typecheck
make test-unit
make test-integration
make test-e2e
make test
```

Run Chromium extension E2E test:

```bash
E2E_RUN_EXTENSION=1 make test-e2e-local
```

## CI/CD

Workflow file: `.github/workflows/build-and-release.yml`

- On push: lint, typecheck, unit/integration tests, package artifacts
- On tag push matching `v*`: create GitHub release and attach extension zips

## Release

```bash
git tag v0.1.0
git push origin v0.1.0
```
