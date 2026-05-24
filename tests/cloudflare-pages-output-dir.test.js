import assert from 'node:assert/strict';
import fs from 'node:fs';

const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf8');

assert.match(
	wranglerConfig,
	/^pages_build_output_dir\s*=\s*["']public["']$/m,
	'Cloudflare Pages previews for the ResearchOps app must deploy public/, not documentation output.'
);

assert.doesNotMatch(
	wranglerConfig,
	/^pages_build_output_dir\s*=\s*["']docs\/agent-operating-model["']$/m,
	'The root Pages config must not point the app preview at agent documentation.'
);
