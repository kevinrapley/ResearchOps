/**
 * @file bundle-recorder.mjs
 * @module BundleRecorder
 * @summary Records bundle detection, application, conflicts and precedence decisions.
 */

/**
 * Recorder for multi-bundle orchestration events.
 */
export class BundleRecorder {
  /**
   * Create a bundle recorder.
   * @param {object} trace Trace writer.
   */
  constructor(trace) {
    this.trace = trace;
  }

  /**
   * Record that a bundle was detected as potentially relevant.
   * @param {Record<string, unknown>} bundle Bundle metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  detect(bundle) {
    return this.trace.event("bundle.detected", {
      bundleId: bundle.id,
      name: bundle.name,
      reason: bundle.reason,
      relevance: bundle.relevance,
      version: bundle.version
    });
  }

  /**
   * Record that a bundle file was loaded.
   * @param {Record<string, unknown>} bundle Bundle metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  load(bundle) {
    return this.trace.event("bundle.loaded", {
      bundleId: bundle.id,
      name: bundle.name,
      path: bundle.path,
      version: bundle.version
    });
  }

  /**
   * Record that bundle rules were applied.
   * @param {Record<string, unknown>} bundle Bundle metadata.
   * @param {Record<string, unknown>} [payload] Application metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  apply(bundle, payload = {}) {
    return this.trace.event("bundle.applied", {
      appliedRules: payload.appliedRules || [],
      bundleId: bundle.id,
      evidence: payload.evidence || [],
      name: bundle.name,
      notAppliedRules: payload.notAppliedRules || [],
      version: bundle.version
    });
  }

  /**
   * Record a bundle conflict.
   * @param {Record<string, unknown>} payload Conflict metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  conflict(payload) {
    return this.trace.event(
      "bundle.conflict",
      {
        affectedDecision: payload.affectedDecision,
        bundles: payload.bundles || [],
        conflict: payload.conflict
      },
      { severity: "warning" }
    );
  }

  /**
   * Record a precedence decision between bundle rules.
   * @param {Record<string, unknown>} payload Precedence metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  precedence(payload) {
    return this.trace.event("bundle.precedence_decided", {
      decisionImpact: payload.decisionImpact,
      rationale: payload.rationale,
      supersededBundles: payload.supersededBundles || [],
      winningBundle: payload.winningBundle
    });
  }
}
