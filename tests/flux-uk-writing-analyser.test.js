import assert from 'node:assert/strict';
import test from 'node:test';
import enGb from 'dictionary-en-gb';
import nspell from 'nspell';

import { analyseUkEnglish } from '../src/flux/uk-english-writing-analyser.mjs';

test('derives bounded UK English writing indicators without returning source text', () => {
	const spell = { correct: (word) => word !== 'speling' };
	const result = analyseUkEnglish(
		'THIS IS speling. this sentence starts lower. It it repeats.',
		spell
	);

	assert.deepEqual(result, {
		writing_language: 'en-GB',
		word_count: 10,
		spelling_issue_count: 1,
		grammar_issue_count: 2,
		uppercase_letter_count: 7,
		lowercase_letter_count: 40,
		all_caps_word_count: 2,
	});
	assert.equal(JSON.stringify(result).includes('speling'), false);
});

test('handles empty and oversized values with bounded output', () => {
	const spell = { correct: () => true };
	assert.deepEqual(analyseUkEnglish('', spell), {
		writing_language: 'en-GB',
		word_count: 0,
		spelling_issue_count: 0,
		grammar_issue_count: 0,
		uppercase_letter_count: 0,
		lowercase_letter_count: 0,
		all_caps_word_count: 0,
	});
	const result = analyseUkEnglish('WORD '.repeat(20_000), spell);
	assert.equal(
		Object.values(result)
			.filter(Number.isInteger)
			.every((value) => value <= 10_000),
		true
	);
});

test('measures spelling against the UK English dictionary', () => {
	const spell = nspell(enGb);
	assert.equal(analyseUkEnglish('The colour is my favourite.', spell).spelling_issue_count, 0);
	assert.equal(analyseUkEnglish('The color is my favorite.', spell).spelling_issue_count, 2);
	assert.equal(analyseUkEnglish('COLOR', spell).spelling_issue_count, 1);
});
