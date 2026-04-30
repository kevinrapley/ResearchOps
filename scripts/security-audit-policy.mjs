import fs from 'node:fs';
import path from 'node:path';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const root = process.cwd();

function parseArgs(argv) {
	const options = {
		policyPath: 'security-audit-policy.json',
		auditPath: '',
		lockfilePath: 'package-lock.json',
		packagePath: 'package.json',
		outputPath: ''
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--policy') {
			options.policyPath = argv[index + 1];
			index += 1;
		} else if (arg === '--audit') {
			options.auditPath = argv[index + 1];
			index += 1;
		} else if (arg === '--lockfile') {
			options.lockfilePath = argv[index + 1];
			index += 1;
		} else if (arg === '--package') {
			options.packagePath = argv[index + 1];
			index += 1;
		} else if (arg === '--output') {
			options.outputPath = argv[index + 1];
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			writeHelp();
			process.exit(0);
		}
	}

	return options;
}

function writeHelp() {
	process.stdout.write(`Usage: node scripts/security-audit-policy.mjs [options]

Options:
  --policy <path>       Security audit policy JSON file. Default: security-audit-policy.json.
  --audit <path>        Existing npm audit JSON file. If omitted, JSON is read from stdin.
  --lockfile <path>     npm package-lock.json path. Default: package-lock.json.
  --package <path>      package.json path. Default: package.json.
  --output <path>       Optional JSON report output path.
`);
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(path.resolve(root, filePath), 'utf8'));
}

function readAudit(options) {
	if (options.auditPath) {
		return readJson(options.auditPath);
	}

	const input = fs.readFileSync(0, 'utf8');
	if (!input.trim()) {
		throw new Error('No npm audit JSON supplied on stdin.');
	}

	return JSON.parse(input);
}

function severityRank(severity) {
	return severities.indexOf(severity);
}

function highestSeverity(current, next) {
	return severityRank(next) > severityRank(current) ? next : current;
}

function dependencyNameFromNode(nodePath) {
	const parts = nodePath.split('/');
	const index = parts.lastIndexOf('node_modules');

	if (index === -1 || index === parts.length - 1) {
		return '';
	}

	const first = parts[index + 1];
	if (first.startsWith('@') && parts[index + 2]) {
		return `${first}/${parts[index + 2]}`;
	}

	return first;
}

function buildPackageScopeIndex(lockfile) {
	const packages = lockfile.packages || {};
	const scopes = new Map();

	for (const [packagePath, metadata] of Object.entries(packages)) {
		if (!packagePath.startsWith('node_modules/')) continue;

		const dependencyName = dependencyNameFromNode(packagePath);
		if (!dependencyName) continue;

		const existing = scopes.get(dependencyName) || { prod: false, dev: false, optional: false };
		existing.dev ||= metadata.dev === true;
		existing.optional ||= metadata.optional === true;
		existing.prod ||= metadata.dev !== true;
		scopes.set(dependencyName, existing);
	}

	return scopes;
}

function classifyScope(vulnerability, packageScopes, packageJson) {
	const directRuntimeDependencies = new Set(Object.keys(packageJson.dependencies || {}));
	const directDevelopmentDependencies = new Set(Object.keys(packageJson.devDependencies || {}));

	if (directRuntimeDependencies.has(vulnerability.name)) return 'runtime';
	if (directDevelopmentDependencies.has(vulnerability.name)) return 'development';
	if (directRuntimeDependencies.size === 0) return 'development';

	const nodes = vulnerability.nodes || [];
	let sawProd = false;
	let sawDev = false;

	for (const node of nodes) {
		const dependencyName = dependencyNameFromNode(node);
		const scope = packageScopes.get(dependencyName);
		if (!scope) continue;
		sawProd ||= scope.prod;
		sawDev ||= scope.dev;
	}

	if (sawProd) return 'runtime';
	if (sawDev) return 'development';
	return 'unknown';
}

function extractAdvisories(vulnerability) {
	const advisories = [];

	for (const entry of vulnerability.via || []) {
		if (typeof entry === 'string') {
			advisories.push({ package: entry });
		} else if (entry && typeof entry === 'object') {
			advisories.push({
				source: entry.source,
				name: entry.name,
				title: entry.title,
				url: entry.url,
				severity: entry.severity,
				cwe: entry.cwe || [],
				cvss: entry.cvss || null,
				range: entry.range
			});
		}
	}

	return advisories;
}

function shouldBlock(record, policy) {
	if (record.scope === 'runtime') {
		return policy.runtime_dependency_severities_blocking.includes(record.severity);
	}

	if (record.scope === 'unknown') {
		return policy.unknown_dependency_type_severities_blocking.includes(record.severity);
	}

	return policy.development_dependency_severities_blocking.includes(record.severity);
}

function summarise(records) {
	const summary = {
		total: records.length,
		bySeverity: Object.fromEntries(severities.map(severity => [severity, 0])),
		byScope: {
			runtime: 0,
			development: 0,
			unknown: 0
		}
	};

	for (const record of records) {
		summary.bySeverity[record.severity] += 1;
		summary.byScope[record.scope] += 1;
	}

	return summary;
}

function buildReport({ audit, lockfile, packageJson, policy }) {
	const packageScopes = buildPackageScopeIndex(lockfile);
	const records = Object.values(audit.vulnerabilities || {}).map(vulnerability => {
		const scope = classifyScope(vulnerability, packageScopes, packageJson);
		const severity = vulnerability.severity || 'info';
		const record = {
			name: vulnerability.name,
			severity,
			scope,
			isDirect: vulnerability.isDirect === true,
			range: vulnerability.range || '',
			fixAvailable: vulnerability.fixAvailable ?? false,
			advisories: extractAdvisories(vulnerability),
			nodes: vulnerability.nodes || []
		};

		record.blocking = shouldBlock(record, policy);
		return record;
	});

	const blocking = records.filter(record => record.blocking);
	let highest = 'info';

	for (const record of records) {
		highest = highestSeverity(highest, record.severity);
	}

	return {
		policy: {
			version: policy.version,
			policy_name: policy.policy_name,
			decision: policy.decision,
			rationale: policy.rationale,
			review_cadence: policy.review_cadence
		},
		status: blocking.length ? 'failed' : 'passed',
		highestSeverity: highest,
		summary: summarise(records),
		blockingFindings: blocking.map(record => record.name),
		findings: records.sort((first, second) => {
			const severityDifference = severityRank(second.severity) - severityRank(first.severity);
			return severityDifference || first.name.localeCompare(second.name);
		})
	};
}

const options = parseArgs(process.argv.slice(2));
const policy = readJson(options.policyPath);
const lockfile = readJson(options.lockfilePath);
const packageJson = readJson(options.packagePath);
const audit = readAudit(options);
const report = buildReport({ audit, lockfile, packageJson, policy });
const output = `${JSON.stringify(report, null, 2)}\n`;

if (options.outputPath) {
	const outputPath = path.resolve(root, options.outputPath);
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, output, 'utf8');
}

process.stdout.write(output);
process.exit(report.status === 'passed' ? 0 : 1);
