import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import enGb from 'dictionary-en-gb';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = resolve(root, 'public/assets/flux/uk-english');
const dictionary = new TextDecoder().decode(enGb.dic);
const splitAfter = dictionary.indexOf('\n', Math.floor(dictionary.length / 2)) + 1;

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
	writeFile(resolve(outputDirectory, 'index.aff'), enGb.aff),
	writeFile(resolve(outputDirectory, 'index-1.dic'), dictionary.slice(0, splitAfter)),
	writeFile(resolve(outputDirectory, 'index-2.dic'), dictionary.slice(splitAfter)),
	writeFile(
		resolve(outputDirectory, 'THIRD_PARTY_NOTICE.txt'),
		'UK English dictionary: dictionary-en-gb 3.0.0, generated from wordlist.aspell.net. Licensed MIT AND BSD. https://github.com/wooorm/dictionaries\n'
	),
]);

await build({
	entryPoints: [resolve(root, 'src/flux/uk-english-writing-runtime.mjs')],
	outfile: resolve(root, 'public/assets/flux/uk-english-writing-runtime.mjs'),
	bundle: true,
	format: 'esm',
	minify: true,
	target: ['es2022'],
	legalComments: 'eof',
});

console.log('Built local UK English writing analyser');
