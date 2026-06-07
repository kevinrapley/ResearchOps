import assert from 'node:assert/strict';
import fs from 'node:fs';

const artefactScript = fs.readFileSync('public/js/repository-artefact-page.js', 'utf8');

assert.equal(artefactScript.includes('function displayTags'), true);
assert.equal(artefactScript.includes('!/seeded/i.test(text(tag.text))'), true);
assert.equal(artefactScript.includes('for (const tag of displayTags(artefact))'), true);
assert.equal(artefactScript.includes('!/confidence$/i.test(text(tag.text))'), false);
assert.equal(artefactScript.includes('slug(tag.text) !== slug(artefact.evidenceMaturity)'), false);
