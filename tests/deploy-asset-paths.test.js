import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredPreviewAssetPaths = [
	'assets/researchops/researchops-home.css',
	'public/assets/researchops/researchops-home.css',
	'public/assets/govuk/govuk-frontend.css',
	'public/assets/govuk/govuk-frontend.min.js',
];

for (const assetPath of requiredPreviewAssetPaths) {
	assert.equal(fs.existsSync(assetPath), true, `${assetPath} should exist for preview deployment`);
}

const topLevelHomeCss = fs.readFileSync('assets/researchops/researchops-home.css', 'utf8');
const publicHomeCss = fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8');

assert.equal(
	topLevelHomeCss,
	publicHomeCss.endsWith('\n') ? publicHomeCss : `${publicHomeCss}\n`,
	'top-level preview home CSS should mirror the public build output',
);

assert.match(topLevelHomeCss, /grid-template-columns:repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
assert.match(topLevelHomeCss, /grid-template-columns:repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(topLevelHomeCss, /\.researchops-next-action:not\(:last-child\)\{border-right:1px solid #cecece\}/);
