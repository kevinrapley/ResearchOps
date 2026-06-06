import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const loggerSource = fs.readFileSync("public/js/browser-logger.js", "utf8");
const layoutSource = fs.readFileSync("public/components/layout.js", "utf8");

const ALLOWED_CONSOLE_LOG_FILES = new Set(["public/js/browser-logger.js", "public/partials/debug.js"]);
const SKIPPED_DIRECTORIES = new Set(["assets", "lib"]);

function* findJavascriptFiles(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!SKIPPED_DIRECTORIES.has(entry.name)) yield* findJavascriptFiles(fullPath);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".min.js")) {
			yield fullPath;
		}
	}
}

assert.match(loggerSource, /const DEBUG_QUERY_KEYS = \["debug", "rops_debug", "researchops_debug"\]/);
assert.match(loggerSource, /globalThis\.ResearchOpsLogger = globalThis\.ResearchOpsLogger \|\| loggerApi/);
assert.match(layoutSource, /import "\/js\/browser-logger\.js";/);

for (const filePath of findJavascriptFiles("public")) {
	const normalisedPath = filePath.split(path.sep).join("/");
	if (ALLOWED_CONSOLE_LOG_FILES.has(normalisedPath)) continue;

	const source = fs.readFileSync(filePath, "utf8");
	assert.equal(
		source.includes("console.log"),
		false,
		`Expected ${normalisedPath} to use ResearchOpsLogger instead of routine console.log`
	);
}
