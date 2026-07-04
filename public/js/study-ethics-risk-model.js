/**
 * @file public/js/study-ethics-risk-model.js
 * @module study-ethics-risk-model
 * @summary Shared local preview model for study ethics and research risk outcomes.
 */

function asSet(values = []) {
	return new Set(Array.isArray(values) ? values : []);
}

function hasAny(values, needles) {
	const set = asSet(values);
	return needles.some(needle => set.has(needle));
}

const SOURCEBOOK_CLAUSES = {
	"GOVERN 2.1.1": {
		id: "GOVERN 2.1.1",
		title: "Complete governance triage before participant contact",
		href: "/pages/sourcebook/governance/#govern-2-1-1"
	},
	"GOVERN 2.1.2": {
		id: "GOVERN 2.1.2",
		title: "Record the method and participant risk rationale",
		href: "/pages/sourcebook/governance/#govern-2-1-2"
	},
	"GOVERN 2.1.3": {
		id: "GOVERN 2.1.3",
		title: "Escalate uncertainty early",
		href: "/pages/sourcebook/governance/#govern-2-1-3"
	},
	"GOVERN 3.1.2": {
		id: "GOVERN 3.1.2",
		title: "Review high-risk ethics and safeguarding before approval",
		href: "/pages/sourcebook/governance/#govern-3-1-2"
	},
	"GOVERN 4.1.1": {
		id: "GOVERN 4.1.1",
		title: "Define data handling before collection",
		href: "/pages/sourcebook/governance/#govern-4-1-1"
	},
	"ENVIRO 1.1.2": {
		id: "ENVIRO 1.1.2",
		title: "Assess the setting before research starts",
		href: "/pages/sourcebook/environment/#enviro-1-1-2"
	},
	"ENVIRO 5.1.1": {
		id: "ENVIRO 5.1.1",
		title: "Complete fieldwork risk planning",
		href: "/pages/sourcebook/environment/#enviro-5-1-1"
	},
	"ENVIRO 6.1.1": {
		id: "ENVIRO 6.1.1",
		title: "Plan safety for people running research",
		href: "/pages/sourcebook/environment/#enviro-6-1-1"
	},
	"ENVIRO 6.1.2": {
		id: "ENVIRO 6.1.2",
		title: "Match support to session risk",
		href: "/pages/sourcebook/environment/#enviro-6-1-2"
	},
	"REC-ADMN 1.1.2": {
		id: "REC-ADMN 1.1.2",
		title: "Classify recruitment support before outreach starts",
		href: "/pages/sourcebook/recruitment-and-administration/#rec-admn-1-1-2"
	},
	"REC-ADMN 3.1.1": {
		id: "REC-ADMN 3.1.1",
		title: "Record informed consent before research participation",
		href: "/pages/sourcebook/recruitment-and-administration/#rec-admn-3-1-1"
	}
};

const BASE_SOURCEBOOK_CLAUSE_IDS = ["GOVERN 2.1.1", "GOVERN 2.1.2", "REC-ADMN 3.1.1"];

function sourcebookClausesFromIds(ids = []) {
	return [...new Set(ids)].map(id => SOURCEBOOK_CLAUSES[id]).filter(Boolean);
}

function addRiskTrigger(triggers, controls, trigger) {
	triggers.push({
		family: trigger.family,
		label: trigger.label,
		level: trigger.level,
		reason: trigger.reason,
		clauseIds: Array.isArray(trigger.clauseIds) ? trigger.clauseIds : []
	});
	if (trigger.control) controls.push(trigger.control);
}

function highestRiskRoute(level) {
	if (level >= 4) {
		return {
			route: "ethics-board-submission-likely",
			status: "blocked",
			statusLabel: "Ethics submission likely needed",
			readinessState: "Pause before recruitment",
			ready: false,
			summary: "This study has triggers that are likely to need formal ethics or governance approval before recruitment or fieldwork.",
			nextAction: "Do not recruit participants until the formal ethics or governance route has been recorded."
		};
	}
	if (level >= 3) {
		return {
			route: "ethics-advice-required",
			status: "blocked",
			statusLabel: "Ethics advice needed",
			readinessState: "Ethics advice needed",
			ready: false,
			summary: "This study has sensitive or uncertain triggers. Record ethics or governance advice before recruitment or fieldwork.",
			nextAction: "Get advice from the ethics, safeguarding or governance route before inviting participants."
		};
	}
	if (level >= 2) {
		return {
			route: "sensitive-research-controls",
			status: "attention",
			statusLabel: "Extra controls needed",
			readinessState: "Extra controls needed",
			ready: false,
			summary: "This study can continue when the required controls are recorded and reflected in the study materials.",
			nextAction: "Record the controls in the study materials before recruitment or fieldwork starts."
		};
	}
	if (level >= 1) {
		return {
			route: "managed-risk",
			status: "ready",
			statusLabel: "Managed research risk",
			readinessState: "Ready",
			ready: true,
			summary: "This study has manageable research risk. Continue with the recorded controls.",
			nextAction: "Continue with standard consent, privacy and data handling controls."
		};
	}
	return {
		route: "standard-controls",
		status: "ready",
		statusLabel: "Standard controls apply",
		readinessState: "Ready",
		ready: true,
		summary: "No material ethical risk triggers were identified from these answers. Continue with standard consent, privacy and data handling controls.",
		nextAction: "Continue with standard consent, privacy and data handling controls."
	};
}

export function requiredEthicsRiskGroups(answers = {}) {
	const participants = Array.isArray(answers.participants) ? answers.participants : [];
	const topics = Array.isArray(answers.topics) ? answers.topics : [];
	const setting = Array.isArray(answers.setting) ? answers.setting : [];
	const data = Array.isArray(answers.data) ? answers.data : [];
	const researcherSupport = Array.isArray(answers.researcherSupport) ? answers.researcherSupport : [];
	const recruitment = String(answers.recruitment || "");
	return [
		{
			id: "participants",
			label: "Who may take part?",
			complete: participants.length > 0,
			href: "#ethics-participants"
		},
		{
			id: "topics",
			label: "What topics might come up?",
			complete: topics.length > 0,
			href: "#ethics-topics"
		},
		{
			id: "setting",
			label: "Where will research happen?",
			complete: setting.length > 0,
			href: "#ethics-setting"
		},
		{
			id: "data",
			label: "What data may be seen or collected?",
			complete: data.length > 0,
			href: "#ethics-data"
		},
		{
			id: "recruitment",
			label: "How will people be invited?",
			complete: Boolean(recruitment),
			href: "#ethics-recruitment"
		},
		{
			id: "researcherSupport",
			label: "What researcher support may be needed?",
			complete: researcherSupport.length > 0,
			href: "#ethics-researcher-support"
		}
	];
}

export function evaluateStudyEthicsRisk(answers = {}, metadata = {}) {
	const participants = Array.isArray(answers.participants) ? answers.participants : [];
	const topics = Array.isArray(answers.topics) ? answers.topics : [];
	const setting = Array.isArray(answers.setting) ? answers.setting : [];
	const data = Array.isArray(answers.data) ? answers.data : [];
	const researcherSupport = Array.isArray(answers.researcherSupport) ? answers.researcherSupport : [];
	const activeResearcherSupport = researcherSupport.filter(value => value !== "no-additional-support");
	const recruitment = String(answers.recruitment || "");
	const started = Boolean(
		participants.length ||
		topics.length ||
		setting.length ||
		data.length ||
		researcherSupport.length ||
		recruitment
	);

	if (!started) {
		return {
			started: false,
			ready: false,
			status: "not-started",
			title: "Risk check not started",
			statusLabel: "Action needed",
			readinessState: "Action needed",
			route: "not-assessed",
			summary: "Complete the ethics and research risk questions before recruitment, fieldwork or participant sessions begin.",
			triggers: [],
			controls: ["Record the study risk outcome."],
			nextAction: "Complete the risk discovery questions.",
			missingGroups: requiredEthicsRiskGroups({}),
			sourcebookClauses: sourcebookClausesFromIds(["GOVERN 2.1.1"]),
			answers: {},
			savedAt: ""
		};
	}

	const missingGroups = requiredEthicsRiskGroups({
		participants,
		topics,
		setting,
		data,
		recruitment,
		researcherSupport
	}).filter(group => !group.complete);
	const hasMinimumAnswers = missingGroups.length === 0;

	if (!hasMinimumAnswers) {
		return {
			started,
			ready: false,
			status: "not-started",
			title: "Risk assessment incomplete",
			statusLabel: "Action needed",
			readinessState: "Action needed",
			route: "incomplete-assessment",
			summary: "Answer all required ethics and research risk questions before recording the study risk outcome.",
			triggers: [],
			controls: ["Answer the required risk discovery questions."],
			nextAction: "Complete the missing risk discovery questions.",
			missingGroups,
			sourcebookClauses: sourcebookClausesFromIds(["GOVERN 2.1.1"]),
			answers: { participants, topics, setting, data, recruitment, researcherSupport },
			savedAt: metadata.savedAt || ""
		};
	}

	const triggers = [];
	const controls = [];
	let level = 0;
	const raise = trigger => {
		level = Math.max(level, trigger.level);
		addRiskTrigger(triggers, controls, trigger);
	};

	if (hasAny(participants, ["children", "custody-detention"])) {
		raise({
			family: "Participants",
			label: "Direct research with people who need formal protection",
			level: 4,
			reason: "The participant group may need specialist approval before any approach.",
			control: "Pause recruitment and record the formal ethics or governance route.",
			clauseIds: ["GOVERN 3.1.2", "GOVERN 2.1.3"]
		});
	}
	if (hasAny(participants, ["service-users", "higher-risk-circumstances"])) {
		raise({
			family: "Participants",
			label: "Participants may be vulnerable, dependent on a service or under pressure",
			level: 3,
			reason: "Consent, distress and service-dependency risks need human review.",
			control: "Record ethics or governance advice before inviting participants.",
			clauseIds: ["GOVERN 3.1.2", "GOVERN 2.1.2"]
		});
	}
	if (hasAny(topics, ["trauma-harm", "crime-enforcement", "health-finance-housing", "identity-discrimination"])) {
		raise({
			family: "Topics",
			label: "Sensitive or distressing topics may come up",
			level: hasAny(topics, ["trauma-harm", "crime-enforcement"]) ? 3 : 2,
			reason: "Participants may disclose harm, distress or legally sensitive information.",
			control: "Add a distress, safeguarding and escalation route before recruitment.",
			clauseIds: ["GOVERN 3.1.2", "GOVERN 2.1.3", "ENVIRO 6.1.2"]
		});
	}
	if (hasAny(setting, ["participant-home-public", "unknown"])) {
		raise({
			family: "Setting",
			label: "Research setting is uncontrolled or not confirmed",
			level: 3,
			reason: "Privacy, safety, access and emergency controls are not yet reliable.",
			control: "Confirm the research setting, host, privacy conditions and stop criteria.",
			clauseIds: ["ENVIRO 1.1.2", "ENVIRO 5.1.1"]
		});
	}
	if (hasAny(setting, ["operational-frontline"])) {
		raise({
			family: "Setting",
			label: "Operational or frontline setting",
			level: 2,
			reason: "The study may expose operational pressure, non-participants or live service work.",
			control: "Record local site controls and how sessions will pause if operational conditions change.",
			clauseIds: ["ENVIRO 1.1.2", "ENVIRO 5.1.1"]
		});
	}
	if (hasAny(data, ["special-category", "criminal-safeguarding", "live-service-data"])) {
		raise({
			family: "Data",
			label: "Sensitive, live or legally protected data may be seen",
			level: hasAny(data, ["criminal-safeguarding"]) ? 3 : 2,
			reason: "The study needs data minimisation and explicit handling controls.",
			control: "Record the data minimisation, redaction, storage and access controls.",
			clauseIds: ["GOVERN 4.1.1", "GOVERN 3.1.2"]
		});
	}
	if (hasAny(data, ["recording-capture"])) {
		raise({
			family: "Data capture",
			label: "Recording, screenshots or screen share are planned",
			level: 2,
			reason: "Capture can preserve sensitive or third-party information beyond the session.",
			control: "Confirm recording consent, withdrawal route, retention period and non-participant exclusion.",
			clauseIds: ["REC-ADMN 3.1.1", "GOVERN 4.1.1"]
		});
	}
	if (recruitment === "manager-gatekeeper" || recruitment === "not-sure") {
		raise({
			family: "Recruitment",
			label: recruitment === "not-sure" ? "Recruitment route is not confirmed" : "Manager or gatekeeper-mediated recruitment",
			level: recruitment === "not-sure" ? 3 : 2,
			reason: "Participants may feel unable to decline or may not understand who will see responses.",
			control: "Record voluntary participation wording and confirm managers will not know who declined or what individuals said.",
			clauseIds: ["REC-ADMN 1.1.2", "REC-ADMN 3.1.1", "GOVERN 2.1.2"]
		});
	}
	if (activeResearcherSupport.length) {
		raise({
			family: "Researcher safety",
			label: "Researcher safety or support controls may be needed",
			level: hasAny(activeResearcherSupport, ["no-escalation-route"]) ? 3 : 2,
			reason: "The study may expose researchers to safety, distress or escalation risk.",
			control: "Record the researcher support, debrief, supervision and escalation arrangements.",
			clauseIds: ["ENVIRO 6.1.1", "ENVIRO 6.1.2"]
		});
	}
	if (level === 0 && hasAny(participants, ["professional-users"])) {
		raise({
			family: "Participants",
			label: "Professional-user research",
			level: 1,
			reason: "Standard workplace research controls still apply.",
			control: "Use standard consent, privacy and data handling controls.",
			clauseIds: ["GOVERN 2.1.2", "REC-ADMN 3.1.1"]
		});
	}

	const route = highestRiskRoute(level);
	const sourcebookClauseIds = [
		...BASE_SOURCEBOOK_CLAUSE_IDS,
		...triggers.flatMap(trigger => trigger.clauseIds || [])
	];
	return {
		started,
		...route,
		triggers,
		controls: [...new Set(controls)],
		missingGroups: [],
		sourcebookClauses: sourcebookClausesFromIds(sourcebookClauseIds),
		answers: { participants, topics, setting, data, recruitment, researcherSupport },
		savedAt: metadata.savedAt || "",
		recordedBy: metadata.recordedBy || ""
	};
}

export function ethicsRiskStorageKey(studyId) {
	return `researchops:study-ethics-risk:${studyId}`;
}

export function loadStudyEthicsRisk(studyId) {
	if (!studyId) return evaluateStudyEthicsRisk({});
	try {
		const saved = JSON.parse(window.localStorage.getItem(ethicsRiskStorageKey(studyId)) || "null");
		if (saved?.answers) {
			return evaluateStudyEthicsRisk(saved.answers, {
				savedAt: saved.savedAt,
				recordedBy: saved.recordedBy
			});
		}
	} catch {
		// Ignore malformed local preview state and require the researcher to re-record the outcome.
	}
	return evaluateStudyEthicsRisk({});
}

export async function loadSeededStudyEthicsRisk(studyId) {
	if (!studyId) return evaluateStudyEthicsRisk({});
	const localOutcome = loadStudyEthicsRisk(studyId);
	if (localOutcome.started) return localOutcome;
	try {
		const url = new URL("/api/study-ethics-risk", window.location.origin);
		url.searchParams.set("study", studyId);
		const response = await fetch(url.toString(), {
			cache: "no-store",
			credentials: "include",
			headers: { Accept: "application/json" }
		});
		const body = await response.json();
		if (!response.ok || body?.ok === false || !body?.ethicsRisk?.answers) {
			return localOutcome;
		}
		return evaluateStudyEthicsRisk(body.ethicsRisk.answers, {
			savedAt: body.ethicsRisk.savedAt,
			recordedBy: body.ethicsRisk.recordedBy
		});
	} catch {
		return localOutcome;
	}
}

export function studyEthicsRiskRecord(studyId, outcome, metadata = {}) {
	return {
		studyId,
		answers: outcome.answers || {},
		outcome: {
			route: outcome.route,
			status: outcome.status,
			title: outcome.title,
			statusLabel: outcome.statusLabel,
			readinessState: outcome.readinessState,
			ready: outcome.ready,
			summary: outcome.summary,
			nextAction: outcome.nextAction,
			triggers: outcome.triggers || [],
			controls: outcome.controls || [],
			sourcebookClauses: outcome.sourcebookClauses || [],
			missingGroups: outcome.missingGroups || []
		},
		savedAt: metadata.savedAt || outcome.savedAt || new Date().toISOString(),
		recordedBy: metadata.recordedBy || outcome.recordedBy || "Local preview user"
	};
}

async function persistStudyEthicsRiskRecord(record) {
	try {
		const response = await fetch("/api/study-ethics-risk", {
			method: "POST",
			cache: "no-store",
			credentials: "include",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json"
			},
			body: JSON.stringify(record)
		});
		if (!response.ok) return false;
		const body = await response.json();
		return body?.ok !== false;
	} catch {
		return false;
	}
}

export function saveStudyEthicsRisk(studyId, answers) {
	const savedAt = new Date().toISOString();
	const outcome = evaluateStudyEthicsRisk(answers, {
		savedAt,
		recordedBy: "Local preview user"
	});
	if (!studyId) return outcome;
	const payload = studyEthicsRiskRecord(studyId, outcome, { savedAt });
	window.localStorage.setItem(ethicsRiskStorageKey(studyId), JSON.stringify(payload));
	return outcome;
}

export async function recordStudyEthicsRisk(studyId, answers) {
	const outcome = saveStudyEthicsRisk(studyId, answers);
	if (!studyId || !outcome.started || outcome.route === "incomplete-assessment") return outcome;
	const record = studyEthicsRiskRecord(studyId, outcome);
	const persisted = await persistStudyEthicsRiskRecord(record);
	return {
		...outcome,
		persisted
	};
}

export function clearStudyEthicsRisk(studyId) {
	if (!studyId) return evaluateStudyEthicsRisk({});
	window.localStorage.removeItem(ethicsRiskStorageKey(studyId));
	return evaluateStudyEthicsRisk({});
}
