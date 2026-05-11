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

test('validateSourcebookLinks skips href="#" placeholder', () => {
	const tmp = makeTempDir();
	try {
		writeHtml(tmp, 'index.html', '<a href="#">placeholder</a>');
		const result = validateSourcebookLinks({ sourcebookDir: tmp });
		assert.equal(result.skippedCount, 1);
		assert.equal(result.totalLinks, 0);
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
