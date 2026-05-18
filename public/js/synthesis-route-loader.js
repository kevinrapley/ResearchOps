/**
 * @file public/js/synthesis-route-loader.js
 * @module synthesis-route-loader
 * @summary Loads the Study route bridge before the synthesis controller.
 */

await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518');
await import('/components/layout.js');
await import('/js/synthesize-page.js?v=study-record-id-routing-20260518');
