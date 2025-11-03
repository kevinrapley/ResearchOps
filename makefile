.PHONY: setup dev test lint typecheck build serve wrangler-publish

setup:
	npm ci

dev:
	npx wrangler dev --config infra/cloudflare/wrangler.toml --local

test:
	npm test -- --watch=false

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build || echo "No build step defined"

serve:
	npx http-server public -p 8080

wrangler-publish:
	npx wrangler publish --config infra/cloudflare/wrangler.toml