/**
 * @file caqdas-interface.js
 * @summary Journals / CAQDAS UI wiring: codes, memos, timeline, co-occurrence, retrieval, export, and code applications list.
 * @description
 *  - Buttons:
 *    + Add Code            → POST /api/codes
 *    + New Memo            → POST /api/memos?project=…
 *    📊 Timeline View      → GET  /api/analysis/timeline?project=…
 *    🔗 Code Co-occurrence → GET  /api/analysis/cooccurrence?project=…
 *    🔍 Code Retrieval     → GET  /api/analysis/retrieval?project=…&q=…
 *    📤 Export Analysis    → GET  /api/analysis/export?project=… (download)
 *    (Also) Code Applications list → GET /api/code-applications?project=…
 *
 *  - Rendering targets (create these containers in your HTML if not present):
 *      <ul id="codes-list"></ul>
 *      <section id="timeline"></section>
 *      <section id="cooccurrence"></section>
 *      <section id="retrieval"></section>
 *      <ul id="code-applications-list"></ul>
 *
 *  - Button IDs expected:
 *      #btn-add-code
 *      #btn-new-memo
 *      #btn-timeline
 *      #btn-cooccurrence
 *      #btn-retrieval
 *      #btn-export-analysis
 *
 *  - This file is self-contained and defensive: it will not throw; it flashes user-friendly messages.
 */

/* -------------------- tiny DOM helpers -------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* -------------------- flash region (accessible) -------------------- */
function flash(message) {
	let el = $("#flash");
	if (!el) {
		el = document.createElement("div");
		el.id = "flash";
		el.setAttribute("role", "status");
		el.setAttribute("aria-live", "polite");
		el.style.margin = "12px 0";
		el.style.padding = "12px";
		el.style.border = "1px solid #d0d7de";
		el.style.background = "#fff";
		document.querySelector("main")?.prepend(el);
	}
	el.textContent = message;
}

/* -------------------- fetch helpers -------------------- */
async function httpJSON(url, opts = {}, timeoutMs = 30000) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	let res;
	try {
		res = await fetch(url, { cache: "no-store", signal: ctrl.signal, ...opts });
	} finally {
		clearTimeout(t);
	}
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
	}
	const ct = (res.headers.get("content-type") || "").toLowerCase();
	if (!ct.includes("application/json")) return {};
	return res.json();
}

/* -------------------- renderers -------------------- */
function renderCodes(list) {
	const ul = $("#codes-list");
	if (!ul) return;
	ul.innerHTML = "";
	if (!Array.isArray(list) || !list.length) {
		const li = document.createElement("li");
		li.textContent = "No codes yet.";
		ul.appendChild(li);
		return;
	}
	for (const c of list) {
		const li = document.createElement("li");
		li.textContent = c.name || "—";
		if (c.color) {
			li.style.borderLeft = `8px solid ${c.color}`;
			li.style.paddingLeft = "8px";
		}
		ul.appendChild(li);
	}
}

function renderTimeline(entries) {
	const wrap = $("#timeline");
	if (!wrap) return;
	wrap.innerHTML = "";
	if (!Array.isArray(entries) || !entries.length) {
		wrap.textContent = "No journal entries yet.";
		return;
	}
	for (const e of entries) {
		const item = document.createElement("article");
		item.className = "entry";

		const h = document.createElement("h4");
		const when = e.createdAt ? new Date(e.createdAt) : new Date();
		h.textContent = when.toLocaleString();

		const p = document.createElement("p");
		p.textContent = e.body || "—";

		if (Array.isArray(e.codeIds) && e.codeIds.length) {
			const meta = document.createElement("div");
			meta.style.fontSize = "0.9em";
			meta.style.opacity = "0.8";
			meta.textContent = `Codes: ${e.codeIds.join(", ")}`;
			item.appendChild(meta);
		}

		item.appendChild(h);
		item.appendChild(p);
		wrap.appendChild(item);
	}
}

function renderCooccurrence(graph) {
	const out = $("#cooccurrence");
	if (!out) return;
	out.innerHTML = "";
	const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
	const links = Array.isArray(graph?.links) ? graph.links : [];
	if (!links.length) {
		out.textContent = "No co-occurrences yet.";
		return;
	}
	/* Minimal tabular view for now */
	const table = document.createElement("table");
	table.style.borderCollapse = "collapse";
	table.style.width = "100%";

	const thead = document.createElement("thead");
	const thr = document.createElement("tr");
	for (const h of ["Source", "Target", "Weight"]) {
		const th = document.createElement("th");
		th.textContent = h;
		th.style.borderBottom = "1px solid #d0d7de";
		th.style.textAlign = "left";
		th.style.padding = "6px";
		thr.appendChild(th);
	}
	thead.appendChild(thr);
	table.appendChild(thead);

	const map = new Map(nodes.map(n => [n.id, n.label || n.name || n.id]));
	const tbody = document.createElement("tbody");
	for (const link of links) {
		const tr = document.createElement("tr");
		const tdA = document.createElement("td");
		const tdB = document.createElement("td");
		const tdW = document.createElement("td");
		tdA.textContent = map.get(link.source) || link.source;
		tdB.textContent = map.get(link.target) || link.target;
		tdW.textContent = String(link.weight ?? 1);
		[tdA, tdB, tdW].forEach(td => { td.style.padding = "6px";
			td.style.borderBottom = "1px solid #f0f2f4"; });
		tr.appendChild(tdA);
		tr.appendChild(tdB);
		tr.appendChild(tdW);
		tbody.appendChild(tr);
	}
	table.appendChild(tbody);
	out.appendChild(table);
}

function renderRetrieval(results) {
	const out = $("#retrieval");
	if (!out) return;
	out.innerHTML = "";
	if (!Array.isArray(results) || !results.length) {
		out.textContent = "No matches.";
		return;
	}
	for (const r of results) {
		const block = document.createElement("article");
		block.style.border = "1px solid #d0d7de";
		block.style.padding = "8px";
		block.style.margin = "8px 0";

		const head = document.createElement("div");
		head.style.fontWeight = "bold";
		head.textContent = `Entry ${r.entryId}`;

		const p = document.createElement("p");
		p.textContent = r.snippet || "—";

		const tags = document.createElement("div");
		for (const c of (r.codes || [])) {
			const b = document.createElement("span");
			b.textContent = c.name || c.id;
			b.style.border = "1px solid #d0d7de";
			b.style.padding = "2px 6px";
			b.style.marginRight = "6px";
			b.style.borderRadius = "3px";
			tags.appendChild(b);
		}

		block.appendChild(head);
		block.appendChild(p);
		block.appendChild(tags);
		out.appendChild(block);
	}
}

function renderCodeApplications(apps) {
	const ul = $("#code-applications-list");
	if (!ul) return;
	ul.innerHTML = "";
	if (!Array.isArray(apps) || !apps.length) {
		const li = document.createElement("li");
		li.textContent = "No code applications recorded for this project.";
		ul.appendChild(li);
		return;
	}
	for (const a of apps) {
		const li = document.createElement("li");
		const name = a.name || "—";
		const vendor = a.vendor ? ` · ${a.vendor}` : "";
		const status = a.status ? ` · ${a.status}` : "";
		li.textContent = `${name}${vendor}${status}`;
		ul.appendChild(li);
	}
}

/* -------------------- data loaders -------------------- */
async function loadCodes(projectId) {
	const data = await httpJSON(`/api/codes?project=${encodeURIComponent(projectId)}`).catch((e) => {
		console.error(e);
		return { codes: [] };
	});
	return Array.isArray(data?.codes) ? data.codes : [];
}

async function createCode(projectId, name) {
	return httpJSON("/api/codes", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name, projectId })
	}).catch((e) => {
		throw e;
	});
}

async function loadTimeline(projectId) {
	const data = await httpJSON(`/api/analysis/timeline?project=${encodeURIComponent(projectId)}`).catch((e) => {
		console.error(e);
		return { timeline: [] };
	});
	return Array.isArray(data?.timeline) ? data.timeline : [];
}

async function loadCooccurrence(projectId) {
	const data = await httpJSON(`/api/analysis/cooccurrence?project=${encodeURIComponent(projectId)}`).catch((e) => {
		console.error(e);
		return { nodes: [], links: [] };
	});
	return { nodes: data.nodes || [], links: data.links || [] };
}

async function loadRetrieval(projectId, q) {
	const data = await httpJSON(`/api/analysis/retrieval?project=${encodeURIComponent(projectId)}&q=${encodeURIComponent(q)}`).catch((e) => {
		console.error(e);
		return { results: [] };
	});
	return Array.isArray(data?.results) ? data.results : [];
}

async function loadCodeApplications(projectId) {
	const res = await fetch(`/api/code-applications?project=${encodeURIComponent(projectId)}`, { cache: "no-store" });
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
	}
	const data = await res.json().catch(() => ({}));
	// handler may return { ok:true, applications:[…] } or bare array []; support both
	const apps = Array.isArray(data) ? data : (Array.isArray(data.applications) ? data.applications : []);
	return apps;
}

/* -------------------- orchestration -------------------- */
async function refreshAll(projectId) {
	const [codes, timeline, graph, apps] = await Promise.all([
		loadCodes(projectId),
		loadTimeline(projectId),
		loadCooccurrence(projectId),
		loadCodeApplications(projectId).catch((e) => {
			console.warn("Code applications load failed:", e?.message || e);
			return [];
		})
	]);

	renderCodes(codes);
	renderTimeline(timeline);
	renderCooccurrence(graph);
	renderCodeApplications(apps);
}

/* -------------------- UI wiring -------------------- */
function initCaqdasInterface() {
	const url = new URL(location.href);
	const projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	const btnAddCode = $("#btn-add-code");
	const btnNewMemo = $("#btn-new-memo");
	const btnTimeline = $("#btn-timeline");
	const btnCooc = $("#btn-cooccurrence");
	const btnRetrieval = $("#btn-retrieval");
	const btnExportAnalysis = $("#btn-export-analysis");

	if (!projectId) {
		flash("No project id found in URL. Some features are disabled.");
		return;
	}

	// initial population
	refreshAll(projectId).catch((e) => {
		console.error(e);
		flash("Initial load failed. Check network/API.");
	});

	/* + Add Code */
	if (btnAddCode) {
		btnAddCode.addEventListener("click", async (e) => {
			e.preventDefault();
			const name = prompt("New code label:");
			if (!name) return;
			try {
				await createCode(projectId, name);
				flash(`Code “${name}” created.`);
				await refreshAll(projectId);
			} catch (err) {
				console.error(err);
				flash(`Could not create code. ${err.message}`);
			}
		});
	}

	/* + New Memo (server if available; graceful fallback) */
	if (btnNewMemo) {
		btnNewMemo.addEventListener("click", async (e) => {
			e.preventDefault();
			const body = prompt("Memo text:");
			if (!body) return;
			try {
				const res = await fetch(`/api/memos?project=${encodeURIComponent(projectId)}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ body })
				});
				if (!res.ok) {
					const t = await res.text().catch(() => "");
					throw new Error(`HTTP ${res.status}${t ? ` — ${t}` : ""}`);
				}
				flash("Memo created.");
				await refreshAll(projectId);
			} catch (err) {
				console.error(err);
				flash("Memo endpoint not available. Add memos via Journals for now.");
			}
		});
	}

	/* 📊 Timeline View: set mode and refresh timeline only */
	if (btnTimeline) {
		btnTimeline.addEventListener("click", async (e) => {
			e.preventDefault();
			document.body.dataset.caqdasView = "timeline";
			const data = await loadTimeline(projectId);
			renderTimeline(data);
			flash("Timeline updated.");
		});
	}

	/* 🔗 Co-occurrence: set mode and refresh graph */
	if (btnCooc) {
		btnCooc.addEventListener("click", async (e) => {
			e.preventDefault();
			document.body.dataset.caqdasView = "cooccurrence";
			const graph = await loadCooccurrence(projectId);
			renderCooccurrence(graph);
			flash("Co-occurrence updated.");
		});
	}

	/* 🔍 Retrieval: prompt query, set mode and render results */
	if (btnRetrieval) {
		btnRetrieval.addEventListener("click", async (e) => {
			e.preventDefault();
			const q = prompt("Find text or code label:");
			if (!q) return;
			const results = await loadRetrieval(projectId, q);
			document.body.dataset.caqdasView = "retrieval";
			renderRetrieval(results);
			flash(`Retrieved ${results.length} results.`);
		});
	}

	/* 📤 Export Analysis: download JSON (server streaming) */
	if (btnExportAnalysis) {
		btnExportAnalysis.addEventListener("click", (e) => {
			e.preventDefault();
			const a = document.createElement("a");
			a.href = `/api/analysis/export?project=${encodeURIComponent(projectId)}`;
			a.download = `analysis-${projectId}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			flash("Export started.");
		});
	}
}

/* -------------------- bootstrap -------------------- */
document.addEventListener("DOMContentLoaded", initCaqdasInterface);
