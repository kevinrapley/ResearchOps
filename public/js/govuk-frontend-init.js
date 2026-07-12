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
	const src = event?.detail?.src || event?.target?.getAttribute?.('src') || '';
	if (String(src).startsWith('/partials/header.html')) {
		import('/js/auth-header-links.js?v=flux-semantic-20260712').then((module) => {
			module.initAuthHeaderLinks(event.target);
		});
	}
});
