/**
 * @file project-dashboard-mural-state.js
 * @summary Normalises Project Dashboard Mural action presentation.
 *
 * Mural account and board state are handled by mural-integration.js. This bridge
 * keeps the GOV.UK dashboard action set to one visible Mural board action when a
 * board is linked.
 */

function hideLegacyOpenAction() {
	const legacyOpen = document.getElementById("mural-open");
	if (!legacyOpen) return;
	if (!legacyOpen.hidden) legacyOpen.hidden = true;
	if (legacyOpen.getAttribute("aria-hidden") !== "true") {
		legacyOpen.setAttribute("aria-hidden", "true");
	}
	if (legacyOpen.getAttribute("aria-disabled") !== "true") {
		legacyOpen.setAttribute("aria-disabled", "true");
	}
	if (legacyOpen.tabIndex !== -1) legacyOpen.tabIndex = -1;
}

function normaliseSetupActionLabel() {
	const setup = document.getElementById("mural-setup");
	if (!setup) return;
	if (setup.textContent.trim() === 'Open "Reflexive Journal"') {
		setup.textContent = "Open Mural board";
	}
}

function normaliseMuralActions() {
	hideLegacyOpenAction();
	normaliseSetupActionLabel();
}

function startMuralActionNormaliser() {
	normaliseMuralActions();
	const section = document.getElementById("mural-integration");
	if (!section) return;
	const observer = new MutationObserver(() => normaliseMuralActions());
	observer.observe(section, {
		attributes: true,
		attributeFilter: ["aria-disabled", "disabled", "hidden", "href"],
		characterData: true,
		childList: true,
		subtree: true,
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", startMuralActionNormaliser, { once: true });
} else {
	startMuralActionNormaliser();
}

export {};
