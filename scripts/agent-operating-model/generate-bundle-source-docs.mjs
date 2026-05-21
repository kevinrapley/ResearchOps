#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TEXT_EXTENSIONS = new Set(['.css', '.csv', '.html', '.js', '.json', '.jsonc', '.md', '.mjs', '.py', '.txt', '.xml', '.yaml', '.yml']);
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', '.cache', '.wrangler']);
const SKIPPED_FILES = new Set(['.DS_Store']);

const SOURCE_FAMILIES = ['modes', 'roles', 'references', 'contracts', 'graders', 'templates', 'scripts', 'examples'];

const FAMILY_COPY = {
	modes: {
		title: 'Modes',
		pill: 'mode',
		card: 'Workflow runbooks.',
		lede: 'Mode files are task routes. They tell the agent what work pattern to follow, what evidence is required, and what must block completion.'
	},
	roles: {
		title: 'Roles',
		pill: 'role',
		card: 'Expert lenses.',
		lede: 'Role files define the expert judgement the agent must apply when reviewing repository work.'
	},
	references: {
		title: 'References',
		pill: 'reference',
		card: 'Policy modules.',
		lede: 'Reference files hold doctrine, conventions, safety rules and implementation policy that modes and roles rely on.'
	},
	contracts: {
		title: 'Contracts',
		pill: 'contract',
		card: 'JSON Schemas.',
		lede: 'Contract files define the machine-readable shapes of evidence, outputs and repository artefacts.'
	},
	graders: {
		title: 'Graders',
		pill: 'grader',
		card: 'Scoring modules.',
		lede: 'Grader files decide whether evidence is strong enough to pass, fail, or require revision.'
	},
	templates: {
		title: 'Templates',
		pill: 'template',
		card: 'Scaffolds.',
		lede: 'Template files are copied or adapted when the bundle creates repository structure, workflows and evidence artefacts.'
	},
	scripts: {
		title: 'Scripts',
		pill: 'script',
		card: 'Validation utilities.',
		lede: 'Script files are executable checks. They turn claims about repository state into something that can be verified.'
	},
	examples: {
		title: 'Examples',
		pill: 'example',
		card: 'Example files.',
		lede: 'Example files show expected, positive, negative or boundary-case bundle behaviour.'
	}
};

function parseArgs(argv) {
	const output = {
		bundle: 'github',
		sourceRoot: '.agent-operating-model/bundles',
		docsRoot: 'docs/agent-operating-model/bundles',
		dryRun: false
	};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];

		if (current === '--bundle') {
			output.bundle = argv[index + 1];
			index += 1;
		} else if (current === '--source-root') {
			output.sourceRoot = argv[index + 1];
			index += 1;
		} else if (current === '--docs-root') {
			output.docsRoot = argv[index + 1];
			index += 1;
		} else if (current === '--dry-run') {
			output.dryRun = true;
		} else {
			throw new Error(`Unknown argument: ${current}`);
		}
	}

	return output;
}

function normalise(value) {
	return value.split(path.sep).join('/');
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function slug(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'source-file';
}

function fileCategory(relativePath) {
	const parts = relativePath.split('/');
	return parts.length === 1 ? 'root' : parts[0];
}

function family(relativePath) {
	const category = fileCategory(relativePath);
	if (category === 'root') return 'source';
	return FAMILY_COPY[category]?.pill || category.slice(0, -1) || category;
}

function familyTitle(category) {
	return FAMILY_COPY[category]?.title || category.replaceAll('-', ' ');
}

function bundleTitle(bundle) {
	return bundle === 'github' ? 'GitHub Diamond bundle' : `${bundle} bundle`;
}

function fileTitle(relativePath) {
	const base = path.basename(relativePath);
	const withoutExtension = base.replace(/\.(xml|yaml|yml|json|jsonc|md|py|js|mjs|css|txt)$/i, '');
	return withoutExtension
		.replace(/^repo-/, 'repository ')
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (match) => match.toUpperCase());
}

function language(relativePath) {
	const extension = path.extname(relativePath).toLowerCase();
	if (extension === '.xml') return 'xml';
	if (extension === '.html') return 'html';
	if (extension === '.json' || extension === '.jsonc') return 'json';
	if (extension === '.yaml' || extension === '.yml') return 'yaml';
	if (extension === '.md') return 'markdown';
	if (extension === '.py') return 'python';
	if (extension === '.js' || extension === '.mjs') return 'javascript';
	if (extension === '.css') return 'css';
	return 'text';
}

function highlight(source, relativePath) {
	let output = escapeHtml(source);
	const lang = language(relativePath);

	if (lang === 'xml' || lang === 'html') {
		return output
			.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-comment">$1</span>')
			.replace(/([\w:.-]+)(=)(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="tok-attr">$1</span>$2<span class="tok-string">$3</span>')
			.replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="tok-tag">$2</span>');
	}

	if (lang === 'json') {
		output = output.replace(/(&quot;[^&]*?&quot;)(\s*:)?/g, (match, quoted, suffix = '') => {
			return suffix ? `<span class="tok-key">${quoted}</span>${suffix}` : `<span class="tok-string">${quoted}</span>`;
		});
		output = output.replace(/\b(true|false|null)\b/g, '<span class="tok-keyword">$1</span>');
		output = output.replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
		return output;
	}

	if (lang === 'yaml') {
		return output.split('\n').map((line) => line
			.replace(/^(\s*)([A-Za-z0-9_.-]+)(:)/, '$1<span class="tok-key">$2</span>$3')
			.replace(/(#.*)$/g, '<span class="tok-comment">$1</span>')).join('\n');
	}

	if (lang === 'markdown') {
		return output.split('\n').map((line) => {
			if (/^#{1,6}\s/.test(line)) return `<span class="tok-key">${line}</span>`;
			if (/^[-*]\s/.test(line)) return `<span class="tok-attr">${line}</span>`;
			return line.replace(/(`[^`]+`)/g, '<span class="tok-string">$1</span>');
		}).join('\n');
	}

	if (lang === 'python' || lang === 'javascript') {
		output = output.replace(/(\/\/.*$|#.*$)/gm, '<span class="tok-comment">$1</span>');
		output = output.replace(/(&quot;[^\n]*?&quot;|&#39;[^\n]*?&#39;|`[^`]*?`)/g, '<span class="tok-string">$1</span>');
		return output;
	}

	return output;
}

function firstMatch(source, regex) {
	const match = source.match(regex);
	return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function quotedList(items) {
	return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function extractSignals(source, relativePath) {
	const ext = language(relativePath);
	const base = path.basename(relativePath);
	return {
		title: firstMatch(source, /^#\s+(.+)$/m) || firstMatch(source, /name:\s*['"]?([^'"\n]+)['"]?/i) || fileTitle(relativePath),
		purpose: firstMatch(source, /<purpose>([\s\S]*?)<\/purpose>/i)
			|| firstMatch(source, /description:\s*['"]?([^'"\n]+)['"]?/i)
			|| firstMatch(source, /"description"\s*:\s*"([^"]+)"/i)
			|| null,
		rootElement: firstMatch(source, /<([A-Za-z][\w:.-]+)(\s|>)/),
		jsonTitle: firstMatch(source, /"title"\s*:\s*"([^"]+)"/i),
		modeId: firstMatch(source, /<mode[^>]*id="([^"]+)"/i) || base.replace(/\.[^.]+$/, ''),
		schemaId: firstMatch(source, /"\$id"\s*:\s*"([^"]+)"/i),
		commands: [...source.matchAll(/\b(node|npm|python|python3|npx|bash)\s+[^<\n"]+/g)].slice(0, 3).map((match) => match[0].trim()),
		keys: [...source.matchAll(/^([A-Za-z0-9_.-]+):/gm)].slice(0, 8).map((match) => match[1]),
		extension: ext
	};
}

function rootAnnotation(relativePath, source) {
	const signals = extractSignals(source, relativePath);
	const base = path.basename(relativePath);
	const exact = {
		'prompt.spec.yaml': {
			how: [
				'The agent reads this as the bundle assembly map. It tells the agent which prompt body, references, modes, roles, contracts, graders, templates and scripts exist before any repository task begins.',
				'For you, this file is the contents page for the operating model. If a module is missing here, the agent may not know that it is part of the bundle, even if the file exists elsewhere.'
			],
			look: [
				'Check that every module family is explicitly listed and that important files are not only present in the repo but also loaded by the assembly.',
				'Look for drift between this manifest, the registry manifest and the generated documentation pages.',
				'Check whether the default mode and always-load references still reflect how the bundle should behave.'
			]
		},
		'prompt.body.xml': {
			how: [
				'The agent treats this as the doctrine layer. It sets the operating principles, mandatory sequence, boundaries and governance behaviour that sit above individual modes.',
				'This is the file that should stop the bundle becoming a loose set of tips. It defines the posture the agent must hold while using the rest of the source files.'
			],
			look: [
				'Check whether the mandatory behaviours are concrete enough to be followed by an agent without interpretation drift.',
				'Look for any instruction that conflicts with the GitHub mutation policy, branch rules, validation expectations or evidence requirements.',
				'Check that the doctrine still reflects the way you want the agent to work, not just how a generic coding assistant would work.'
			]
		},
		'README.md': {
			how: [
				'The README gives human readers the entry point into the bundle. The agent can use it to explain the bundle at a high level, but it should not treat it as a substitute for the prompt spec or source modules.',
				'For you, this file is the short human contract: what the bundle is for, how it should be used and where deeper controls live.'
			],
			look: [
				'Check that the README describes the bundle in plain language without weakening the binding rules in the XML and YAML files.',
				'Look for gaps between the public-facing summary and the actual implementation files.',
				'Check that it tells a future maintainer where to start.'
			]
		},
		'registry-manifest.yaml': {
			how: [
				'The registry manifest is the inventory control point. It lets the agent and reviewers compare what the bundle thinks exists with what is actually in the repository.',
				'It is a drift detector. If generated documentation, prompt spec and source files disagree, this file helps expose the mismatch.'
			],
			look: [
				'Check that new files are registered and that removed files are not still listed.',
				'Look for categories that have grown without a matching update to the prompt spec or documentation generator.',
				'Check that this manifest can support audit, not just navigation.'
			]
		},
		'template-registry.yaml': {
			how: [
				'The template registry tells the agent which template file is used for which repository destination and under which contract or grader.',
				'It prevents the agent from inventing target paths when scaffolding workflows, evidence packs or repository files.'
			],
			look: [
				'Check that each template has a clear destination and usage condition.',
				'Look for templates that are present but not selectable, or selectable without validation.',
				'Check whether destination paths still match repository conventions.'
			]
		},
		'VALIDATION-REPORT.md': {
			how: [
				'The validation report is the readable assurance record. It tells the agent and reviewer what has been checked and what confidence can be claimed.',
				'It should support a PR-readiness decision rather than act as a ceremonial sign-off.'
			],
			look: [
				'Check whether validation claims are backed by scripts, tests or explicit evidence.',
				'Look for stale dates, unverified claims or gaps that should block release.',
				'Check whether failed or skipped checks are explained plainly.'
			]
		},
		'CHANGELOG.md': {
			how: [
				'The changelog gives the agent release history. It helps explain why a rule, contract, template or workflow changed.',
				'It should be used when assessing whether a proposed change is new behaviour, a correction, or a reversal of a previous decision.'
			],
			look: [
				'Check that breaking changes are named as breaking changes.',
				'Look for entries that describe what changed but not why.',
				'Check that version history matches the status recorded in the prompt spec and metadata.'
			]
		}
	};

	if (exact[base]) return exact[base];

	if (base.endsWith('.schema.json')) {
		return {
			how: [
				`The agent uses ${base} as a root-level schema for bundle I/O or grading behaviour. It helps turn an otherwise loose instruction into a checkable data shape.`,
				`The schema title is ${signals.jsonTitle || fileTitle(relativePath)}. That title should tell you what evidence or output is being constrained.`
			],
			look: [
				'Check required fields first. They tell you what the agent must produce before the output can be trusted.',
				'Look for vague free-text fields where stronger enums, arrays or nested evidence objects would improve traceability.',
				'Check that the schema matches the files and graders that claim to use it.'
			]
		};
	}

	return {
		how: [
			`The agent uses ${base} as a top-level bundle control or assurance file. It sits on the overview page because it helps explain the bundle as a system rather than as a source family.`,
			signals.purpose || `The file exposes ${signals.keys.length ? `keys such as ${signals.keys.join(', ')}` : 'configuration or documentation'} that shape how the bundle is read.`
		],
		look: [
			`Check whether ${base} still belongs in the top-level operating manual rather than a source-family page.`,
			'Look for stale references, unregistered files or claims that are not backed by scripts, contracts or graders.',
			'Check how this file connects to prompt.spec.yaml and the generated source panels.'
		]
	};
}

function familyAnnotation(relativePath, source) {
	const category = fileCategory(relativePath);
	const signals = extractSignals(source, relativePath);
	const base = path.basename(relativePath);
	const title = fileTitle(relativePath);

	if (category === 'modes') {
		const modeName = base.replace(/\.xml$/, '').replace(/^repo-/, '');
		return {
			how: [
				`The agent selects ${base} when a repository task fits the ${modeName.replaceAll('-', ' ')} workflow. It acts as a route through the work rather than a passive reference file.`,
				'The mode should tell the agent what to inspect first, what outputs to produce, which evidence is required, and what failure states block completion.',
				signals.purpose || `For you, this file explains how the agent should behave when the task is specifically about ${modeName.replaceAll('-', ' ')}.`
			],
			look: [
				'Check the entry conditions. They should make it clear when this mode applies and when another mode is more appropriate.',
				'Check the completion evidence. A mode that allows completion without tests, trace or changed-file review is too weak.',
				'Look for linked contracts, graders and references. These links are what turn the mode into a governed workflow rather than a checklist.'
			]
		};
	}

	if (category === 'roles') {
		const roleName = base.replace(/\.xml$/, '').replaceAll('-', ' ');
		return {
			how: [
				`The agent applies ${base} as the ${roleName} judgement lens. It shapes how the output is critiqued, not just how it is written.`,
				'This role should make the agent ask different questions from the mode. The mode says what work to do; the role says what good looks like from this professional viewpoint.',
				signals.purpose || `For you, this file explains what responsibility the ${roleName} lens carries in the operating model.`
			],
			look: [
				'Check whether the role has real authority to block or escalate weak work.',
				'Look for overlap with other roles. Repetition is acceptable only when it reinforces a critical judgement point.',
				'Check whether the role gives practical review questions, not just abstract values.'
			]
		};
	}

	if (category === 'references') {
		return {
			how: [
				`The agent consults ${base} when a task touches this policy area. It supplies the doctrine behind the operational steps.`,
				'This reference should explain constraints that modes and roles depend on, such as repository conventions, mutation rules, implementation workflow, CI policy or evidence standards.',
				signals.purpose || `For you, this file is the source of truth for the ${title.toLowerCase()} policy area.`
			],
			look: [
				'Check whether the rules are specific enough to constrain agent behaviour.',
				'Look for priority language such as must, should and must-not. Ambiguous policy will produce inconsistent agent action.',
				'Check that the reference is linked from relevant modes, roles, contracts or graders.'
			]
		};
	}

	if (category === 'contracts') {
		return {
			how: [
				`The agent uses ${base} to validate a specific evidence or artefact shape. It converts “looks plausible” into “matches the expected structure”.`,
				`The schema ${signals.schemaId ? `declares ${signals.schemaId}` : `is titled ${signals.jsonTitle || title}`}. That identifier should make clear what kind of output it governs.`,
				'This file should be used before evidence is accepted as PR-ready.'
			],
			look: [
				'Check the required fields. They define the minimum evidence that must exist.',
				'Look for weakly typed fields that could allow vague prose to pass as evidence.',
				'Check that enums, nested objects and examples match the way the associated scripts and graders evaluate output.'
			]
		};
	}

	if (category === 'graders') {
		return {
			how: [
				`The agent uses ${base} after work is produced to judge whether evidence is strong enough to pass.`,
				`This grader should describe the threshold between acceptable, incomplete and blocking output for ${title.toLowerCase()}.`,
				signals.purpose || 'For you, this file explains the review logic the agent should apply before claiming readiness.'
			],
			look: [
				'Check whether the scoring criteria are observable rather than subjective.',
				'Look for blocking conditions. These are the safety rails that stop premature “done” claims.',
				'Check that the grader points to the evidence it needs rather than relying on confidence language.'
			]
		};
	}

	if (category === 'templates') {
		const destinationHint = relativePath.includes('/.github/') ? 'GitHub workflow or repository control file' : 'repository scaffold or evidence artefact';
		return {
			how: [
				`The agent uses ${base} as a ${destinationHint}. It should copy or adapt this file only through the template registry or an explicit mode.`,
				`Because this file lives under ${relativePath.split('/').slice(0, -1).join('/') || 'templates'}, the path itself helps show where the template is expected to land or what family of artefact it supports.`,
				signals.purpose || 'For you, this file shows the exact structure the bundle wants to generate rather than describing it abstractly.'
			],
			look: [
				'Check what must be customised and what must remain stable.',
				'Look for placeholders that need explicit values before the template can be committed into a real repository.',
				'Check that workflow, evidence or repository paths match the template registry.'
			]
		};
	}

	if (category === 'scripts') {
		return {
			how: [
				`The agent uses ${base} as an executable verification or generation utility. It is where a claim should become a check.`,
				signals.commands.length ? `The source references commands such as ${signals.commands.join(', ')}, which gives a clue about how the check is expected to run.` : 'The script should be run locally or in CI when its corresponding evidence claim needs verification.',
				`For you, this file explains what the bundle can prove mechanically for ${title.toLowerCase()}.`
			],
			look: [
				'Check the exit behaviour. A validation script must fail loudly when the evidence is wrong.',
				'Look for hard-coded paths, silent fallbacks or broad catch blocks that could hide failure.',
				'Check that the script is referenced by the relevant mode, grader, workflow or validation report.'
			]
		};
	}

	if (category === 'examples') {
		return {
			how: [
				`The agent uses ${base} as an example of expected, negative or boundary-case behaviour.`,
				'This file helps the agent and reviewer understand how the abstract bundle rules should look in practice.',
				signals.purpose || `For you, this example shows how ${title.toLowerCase()} should be interpreted when evaluating real output.`
			],
			look: [
				'Check whether the example is clearly labelled as positive, negative or illustrative.',
				'Look for mismatch between the example and the current contracts, graders or templates.',
				'Check whether the example teaches a decision, not just a file shape.'
			]
		};
	}

	return {
		how: [
			`The agent uses ${base} as part of the ${category} source family.`,
			signals.purpose || `The file contributes to ${title.toLowerCase()} behaviour in the bundle.`
		],
		look: [
			'Check whether the file has a clear role in the operating model.',
			'Look for drift against the prompt spec, registry and generated documentation.',
			'Check whether a reviewer can tell why this file exists.'
		]
	};
}

function annotation(relativePath, source) {
	return fileCategory(relativePath) === 'root'
		? rootAnnotation(relativePath, source)
		: familyAnnotation(relativePath, source);
}

async function walk(directory, root = directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (entry.name.startsWith('.') && entry.name !== '.github') continue;
		if (SKIPPED_FILES.has(entry.name)) continue;

		const fullPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...await walk(fullPath, root));
			continue;
		}

		if (entry.isFile()) {
			files.push({
				absolutePath: fullPath,
				relativePath: normalise(path.relative(root, fullPath))
			});
		}
	}

	return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isText(file, buffer) {
	return TEXT_EXTENSIONS.has(path.extname(file.relativePath).toLowerCase()) || !buffer.includes(0);
}

function styles() {
	return `
:root { --black:#0b0c0c; --blue:#1d70b8; --grey:#505a5f; --mid:#b1b4b6; --light:#f3f2f1; --yellow:#ffdd00; --green:#00703c; --red:#d4351c; --purple:#4c2c92; --max:1320px; }
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; background:#fff; color:var(--black); font-family:Arial, Helvetica, sans-serif; font-size:18px; line-height:1.5; }
a { color:var(--blue); text-decoration-thickness:max(1px,.08em); text-underline-offset:.12em; }
a:focus { outline:3px solid var(--yellow); background:var(--yellow); color:var(--black); }
.skip-link { position:absolute; left:-999em; top:0; padding:8px 12px; background:var(--yellow); color:var(--black); z-index:10; }
.skip-link:focus { left:0; }
.site-header { background:var(--black); color:#fff; border-bottom:10px solid var(--blue); }
.site-header__inner { max-width:var(--max); margin:0 auto; padding:30px 24px 46px; }
.site-header__product { margin:0 0 38px; font-weight:700; }
h1 { max-width:1000px; margin:0; font-size:clamp(42px,7vw,88px); line-height:.95; letter-spacing:-.045em; }
.site-header__lede { max-width:900px; margin:28px 0 0; font-size:23px; line-height:1.35; }
.meta { background:var(--light); border-bottom:1px solid var(--mid); }
.meta-inner { max-width:var(--max); margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:12px 24px; font-size:16px; }
.meta strong { display:block; color:var(--grey); font-size:14px; }
.layout { max-width:var(--max); margin:0 auto; display:grid; grid-template-columns:300px minmax(0,1fr); gap:34px; padding:34px 24px 80px; align-items:start; }
.side-nav { position:sticky; top:16px; border-top:4px solid var(--blue); font-size:16px; }
.side-nav h2 { font-size:19px; margin:12px 0 8px; }
.side-nav ol { list-style:none; margin:0; padding:0; }
.side-nav li { border-bottom:1px solid #ddd; }
.side-nav a { display:block; padding:9px 0; text-decoration:none; }
.side-nav a[aria-current="page"] { padding-left:10px; border-left:5px solid var(--blue); color:var(--black); font-weight:700; }
.breadcrumbs { margin:0 0 24px; font-size:16px; }
.breadcrumbs span::before { content:"›"; margin:0 8px; color:var(--grey); }
main { min-width:0; }
section { margin:0 0 64px; padding-top:2px; }
h2 { margin:0 0 20px; font-size:clamp(34px,4vw,50px); line-height:1.04; letter-spacing:-.025em; }
h3 { font-size:26px; line-height:1.16; margin:28px 0 10px; }
h4 { font-size:20px; margin:20px 0 8px; }
p { max-width:900px; margin:0 0 16px; }
.lede2 { max-width:950px; font-size:23px; line-height:1.35; }
.grid3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; margin:20px 0; }
.card { border:1px solid var(--mid); border-top:5px solid var(--blue); background:#fff; padding:18px; }
.card.green { border-top-color:var(--green); }
.card.red { border-top-color:var(--red); }
.card.purple { border-top-color:var(--purple); }
.card.yellow { border-top-color:var(--yellow); }
.card h3 { margin-top:0; }
.diagram, .callout { margin:24px 0; padding:18px; background:var(--light); border:1px solid var(--mid); overflow:auto; }
.workflow { display:grid; gap:10px; margin:22px 0; }
.step { display:grid; grid-template-columns:72px minmax(0,1fr); border:1px solid var(--mid); background:#fff; }
.num { display:grid; place-items:center; background:var(--blue); color:#fff; font-weight:700; font-size:22px; }
.step-body { padding:14px 16px; }
.step-body strong { display:block; font-size:20px; }
.source-panel { border:1px solid var(--mid); margin:24px 0; background:#fff; box-shadow:0 4px 18px rgba(11,12,12,.08); }
.source-head { display:flex; justify-content:space-between; gap:16px; align-items:start; padding:16px 18px; border-top:6px solid var(--blue); border-bottom:1px solid var(--mid); background:#fafafa; }
.source-head h3 { margin:0 0 6px; }
.source-head p { margin:0; font-size:16px; color:var(--grey); }
.source-panel.mode .source-head { border-top-color:var(--blue); }
.source-panel.role .source-head { border-top-color:var(--green); }
.source-panel.reference .source-head { border-top-color:var(--red); }
.source-panel.contract .source-head { border-top-color:var(--yellow); }
.source-panel.grader .source-head { border-top-color:var(--purple); }
.source-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr); }
.source-grid pre { margin:0; border:0; border-right:1px solid var(--mid); max-height:560px; overflow:auto; }
.source-grid aside { padding:18px; background:var(--light); }
pre { margin:16px 0 24px; padding:16px; background:#1e1e1e; color:#f8f8f8; overflow:auto; font-size:15px; line-height:1.45; tab-size:2; border-left:6px solid var(--blue); }
code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.94em; background:var(--light); padding:1px 4px; }
pre code { background:transparent; color:inherit; padding:0; }
.pill { display:inline-block; padding:3px 8px; background:var(--black); color:#fff; font-size:13px; font-weight:700; text-transform:uppercase; white-space:nowrap; }
.tok-comment { color:#7d8790; font-style:italic; }
.tok-tag,.tok-key { color:#86d1ff; }
.tok-attr,.tok-number { color:#ffd580; }
.tok-string { color:#b7f7b5; }
.tok-keyword { color:#ff9bd2; }
.site-footer { background:var(--light); border-top:1px solid var(--mid); }
.site-footer__inner { max-width:var(--max); margin:0 auto; padding:32px 24px; color:var(--grey); font-size:16px; }
@media (max-width:1020px) { .layout,.source-grid,.grid3 { grid-template-columns:1fr; } .side-nav { position:static; } .meta-inner { grid-template-columns:1fr 1fr; } .source-grid pre { border-right:0; border-bottom:1px solid var(--mid); } }
@media (max-width:640px) { .meta-inner { grid-template-columns:1fr; } }
`;
}

function nav(items, label = 'Contents') {
	return `<nav class="side-nav" aria-label="${escapeHtml(label)}"><h2>${escapeHtml(label)}</h2><ol>${items.map((item) => `<li><a href="${escapeHtml(item.href)}"${item.current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a></li>`).join('')}</ol></nav>`;
}

function chrome({ title, product, lede, meta, navHtml, body, footer }) {
	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(title)}</title>
	<style>${styles()}</style>
</head>
<body>
	<a class="skip-link" href="#main">Skip to main content</a>
	<header class="site-header"><div class="site-header__inner"><p class="site-header__product">${escapeHtml(product)}</p><h1>${escapeHtml(title)}</h1><p class="site-header__lede">${escapeHtml(lede)}</p></div></header>
	<div class="meta"><div class="meta-inner">${meta.map((item) => `<div><strong>${escapeHtml(item.label)}</strong>${escapeHtml(item.value)}</div>`).join('')}</div></div>
	<div class="layout">
		${navHtml}
		<main id="main">${body}</main>
	</div>
	<footer class="site-footer"><div class="site-footer__inner">${escapeHtml(footer)}</div></footer>
</body>
</html>
`;
}

function sourcePanel(file, bundle) {
	if (!file.content) return '';
	const note = annotation(file.relativePath, file.content);
	const pill = family(file.relativePath);
	const panelClass = pill === 'source' ? 'source' : pill;
	const summary = note.how[0] || purposeFromContent(file.relativePath, file.content);
	return `<article class="source-panel ${escapeHtml(panelClass)}" id="${escapeHtml(slug(file.relativePath))}">
	<div class="source-head">
		<div>
			<h3><code>${escapeHtml(file.relativePath)}</code></h3>
			<p>${escapeHtml(summary)}</p>
		</div>
		<span class="pill">${escapeHtml(pill)}</span>
	</div>
	<div class="source-grid">
		<pre><code>${highlight(file.content, file.relativePath)}</code></pre>
		<aside class="notes">
			<h4>How the agent uses this file</h4>
			${note.how.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
			<h4>What to look for</h4>
			<ul>${quotedList(note.look)}</ul>
		</aside>
	</div>
</article>`;
}

function purposeFromContent(relativePath, source) {
	return annotation(relativePath, source).how[0];
}

function cardClass(category) {
	return {
		modes: 'green',
		roles: 'green',
		references: 'red',
		contracts: 'yellow',
		graders: 'purple',
		templates: '',
		scripts: '',
		examples: ''
	}[category] || '';
}

function categoryCards(categories, prefix = 'source/') {
	return `<div class="grid3">${categories.map((category) => {
		const copy = FAMILY_COPY[category];
		const href = `${prefix}${category}/`;
		const klass = cardClass(category);
		return `<article class="card ${klass}"><h3><a href="${escapeHtml(href)}">${escapeHtml(copy.title)}</a></h3><p>${escapeHtml(copy.card)}</p><p><a href="${escapeHtml(href)}">View ${escapeHtml(copy.title.toLowerCase())} panels</a></p></article>`;
	}).join('')}</div>`;
}

function simpleDiagram() {
	return `<div class="diagram" role="img" aria-label="Visual model of how source files interact">
<svg viewBox="0 0 980 260" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#1d70b8"/></marker></defs>
<rect x="40" y="80" width="150" height="70" fill="#fff" stroke="#0b0c0c" stroke-width="2"/><text x="115" y="122" text-anchor="middle" font-size="16" font-weight="700">prompt spec</text>
<rect x="250" y="80" width="150" height="70" fill="#fff" stroke="#1d70b8" stroke-width="3"/><text x="325" y="112" text-anchor="middle" font-size="16" font-weight="700">mode</text><text x="325" y="134" text-anchor="middle" font-size="12">workflow route</text>
<rect x="460" y="80" width="150" height="70" fill="#fff" stroke="#00703c" stroke-width="3"/><text x="535" y="112" text-anchor="middle" font-size="16" font-weight="700">role</text><text x="535" y="134" text-anchor="middle" font-size="12">expert lens</text>
<rect x="670" y="80" width="150" height="70" fill="#fff" stroke="#4c2c92" stroke-width="3"/><text x="745" y="112" text-anchor="middle" font-size="16" font-weight="700">grader</text><text x="745" y="134" text-anchor="middle" font-size="12">quality proof</text>
<line x1="190" y1="115" x2="250" y2="115" stroke="#1d70b8" stroke-width="3" marker-end="url(#arrow)"/><line x1="400" y1="115" x2="460" y2="115" stroke="#1d70b8" stroke-width="3" marker-end="url(#arrow)"/><line x1="610" y1="115" x2="670" y2="115" stroke="#1d70b8" stroke-width="3" marker-end="url(#arrow)"/>
</svg>
</div>`;
}

function findFile(files, relativePath) {
	return files.find((file) => file.relativePath === relativePath);
}

function panelsFor(files, bundle, paths) {
	return paths.map((relativePath) => findFile(files, relativePath)).filter(Boolean).map((file) => sourcePanel(file, bundle)).join('\n');
}

function overviewPage({ bundle, files, categories }) {
	const rootPaths = files.filter((file) => fileCategory(file.relativePath) === 'root').map((file) => file.relativePath);
	const coveragePaths = rootPaths.filter((relativePath) => !['README.md', 'prompt.spec.yaml', 'prompt.body.xml'].includes(relativePath));
	const mutationPath = 'references/github-tooling-mutation-policy.xml';

	const body = `
<section id="purpose">
	<h2>Purpose</h2>
	<p class="lede2">The GitHub Diamond bundle is not a prompt. It is a repository-governance machine. The files are small parts that interlock: modes decide the workflow, roles apply judgement, references supply policy, contracts define evidence, templates scaffold artefacts, graders score quality, and scripts verify reality.</p>
	<div class="grid3">
		<div class="card green"><h3>Mode = route</h3><p>Modes are task-specific runbooks. They tell the agent what to do, what to produce, and what failure states block completion.</p></div>
		<div class="card purple"><h3>Grader = judge</h3><p>Graders define thresholds, evidence requirements, scoring criteria and blocking failures.</p></div>
		<div class="card red"><h3>Script = proof</h3><p>Scripts execute validation. They keep the bundle from becoming confident prose without evidence.</p></div>
	</div>
	${panelsFor(files, bundle, ['README.md'])}
</section>
<section id="how-to-read">
	<h2>How to read the bundle</h2>
	${simpleDiagram()}
	<div class="workflow">
		<div class="step"><div class="num">1</div><div class="step-body"><strong>Prompt spec loads the map</strong>The YAML tells the agent which modules exist and which assets must be assembled.</div></div>
		<div class="step"><div class="num">2</div><div class="step-body"><strong>Prompt body defines doctrine</strong>The XML states principles, mandatory sequence, branch rules, mutation policy and refusal rules.</div></div>
		<div class="step"><div class="num">3</div><div class="step-body"><strong>Mode selects the workflow</strong>A task becomes discovery, instantiation, build, fix, review, security, release, conformance, docs or archive.</div></div>
	</div>
	${panelsFor(files, bundle, ['prompt.body.xml'])}
</section>
<section id="prompt-spec">
	<h2>Prompt spec</h2>
	<p>The prompt spec is the manifest. It does not do the work. It tells the agent which files make up the work system.</p>
	${panelsFor(files, bundle, ['prompt.spec.yaml', 'variables.schema.json', 'grade.schema.json', 'output.schema.json'])}
</section>
<section id="mutation">
	<h2>Mutation policy</h2>
	<p>This reference exists because repository-edit tooling can damage a repository if the agent replaces whole files or creates trees incorrectly.</p>
	${panelsFor(files, bundle, [mutationPath])}
</section>
<section id="source">
	<h2>Source panels</h2>
	<p class="lede2">This is the gateway into the source reference area. The overview page stays narrative. The category pages show the complete source panels for each family.</p>
	${categoryCards(categories)}
	${panelsFor(files, bundle, ['template-registry.yaml'])}
</section>
<section id="worked-flow">
	<h2>Worked flow</h2>
	<div class="callout"><p><strong>Prompt to PR-ready evidence.</strong> A user task selects a mode, applies roles, consults references, produces evidence, validates against contracts, then passes or fails through graders and scripts.</p></div>
	<pre><code>${escapeHtml(`Prompt:
"Fix the CI failure on this PR and address the Codex review thread."

Mode:
repo-fix + repo-review

Required source modules:
- modes/repo-fix.xml
- modes/repo-review.xml
- roles/developer.xml
- roles/qa.xml
- references/github-tooling-mutation-policy.xml
- contracts/pull-request-contract.schema.json
- contracts/agent-evidence.schema.json
- graders/code-confidence-grader.xml
- graders/pr-readiness-grader.xml
- scripts/validate-agent-evidence.py
- scripts/verify-repository-state.py`)}</code></pre>
</section>
<section id="coverage">
	<h2>Coverage note</h2>
	<p>This section explains the bundle-level files that control inventory, release history, validation status, tests and evaluation. These are part of the overview because they explain whether the bundle is coherent as a whole.</p>
	${panelsFor(files, bundle, coveragePaths)}
</section>`;

	return chrome({
		title: 'How the GitHub bundle works',
		product: 'ResearchOps · GitHub Diamond bundle',
		lede: 'A visual operating manual for the highest-precedence repository governance bundle. It explains how agents instantiate, maintain, review, release and audit GitHub repositories using contracts, modes, graders, templates, evidence and release gates.',
		meta: [
			{ label: 'Bundle', value: 'GitHub Diamond Standard' },
			{ label: 'Version', value: '2.9.2' },
			{ label: 'Canonical path', value: '.agent-operating-model/bundles/github/' },
			{ label: 'Generated', value: new Date().toISOString().slice(0, 10) }
		],
		navHtml: nav([
			{ href: '#purpose', label: 'Purpose' },
			{ href: '#how-to-read', label: 'How to read the bundle' },
			{ href: '#prompt-spec', label: 'Prompt spec' },
			{ href: '#mutation', label: 'Mutation policy' },
			{ href: '#source', label: 'Source panels' },
			{ href: '#worked-flow', label: 'Worked flow' },
			{ href: '#coverage', label: 'Coverage note' }
		]),
		body,
		footer: 'GitHub Diamond bundle annotated source guide. Generated for ResearchOps.'
	});
}

function sourceHubPage({ bundle, categories }) {
	const body = `
<nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="../index.html">GitHub bundle</a><span>Source panels</span></nav>
<section>
	<h2>Source panels</h2>
	<p class="lede2">The source hub starts the reference area. Use it to move from the overview into complete family pages for modes, roles, references, contracts, graders, templates, scripts and examples.</p>
	${categoryCards(categories, '')}
</section>`;

	return chrome({
		title: 'Source panels',
		product: `ResearchOps · ${bundleTitle(bundle)}`,
		lede: 'Generated category pages with complete source panels for the canonical bundle files.',
		meta: [
			{ label: 'Bundle', value: 'GitHub Diamond Standard' },
			{ label: 'Navigation', value: 'Source families' },
			{ label: 'Canonical path', value: `.agent-operating-model/bundles/${bundle}/` },
			{ label: 'Generated', value: new Date().toISOString().slice(0, 10) }
		],
		navHtml: nav([{ href: 'index.html', label: 'Source overview', current: true }, ...categories.map((category) => ({ href: `${category}/`, label: familyTitle(category) }))], 'Source panels'),
		body,
		footer: 'Generated source panels for the GitHub Diamond bundle.'
	});
}

function categoryPage({ bundle, category, files, categories }) {
	const title = `${familyTitle(category)} source panels`;
	const sourcePanels = files.map((file) => sourcePanel(file, bundle)).join('\n');

	const body = `
<nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="../../index.html">GitHub bundle</a><span><a href="../index.html">Source panels</a></span><span>${escapeHtml(familyTitle(category))}</span></nav>
<section>
	<h2>${escapeHtml(title)}</h2>
	<p class="lede2">${escapeHtml(FAMILY_COPY[category]?.lede || 'Complete source panels for this family.')}</p>
	${sourcePanels}
</section>`;

	return chrome({
		title,
		product: `ResearchOps · ${bundleTitle(bundle)}`,
		lede: `Complete annotated source panels for ${familyTitle(category).toLowerCase()} files.`,
		meta: [
			{ label: 'Bundle', value: 'GitHub Diamond Standard' },
			{ label: 'Family', value: familyTitle(category) },
			{ label: 'Canonical path', value: `.agent-operating-model/bundles/${bundle}/${category}/` },
			{ label: 'Generated', value: new Date().toISOString().slice(0, 10) }
		],
		navHtml: nav([{ href: '../index.html', label: 'Source overview' }, ...categories.map((item) => ({ href: item === category ? './' : `../${item}/`, label: familyTitle(item), current: item === category }))], 'Source panels'),
		body,
		footer: 'Generated source panels for the GitHub Diamond bundle.'
	});
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const root = process.cwd();
	const sourceDirectory = path.resolve(root, options.sourceRoot, options.bundle);
	const docsDirectory = path.resolve(root, options.docsRoot, options.bundle);
	const sourceOutputDirectory = path.join(docsDirectory, 'source');

	if (!(await stat(sourceDirectory).catch(() => null))?.isDirectory()) {
		throw new Error(`Source bundle directory not found: ${normalise(path.relative(root, sourceDirectory))}`);
	}

	const discovered = await walk(sourceDirectory);
	const files = [];

	for (const file of discovered) {
		const buffer = await readFile(file.absolutePath);
		if (!isText(file, buffer)) continue;
		files.push({ ...file, content: buffer.toString('utf8'), bytes: buffer.byteLength });
	}

	const grouped = new Map();
	for (const file of files) {
		const category = fileCategory(file.relativePath);
		if (SOURCE_FAMILIES.includes(category)) {
			if (!grouped.has(category)) grouped.set(category, []);
			grouped.get(category).push(file);
		}
	}

	const categories = SOURCE_FAMILIES.filter((category) => grouped.has(category));

	if (!options.dryRun) {
		await rm(sourceOutputDirectory, { recursive: true, force: true });
		await mkdir(sourceOutputDirectory, { recursive: true });

		await writeFile(path.join(docsDirectory, 'index.html'), overviewPage({ bundle: options.bundle, files, categories }), 'utf8');
		await writeFile(path.join(sourceOutputDirectory, 'index.html'), sourceHubPage({ bundle: options.bundle, categories }), 'utf8');

		for (const category of categories) {
			const categoryDirectory = path.join(sourceOutputDirectory, category);
			await mkdir(categoryDirectory, { recursive: true });
			await writeFile(path.join(categoryDirectory, 'index.html'), categoryPage({ bundle: options.bundle, category, files: grouped.get(category), categories }), 'utf8');
		}

		const pages = ['index.html', 'source/index.html', ...categories.map((category) => `source/${category}/index.html`)];
		await writeFile(path.join(sourceOutputDirectory, 'source-metadata.json'), `${JSON.stringify({
			siteId: `${options.bundle}-bundle-source-panels`,
			generatedAt: new Date().toISOString(),
			bundle: options.bundle,
			canonicalSourcePath: `.agent-operating-model/bundles/${options.bundle}/`,
			pages,
			fileCount: files.length,
			sourceFamilies: categories
		}, null, 2)}\n`, 'utf8');

		if (await stat(path.join(sourceOutputDirectory, 'bundle-root')).catch(() => null)) {
			throw new Error('Invalid generated output: source/bundle-root must not exist.');
		}
	}

	console.log(`Generated prototype-aligned source panels for ${options.bundle}: ${files.length} files, ${categories.length} source families.`);
	if (options.dryRun) console.log('Dry run only. No files were written.');
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
