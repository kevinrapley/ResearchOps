import { execFileSync } from 'node:child_process';

import { generatedCssPaths } from './generated-css-targets.mjs';

try {
	execFileSync('git', ['diff', '--exit-code', '--', ...generatedCssPaths], { stdio: 'inherit' });
} catch {
	console.error('Generated CSS is out of date. Run npm run build:generated-css and commit the generated stylesheet changes.');
	process.exit(1);
}
