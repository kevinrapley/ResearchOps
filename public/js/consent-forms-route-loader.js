/**
 * @file public/js/consent-forms-route-loader.js
 * @module consent-forms-route-loader
 * @summary Loads the Study route bridge before the consent forms controller.
 */

await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518');
await import('/components/layout.js');
await import('/js/consent-forms-page.js?v=study-record-id-routing-20260518');
