const MAX_COUNT = 10_000;
const MAX_TEXT_LENGTH = 100_000;
const WORD_PATTERN = /[\p{L}]+(?:['’][\p{L}]+)*/gu;
const LETTER_PATTERN = /\p{L}/u;

export function analyseUkEnglish(value, spell) {
	const text = typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : '';
	const words = text.match(WORD_PATTERN) ?? [];
	let spellingIssues = 0;
	let uppercaseLetters = 0;
	let lowercaseLetters = 0;
	let allCapsWords = 0;

	for (const character of text) {
		if (!LETTER_PATTERN.test(character)) continue;
		if (character === character.toUpperCase() && character !== character.toLowerCase())
			uppercaseLetters += 1;
		else if (character === character.toLowerCase() && character !== character.toUpperCase())
			lowercaseLetters += 1;
	}

	for (const word of words) {
		const letters = [...word].filter((character) => LETTER_PATTERN.test(character));
		const isAllCaps =
			letters.length >= 2 && letters.every((character) => character === character.toUpperCase());
		if (isAllCaps) allCapsWords += 1;
		if (letters.length > 1 && spell?.correct?.(word.toLocaleLowerCase('en-GB')) === false)
			spellingIssues += 1;
	}

	return {
		writing_language: 'en-GB',
		word_count: bounded(words.length),
		spelling_issue_count: bounded(spellingIssues),
		grammar_issue_count: bounded(grammarIssueCount(text, words)),
		uppercase_letter_count: bounded(uppercaseLetters),
		lowercase_letter_count: bounded(lowercaseLetters),
		all_caps_word_count: bounded(allCapsWords),
	};
}

function grammarIssueCount(text, words) {
	let issues = 0;
	for (const match of text.matchAll(/(?:^|[.!?]["')\]]*\s+)(\p{L})/gu)) {
		const letter = match[1];
		if (
			letter === letter.toLocaleLowerCase('en-GB') &&
			letter !== letter.toLocaleUpperCase('en-GB')
		)
			issues += 1;
	}
	for (let index = 1; index < words.length; index += 1) {
		if (words[index].toLocaleLowerCase('en-GB') === words[index - 1].toLocaleLowerCase('en-GB'))
			issues += 1;
	}
	issues += (text.match(/\bi\b/g) ?? []).length;
	issues += (text.match(/\s+[,.!?;:]/g) ?? []).length;
	issues += (text.match(/(?:[!?]{2,}|,{2,}|\.{4,})/g) ?? []).length;
	if (words.length >= 4 && !/[.!?]["')\]]*\s*$/u.test(text)) issues += 1;
	return issues;
}

function bounded(value) {
	return Math.min(MAX_COUNT, Math.max(0, Math.round(value)));
}
