/**
 * @file public/js/participant-consent-route-loader.js
 * @module participant-consent-route-loader
 * @summary Loads the Study route bridge before the participant consent controller.
 */

await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518');
await import('/components/layout.js');
await import('/js/participant-consent-page.js?v=study-record-id-routing-20260518');
