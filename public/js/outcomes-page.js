/**
 * @file /js/outcomes-page.js
 * @summary Hydrates the Outcomes page project context and impact identifier.
 */

(function initOutcomesPage() {
	const params = new URLSearchParams(window.location.search);
	const projectId = params.get("id");

	if (projectId) {
		const impactSection = document.getElementById("impact-tracker");
		if (impactSection) impactSection.setAttribute("data-project-id", projectId);

		const bcProject = document.getElementById("breadcrumb-project");
		if (bcProject) bcProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;

		const backLink = document.getElementById("back-link");
		if (backLink) {
			backLink.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}#outcomes`;
		}
	}

	const insightInput = document.getElementById("impact-insightId");
	if (insightInput && !insightInput.value) {
		if (window.crypto && typeof window.crypto.randomUUID === "function") {
			insightInput.value = window.crypto.randomUUID();
		} else {
			insightInput.value = `insight-${Date.now().toString(36)}`;
		}
	}
})();
