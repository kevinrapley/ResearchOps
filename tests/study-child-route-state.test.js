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
	guides: read("public/pages/study/guides/index.html"),
	participantConsent: read("public/pages/study/participant-consent/index.html"),
	participants: read("public/pages/study/participants/index.html"),
	synthesis: read("public/pages/study/synthesis/index.html"),
};

const loaders = {
	consentForms: read("public/js/consent-forms-route-loader.js"),
	guides: read("public/js/guides-route-loader.js"),
	participantConsent: read("public/js/participant-consent-route-loader.js"),
	participants: read("public/js/participants-route-loader.js"),
	synthesis: read("public/js/synthesis-route-loader.js"),
};

includes(studyPageController, "const studyParams = { id: studyId }", "study page controller");
includes(studyPageController, "route(\"/pages/study/consent-forms/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/participant-consent/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/guides/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/participants/\", studyParams)", "study page controller");
includes(studyPageController, "route(\"/pages/study/synthesis/\", studyParams)", "study page controller");
excludes(studyPageController, "route(\"/pages/synthesize/\", studyParams)", "study page controller");

includes(studyRouteContext, "const canonicalStudyId = params.get(\"id\") || \"\"", "study route context");
includes(studyRouteContext, "projectId !== legacyProjectId", "study route context");
excludes(studyRouteContext, "rops-api.digikev-kevin-rapley.workers.dev", "study route context");
excludes(studyRouteContext, "location.hostname.endsWith(\"pages.dev\")", "study route context");

includes(studyBridge, "pathname === '/pages/synthesize/'", "study canonical URL bridge");
includes(studyBridge, "next.pathname = '/pages/study/synthesis/'", "study canonical URL bridge");
includes(studyBridge, "next.searchParams.delete('pid')", "study canonical URL bridge");
includes(studyBridge, "next.searchParams.delete('sid')", "study canonical URL bridge");
includes(studyBridge, "next.searchParams.set('id', context.studyId)", "study canonical URL bridge");

for (const [label, source] of Object.entries(pages)) {
	includes(source, "<html lang=\"en-GB\">", label);
	includes(source, "/js/study-route-context.js", label);
	includes(source, "?v=study-record-id-routing-20260518", label);
	excludes(source, "?pid=", label);
	excludes(source, "&sid=", label);
}

includes(pages.consentForms, "/js/consent-forms-route-loader.js?v=study-record-id-routing-20260518", "consent forms page");
excludes(pages.consentForms, "/js/consent-forms-page.js?v=study-record-id-routing-20260518", "consent forms page");
includes(pages.guides, "/js/guides-route-loader.js?v=study-record-id-routing-20260518", "guides page");
excludes(pages.guides, "/js/study-guides-context.js?v=study-record-id-routing-20260518", "guides page");
excludes(pages.guides, "/components/guides/guides-page.js?v=study-record-id-routing-20260518", "guides page");
includes(pages.participantConsent, "/js/participant-consent-route-loader.js?v=study-record-id-routing-20260518", "participant consent page");
excludes(pages.participantConsent, "/js/participant-consent-page.js?v=study-record-id-routing-20260518", "participant consent page");
includes(pages.participants, "/js/participants-route-loader.js?v=study-record-id-routing-20260518", "participants page");
includes(pages.synthesis, "/js/synthesis-route-loader.js?v=study-record-id-routing-20260518", "synthesis page");
excludes(pages.synthesis, "/js/synthesize-page.js?v=study-record-id-routing-20260518", "synthesis page");

for (const [label, source] of Object.entries(loaders)) {
	includes(source, "await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518')", label);
	includes(source, "await import('/components/layout.js')", label);
}

includes(loaders.consentForms, "await import('/js/consent-forms-page.js?v=study-record-id-routing-20260518')", "consent forms loader");
includes(loaders.guides, "await import('/js/study-guides-context.js?v=study-record-id-routing-20260518')", "guides loader");
includes(loaders.guides, "await import('/components/guides/guides-page.js?v=study-record-id-routing-20260518')", "guides loader");
includes(loaders.participantConsent, "await import('/js/participant-consent-page.js?v=study-record-id-routing-20260518')", "participant consent loader");
includes(loaders.participants, "await import('/components/participants/participants-page.js?v=study-record-id-routing-20260518')", "participants loader");
includes(loaders.participants, "await import('/pages/study/participants/scheduler.js?v=study-record-id-routing-20260518')", "participants loader");
includes(loaders.synthesis, "await import('/js/synthesize-page.js?v=study-record-id-routing-20260518')", "synthesis loader");
