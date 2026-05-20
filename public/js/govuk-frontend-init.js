import { initAll } from '/assets/govuk/govuk-frontend.min.js';

function initialiseGovukFrontend(scope = document) {
	try {
		initAll({ scope });
	} catch (error) {
		document.dispatchEvent(
			new CustomEvent('govuk-frontend:init-error', {
				detail: { error: String(error) },
			}),
		);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => initialiseGovukFrontend(), { once: true });
} else {
	initialiseGovukFrontend();
}

document.addEventListener('x-include:loaded', (event) => {
	initialiseGovukFrontend(event.target);
});
