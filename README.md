# webviewmcp

Cross-browser MCP bridge for local web app interaction and debugging.

## Setup

```bash
make install
```

## Common Tasks

```bash
make lint
make typecheck
make test-unit
make test-integration
make test-e2e
make test
```

## Run Companion

```bash
make run-companion
```

Companion listens on:
- `http://127.0.0.1:8787/mcp` (HTTP MCP)
- `ws://127.0.0.1:8788/bridge` (extension bridge)

## Strictness Baseline

- TypeScript: extends `@tsconfig/strictest` + additional compiler flags
- Lint/format: Biome with strict suspicious/style rules
- Tests: unit/integration (Vitest) + real-browser E2E (Vitest + Playwright)

## Real Browser E2E

The E2E suite uses actual Chromium and Firefox instances, not browser mocks.

### Local workstation

```bash
./scripts/e2e/run-local.sh
```

Includes:
- Cross-browser page interaction checks (Chromium + Firefox)
- Real screenshot capture assertions
- DOM structure assertions

Optional extension-loaded Chromium test:

```bash
E2E_RUN_EXTENSION=1 ./scripts/e2e/run-local.sh
```

Note: extension-loaded Chromium test runs headed and needs a display (or `xvfb-run`).

### Remote dev server -> local browser workflow

When coding on a remote server without X:

1. Export your local host:
```bash
export LOCAL_E2E_HOST=user@my-laptop
```
2. Optional local checkout path:
```bash
export LOCAL_E2E_DIR=~/webviewmcp
```
3. Run:
```bash
make test-e2e-remote
```

This syncs the current remote workspace to your local machine and executes E2E there.
