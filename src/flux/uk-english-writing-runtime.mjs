import nspell from 'nspell';
import { analyseUkEnglish } from './uk-english-writing-analyser.mjs';

let checkerPromise;

window.researchOpsFluxWriting = Object.freeze({
	analyse: async (value) => analyseUkEnglish(value, await checker()),
});

function checker() {
	checkerPromise ??= Promise.all([
		fetch('/assets/flux/uk-english/index.aff?v=1.0.0', { credentials: 'omit' }).then(requireText),
		fetch('/assets/flux/uk-english/index-1.dic?v=1.0.0', { credentials: 'omit' }).then(requireText),
		fetch('/assets/flux/uk-english/index-2.dic?v=1.0.0', { credentials: 'omit' }).then(requireText),
	]).then(([affix, dictionaryPart1, dictionaryPart2]) =>
		nspell(affix, dictionaryPart1 + dictionaryPart2)
	);
	return checkerPromise;
}

async function requireText(response) {
	if (!response.ok) throw new Error('UK English writing resource unavailable');
	return response.text();
}
