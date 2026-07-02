import assert from 'node:assert/strict';
import fs from 'node:fs';

const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf8');
const sourcebookDeployWorkflow = fs.readFileSync('.github/workflows/deploy-sourcebook.yml', 'utf8');

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

assert.match(
	sourcebookDeployWorkflow,
	/projectName:\s*reops-sourcebook/,
	'The Sourcebook workflow must publish to the dedicated Sourcebook Pages project.'
);

assert.match(
	sourcebookDeployWorkflow,
	/directory:\s*\.\/docs\/devops\/sourcebook/,
	'The Sourcebook workflow must publish the generated Sourcebook site, not the root app output.'
);

assert.match(
	sourcebookDeployWorkflow,
	/- "\.github\/workflows\/deploy-sourcebook\.yml"/,
	'The Sourcebook workflow must run when its own deploy rules change.'
);

assert.ok(
	sourcebookDeployWorkflow.indexOf('Ensure site has an index') <
		sourcebookDeployWorkflow.indexOf('cloudflare/pages-action@v1'),
	'The Sourcebook fallback index must be created before Cloudflare Pages publish runs.'
);

assert.doesNotMatch(
	sourcebookDeployWorkflow,
	/<<['-]?HTML/,
	'The Sourcebook fallback index guard must not use an indented heredoc in a YAML run block.'
);

assert.match(
	sourcebookDeployWorkflow,
	/printf '%s\\n' '<!doctype html><meta charset="utf-8">'/,
	'The Sourcebook fallback index guard must write a valid HTML index without relying on heredoc indentation.'
);
