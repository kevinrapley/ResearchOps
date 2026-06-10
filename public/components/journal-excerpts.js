/**
 * @file components/journal-excerpts.js
 * @summary Compatibility module for the retired journal excerpts renderer.
 * @description Journal entry rendering is owned by /js/journal-tabs.js so that first-load and tab-switch rendering use the same GOV.UK summary-card path.
 */

document.dispatchEvent(new CustomEvent('journal:excerpts:retired'));
