import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export function createGovukPageFilesystemOutput(root = process.cwd()) {
	return {
		async write(publications) {
			for (const publication of publications) {
				const outputPath = resolve(root, publication.output);
				await mkdir(dirname(outputPath), { recursive: true });
				await writeFile(outputPath, publication.html, 'utf8');
				console.log(`Rendered ${publication.output}`);
			}
		},
	};
}
