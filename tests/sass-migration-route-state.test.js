import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function* findScssFiles(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			yield* findScssFiles(fullPath);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".scss")) {
			yield fullPath;
		}
	}
}

const deprecatedGovukColours = ["mid-grey", "light-grey", "dark-grey"];

for (const filePath of findScssFiles("src/styles")) {
	const normalisedPath = filePath.split(path.sep).join("/");
	const source = fs.readFileSync(filePath, "utf8");

	assert.equal(source.includes("@import"), false, `Expected ${normalisedPath} to use @use instead of @import`);

	for (const colour of deprecatedGovukColours) {
		assert.equal(
			source.includes(`govuk-colour("${colour}")`) || source.includes(`govuk-colour('${colour}')`),
			false,
			`Expected ${normalisedPath} to use the GOV.UK replacement for ${colour}`
		);
	}
}

const govukSource = fs.readFileSync("src/styles/govuk.scss", "utf8");
assert.match(govukSource, /@use ['"]govuk-frontend\/dist\/govuk['"] with \(/);
assert.match(govukSource, /\$govuk-page-width: 1020px/);
assert.match(govukSource, /\$govuk-assets-path: ['"]\/assets\/govuk\/assets\/['"]/);

const generatedCssBuildSource = fs.readFileSync("scripts/styles/build-generated-css.mjs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(generatedCssBuildSource, /--silence-deprecation=import/);
assert.match(packageJson.scripts["build:govuk"], /--silence-deprecation=import/);
