import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
	return fs.readFileSync(path, "utf8");
}

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

const studyPageController = read("public/js/study-page.js");
const studyRouteContext = read("public/js/study-route-context.js");
const studyBridge = read("public/js/study-canonical-url-bridge.js");

const pages = {
	consentForms: read("public/pages/study/consent-forms/index.html"),
	ethicsRisk: read("public/pages/study/ethics-risk/index.html"),
	ethicsRiskNextSteps: read("public/pages/study/ethics-risk/next-steps/index.html"),
	guides: read("public/pages/study/guides/index.html"),
	noteTakersObservers: read("public/pages/study/note-takers-observers/index.html"),
	participantConsent: read("public/pages/study/participant-consent/index.html"),
	participants: read("public/pages/study/participants/index.html"),
	synthesis: read("public/pages/study/synthesis/index.html"),
};

const loaders = {
	consentForms: read("public/js/consent-forms-route-loader.js"),
	ethicsRisk: read("public/js/study-ethics-risk-page.js"),
	ethicsRiskNextSteps: read("public/js/study-ethics-risk-next-steps-page.js"),
	guides: read("public/js/guides-route-loader.js"),
	noteTakersObservers: read("public/js/note-takers-observers-route-loader.js"),
	participantConsent: read("public/js/participant-consent-route-loader.js"),
	participants: read("public/js/participants-route-loader.js"),
	synthesis: read("public/js/synthesis-route-loader.js"),
};

includes(studyPageController, "const studyParams = { id: studyId, project: projectId }", "study page controller");
includes(studyPageController, "route(\"/pages/study/consent-forms/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/ethics-risk/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/ethics-risk/next-steps/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/participant-consent/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/guides/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/participants/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/note-takers-observers/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/synthesis/\", studyParams)", "study page controller");
excludes(studyPageController, "route(\"/pages/synthesize/\", studyParams)", "study page controller");

includes(studyRouteContext, "const canonicalStudyId = params.get(\"id\") || \"\"", "study route context");
includes(studyRouteContext, "const routeProjectId = params.get(\"project\") || params.get(\"projectId\") || \"\"", "study route context");
includes(studyRouteContext, "const linkedProjectId = linkedProjectIdForStudy(study)", "study route context");
includes(studyRouteContext, "routeProjectId && linkedProjectId && routeProjectId !== linkedProjectId", "study route context");
includes(studyRouteContext, "const projectId = linkedProjectId || routeProjectId", "study route context");
excludes(studyRouteContext, "const projectId = routeProjectId || linkedProjectIdForStudy(study)", "study route context");
includes(studyRouteContext, "projectId !== legacyProjectId", "study route context");
excludes(studyRouteContext, "rops-api.digikev-kevin-rapley.workers.dev", "study route context");
excludes(studyRouteContext, "location.hostname.endsWith(\"pages.dev\")", "study route context");

includes(studyBridge, "pathname === '/pages/synthesize/'", "study canonical URL bridge");
includes(studyBridge, "next.pathname = '/pages/study/synthesis/'", "study canonical URL bridge");
includes(studyBridge, "next.searchParams.delete('pid')", "study canonical URL bridge");
includes(studyBridge, "next.searchParams.delete('sid')", "study canonical URL bridge");
includes(studyBridge, "next.searchParams.set('id', context.studyId)", "study canonical URL bridge");

for (const [label, source] of Object.entries(pages)) {
	includes(source, "<html class=\"govuk-template\" lang=\"en\">", label);
	includes(source, "/assets/govuk/govuk-frontend.css", label);
	includes(source, "/js/study-route-context.js", label);
	excludes(source, "?pid=", label);
	excludes(source, "&sid=", label);
}

for (const [label, source] of Object.entries(pages)) {
	if (label === "guides") {
		includes(source, "?v=study-guides-delete-confirmation-20260605", label);
	} else if (label === "noteTakersObservers") {
		includes(source, "?v=study-note-takers-observers-20260606", label);
	} else if (label === "synthesis") {
		includes(source, "?v=study-synthesis-20260701-cache-refresh", label);
	} else if (label === "ethicsRisk") {
		includes(source, "?v=study-ethics-risk-20260704", label);
	} else if (label === "ethicsRiskNextSteps") {
		includes(source, "?v=study-ethics-risk-next-steps-20260704", label);
	} else {
		includes(source, "?v=study-record-id-routing-20260518", label);
	}
}

includes(pages.consentForms, "/js/consent-forms-route-loader.js?v=study-record-id-routing-20260518", "consent forms page");
includes(pages.ethicsRisk, "/js/study-ethics-risk-page.js?v=study-ethics-risk-20260704", "ethics risk page");
includes(pages.ethicsRiskNextSteps, "/js/study-ethics-risk-next-steps-page.js?v=study-ethics-risk-next-steps-20260704", "ethics risk next steps page");
excludes(pages.consentForms, "/js/consent-forms-page.js?v=study-record-id-routing-20260518", "consent forms page");
includes(pages.guides, "/js/guides-route-loader.js?v=study-guides-delete-confirmation-20260605", "guides page");
excludes(pages.guides, "/js/study-guides-context.js?v=study-record-id-routing-20260518", "guides page");
excludes(pages.guides, "/components/guides/guides-page.js?v=study-record-id-routing-20260518", "guides page");
includes(pages.noteTakersObservers, "/js/note-takers-observers-route-loader.js?v=study-note-takers-observers-20260606", "note takers and observers page");
includes(pages.participantConsent, "/js/participant-consent-route-loader.js?v=study-record-id-routing-20260518", "participant consent page");
excludes(pages.participantConsent, "/js/participant-consent-page.js?v=study-record-id-routing-20260518", "participant consent page");
includes(pages.participants, "/js/participants-route-loader.js?v=study-record-id-routing-20260518", "participants page");
includes(pages.synthesis, "/js/synthesis-route-loader.js?v=study-synthesis-20260701-cache-refresh", "synthesis page");
excludes(pages.synthesis, "/js/synthesize-page.js?v=study-record-id-routing-20260518", "synthesis page");

for (const [label, source] of Object.entries(loaders)) {
	if (label === "guides") {
		includes(source, "await import('/js/study-canonical-url-bridge.js?v=study-guides-delete-confirmation-20260605')", label);
	} else if (label === "noteTakersObservers") {
		includes(source, "await import(`/js/study-canonical-url-bridge.js?v=${version}`)", label);
	} else if (label === "ethicsRisk" || label === "ethicsRiskNextSteps") {
		includes(source, "resolveStudyContextFromUrl", label);
	} else if (label === "participantConsent") {
		excludes(source, "study-canonical-url-bridge", label);
	} else {
		includes(source, "await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518')", label);
	}
	if (label !== "ethicsRisk" && label !== "ethicsRiskNextSteps") {
		includes(source, "await import('/components/layout.js')", label);
	}
}

includes(loaders.consentForms, "await import('/js/consent-forms-page.js?v=study-record-id-routing-20260518')", "consent forms loader");
includes(loaders.guides, "Study route bridge unavailable", "guides loader");
includes(loaders.guides, "Study guides context unavailable", "guides loader");
includes(loaders.guides, "await import('/js/study-guides-context.js?v=study-guides-delete-confirmation-20260605')", "guides loader");
includes(loaders.guides, "await import('/components/guides/guides-page.js?v=study-guides-delete-confirmation-20260605')", "guides loader");
includes(loaders.noteTakersObservers, "await import(`/js/note-takers-observers-page.js?v=${version}`)", "note takers and observers loader");
includes(loaders.participantConsent, "await import('/js/participant-consent-page.js?v=study-record-id-routing-20260518')", "participant consent loader");
includes(loaders.participants, "await import('/components/participants/participants-page.js?v=study-record-id-routing-20260518')", "participants loader");
includes(loaders.participants, "await import('/pages/study/participants/scheduler.js?v=study-record-id-routing-20260518')", "participants loader");
includes(loaders.synthesis, "await import('/js/synthesize-page.js?v=study-synthesis-20260701-cache-refresh')", "synthesis loader");
