/**
 * @file public/js/note-takers-observers-route-loader.js
 * @module note-takers-observers-route-loader
 * @summary Loads the Study route bridge before the note takers and observers controller.
 */

const version = 'study-note-takers-observers-20260606';

try {
	await import(`/js/study-canonical-url-bridge.js?v=${version}`);
} catch {
	// The page can still render its local fallback context without the bridge.
}

await import('/components/layout.js');

try {
	await import(`/js/note-takers-observers-page.js?v=${version}`);
} catch {
	// The static page remains readable if the controller fails to load.
}

export const noteTakersObserversRouteLoaderReady = true;
