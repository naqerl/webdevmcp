SHELL := /bin/bash

-include example.env
-include .env

NPM := npm
NPM_EXEC := $(NPM) exec --

.PHONY: install format lint typecheck test test-unit test-integration test-e2e test-e2e-local test-e2e-remote test-e2e-ssh build-companion run-companion build-extension clean

install:
	$(NPM) install

format:
	$(NPM_EXEC) biome format --write .

lint:
	$(NPM_EXEC) biome check .

typecheck:
	$(NPM_EXEC) tsc -b --pretty false

test-unit:
	$(NPM_EXEC) vitest run --config vitest.unit.config.ts

test-integration:
	$(NPM_EXEC) vitest run --config vitest.integration.config.ts

test-e2e:
	$(NPM_EXEC) vitest run --config vitest.e2e.config.ts

test-e2e-local: build-extension test-e2e

test-e2e-remote:
	./scripts/e2e/push-and-run-local.sh

test-e2e-ssh:
	LOCAL_E2E_TARGET="$(LOCAL_E2E_TARGET)" \
	LOCAL_E2E_PORT="$(LOCAL_E2E_PORT)" \
	BRANCH="$(BRANCH)" \
	E2E_RUN_EXTENSION="$(E2E_RUN_EXTENSION)" \
	./scripts/e2e/run-ssh-tests.sh

build-companion:
	$(NPM_EXEC) tsc -b companion/tsconfig.json --pretty false --noEmit false

run-companion: build-companion
	node companion/dist/index.js

build-extension:
	$(NPM_EXEC) tsc -b extension/tsconfig.json --pretty false --noEmit false
	$(NPM_EXEC) node scripts/build-manifests.mjs

test: test-unit test-integration test-e2e

clean:
	rm -rf node_modules companion/node_modules extension/node_modules packages/protocol/node_modules coverage extension/dist companion/dist dist-tests
