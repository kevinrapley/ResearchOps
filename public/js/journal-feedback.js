export function clearJournalFeedback() {
	const summary = document.getElementById("journal-error-summary");
	const banner = document.getElementById("journal-notification-banner");
	if (summary) summary.setAttribute("hidden", "hidden");
	if (banner) banner.setAttribute("hidden", "hidden");
}

export function showJournalError(message) {
	const summary = document.getElementById("journal-error-summary");
	const item = summary?.querySelector(".govuk-error-summary__list li");
	const banner = document.getElementById("journal-notification-banner");
	if (banner) banner.setAttribute("hidden", "hidden");
	if (item) item.textContent = String(message || "There is a problem.");
	if (summary) {
		summary.removeAttribute("hidden");
		summary.focus?.();
	}
}

export function showJournalStatus(message, options = {}) {
	const banner = document.getElementById("journal-notification-banner");
	const title = document.getElementById("govuk-notification-banner-title");
	const body = document.getElementById("journal-notification-message");
	const summary = document.getElementById("journal-error-summary");
	if (summary) summary.setAttribute("hidden", "hidden");
	if (title) title.textContent = options.title || "Information";
	if (body) body.textContent = String(message || "");
	if (banner) {
		banner.removeAttribute("hidden");
		if (options.success) {
			banner.classList.add("govuk-notification-banner--success");
		} else {
			banner.classList.remove("govuk-notification-banner--success");
		}
	}
}
