/**
 * @file public/js/guides-route-loader.js
 * @module guides-route-loader
 * @summary Loads the Study route bridge before the discussion guides controllers.
 */

try {
	await import('/js/study-canonical-url-bridge.js?v=study-guides-drawer-focus-20260605');
} catch (err) {
	console.warn('[guides-route-loader] Study route bridge unavailable:', err);
}
await import('/components/layout.js');
try {
	await import('/js/study-guides-context.js?v=study-guides-drawer-focus-20260605');
} catch (err) {
	console.warn('[guides-route-loader] Study guides context unavailable:', err);
}
try {
	await import('/components/guides/guides-page.js?v=study-guides-drawer-focus-20260605');
} catch (err) {
	console.error('[guides-route-loader] Guides controller unavailable:', err);
}

export const guideRouteLoaderReady = true;
