import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const promptBody = fs.readFileSync('.agent-operating-model/bundles/github/prompt.body.xml', 'utf8');
const reviewMode = fs.readFileSync(
	'.agent-operating-model/bundles/github/modes/repo-review.xml',
	'utf8'
);
const fixMode = fs.readFileSync('.agent-operating-model/bundles/github/modes/repo-fix.xml', 'utf8');
const readme = fs.readFileSync('.agent-operating-model/bundles/github/README.md', 'utf8');

function assertCodexDispositionRule(source, label) {
	assert.match(source, /Codex/i, `${label} should mention Codex comments`);
	assert.match(
		source,
		/automated review comment/i,
		`${label} should cover automated review comments`
	);
	assert.match(source, /legitimate/i, `${label} should distinguish legitimate comments`);
	assert.match(
		source,
		/thumbs-up reaction|thumbs-up/i,
		`${label} should require a thumbs-up reaction`
	);
	assert.match(source, /reply/i, `${label} should require a reply`);
	assert.match(
		source,
		/how the issue was overcome|issue was overcome|what changed/i,
		`${label} should require explaining how the issue was overcome`
	);
	assert.match(
		source,
		/Resolve conversation|resolve the review thread|resolved/i,
		`${label} should require resolving the thread`
	);
}

test('GitHub bundle documents required Codex comment disposition', () => {
	assertCodexDispositionRule(promptBody, 'prompt.body.xml');
	assertCodexDispositionRule(reviewMode, 'repo-review.xml');
	assertCodexDispositionRule(fixMode, 'repo-fix.xml');
	assertCodexDispositionRule(readme, 'README.md');
});

test('GitHub bundle blocks resolving legitimate Codex comments before evidence exists', () => {
	assert.match(
		promptBody,
		/Do not resolve a legitimate thread before the fix is present on the branch and validation evidence has been checked/
	);
	assert.match(
		reviewMode,
		/Resolving a legitimate Codex or automated review thread before the issue has been overcome/
	);
	assert.match(fixMode, /Review thread resolved before the fix is present on the branch/);
	assert.match(
		readme,
		/Do not resolve a legitimate automated review thread until the issue has been overcome/
	);
});
