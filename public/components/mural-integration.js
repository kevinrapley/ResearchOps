/** GET /api/mural/find?uid=&title=Reflexive%20Journal[&projectId=rec...|&projectName=...]
 * Looks up a previously-created board URL from KV. Never throws: 200 with {ok:false}
 * on miss; 404 only if input is malformed. */
async muralFind(origin, url) {
  const cors = this.root.corsHeaders(origin);

  try {
    const uid   = (url.searchParams.get("uid") || "anon").trim();
    const title = (url.searchParams.get("title") || "").trim();
    const pid   = (url.searchParams.get("projectId") || "").trim();
    const pname = (url.searchParams.get("projectName") || "").trim();

    if (!uid || !title || (!pid && !pname)) {
      return this.root.json(
        { ok: false, error: "bad_request", message: "uid, title and (projectId or projectName) are required" },
        400,
        cors
      );
    }

    // Build KV keys (must match wherever you saved them during setup)
    const keyById   = pid   ? `mural:url:${uid}:projectId:${pid}:title:${title}` : null;
    const keyByName = pname ? `mural:url:${uid}:projectName:${pname.toLowerCase()}:title:${title}` : null;

    // Try id first, then name; tolerate missing KV binding
    let urlHit = null;
    try {
      if (keyById)   urlHit = await this.root.env.SESSION_KV.get(keyById);
      if (!urlHit && keyByName) urlHit = await this.root.env.SESSION_KV.get(keyByName);
    } catch (_) {
      // If KV isn’t bound in this environment, do not 500 the client
      return this.root.json({ ok: false, error: "kv_unavailable" }, 200, cors);
    }

    if (!urlHit) {
      // Soft miss; caller can keep the button as “Create…”
      return this.root.json({ ok: false, reason: "not_found" }, 200, cors);
    }

    // Return the URL we persisted on creation
    return this.root.json({ ok: true, url: urlHit }, 200, cors);
  } catch (e) {
    // Never leak stack to client; keep it soft
    return this.root.json({ ok: false, error: "find_failed" }, 200, cors);
  }
}
