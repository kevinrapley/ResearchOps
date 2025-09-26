#!/usr/bin/env node
/**
 * Retention Enforcer (client-side placeholder; run server-side in production)
 * Reads consent objects, computes expiry from RetentionSchedule, and removes linked notes.
 */
import { ResearchOpsSDK } from '../sdk/researchops_sdk_v1.0.0.js';

const sdk = ResearchOpsSDK.createSDK({
  org: process.env.ROPS_ORG || "home-office-biometrics",
  project: process.env.ROPS_PROJECT || "demo",
  study: process.env.ROPS_STUDY || "demo",
  user: "retention-job@system"
});

(async () => {
  // NOTE: For localStorage adapter this is illustrative only.
  // In production, replace with a server-side storage adapter.
  const all = await sdk.search({ type: "Consent" });
  const now = new Date();

  const removed = [];
  for (const c of all) {
    const dur = c.RetentionSchedule || "P12M";
    const created = new Date(c.created);
    const expiry = new Date(created);
    const m = /^P(\\d+)M$/.exec(dur);
    if (m) expiry.setMonth(expiry.getMonth() + Number(m[1]));
    if (now >= expiry) {
      // remove linked notes
      const notes = (await sdk.search({ type: "Note" })).filter(n => n.hasTarget === c.hasTarget);
      for (const n of notes) {
        // replace with storage.remove('note', n.id) once server adapter exists
        removed.push(n.id);
      }
      removed.push(c.id);
    }
  }
  console.log(JSON.stringify({ removed, at: now.toISOString() }, null, 2));
})();
