SHELL := /bin/bash

NPM := npm
NPM_EXEC := $(NPM) exec --

.PHONY: install format lint typecheck test test-unit test-integration test-e2e test-e2e-local build-companion run-companion build-extension package-extensions clean

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

build-companion:
	$(NPM_EXEC) tsc -b companion/tsconfig.json --pretty false --noEmit false

run-companion: build-companion
	node companion/dist/index.js

build-extension:
	$(NPM_EXEC) tsc -b extension/tsconfig.json --pretty false --noEmit false
	$(NPM_EXEC) node scripts/build-manifests.mjs

package-extensions: build-extension
	$(NPM_EXEC) node scripts/package-extensions.mjs
	cd artifacts/package/chromium && python3 -m zipfile -c ../../extensions/$$(cat ../../extensions/chromium.zipname) manifest.json dist
	cd artifacts/package/firefox && python3 -m zipfile -c ../../extensions/$$(cat ../../extensions/firefox.zipname) manifest.json dist

test: test-unit test-integration test-e2e

clean:
	rm -rf node_modules companion/node_modules extension/node_modules packages/protocol/node_modules coverage extension/dist companion/dist dist-tests artifacts
