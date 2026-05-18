/**
 * @file public/js/participants-route-loader.js
 * @module participants-route-loader
 * @summary Loads the Study route bridge before the participants and scheduling controllers.
 */

await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518');
await import('/components/layout.js');
await import('/components/participants/participants-page.js?v=study-record-id-routing-20260518');
await import('/pages/study/participants/scheduler.js?v=study-record-id-routing-20260518');
