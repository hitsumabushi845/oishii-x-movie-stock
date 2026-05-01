.PHONY: install test scraper-test web-test web-dev web-build scrape-dry

install:
	cd scraper && uv sync
	cd web && pnpm install

test: scraper-test web-test

scraper-test:
	cd scraper && uv run pytest

web-test:
	cd web && pnpm test

web-dev:
	cd web && pnpm dev

web-build:
	cd web && pnpm build

scrape-dry:
	cd scraper && uv run python -m scraper \
		--data-file ../data/videos.json \
		--schema ../schema/videos.schema.json \
		--dry-run
