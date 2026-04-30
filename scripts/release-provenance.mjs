import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const defaultFiles = [
	"README.md",
	"package.json",
	"package-lock.json",
	"release-evidence.yaml",
	"configuration-evidence.yaml",
	"deployment-toolchain.yaml",
	"security-audit-policy.json",
	"security-audit-triage.yaml",
	"branch-protection-evidence.yaml",
	"github-settings.yaml",
	"gap-register.yaml",
	"RECENT_LEARNINGS.md",
	".github/workflows/release-gate.yml",
	".github/workflows/deploy-worker.yml",
	"infra/cloudflare/wrangler.toml",
];

function parseArgs(argv) {
	const options = {
		outputDir: "artifacts/release-provenance",
		files: defaultFiles,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--output-dir") {
			options.outputDir = argv[index + 1];
			index += 1;
		} else if (arg === "--file") {
			options.files.push(argv[index + 1]);
			index += 1;
		} else if (arg === "--help" || arg === "-h") {
			writeHelp();
			process.exit(0);
		}
	}

	return options;
}

function writeHelp() {
	process.stdout.write(`Usage: node scripts/release-provenance.mjs [options]

Options:
  --output-dir <path>  Directory for provenance artifacts. Default: artifacts/release-provenance.
  --file <path>        Additional file to include in the provenance manifest.
`);
}

function readIfExists(filePath) {
	const absolutePath = path.resolve(root, filePath);
	if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
		return null;
	}

	return fs.readFileSync(absolutePath);
}

function sha256(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function gitValue(name, fallback = "") {
	return process.env[name] || fallback;
}

function buildSubject(filePath) {
	const buffer = readIfExists(filePath);
	if (!buffer) {
		return {
			path: filePath,
			present: false,
			sha256: null,
			size_bytes: null,
		};
	}

	return {
		path: filePath,
		present: true,
		sha256: sha256(buffer),
		size_bytes: buffer.length,
	};
}

function buildManifest(files) {
	const uniqueFiles = [...new Set(files)].sort((first, second) =>
		first.localeCompare(second),
	);
	const subjects = uniqueFiles.map(buildSubject);
	const presentSubjects = subjects.filter((subject) => subject.present);

	return {
		schema_version: 1,
		generated_at: new Date().toISOString(),
		repository: gitValue("GITHUB_REPOSITORY", "kevinrapley/ResearchOps"),
		ref: gitValue("GITHUB_REF_NAME"),
		commit: gitValue("GITHUB_SHA"),
		run_id: gitValue("GITHUB_RUN_ID"),
		run_attempt: gitValue("GITHUB_RUN_ATTEMPT"),
		subject_count: presentSubjects.length,
		missing_subjects: subjects
			.filter((subject) => !subject.present)
			.map((subject) => subject.path),
		subjects,
	};
}

function buildSlsa(manifest) {
	return {
		_predicateType: "https://slsa.dev/provenance/v1",
		predicateType: "https://slsa.dev/provenance/v1",
		subject: manifest.subjects
			.filter((subject) => subject.present)
			.map((subject) => ({
				name: subject.path,
				digest: {
					sha256: subject.sha256,
				},
			})),
		predicate: {
			buildDefinition: {
				buildType:
					"https://github.com/kevinrapley/ResearchOps/actions/workflows/release-provenance.yml",
				externalParameters: {
					repository: manifest.repository,
					ref: manifest.ref,
					commit: manifest.commit,
				},
				internalParameters: {},
			},
			runDetails: {
				builder: {
					id: "https://github.com/actions/runner",
				},
				metadata: {
					invocationId: manifest.run_id,
					startedOn: manifest.generated_at,
					finishedOn: manifest.generated_at,
				},
			},
		},
	};
}

function buildDsse(provenance, manifest) {
	const payload = Buffer.from(JSON.stringify(provenance, null, 2)).toString(
		"base64",
	);
	const digest = sha256(Buffer.from(payload));

	return {
		payloadType: "application/vnd.in-toto+json",
		payload,
		signatures: [
			{
				keyid: "researchops-offline-provenance-placeholder",
				sig: digest,
			},
		],
		verification_note:
			"This DSSE-shaped envelope records release provenance evidence. It is not a cryptographic signature. Use GitHub artifact attestations or Sigstore for trusted release verification.",
		subject_manifest_sha256: sha256(Buffer.from(JSON.stringify(manifest))),
	};
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

const options = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(root, options.outputDir);
fs.mkdirSync(outputDir, { recursive: true });

const manifest = buildManifest(options.files);
const provenance = buildSlsa(manifest);
const dsse = buildDsse(provenance, manifest);

writeJson(path.join(outputDir, "release-provenance-manifest.json"), manifest);
writeJson(path.join(outputDir, "slsa-provenance.json"), provenance);
writeJson(path.join(outputDir, "dsse-envelope.json"), dsse);

process.stdout.write(
	`Wrote release provenance artifacts to ${options.outputDir}\n`,
);
process.stdout.write(`Subjects: ${manifest.subject_count}\n`);

if (manifest.missing_subjects.length > 0) {
	process.stdout.write(
		`Missing optional subjects: ${manifest.missing_subjects.join(", ")}\n`,
	);
}
