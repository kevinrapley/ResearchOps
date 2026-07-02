import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateSourcebookLinks } from '../scripts/validate-sourcebook-links.mjs';

function makeTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'sourcebook-link-test-'));
}

function writeHtml(dir, filename, body) {
	fs.writeFileSync(
		path.join(dir, filename),
		`<!DOCTYPE html><html><body id="main-content">${body}</body></html>`
	);
}

function writeQualityHtml(dir, filename, body) {
	fs.writeFileSync(
		path.join(dir, filename),
		`<!DOCTYPE html><html><head><meta property="dc:modified" content="2026-07-02"></head><body id="main-content">${body}</body></html>`
	);
}

function writeMinimalSourcebookModel(indexPath, sourcebookDir, overrides = {}) {
	fs.mkdirSync(path.join(sourcebookDir, 'templates'), { recursive: true });
	fs.writeFileSync(path.join(sourcebookDir, 'templates', 'used-template.md'), '# Used template');

	const model = {
		contentTypes: {
			rule: { notation: 'R', label: 'Rule' },
			principle: { notation: 'P', label: 'Principle' },
			guidance: { notation: 'G', label: 'Guidance' },
			conduct: { notation: 'C', label: 'Conduct' },
		},
		templates: [
			{
				id: 'TPL-USED',
				title: 'Used template',
				path: '/sourcebook/templates/used-template.md',
			},
		],
		pillars: [
			{
				code: 'SCOPE',
				changeHistory: [{ date: '2026-07-02', summary: 'Initial sourcebook clause set.' }],
				sections: [
					{
						clauses: [
							{
								id: 'SCOPE 1.1.1',
								relatedTemplates: ['TPL-USED'],
							},
						],
					},
				],
			},
		],
		...overrides,
	};

	fs.writeFileSync(indexPath, JSON.stringify(model, null, 2));
}

test('validateSourcebookLinks throws when sourcebook directory is missing', () => {
	assert.throws(
		() => validateSourcebookLinks({ sourcebookDir: '/nonexistent/sourcebook/path' }),
		/directory not found/
	);
});

test('validateSourcebookLinks passes with no links', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<p>No links here.</p>');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.pages, 1);
		assert.equal(result.totalLinks, 0);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails on href="#" placeholder', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="#">placeholder</a>');
		assert.throws(() => validateSourcebookLinks({ sourcebookDir: tmp }), /placeholder href/);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks counts external links without validating them', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="https://example.com">external</a>');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.externalCount, 1);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks passes for valid in-page anchor', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="#section-1">go</a><section id="section-1"></section>');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.totalLinks, 1);
		assert.equal(result.externalCount, 0);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks throws for broken in-page anchor', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="#missing-section">go</a>');
		assert.throws(() => validateSourcebookLinks({ sourcebookDir: tmp }), /broken link/);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks passes for valid cross-page link', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="other.html">other</a>');
		writeHtml(tmp, 'other.html', '<p>other page</p>');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.totalLinks, 1);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks throws for missing cross-page file', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="missing.html">missing</a>');
		assert.throws(() => validateSourcebookLinks({ sourcebookDir: tmp }), /broken link/);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks throws for missing asset file', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<link rel="stylesheet" href="styles.css">');
		assert.throws(() => validateSourcebookLinks({ sourcebookDir: tmp }), /broken link/);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks passes for existing asset file', () => {
	const tmp = makeTempDir();
	try {
		fs.writeFileSync(path.join(tmp, 'styles.css'), 'body {}');
		writeHtml(tmp, 'index.html', '<link rel="stylesheet" href="styles.css">');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.totalLinks, 1);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks throws for missing template file', () => {
	const tmp = makeTempDir();
	try {
		fs.mkdirSync(path.join(tmp, 'templates'));
		writeHtml(tmp, 'index.html', '<a href="templates/missing-template.md">template</a>');
		assert.throws(() => validateSourcebookLinks({ sourcebookDir: tmp }), /broken link/);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks passes for existing template file', () => {
	const tmp = makeTempDir();
	try {
		fs.mkdirSync(path.join(tmp, 'templates'));
		fs.writeFileSync(path.join(tmp, 'templates', 'my-template.md'), '# Template');
		writeHtml(tmp, 'index.html', '<a href="templates/my-template.md">template</a>');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.totalLinks, 1);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails quality gates on placeholder text', () => {
	const tmp = makeTempDir();
	try {
		const sourcebookDir = path.join(tmp, 'docs');
		fs.mkdirSync(sourcebookDir);
		writeQualityHtml(sourcebookDir, 'index.html', '<p>TODO</p>');
		const indexPath = path.join(tmp, 'sourcebook-index.json');
		writeMinimalSourcebookModel(indexPath, sourcebookDir);

		assert.throws(
			() =>
				validateSourcebookLinks({
					sourcebookDir,
					sourcebookIndexPath: indexPath,
					govukSourcebookDir: path.join(tmp, 'govuk'),
					validateQualityGates: true,
				}),
			/placeholder/
		);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails quality gates when dc:modified is missing', () => {
	const tmp = makeTempDir();
	try {
		const sourcebookDir = path.join(tmp, 'docs');
		fs.mkdirSync(sourcebookDir);
		writeHtml(sourcebookDir, 'index.html', '<p>Valid sourcebook page.</p>');
		const indexPath = path.join(tmp, 'sourcebook-index.json');
		writeMinimalSourcebookModel(indexPath, sourcebookDir);

		assert.throws(
			() =>
				validateSourcebookLinks({
					sourcebookDir,
					sourcebookIndexPath: indexPath,
					govukSourcebookDir: path.join(tmp, 'govuk'),
					validateQualityGates: true,
				}),
			/dc:modified/
		);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails quality gates when a pillar page has no change history', () => {
	const tmp = makeTempDir();
	try {
		const sourcebookDir = path.join(tmp, 'docs');
		fs.mkdirSync(sourcebookDir);
		writeQualityHtml(sourcebookDir, 'index.html', '<p>Valid sourcebook index.</p>');
		writeQualityHtml(sourcebookDir, 'scope.html', '<p>Valid sourcebook pillar.</p>');
		const indexPath = path.join(tmp, 'sourcebook-index.json');
		writeMinimalSourcebookModel(indexPath, sourcebookDir);

		assert.throws(
			() =>
				validateSourcebookLinks({
					sourcebookDir,
					sourcebookIndexPath: indexPath,
					govukSourcebookDir: path.join(tmp, 'govuk'),
					validateQualityGates: true,
				}),
			/change history/
		);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails quality gates when a badge is missing its label', () => {
	const tmp = makeTempDir();
	try {
		const sourcebookDir = path.join(tmp, 'docs');
		fs.mkdirSync(sourcebookDir);
		writeQualityHtml(sourcebookDir, 'index.html', '<span class="sourcebook-clause-badge">R</span>');
		const indexPath = path.join(tmp, 'sourcebook-index.json');
		writeMinimalSourcebookModel(indexPath, sourcebookDir);

		assert.throws(
			() =>
				validateSourcebookLinks({
					sourcebookDir,
					sourcebookIndexPath: indexPath,
					govukSourcebookDir: path.join(tmp, 'govuk'),
					validateQualityGates: true,
				}),
			/missing the Rule label/
		);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails quality gates on orphaned templates', () => {
	const tmp = makeTempDir();
	try {
		const sourcebookDir = path.join(tmp, 'docs');
		fs.mkdirSync(sourcebookDir);
		writeQualityHtml(sourcebookDir, 'index.html', '<p>Valid sourcebook index.</p>');
		const indexPath = path.join(tmp, 'sourcebook-index.json');
		writeMinimalSourcebookModel(indexPath, sourcebookDir, {
			templates: [
				{
					id: 'TPL-USED',
					title: 'Used template',
					path: '/sourcebook/templates/used-template.md',
				},
				{
					id: 'TPL-UNUSED',
					title: 'Unused template',
					path: '/sourcebook/templates/unused-template.md',
				},
			],
		});
		fs.writeFileSync(path.join(sourcebookDir, 'templates', 'unused-template.md'), '# Unused');

		assert.throws(
			() =>
				validateSourcebookLinks({
					sourcebookDir,
					sourcebookIndexPath: indexPath,
					govukSourcebookDir: path.join(tmp, 'govuk'),
					validateQualityGates: true,
				}),
			/defined but not referenced/
		);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks fails quality gates on unregistered template files', () => {
	const tmp = makeTempDir();
	try {
		const sourcebookDir = path.join(tmp, 'docs');
		fs.mkdirSync(sourcebookDir);
		writeQualityHtml(sourcebookDir, 'index.html', '<p>Valid sourcebook index.</p>');
		const indexPath = path.join(tmp, 'sourcebook-index.json');
		writeMinimalSourcebookModel(indexPath, sourcebookDir);
		fs.writeFileSync(path.join(sourcebookDir, 'templates', 'unregistered-template.md'), '# Orphan');

		assert.throws(
			() =>
				validateSourcebookLinks({
					sourcebookDir,
					sourcebookIndexPath: indexPath,
					govukSourcebookDir: path.join(tmp, 'govuk'),
					validateQualityGates: true,
				}),
			/not registered/
		);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('validateSourcebookLinks throws when href resolves to a directory', () => {
	const tmp = makeTempDir();
	try {
		fs.mkdirSync(path.join(tmp, 'templates'));
		writeHtml(tmp, 'index.html', '<a href="templates/">browse</a>');
		assert.throws(() => validateSourcebookLinks({ sourcebookDir: tmp }), /broken link/);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('live sourcebook passes link validation', () => {
	const result = validateSourcebookLinks();
	assert.ok(result.pages >= 9, `Expected at least 9 sourcebook pages, got ${result.pages}`);
	assert.ok(result.totalLinks >= 100, `Expected at least 100 links, got ${result.totalLinks}`);
});
