/**
 * @file public/js/study-guides-route-loader.js
 * @module study-guides-route-loader
 * @summary Loads the Study route bridge before the Discussion Guides controllers.
 */

await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518');
await import('/components/layout.js');
await import('/js/study-guides-context.js?v=study-record-id-routing-20260518');
await import('/components/guides/guides-page.js?v=study-record-id-routing-20260518');
