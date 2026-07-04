/**
 * @file public/js/study-ethics-risk-next-steps-page.js
 * @module study-ethics-risk-next-steps-page
 * @summary Renders route-specific next steps after a study ethics risk assessment.
 */

import {
	loadSeededStudyEthicsRisk,
	loadStudyEthicsRiskNextSteps,
	saveStudyEthicsRiskNextSteps
} from "./study-ethics-risk-model.js?v=study-ethics-risk-20260704-2";
import {
	linkedProjectIdForStudy,
	loadProjectById,
	loadStudyById,
	resolveStudyContextFromUrl,
	route,
	studyTitle
} from "./study-route-context.js";

const $ = (selector, root = document) => root.querySelector(selector);
let currentStudyId = "";
let currentWorkflowKey = "";
let currentContext = null;
let currentOutcome = {};
let currentSubmissionStepId = "";

const ethicsSubmissionRoute = "ethics-board-submission-likely";

const routeSlaWorkingDays = {
	"ethics-advice-required": 5,
	"sensitive-research-controls": 3,
	"ethics-board-submission-likely": 20
};

const workflowDefinitions = {
	"ethics-advice-required": {
		key: "ethics-advice",
		route: "ethics-advice-required",
		title: "Ethics advice needed",
		tag: "Ethics advice needed",
		tagClass: "govuk-tag--yellow",
		summary: "Use this workflow to prepare the question and send the saved risk context to the right research lead or governance contact before recruitment or fieldwork.",
		actionTitle: "Request ethics advice",
		actionIntro: "Prepare the advice question. ResearchOps will route it to the right research lead or governance contact using the project setup.",
		ownerLabel: "Owner of the next action",
		reviewerLabel: "Reviewer or approver",
		requestLabel: "Advice question",
		decisionLabel: "Advice response and conditions",
		showReviewerContext: true,
		showDecisionField: false,
		saveStatus: "advice-requested",
		reviewDateLabel: "Expected advice review date",
		statusOptions: [
			{ value: "question-prepared", text: "Advice question prepared" },
			{ value: "advice-requested", text: "Advice request sent" },
			{ value: "advice-received", text: "Advice response recorded" },
			{ value: "conditions-applied", text: "Advice conditions applied to the study" }
		],
		tasks: [
			{
				id: "question-prepared",
				title: "Prepare the ethics advice question",
				hint: "Summarise the study method, participants, sensitive triggers and the specific decision you need.",
				completeStatuses: ["question-prepared", "advice-requested", "advice-received", "conditions-applied"]
			},
			{
				id: "advice-requested",
				title: "Notify the lead or governance contact",
				hint: "Record who needs to be notified and send the advice question with the saved risk context.",
				completeStatuses: ["advice-requested", "advice-received", "conditions-applied"]
			},
			{
				id: "advice-received",
				title: "Record the advice response",
				hint: "After reviewers respond, record who gave advice, what route was recommended and any conditions.",
				completeStatuses: ["advice-received", "conditions-applied"]
			},
			{
				id: "conditions-applied",
				title: "Update the study before recruitment",
				hint: "Apply any advice to the study plan, participant materials and session controls before inviting people.",
				completeStatuses: ["conditions-applied"]
			}
		],
		evidenceIntro: "Keep enough evidence to show what advice was requested and what conditions apply.",
		evidence: [
			{ id: "risk-assessment", text: "Risk assessment outcome" },
			{ id: "triage-outcome", text: "Triage outcome" },
			{ id: "advice-request", text: "Advice request or question" },
			{ id: "ethics-response", text: "Ethics, safeguarding or governance response" },
			{ id: "updated-controls", text: "Updated study controls and participant materials" }
		]
	},
	"sensitive-research-controls": {
		key: "extra-controls",
		route: "sensitive-research-controls",
		title: "Extra controls needed",
		tag: "Extra controls needed",
		tagClass: "govuk-tag--yellow",
		summary: "Use this workflow to convert sensitive research triggers into controls before recruitment or fieldwork.",
		actionTitle: "Record extra study controls",
		actionIntro: "Turn each sensitive research trigger into a named control, confirm the accountable route, then check the control is reflected in study materials.",
		ownerLabel: "Owner of the next action",
		reviewerLabel: "Reviewer or approver",
		requestLabel: "Controls to add",
		decisionLabel: "Control decision, conditions or implementation note",
		saveStatus: "controls-identified",
		reviewDateLabel: "Expected controls review date",
		statusOptions: [
			{ value: "controls-identified", text: "Controls identified for each trigger" },
			{ value: "materials-updated", text: "Study materials updated" },
			{ value: "support-confirmed", text: "Support and escalation route confirmed" },
			{ value: "controls-implemented", text: "Controls implemented and visible to the team" }
		],
		tasks: [
			{
				id: "controls-identified",
				title: "Turn each trigger into a control",
				hint: "Record the control for distress, safeguarding, privacy, recruitment pressure, data handling or researcher support.",
				completeStatuses: ["controls-identified", "materials-updated", "support-confirmed", "controls-implemented"]
			},
			{
				id: "materials-updated",
				title: "Update study materials",
				hint: "Make sure consent forms, recruitment wording and the discussion guide reflect the controls.",
				completeStatuses: ["materials-updated", "support-confirmed", "controls-implemented"]
			},
			{
				id: "support-confirmed",
				title: "Confirm the support and escalation route",
				hint: "Check who will support the researcher and what happens if a session needs to pause or stop.",
				completeStatuses: ["support-confirmed", "controls-implemented"]
			},
			{
				id: "controls-implemented",
				title: "Record controls before sessions",
				hint: "Treat the study as not ready until the controls are recorded and visible to the team.",
				completeStatuses: ["controls-implemented"]
			}
		],
		evidenceIntro: "Keep evidence that the controls exist and are reflected in the study materials.",
		evidence: [
			{ id: "risk-assessment", text: "Risk assessment outcome" },
			{ id: "triage-outcome", text: "Triage outcome" },
			{ id: "control-log", text: "Control log or study plan update" },
			{ id: "updated-materials", text: "Updated consent, recruitment and guide materials" },
			{ id: "support-route", text: "Researcher support or escalation route" }
		]
	},
	"ethics-board-submission-likely": {
		key: "ethics-submission",
		route: "ethics-board-submission-likely",
		title: "Ethics submission needed",
		tag: "Ethics submission needed",
		tagClass: "govuk-tag--red",
		summary: "Use this workflow to pause fieldwork, complete the full ethics submission and record the board route before any participant contact.",
		actionTitle: "Complete full ethics submission",
		actionIntro: "Keep recruitment and fieldwork paused while the formal ethics submission is completed and submitted through the required route.",
		ownerLabel: "Owner of the next action",
		reviewerLabel: "Reviewer or approver",
		requestLabel: "Submission overview",
		decisionLabel: "Board response and conditions",
		showReviewerContext: true,
		showDecisionField: false,
		saveStatus: "submission-drafted",
		reviewDateLabel: "Expected submission review date",
		statusOptions: [
			{ value: "recruitment-paused", text: "Recruitment and fieldwork paused" },
			{ value: "submission-drafted", text: "Full ethics submission drafted" },
			{ value: "attachments-ready", text: "Supporting evidence attached" },
			{ value: "submitted", text: "Submission sent" },
			{ value: "approved", text: "Board decision recorded" },
			{ value: "approved-with-conditions", text: "Board conditions recorded" },
			{ value: "resubmission-needed", text: "Resubmission needed" },
			{ value: "rejected", text: "Not approved" }
		],
		tasks: [
			{
				id: "recruitment-paused",
				title: "Pause recruitment and fieldwork",
				hint: "Do not invite participants or begin sessions while the formal route is unresolved.",
				completeStatuses: ["recruitment-paused", "submission-drafted", "attachments-ready", "submitted", "approved", "approved-with-conditions", "resubmission-needed", "rejected"]
			},
			{
				id: "submission-drafted",
				title: "Complete the full ethics submission",
				hint: "Set out the project details, research background, method, participants, consent, risks, safeguards, data handling and outputs.",
				completeStatuses: ["submission-drafted", "attachments-ready", "submitted", "approved", "approved-with-conditions", "resubmission-needed", "rejected"]
			},
			{
				id: "attachments-ready",
				title: "Attach supporting evidence",
				hint: "Include the risk assessment, participant information, consent material, research materials and any local site risk assessment.",
				completeStatuses: ["attachments-ready", "submitted", "approved", "approved-with-conditions", "resubmission-needed", "rejected"]
			},
			{
				id: "submitted",
				title: "Submit through the required route",
				hint: "Use the departmental ethics, governance or assurance route and keep a record of the submission.",
				completeStatuses: ["submitted", "approved", "approved-with-conditions", "resubmission-needed", "rejected"]
			},
			{
				id: "approved",
				title: "Record the board response",
				hint: "Record the outcome, conditions, expiry or review points before the study can move back towards readiness.",
				completeStatuses: ["approved", "approved-with-conditions"]
			}
		],
		evidenceIntro: "Keep the evidence needed to show what was submitted, how it was reviewed and what conditions apply.",
		evidence: [
			{ id: "risk-assessment", text: "Risk assessment outcome" },
			{ id: "triage-outcome", text: "Triage outcome" },
			{ id: "full-ethics-submission", text: "Full ethics submission" },
			{ id: "supporting-evidence", text: "Participant materials, research materials and local risk evidence" },
			{ id: "board-response", text: "Board response and conditions" },
			{ id: "approval-material-updates", text: "Updated study materials reflecting board conditions" }
		],
		submissionFields: [
			{
				id: "project-details",
				label: "Project details and research team",
				hint: "Name the project, researchers, accountable lead, proposed dates and whether senior review has happened.",
				inputLabel: "Add missing project, researcher or senior review information",
				inputHint: "Use this only if the generated project details are incomplete or wrong.",
				rows: 4
			},
			{
				id: "submission-criteria",
				label: "Why this needs ethics board review",
				hint: "Explain the sensitive research triggers, participant groups, setting, data exposure or researcher safety risks that require submission.",
				inputLabel: "Add any reason for board review not already covered",
				inputHint: "Include only submission criteria that are not shown in the saved risk route, sensitive triggers or Sourcebook clauses.",
				rows: 5
			},
			{
				id: "background-objectives",
				label: "Research background and objectives",
				hint: "Summarise the service context, users, research questions and what would happen if the research was not done.",
				inputLabel: "Add missing background, objective or impact information",
				inputHint: "Add anything the ethics board needs to understand why the research is needed.",
				rows: 6
			},
			{
				id: "research-design",
				label: "Research design and methods",
				hint: "Describe the methods, session structure, analysis approach and why the methods are appropriate.",
				inputLabel: "Add missing method, session or analysis information",
				inputHint: "Add method detail only if it is not already captured in the study setup or discussion guide.",
				rows: 6
			},
			{
				id: "participants-recruitment",
				label: "Participants, sampling and recruitment",
				hint: "Describe who will take part, why they are needed, how they will be recruited and how pressure to participate will be avoided.",
				inputLabel: "Add missing participant, sampling or recruitment information",
				inputHint: "Include any participant group, sample, access need or recruitment-pressure detail that is not already recorded.",
				rows: 6
			},
			{
				id: "consent",
				label: "Consent and participant information",
				hint: "Explain consent choices, information sheets, withdrawal, recording, observers and how informed consent will be checked during the study.",
				inputLabel: "Add missing consent or participant information details",
				inputHint: "Add only consent choices, withdrawal limits, recording arrangements or observer details not covered by the consent materials.",
				rows: 6
			},
			{
				id: "setting-risks",
				label: "Setting and in-person risks",
				hint: "Record remote, fieldwork or site risks, local risk assessments, host arrangements, stop conditions and safe arrival or departure controls.",
				inputLabel: "Add missing setting, site or travel risk information",
				inputHint: "Add local site controls, host arrangements or stop conditions that are not already in the risk assessment.",
				rows: 6
			},
			{
				id: "participant-safeguards",
				label: "Participant risks and safeguards",
				hint: "Explain potential distress, safeguarding, legal, operational or power-dynamic risks and the controls that reduce them.",
				inputLabel: "Add missing participant safeguard information",
				inputHint: "Add safeguards for distress, safeguarding, legal risk, pressure to participate or operational sensitivity only where they are not already recorded.",
				rows: 6
			},
			{
				id: "researcher-safety",
				label: "Researcher safety and support",
				hint: "Explain exposure to distressing material, lone working, fatigue, debriefing, supervision and escalation routes.",
				inputLabel: "Add missing researcher safety or support information",
				inputHint: "Add supervision, debriefing, lone-working, travel or escalation controls not already recorded.",
				rows: 6
			},
			{
				id: "data-handling",
				label: "Data collection, storage and privacy",
				hint: "Record what data will be collected, why it is needed, how it will be stored, retention, deletion and how identification risks will be reduced.",
				inputLabel: "Add missing data collection, storage or privacy information",
				inputHint: "Add any data format, retention, deletion, access or identification-risk detail not already recorded.",
				rows: 6
			},
			{
				id: "outputs-sharing",
				label: "Findings and restricted sharing",
				hint: "Explain who will see findings, what outputs will be produced and when access must be restricted.",
				inputLabel: "Add missing findings or sharing restrictions",
				inputHint: "Add any restricted audience, redaction or sharing condition that is not already in the study record.",
				rows: 5
			},
			{
				id: "attachments",
				label: "Attachments and evidence",
				hint: "List the information sheet, consent form, research materials, risk assessment, signposting or local site evidence that will be attached.",
				inputLabel: "Add missing attachments or evidence",
				inputHint: "List only materials that still need to be added to the submission pack.",
				rows: 4
			}
		]
	},
	"default": {
		key: "complete-assessment",
		route: "not-assessed",
		title: "Complete the risk assessment first",
		tag: "Action needed",
		tagClass: "govuk-tag--yellow",
		summary: "The next-steps workflow starts after the ethics and research risk assessment has been recorded.",
		actionTitle: "Complete the risk assessment",
		actionIntro: "Return to the assessment page and record the ethics and research risk outcome.",
		ownerLabel: "Who owns this action?",
		reviewerLabel: "Reviewer or approver",
		requestLabel: "Action note",
		decisionLabel: "Decision or conditions",
		reviewDateLabel: "Review date",
		statusOptions: [{ value: "assessment-needed", text: "Risk assessment needs to be completed" }],
		tasks: [
			{
				id: "assessment-needed",
				title: "Complete the ethics and research risk assessment",
				hint: "Answer the risk discovery questions and record the study risk outcome.",
				completeStatuses: []
			}
		],
		evidenceIntro: "No escalation evidence is needed until an assessment outcome has been recorded.",
		evidence: [
			{ id: "risk-assessment", text: "Risk assessment outcome" },
			{ id: "triage-outcome", text: "Triage outcome" }
		],
		routeStateSummary: "Risk assessment needs to be completed."
	},
	"ready": {
		key: "no-escalation",
		route: "ready",
		title: "No ethics escalation required",
		tag: "No escalation required",
		tagClass: "govuk-tag--green",
		summary: "The recorded risk assessment does not require a dedicated ethics escalation workflow. Continue with the standard study setup controls.",
		actionTitle: "Return to study readiness",
		actionIntro: "No route-specific escalation is needed. Continue with standard Sourcebook evidence and study setup controls.",
		ownerLabel: "Who owns this action?",
		reviewerLabel: "Reviewer or approver",
		requestLabel: "Action note",
		decisionLabel: "Decision or conditions",
		reviewDateLabel: "Review date",
		statusOptions: [{ value: "no-escalation", text: "No escalation required" }],
		tasks: [
			{
				id: "no-escalation",
				title: "Return to study readiness",
				hint: "Continue with standard consent, privacy, data handling and session controls.",
				completeStatuses: ["no-escalation"]
			}
		],
		evidenceIntro: "Keep the standard Sourcebook evidence record for study readiness.",
		evidence: [
			{ id: "risk-assessment", text: "Risk assessment outcome" },
			{ id: "triage-outcome", text: "Triage outcome" },
			{ id: "standard-controls", text: "Standard consent and data handling controls" }
		],
		routeStateSummary: "No dedicated ethics escalation route is required."
	}
};

function projectTitle(project = {}) {
	const safeProject = project || {};
	return (
		safeProject.name ||
		safeProject.Name ||
		safeProject.title ||
		safeProject.Title ||
		safeProject.projectName ||
		safeProject.ProjectName ||
		safeProject["Project name"] ||
		safeProject["Project Name"] ||
		"Project"
	);
}

function setText(selector, value) {
	const element = $(selector);
	if (element) element.textContent = value || "—";
}

function statusLabel(workflow, statusValue = "") {
	return workflow.statusOptions.find(option => option.value === statusValue)?.text || "Not recorded";
}

function parseMaybeJson(value) {
	if (!value || typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function stakeholderList(context = {}) {
	const project = context.project || {};
	const study = context.study || {};
	const candidates = [
		project.stakeholders,
		project.Stakeholders,
		project.projectStakeholders,
		project["Project stakeholders"],
		study.stakeholders,
		study.Stakeholders
	]
		.map(parseMaybeJson)
		.filter(Boolean);
	for (const candidate of candidates) {
		if (Array.isArray(candidate)) return candidate.filter(item => item && typeof item === "object");
	}
	return [];
}

function personLabel(person = {}) {
	if (!person) return "";
	const name = person.name || person.Name || person.fullName || person["Full name"] || "";
	const role = person.role || person.Role || person.title || person.Title || "";
	if (name && role) return `${name} (${role})`;
	return name || role || "";
}

function findStakeholder(context, rolePattern) {
	return stakeholderList(context).find(person => rolePattern.test(String(person.role || person.Role || person.title || person.Title || "")));
}

function projectLeadLabel(context = {}) {
	const project = context.project || {};
	return (
		project.lead_researcher ||
		project.leadResearcher ||
		project.researchLead ||
		project["Lead researcher"] ||
		project["Lead Researcher"] ||
		""
	);
}

function workflowOwnership(workflow, context = {}) {
	const owner =
		findStakeholder(context, /(senior|principal|lead).*(user )?researcher|lead ur|principal ur|senior ur/i) ||
		findStakeholder(context, /(user )?researcher/i);
	const reviewer =
		findStakeholder(context, /principal|lead|governance|ethics|research operations|approver|reviewer/i) ||
		null;
	const ownerText = personLabel(owner) || projectLeadLabel(context) || "Research Operations";
	const reviewerText = personLabel(reviewer) || (workflow.route === "ethics-board-submission-likely" ? "Ethics board or governance approver" : "Research Operations");
	return {
		owner: ownerText,
		reviewer: reviewerText
	};
}

function addWorkingDays(date, days) {
	const result = new Date(date);
	let remaining = Number(days) || 0;
	while (remaining > 0) {
		result.setDate(result.getDate() + 1);
		const day = result.getDay();
		if (day !== 0 && day !== 6) remaining -= 1;
	}
	return result;
}

function reviewDateForWorkflow(workflow, baseDate = new Date()) {
	const days = routeSlaWorkingDays[workflow.route];
	if (!days) return "";
	return addWorkingDays(baseDate, days).toISOString().slice(0, 10);
}

function formatStoredDate(value) {
	if (!value) return "Calculated after the checkpoint record is saved.";
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric"
	}).format(date);
}

function formatStoredDateTime(value) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}

function evidenceIdsForStatus(workflow, status) {
	const base = ["risk-assessment", "triage-outcome"];
	if (!status) return base.filter(id => workflow.evidence.some(evidence => evidence.id === id));
	const statusIndex = workflow.statusOptions.findIndex(option => option.value === status);
	if (statusIndex < 0) return base.filter(id => workflow.evidence.some(evidence => evidence.id === id));
	const required = new Set(base);
	if (workflow.route === "ethics-advice-required") {
		if (statusIndex >= 0) required.add("advice-request");
		if (statusIndex >= 2) required.add("ethics-response");
		if (statusIndex >= 3) required.add("updated-controls");
	}
	if (workflow.route === "sensitive-research-controls") {
		if (statusIndex >= 0) required.add("control-log");
		if (statusIndex >= 1) required.add("updated-materials");
		if (statusIndex >= 2) required.add("support-route");
	}
		if (workflow.route === "ethics-board-submission-likely") {
			if (statusIndex >= 1) required.add("full-ethics-submission");
			if (statusIndex >= 2) required.add("supporting-evidence");
			if (statusIndex >= 4) required.add("board-response");
			if (["approved-with-conditions", "resubmission-needed", "rejected"].includes(status)) required.add("approval-material-updates");
		}
	return [...required].filter(id => workflow.evidence.some(evidence => evidence.id === id));
}

function sourcebookClauseMarkup(clauses = []) {
	if (!clauses.length) return document.createTextNode("No Sourcebook clauses mapped.");
	const list = document.createElement("ul");
	list.className = "govuk-list study-ethics-risk-sourcebook-list";
	clauses.forEach(clause => {
		const item = document.createElement("li");
		const link = document.createElement("a");
		link.className = "govuk-link";
		link.href = clause.href;
		link.textContent = clause.id;
		item.append(link, `: ${clause.title}`);
		list.append(item);
	});
	return list;
}

function contextTextList(items = [], fallback) {
	if (!items.length) return document.createTextNode(fallback);
	const list = document.createElement("ul");
	list.className = "govuk-list govuk-list--bullet study-ethics-next-steps-context-list";
	items.forEach(item => {
		const listItem = document.createElement("li");
		if (item.family) {
			const family = document.createElement("span");
			family.className = "study-ethics-next-steps-context-family";
			family.textContent = `${item.family}:`;
			listItem.append(family, " ");
		}
		listItem.append(document.createTextNode(item.label || item));
		list.append(listItem);
	});
	return list;
}

function plainTextList(items = []) {
	return items.map(item => {
		if (typeof item === "string") return item;
		if (item?.family && item?.label) return `${item.family}: ${item.label}`;
		return item?.label || "";
	}).filter(Boolean);
}

function studyDescription(context = {}) {
	const study = context.study || {};
	return (
		study.description ||
		study.Description ||
		study.summary ||
		study.Summary ||
		study.objective ||
		study.Objective ||
		"Study description has not been recorded in ResearchOps."
	);
}

function studyMethod(context = {}) {
	const study = context.study || {};
	return study.method || study.Method || study.studyMethod || study["Study method"] || "Study method has not been recorded in ResearchOps.";
}

function generatedSubmissionContent(field, outcome = {}, context = {}) {
	const ownership = workflowOwnership({ route: ethicsSubmissionRoute }, context);
	const projectName = projectTitle(context.project || {});
	const title = studyTitle(context.study || {});
	const triggers = plainTextList(outcome.triggers || []);
	const controls = plainTextList(outcome.controls || []);
	const clauses = (outcome.sourcebookClauses || []).map(clause => `${clause.id}: ${clause.title}`);
	const linesByField = {
		"project-details": [
			`Project: ${projectName}`,
			`Study: ${title}`,
			`Owner of the next action: ${ownership.owner}`,
			`Reviewer or approver: ${ownership.reviewer}`,
			"Submission type: determined from ResearchOps submission history."
		],
		"submission-criteria": [
			`Risk route: ${workflowDefinitions[ethicsSubmissionRoute].title}`,
			...triggers.map(trigger => `Sensitive research trigger: ${trigger}`),
			...clauses.map(clause => `Sourcebook clause: ${clause}`)
		],
		"background-objectives": [
			`Study context: ${studyDescription(context)}`,
			`Risk rationale: ${outcome.summary || workflowDefinitions[ethicsSubmissionRoute].summary}`
		],
		"research-design": [
			`Method: ${studyMethod(context)}`,
			"ResearchOps will include saved discussion guide and study setup information where available."
		],
		"participants-recruitment": [
			"ResearchOps will include the participant group, sample size and recruitment route from the study setup where available.",
			...triggers.filter(trigger => /^Participants:/i.test(trigger)).map(trigger => `Participant trigger: ${trigger}`)
		],
		consent: [
			"ResearchOps will include the current participant information sheet and consent form version.",
			"Consent controls from the saved risk assessment will be included where available."
		],
		"setting-risks": [
			"ResearchOps will include the recorded research setting, fieldwork route and local risk evidence where available.",
			...triggers.filter(trigger => /^Setting:/i.test(trigger)).map(trigger => `Setting trigger: ${trigger}`)
		],
		"participant-safeguards": [
			...triggers.filter(trigger => /^(Participants|Topics):/i.test(trigger)).map(trigger => `Relevant trigger: ${trigger}`),
			...controls.map(control => `Recorded control: ${control}`)
		],
		"researcher-safety": [
			...triggers.filter(trigger => /^Researcher safety:/i.test(trigger)).map(trigger => `Researcher safety trigger: ${trigger}`),
			...controls.map(control => `Recorded control: ${control}`)
		],
		"data-handling": [
			...triggers.filter(trigger => /^Data:/i.test(trigger)).map(trigger => `Data trigger: ${trigger}`),
			"ResearchOps will include the recorded data collection, retention and access controls where available."
		],
		"outputs-sharing": [
			"ResearchOps will include sharing restrictions from the study setup and risk assessment where available.",
			"Outputs should not include raw participant data or unnecessary operational detail."
		],
		attachments: [
			"ResearchOps will attach available information sheets, consent forms, discussion guides, recruitment material and saved risk evidence.",
			"Any missing local site risk assessment or specialist evidence should be added before submission."
		]
	};
	const lines = (linesByField[field.id] || []).filter(Boolean);
	return lines.length ? lines : [field.hint || "ResearchOps will include available project, study and risk assessment evidence."];
}

function lineSuggestsMissingSubmissionInformation(line = "") {
	return /\b(has not been recorded|where available|missing|not available|needs to be added)\b/i.test(String(line));
}

function sectionNeedsResearcherInput(field, generatedLines = [], savedValue = "") {
	if (!field?.inputLabel) return false;
	if (savedValue) return true;
	return generatedLines.some(lineSuggestsMissingSubmissionInformation);
}

function normaliseSubmissionRecord(workflow, record = null) {
	const firstStep = workflow.submissionFields?.[0]?.id || "";
	const source = record && record.route === workflow.route ? record : {};
	const sections = source.submissionSections && typeof source.submissionSections === "object" ? source.submissionSections : {};
	const sectionStates = source.submissionSectionStates && typeof source.submissionSectionStates === "object" ? source.submissionSectionStates : {};
	const version = Number(source.submissionVersion) || 1;
	return {
		...source,
		route: workflow.route,
		workflow: workflow.key,
		status: source.status || "submission-draft",
		submissionStatus: source.submissionStatus || "draft",
		submissionType: source.submissionType || (version > 1 ? "Resubmission" : "New submission"),
		submissionVersion: version,
		activeSubmissionStep: source.activeSubmissionStep || firstStep,
		submissionSections: sections,
		submissionSectionStates: sectionStates,
		submissionHistory: Array.isArray(source.submissionHistory) ? source.submissionHistory : [],
		evidenceIds: Array.isArray(source.evidenceIds) ? source.evidenceIds : evidenceIdsForStatus(workflow, source.status || "submission-draft")
	};
}

function savedSubmissionCount(workflow, record) {
	const states = record?.submissionSectionStates || {};
	return (workflow.submissionFields || []).filter(field => states[field.id] === "saved").length;
}

function currentSubmissionField(workflow, record) {
	const fields = workflow.submissionFields || [];
	const activeId = currentSubmissionStepId || record.activeSubmissionStep || fields[0]?.id || "";
	const index = Math.max(0, fields.findIndex(field => field.id === activeId));
	return {
		fields,
		field: fields[index] || fields[0],
		index
	};
}

function submissionStepErrorText(field) {
	if (field?.errorText) return field.errorText;
	if (field?.inputLabel) {
		return field.inputLabel
			.replace(/^Add missing /, "Enter the missing ")
			.replace(/^Add any /, "Enter any ")
			.replace(/^Add /, "Enter ")
			.replace(/^Provide /, "Enter ");
	}
	return "Enter the missing information for this section";
}

function clearSubmissionStepError() {
	const summary = $("#ethics-submission-step-error-summary");
	const inputGroup = $("#ethics-submission-step-input-group");
	const input = $("#ethics-submission-step-input");
	const error = $("#ethics-submission-step-input-error");
	if (summary) summary.hidden = true;
	inputGroup?.classList.remove("govuk-form-group--error");
	input?.classList.remove("govuk-textarea--error");
	if (error) {
		error.hidden = true;
		error.replaceChildren();
	}
	if (input) input.setAttribute("aria-describedby", "ethics-submission-step-input-hint");
}

function setSubmissionStepError(message) {
	const summary = $("#ethics-submission-step-error-summary");
	const link = $("#ethics-submission-step-error-link");
	const inputGroup = $("#ethics-submission-step-input-group");
	const input = $("#ethics-submission-step-input");
	const error = $("#ethics-submission-step-input-error");
	if (summary) summary.hidden = false;
	if (link) link.textContent = message;
	if (error) {
		error.hidden = false;
		error.replaceChildren();
		const prefix = document.createElement("span");
		prefix.className = "govuk-visually-hidden";
		prefix.textContent = "Error:";
		error.append(prefix, " ", message);
	}
	inputGroup?.classList.add("govuk-form-group--error");
	input?.classList.add("govuk-textarea--error");
	if (input) input.setAttribute("aria-describedby", "ethics-submission-step-input-error ethics-submission-step-input-hint");
	summary?.focus();
}

function validateSubmissionStep(workflow, record) {
	const { field } = currentSubmissionField(workflow, record);
	if (!field) return true;
	const inputGroup = $("#ethics-submission-step-input-group");
	const input = $("#ethics-submission-step-input");
	const value = input?.value || "";
	const generatedLines = generatedSubmissionContent(field, currentOutcome, currentContext || {});
	const needsInput = inputGroup && !inputGroup.hidden && sectionNeedsResearcherInput(field, generatedLines, value);
	if (needsInput && !value.trim()) {
		setSubmissionStepError(submissionStepErrorText(field));
		return false;
	}
	clearSubmissionStepError();
	return true;
}

function submissionStepStatus(workflow, field, record) {
	const saved = record?.submissionSectionStates?.[field.id] === "saved";
	if (saved) return { text: "Saved", className: "govuk-tag--green" };
	if ((record?.activeSubmissionStep || workflow.submissionFields?.[0]?.id) === field.id) {
		return { text: "Current", className: "govuk-tag--yellow" };
	}
	return { text: "To\u00a0do", className: "govuk-tag--grey" };
}

function saveSubmissionRecord(workflow, patch = {}) {
	const existing = normaliseSubmissionRecord(workflow, loadStudyEthicsRiskNextSteps(currentStudyId));
	const payload = {
		...existing,
		...patch,
		workflow: workflow.key,
		route: workflow.route,
		owner: patch.owner || existing.owner || workflowOwnership(workflow, currentContext || {}).owner,
		reviewer: patch.reviewer || existing.reviewer || workflowOwnership(workflow, currentContext || {}).reviewer,
		reviewDate: patch.reviewDate || existing.reviewDate || reviewDateForWorkflow(workflow),
		evidenceIds: patch.evidenceIds || existing.evidenceIds || evidenceIdsForStatus(workflow, patch.status || existing.status)
	};
	return saveStudyEthicsRiskNextSteps(currentStudyId, payload);
}

function setSubmissionDocumentStatus(message = "", error = false) {
	const status = $("#ethics-submission-document-status");
	if (!status) return;
	status.textContent = message;
	status.classList.toggle("study-ethics-submission-document-status--error", Boolean(error));
}

function submissionDocumentSections(workflow, record, outcome = {}) {
	return (workflow.submissionFields || []).map(field => ({
		id: field.id,
		label: field.label,
		hint: field.hint,
		state: record.submissionSectionStates?.[field.id] || "",
		value: record.submissionSections?.[field.id] || "",
		generated: generatedSubmissionContent(field, outcome, currentContext || {})
	}));
}

function submissionDocumentPayload(workflow, record, outcome = {}) {
	const context = currentContext || {};
	const ownership = workflowOwnership(workflow, context);
	return {
		projectId: context.projectId || context.project?.id || "",
		projectName: projectTitle(context.project || {}),
		studyId: currentStudyId,
		studyTitle: studyTitle(context.study || {}),
		submission: {
			studyId: currentStudyId,
			route: workflow.route,
			status: "submitted",
			submissionStatus: "submitted",
			submissionType: record.submissionType,
			submissionVersion: record.submissionVersion,
			owner: record.owner || ownership.owner,
			reviewer: record.reviewer || ownership.reviewer,
			reviewDate: record.reviewDate || reviewDateForWorkflow(workflow)
		},
		riskOutcome: outcome,
		sections: submissionDocumentSections(workflow, record, outcome)
	};
}

async function createEthicsSubmissionDocument(workflow, record, outcome = {}) {
	const response = await fetch("/api/study-ethics-risk/submissions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-ResearchOps-CSRF": "1"
		},
		body: JSON.stringify(submissionDocumentPayload(workflow, record, outcome))
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok || body?.ok === false || !body?.document?.id) {
		throw new Error(body?.message || "The ethics submission document could not be generated.");
	}
	return body.document;
}

function renderSubmissionStepList(workflow, record) {
	const list = $("#ethics-submission-step-list");
	if (!list) return;
	list.replaceChildren(
		...(workflow.submissionFields || []).map((field, index) => {
			const item = document.createElement("li");
			item.className = "govuk-task-list__item govuk-task-list__item--with-link";
			const body = document.createElement("div");
			body.className = "govuk-task-list__name-and-hint";
			const link = document.createElement("a");
			link.className = "govuk-link govuk-task-list__link";
			link.href = "#ethics-submission-step-form";
			link.dataset.submissionStep = field.id;
			link.textContent = field.label;
			link.addEventListener("click", event => {
				event.preventDefault();
				clearSubmissionStepError();
				currentSubmissionStepId = field.id;
				const updated = saveSubmissionRecord(workflow, { activeSubmissionStep: field.id });
				renderSubmissionWorkflow(workflow, updated, currentOutcome);
				$("#ethics-submission-step-form")?.scrollIntoView({ block: "start" });
			});
			const hint = document.createElement("div");
			hint.className = "govuk-task-list__hint";
			hint.textContent = `Step ${index + 1} of ${workflow.submissionFields.length}. ${field.hint}`;
			body.append(link, hint);
			const statusWrap = document.createElement("div");
			statusWrap.className = "govuk-task-list__status";
			const status = document.createElement("strong");
			const statusInfo = submissionStepStatus(workflow, field, record);
			status.className = `govuk-tag ${statusInfo.className}`;
			status.textContent = statusInfo.text;
			statusWrap.append(status);
			item.append(body, statusWrap);
			return item;
		})
	);
}

function renderSubmissionStep(workflow, record, outcome = {}) {
	const { fields, field, index } = currentSubmissionField(workflow, record);
	if (!field) return;
	currentSubmissionStepId = field.id;
	clearSubmissionStepError();
	setText("#ethics-submission-step-caption", `Step ${index + 1} of ${fields.length}`);
	setText("#ethics-submission-step-title", field.label);
	setText("#ethics-submission-step-hint", field.hint);
	const generatedLines = generatedSubmissionContent(field, outcome, currentContext || {});
	const derived = $("#ethics-submission-step-derived");
	if (derived) {
		const list = document.createElement("ul");
		list.className = "govuk-list govuk-list--bullet";
		generatedLines.forEach(line => {
			const item = document.createElement("li");
			item.textContent = line;
			list.append(item);
		});
		derived.replaceChildren(list);
	}
	const savedValue = record.submissionSections?.[field.id] || "";
	const inputGroup = $("#ethics-submission-step-input-group");
	const needsInput = sectionNeedsResearcherInput(field, generatedLines, savedValue);
	if (inputGroup) inputGroup.hidden = !needsInput;
	setText("#ethics-submission-step-input-label", field.inputLabel || "Provide missing information for this section");
	setText("#ethics-submission-step-input-hint", field.inputHint || "Only add information needed for ethics board review. Do not include participant personal data.");
	const input = $("#ethics-submission-step-input");
	if (input) {
		input.rows = field.rows || 6;
		input.value = savedValue;
		input.setAttribute("aria-describedby", "ethics-submission-step-input-hint");
	}
}

function renderSubmissionHistory(record) {
	const list = $("#ethics-submission-history-list");
	const empty = $("#ethics-submission-history-empty");
	if (!list) return;
	const history = Array.isArray(record?.submissionHistory) ? record.submissionHistory : [];
	if (empty) empty.hidden = history.length > 0;
	list.replaceChildren(
		...history.map(item => {
			const entry = document.createElement("li");
			const title = document.createElement("span");
			title.className = "study-ethics-submission-history__title";
			title.textContent = `Version ${item.version}: ${item.status || "Submitted"}`;
			const meta = document.createElement("span");
			meta.className = "study-ethics-submission-history__meta";
			meta.textContent = item.submittedAt ? `Submitted ${formatStoredDateTime(item.submittedAt)}` : "Saved";
			entry.append(title, document.createElement("br"), meta);
			if (item.documentId) {
				const documentLink = document.createElement("a");
				documentLink.className = "govuk-link";
				documentLink.href = `/api/study-ethics-risk/submissions/${encodeURIComponent(item.documentId)}`;
				documentLink.textContent = "Download generated Word document";
				entry.append(document.createElement("br"), documentLink);
			}
			return entry;
		})
	);
}

function renderSubmissionWorkflow(workflow, sourceRecord, outcome = {}) {
	const container = $("#ethics-submission-workflow");
	if (!container) return;
	const record = normaliseSubmissionRecord(workflow, sourceRecord);
	const total = workflow.submissionFields?.length || 0;
	const savedCount = savedSubmissionCount(workflow, record);
	const submitted = record.submissionStatus === "submitted";
	container.hidden = false;
	setText("#ethics-submission-workflow-title", submitted ? `Ethics submission version ${record.submissionVersion} submitted` : `Prepare ethics submission version ${record.submissionVersion}`);
	setText("#ethics-submission-workflow-summary", submitted ? "This version has been submitted. Create a resubmission if the board asks for changes." : "Work through each section, save progress and return later if needed.");
	setText("#ethics-submission-type", record.submissionType);
	setText("#ethics-submission-version", `Version ${record.submissionVersion}`);
	setText("#ethics-submission-progress", `${savedCount} of ${total} sections saved.`);
	renderSubmissionStepList(workflow, record);
	renderSubmissionStep(workflow, record, outcome);
	renderSubmissionHistory(record);
	const submitPanel = $("#ethics-submission-submit-panel");
	if (submitPanel) submitPanel.hidden = savedCount < total;
	setText("#ethics-submission-submit-title", submitted ? "Create a resubmission" : "Submit this version");
	setText("#ethics-submission-submit-summary", submitted ? "Create a new draft version if the board asks for changes or a revised submission." : "Submit the saved ethics pack and attachments when every section is ready for board review.");
	const submitVersion = $("#ethics-submission-submit-version");
	if (submitVersion) submitVersion.hidden = submitted;
	const form = $("#ethics-submission-step-form");
	if (form) form.hidden = submitted;
	const createResubmission = $("#ethics-submission-create-resubmission");
	if (createResubmission) createResubmission.hidden = !submitted;
	const document = record.submissionDocument;
	setSubmissionDocumentStatus(document?.id ? "Generated Word document saved with this submission version." : "");
}

function hideSubmissionWorkflow() {
	const container = $("#ethics-submission-workflow");
	if (container) container.hidden = true;
}

function renderReviewerContext(workflow, outcome = {}) {
	const context = $("#ethics-next-step-review-context");
	if (!context) return;
	const shouldShow = Boolean(workflow.showReviewerContext);
	context.hidden = !shouldShow;
	if (!shouldShow) return;
	const triggers = $("#ethics-next-step-review-triggers");
	if (triggers) {
		triggers.replaceChildren(
			contextTextList(outcome.triggers || [], "No sensitive research triggers recorded.")
		);
	}
	const controls = $("#ethics-next-step-review-controls");
	if (controls) {
		controls.replaceChildren(
			contextTextList(outcome.controls || [], "No additional controls recorded.")
		);
	}
}

function renderSubmissionFields(workflow, record = {}) {
	const container = $("#ethics-next-step-submission-fields");
	if (!container) return;
	const fields = workflow.submissionFields || [];
	container.hidden = fields.length === 0;
	container.replaceChildren();
	if (!fields.length) return;
	const title = document.createElement("h3");
	title.className = "govuk-heading-s";
	title.textContent = "Full ethics submission";
	const intro = document.createElement("p");
	intro.className = "govuk-body";
	intro.textContent =
		"Complete the formal submission content using the saved risk assessment as context. Do not include participant personal data.";
	container.append(title, intro);
	fields.forEach(field => {
		const group = document.createElement("div");
		group.className = "govuk-form-group";
		const textareaId = `ethics-next-step-submission-${field.id}`;
		const label = document.createElement("label");
		label.className = "govuk-label govuk-label--s";
		label.htmlFor = textareaId;
		label.textContent = field.label;
		group.append(label);
		if (field.hint) {
			const hint = document.createElement("div");
			hint.className = "govuk-hint";
			hint.textContent = field.hint;
			group.append(hint);
		}
		const textarea = document.createElement("textarea");
		textarea.className = "govuk-textarea";
		textarea.id = textareaId;
		textarea.name = `nextStepSubmission-${field.id}`;
		textarea.rows = field.rows || 5;
		textarea.value = record?.submissionSections?.[field.id] || "";
		group.append(textarea);
		container.append(group);
	});
}

function submissionSectionsForWorkflow(workflow) {
	return Object.fromEntries(
		(workflow.submissionFields || []).map(field => [
			field.id,
			$(`#ethics-next-step-submission-${field.id}`)?.value || ""
		])
	);
}

function renderEvidenceList(selector, workflow, record) {
	const list = $(selector);
	if (!list) return;
	const captured = new Set(record?.evidenceIds || []);
	list.replaceChildren(
		...workflow.evidence.map(evidence => {
			const item = document.createElement("li");
			item.className = "study-ethics-next-steps-evidence__item";
			const label = document.createElement("span");
			label.textContent = evidence.text;
			const tag = document.createElement("strong");
			const present = captured.has(evidence.id);
			tag.className = `govuk-tag ${present ? "govuk-tag--green" : "govuk-tag--grey"} study-ethics-next-steps-evidence__tag`;
			tag.textContent = present ? "Recorded" : "Needed";
			item.append(label, tag);
			return item;
		})
	);
}

function groupedTriggers(triggers = []) {
	const groups = [];
	for (const trigger of triggers) {
		const family = trigger.family || "Other";
		let group = groups.find(item => item.family === family);
		if (!group) {
			group = { family, labels: [] };
			groups.push(group);
		}
		if (trigger.label) group.labels.push(trigger.label);
	}
	return groups;
}

function renderTriggerGroups(container, triggers = []) {
	if (!container) return;
	container.replaceChildren();
	const groups = groupedTriggers(triggers);
	if (!groups.length) {
		const empty = document.createElement("p");
		empty.className = "govuk-body";
		empty.textContent = "No sensitive research triggers recorded.";
		container.append(empty);
		return;
	}
	for (const group of groups) {
		const section = document.createElement("div");
		section.className = "study-ethics-risk-trigger-group";
		const heading = document.createElement("h4");
		heading.className = "govuk-heading-s study-ethics-risk-trigger-group__heading";
		heading.textContent = group.family;
		section.append(heading);
		if (group.labels.length === 1) {
			const value = document.createElement("p");
			value.className = "govuk-body-s";
			value.textContent = group.labels[0];
			section.append(value);
		} else {
			const list = document.createElement("ul");
			list.className = "govuk-list govuk-list--bullet govuk-!-margin-bottom-0";
			list.replaceChildren(
				...group.labels.map(label => {
					const item = document.createElement("li");
					item.textContent = label;
					return item;
				})
			);
			section.append(list);
		}
		container.append(section);
	}
}

function taskStatus(workflow, task, record) {
	const status = record?.route === workflow.route ? record.status : "";
	if (task.completeStatuses.includes(status)) return { text: "Completed", className: "govuk-tag--green" };
	if (!status && workflow.tasks[0]?.id === task.id) return { text: "Next", className: "govuk-tag--yellow" };
	const currentIndex = workflow.statusOptions.findIndex(option => option.value === status);
	const taskIndex = workflow.tasks.findIndex(item => item.id === task.id);
	if (currentIndex + 1 === taskIndex) return { text: "Next", className: "govuk-tag--yellow" };
	if (currentIndex >= taskIndex && currentIndex !== -1) return { text: "In progress", className: "govuk-tag--blue" };
	return { text: "To\u00a0do", className: "govuk-tag--grey" };
}

function renderTasks(workflow, record) {
	const list = $("#ethics-next-steps-list");
	if (!list) return;
	list.replaceChildren(
		...workflow.tasks.map(task => {
			const item = document.createElement("li");
			item.className = "govuk-task-list__item govuk-task-list__item--with-link";
			const body = document.createElement("div");
			body.className = "govuk-task-list__name-and-hint";
			const link = document.createElement("a");
			link.className = "govuk-link govuk-task-list__link";
			link.href = workflow.route === ethicsSubmissionRoute ? "#ethics-submission-workflow" : "#ethics-next-steps-action";
			link.textContent = task.title;
			const hint = document.createElement("div");
			hint.className = "govuk-task-list__hint";
			hint.textContent = task.hint;
			body.append(link, hint);
			const statusWrap = document.createElement("div");
			statusWrap.className = "govuk-task-list__status";
			const status = document.createElement("strong");
			const statusInfo = taskStatus(workflow, task, record);
			status.className = `govuk-tag ${statusInfo.className}`;
			status.textContent = statusInfo.text;
			statusWrap.append(status);
			item.append(body, statusWrap);
			return item;
		})
	);
}

function workflowForOutcome(outcome = {}) {
	if (!outcome.started || ["incomplete-assessment", "not-assessed", "not-recorded"].includes(outcome.route)) {
		return workflowDefinitions.default;
	}
	if (outcome.ready === true) return workflowDefinitions.ready;
	return workflowDefinitions[outcome.route] || workflowDefinitions.default;
}

function renderRecordedState(record) {
	const element = $("#ethics-next-steps-recorded-state");
	if (!element) return;
	if (!record?.savedAt) {
		element.replaceChildren(document.createTextNode("No checkpoint decision recorded yet."));
		return;
	}
	const date = new Date(record.savedAt);
	const formatted = Number.isNaN(date.getTime())
		? record.savedAt
		: new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(date);
	const items = [
		`Status: ${statusLabel(workflowDefinitions[record.route] || workflowDefinitions.default, record.status)}`,
		record.owner ? `Owner: ${record.owner}` : "",
		record.reviewer ? `Reviewer or route: ${record.reviewer}` : "",
		record.reviewDate ? `Review date: ${record.reviewDate}` : "",
		`Recorded ${formatted}`
	].filter(Boolean);
	element.replaceChildren(document.createTextNode(items.join(". ")));
}

function populateRecordForm(workflow, record, outcome = {}) {
	const form = $("#ethics-next-steps-form");
	if (!form) return;
	setText("#ethics-next-steps-action-title", workflow.actionTitle);
	setText("#ethics-next-steps-action-intro", workflow.actionIntro);
	if (workflow.route === ethicsSubmissionRoute) {
		const routeState = $("#ethics-next-step-route-state");
		if (routeState) routeState.hidden = true;
		form.hidden = true;
		renderSubmissionWorkflow(workflow, record, outcome);
		return;
	}
	hideSubmissionWorkflow();
	const canRecord = ![workflowDefinitions.default, workflowDefinitions.ready].includes(workflow);
	const routeState = $("#ethics-next-step-route-state");
	if (routeState) routeState.hidden = canRecord;
	setText("#ethics-next-step-route-state-summary", workflow.routeStateSummary || workflow.summary);
	setText("#ethics-next-step-owner-label", workflow.ownerLabel);
	setText("#ethics-next-step-reviewer-label", workflow.reviewerLabel);
	setText("#ethics-next-step-request-label", workflow.requestLabel);
	setText("#ethics-next-step-decision-label", workflow.decisionLabel);
	setText("#ethics-next-step-review-date-label", workflow.reviewDateLabel);
	form.dataset.workflowRoute = workflow.route;
	form.hidden = !canRecord;
	const ownership = workflowOwnership(workflow, currentContext || {});
	setText("#ethics-next-step-owner-value", record?.owner || ownership.owner);
	setText("#ethics-next-step-reviewer-value", record?.reviewer || ownership.reviewer);
	setText("#ethics-next-step-review-date-value", formatStoredDate(record?.reviewDate));
	const request = $("#ethics-next-step-request");
	if (request) request.value = record?.requestSummary || "";
	const decisionGroup = $("#ethics-next-step-decision-group");
	if (decisionGroup) decisionGroup.hidden = workflow.showDecisionField === false;
	const decision = $("#ethics-next-step-decision");
	if (decision) decision.value = record?.decisionSummary || "";
	renderReviewerContext(workflow, outcome);
	renderSubmissionFields(workflow, record);
}

function renderOutcome(outcome = {}) {
	currentOutcome = outcome;
	const workflow = workflowForOutcome(outcome);
	currentWorkflowKey = workflow.key;
	const record = loadStudyEthicsRiskNextSteps(currentStudyId);
	const routeRecord = record?.route === workflow.route ? record : null;
	setText("#ethics-next-steps-title", workflow.title);
	setText("#ethics-next-steps-summary", workflow.summary);
	setText("#ethics-next-steps-outcome-title", workflow.title);
	setText("#ethics-next-steps-outcome-summary", workflow.route === "not-assessed" ? outcome.summary || workflow.summary : workflow.summary);
	setText("#ethics-next-steps-evidence-intro", workflow.evidenceIntro);
	const tag = $("#ethics-next-steps-outcome-tag");
	if (tag) {
		tag.textContent = workflow.tag;
		tag.className = `govuk-tag ${workflow.tagClass}`;
	}

	const triggers = $("#ethics-next-steps-triggers");
	renderTriggerGroups(triggers, outcome.triggers || []);

	const clauses = $("#ethics-next-steps-sourcebook-clauses");
	if (clauses) clauses.replaceChildren(sourcebookClauseMarkup(outcome.sourcebookClauses || []));
	renderTasks(workflow, routeRecord);
	renderEvidenceList("#ethics-next-steps-evidence-list", workflow, routeRecord);
	renderRecordedState(routeRecord);
	populateRecordForm(workflow, routeRecord, outcome);
}

function bindRecordForm() {
	const form = $("#ethics-next-steps-form");
	if (!form) return;
	form.addEventListener("submit", event => {
		event.preventDefault();
		const routeKey = form.dataset.workflowRoute || "";
		const workflow = Object.values(workflowDefinitions).find(item => item.route === routeKey) || workflowDefinitions.default;
		const status = workflow.saveStatus || workflow.statusOptions[0]?.value || "";
		const ownership = workflowOwnership(workflow, currentContext || {});
		const reviewDate = reviewDateForWorkflow(workflow);
		const record = saveStudyEthicsRiskNextSteps(currentStudyId, {
			workflow: currentWorkflowKey,
			route: workflow.route,
			status,
			notificationRecipients: [],
			owner: ownership.owner,
			reviewer: ownership.reviewer,
			requestSummary: $("#ethics-next-step-request")?.value || "",
			submissionSections: submissionSectionsForWorkflow(workflow),
			decisionSummary: workflow.showDecisionField === false ? "" : $("#ethics-next-step-decision")?.value || "",
			reviewDate,
			evidenceIds: evidenceIdsForStatus(workflow, status)
		});
		renderTasks(workflow, record);
		renderEvidenceList("#ethics-next-steps-evidence-list", workflow, record);
		renderRecordedState(record);
		populateRecordForm(workflow, record, currentOutcome);
	});
}

function saveCurrentSubmissionStep(workflow, advance) {
	const record = normaliseSubmissionRecord(workflow, loadStudyEthicsRiskNextSteps(currentStudyId));
	const { fields, field, index } = currentSubmissionField(workflow, record);
	if (!field) return record;
	if (!validateSubmissionStep(workflow, record)) return null;
	const input = $("#ethics-submission-step-input");
	const submissionSections = {
		...(record.submissionSections || {}),
		[field.id]: input?.value || ""
	};
	const submissionSectionStates = {
		...(record.submissionSectionStates || {}),
		[field.id]: "saved"
	};
	const nextField = fields[Math.min(index + 1, fields.length - 1)];
	const saved = saveSubmissionRecord(workflow, {
		status: "submission-drafted",
		submissionStatus: "draft",
		activeSubmissionStep: advance && nextField ? nextField.id : field.id,
		submissionSections,
		submissionSectionStates,
		evidenceIds: evidenceIdsForStatus(workflow, "submission-drafted")
	});
	currentSubmissionStepId = saved?.activeSubmissionStep || field.id;
	return saved;
}

function bindSubmissionWorkflow() {
	const form = $("#ethics-submission-step-form");
	if (form) {
		form.addEventListener("submit", event => {
			event.preventDefault();
			const workflow = workflowDefinitions[ethicsSubmissionRoute];
			const record = saveCurrentSubmissionStep(workflow, true);
			if (!record) return;
			renderSubmissionWorkflow(workflow, record, currentOutcome);
		});
	}
	const saveLater = $("#ethics-submission-save-later");
	if (saveLater) {
		saveLater.addEventListener("click", () => {
			const workflow = workflowDefinitions[ethicsSubmissionRoute];
			const record = saveCurrentSubmissionStep(workflow, false);
			if (!record) return;
			renderSubmissionWorkflow(workflow, record, currentOutcome);
			renderRecordedState(record);
		});
	}
	const submitVersion = $("#ethics-submission-submit-version");
	if (submitVersion) {
		submitVersion.addEventListener("click", async () => {
			const workflow = workflowDefinitions[ethicsSubmissionRoute];
			const record = normaliseSubmissionRecord(workflow, loadStudyEthicsRiskNextSteps(currentStudyId));
			const submittedAt = new Date().toISOString();
			setSubmissionDocumentStatus("Generating and saving the Word submission document.");
			submitVersion.disabled = true;
			let documentRecord;
			try {
				documentRecord = await createEthicsSubmissionDocument(workflow, record, currentOutcome);
			} catch (error) {
				submitVersion.disabled = false;
				setSubmissionDocumentStatus(error?.message || "The ethics submission document could not be generated.", true);
				return;
			}
			const history = [
				...(record.submissionHistory || []),
				{
					version: record.submissionVersion,
					status: "Submitted to ethics board",
					submittedAt,
					documentId: documentRecord.id
				}
			];
			const saved = saveSubmissionRecord(workflow, {
				...record,
				status: "submitted",
				submissionStatus: "submitted",
				submittedAt,
				submissionDocument: documentRecord,
				submissionHistory: history,
				evidenceIds: evidenceIdsForStatus(workflow, "submitted")
			});
			submitVersion.disabled = false;
			setSubmissionDocumentStatus("Generated Word document saved with this submission version.");
			renderSubmissionWorkflow(workflow, saved, currentOutcome);
			renderTasks(workflow, saved);
			renderEvidenceList("#ethics-next-steps-evidence-list", workflow, saved);
			renderRecordedState(saved);
		});
	}
	const createResubmission = $("#ethics-submission-create-resubmission");
	if (createResubmission) {
		createResubmission.addEventListener("click", () => {
			const workflow = workflowDefinitions[ethicsSubmissionRoute];
			const record = normaliseSubmissionRecord(workflow, loadStudyEthicsRiskNextSteps(currentStudyId));
			const nextVersion = record.submissionVersion + 1;
			const saved = saveSubmissionRecord(workflow, {
				...record,
				status: "resubmission-needed",
				submissionStatus: "draft",
				submissionType: "Resubmission",
				submissionVersion: nextVersion,
				activeSubmissionStep: workflow.submissionFields?.[0]?.id || "",
				submissionSectionStates: {},
				evidenceIds: evidenceIdsForStatus(workflow, "resubmission-needed")
			});
			currentSubmissionStepId = saved?.activeSubmissionStep || "";
			renderSubmissionWorkflow(workflow, saved, currentOutcome);
			renderTasks(workflow, saved);
			renderEvidenceList("#ethics-next-steps-evidence-list", workflow, saved);
			renderRecordedState(saved);
		});
	}
}

function bindContext(context) {
	const projectName = projectTitle(context.project);
	const title = studyTitle(context.study || {});
	const studyHref = route("/pages/study/", { id: context.studyId, project: context.projectId });
	const riskHref = route("/pages/study/ethics-risk/", { id: context.studyId, project: context.projectId });
	currentContext = context;
	currentStudyId = context.studyId;

	const projectBreadcrumb = $("#breadcrumb-project");
	if (projectBreadcrumb) {
		projectBreadcrumb.href = route("/pages/project-dashboard/", { id: context.projectId });
		projectBreadcrumb.textContent = projectName;
	}
	const studyBreadcrumb = $("#breadcrumb-study");
	if (studyBreadcrumb) {
		studyBreadcrumb.href = studyHref;
		studyBreadcrumb.textContent = title;
	}
	const riskBreadcrumb = $("#breadcrumb-ethics-risk");
	if (riskBreadcrumb) riskBreadcrumb.href = riskHref;
	const backToRisk = $("#back-to-risk-assessment");
	if (backToRisk) backToRisk.href = riskHref;
	const backToStudy = $("#back-to-study");
	if (backToStudy) backToStudy.href = studyHref;
	setText("#study-eyebrow", title);
}

async function recoverStudyContextFromUrl(params) {
	const studyId = params.get("id") || params.get("sid") || "";
	if (!studyId) throw new Error("The page needs a Study record ID in the URL.");
	const study = await loadStudyById(studyId);
	const linkedProjectId = linkedProjectIdForStudy(study);
	const projectId = linkedProjectId || params.get("project") || params.get("projectId") || params.get("pid") || "";
	const project = await loadProjectById(projectId);
	return {
		projectId,
		studyId: study.id || studyId,
		project,
		study,
		routeMode: "canonical-recovered"
	};
}

async function initContext() {
	const params = new URLSearchParams(window.location.search);
	try {
		const context = await resolveStudyContextFromUrl(params);
		bindContext(context);
		return context.studyId;
	} catch {
		try {
			const context = await recoverStudyContextFromUrl(params);
			bindContext(context);
			return context.studyId;
		} catch {
		}
		const warning = $("#study-context-warning");
		if (warning) warning.hidden = false;
		currentStudyId = params.get("id") || params.get("sid") || "";
		const backToRisk = $("#back-to-risk-assessment");
		if (backToRisk) backToRisk.href = currentStudyId ? route("/pages/study/ethics-risk/", { id: currentStudyId }) : "/pages/study/ethics-risk/";
		const backToStudy = $("#back-to-study");
		if (backToStudy) backToStudy.href = currentStudyId ? route("/pages/study/", { id: currentStudyId }) : "/pages/study/";
		return currentStudyId;
	}
}

async function init() {
	const studyId = await initContext();
	renderOutcome(await loadSeededStudyEthicsRisk(studyId));
	bindRecordForm();
	bindSubmissionWorkflow();
}

init();
