/**
 * @file /js/caqdas-interface.js
 * @description CAQDAS heavy-lifting for the Analysis tab only.
 * Exposes: runTimeline(projectId), runCooccurrence(projectId), runRetrieval(projectId), runExport(projectId)
 */

/* eslint-env browser */

// ---------- tiny helpers ----------
function $(s, r) { if (!r) r = document; return r.querySelector(s); }

function esc(s) { var d = document.createElement("div");
	d.textContent = String(s || ""); return d.innerHTML; }

function when(iso) { return iso ? new Date(iso).toLocaleString() : "—"; }

function fetchJSON(url, init) {
	return fetch(url, init).then(function(res) {
		return res.text().then(function(txt) {
			var ct = (res.headers.get("content-type") || "").toLowerCase();
			var body = ct.indexOf("application/json") >= 0 ? (txt ? JSON.parse(txt) : {}) : {};
			if (!res.ok) {
				var err = new Error("HTTP " + res.status + (txt ? " — " + txt : ""));
				err.response = body;
				throw err;
			}
			return body;
		});
	});
}

function updateJsonPanel(data, filename) {
	var host = document.getElementById("analysis-container") || document.body;
	var code = document.getElementById("json-code");
	if (!code) {
		var details = document.getElementById("json-viewer");
		if (!details) {
			details = document.createElement("details");
			details.id = "json-viewer";
			details.className = "govuk-details govuk-!-margin-top-4";
			details.setAttribute("data-module", "govuk-details");
			details.innerHTML =
				'<summary class="govuk-details__summary"><span class="govuk-details__summary-text">View raw JSON</span></summary>' +
				'<div class="govuk-details__text">' +
				'  <div class="govuk-button-group">' +
				'    <button type="button" class="govuk-button govuk-button--secondary" id="json-copy">Copy JSON</button>' +
				'    <button type="button" class="govuk-button govuk-button--secondary" id="json-download">Download JSON</button>' +
				'  </div>' +
				'  <pre class="app-codeblock" tabindex="0" aria-label="Raw JSON"><code id="json-code"></code></pre>' +
				'</div>';
			host.appendChild(details);
		}
		code = document.getElementById("json-code");

		var btnCopy = document.getElementById("json-copy");
		var btnDl = document.getElementById("json-download");
		if (btnCopy) {
			btnCopy.addEventListener("click", function() {
				var raw = code ? code.textContent : "";
				navigator.clipboard.writeText(String(raw || "")).catch(function() {});
			});
		}
		if (btnDl) {
			btnDl.addEventListener("click", function() {
				var raw = code ? code.textContent : "{}";
				var blob = new Blob([raw], { type: "application/json;charset=utf-8" });
				var a = document.createElement("a");
				a.href = URL.createObjectURL(blob);
				a.download = filename || "analysis.json";
				a.click();
				setTimeout(function() { URL.revokeObjectURL(a.href); }, 0);
			});
		}
	}

	var json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
	var safe = json.replace(/[&<>]/g, function(c) { return c === "&" ? "&amp;" : (c === "<" ? "&lt;" : "&gt;"); })
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"(?=\s*:)/g, function(m) { return '<span class="k">' + m + "</span>"; })
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"/g, function(m) { return '<span class="s">' + m + "</span>"; })
		.replace(/\b-?(0x[\da-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)\b/g, function(m) { return '<span class="n">' + m + "</span>"; })
		.replace(/\b(true|false|null)\b/g, function(m) { return '<span class="b">' + m + "</span>"; });

	code.innerHTML = safe;
	code.dataset.filename = filename || "analysis.json";
}

function nodeLabel(nodes, id) {
	for (var i = 0; i < nodes.length; i += 1) {
		var n = nodes[i];
		if (n && n.id === id) return n.label || n.name || String(id);
	}
	return String(id);
}

// ---------- public API ----------
function runTimeline(projectId) {
	var wrap = document.getElementById("analysis-timeline");
	if (wrap) wrap.innerHTML = "<p>Loading timeline…</p>";

	var url = "/api/analysis/timeline?project=" + encodeURIComponent(projectId || "");
	return fetchJSON(url).then(function(res) {
		var items = Array.isArray(res && res.timeline) ? res.timeline : [];
		updateJsonPanel({ timeline: items }, "timeline-" + String(projectId || "unknown") + ".json");
		if (!wrap) return;
		if (!items.length) { wrap.innerHTML = '<p class="hint">No journal entries yet.</p>'; return; }
		var html = '' +
			'<ul class="analysis-list">' +
			items.map(function(en) {
				return '' +
					'<li class="analysis-list__item">' +
					'  <div class="summary-card">' +
					'    <div class="summary-card__title-row">' +
					'      <h4 class="summary-card__title">' + when(en.createdAt) + '</h4>' +
					(en.category ? ('<span class="tag">' + esc(en.category) + '</span>') : '') +
					'    </div>' +
					'    <div class="summary-card__content">' +
					'      <dl class="summary">' +
					'        <div class="summary__row">' +
					'          <dt class="summary__key">Entry</dt>' +
					'          <dd class="summary__value">' + esc(en.body || en.content || '') + '</dd>' +
					'        </div>' +
					'      </dl>' +
					'    </div>' +
					'  </div>' +
					'</li>';
			}).join('') +
			'</ul>';
		wrap.innerHTML = html;
	});
}

function runCooccurrence(projectId) {
	var wrap = document.getElementById("analysis-cooccurrence");
	if (wrap) wrap.innerHTML = "<p>Loading co-occurrence…</p>";

	var url = "/api/analysis/cooccurrence?project=" + encodeURIComponent(projectId || "");
	return fetchJSON(url).then(function(res) {
		var nodes = Array.isArray(res && res.nodes) ? res.nodes : [];
		var links = Array.isArray(res && res.links) ? res.links : [];
		updateJsonPanel({ nodes: nodes, links: links }, "cooccurrence-" + String(projectId || "unknown") + ".json");

		if (!wrap) return;
		if (!links.length) { wrap.innerHTML = '<p class="hint">No co-occurrences yet.</p>'; return; }

		links.sort(function(a, b) { return (b.weight || 0) - (a.weight || 0); });
		var html = '' +
			'<table class="table">' +
			'  <caption>Code pairs by strength</caption>' +
			'  <thead><tr><th>Source</th><th>Target</th><th>Weight</th></tr></thead>' +
			'  <tbody>' +
			links.map(function(l) {
				return '' +
					'<tr>' +
					'  <td><span class="tag">' + esc(nodeLabel(nodes, l.source)) + '</span></td>' +
					'  <td><span class="tag">' + esc(nodeLabel(nodes, l.target)) + '</span></td>' +
					'  <td>' + esc(String(l.weight == null ? 1 : l.weight)) + '</td>' +
					'</tr>';
			}).join('') +
			'  </tbody>' +
			'</table>';
		wrap.innerHTML = html;
	});
}

function runRetrieval(projectId) {
	var form = document.getElementById("retrieval-form");
	var results = document.getElementById("retrieval-results");
	if (!form || !results) return;

	// replace handler to avoid duplicates
	var clone = form.cloneNode(true);
	form.parentNode.replaceChild(clone, form);
	form = document.getElementById("retrieval-form");

	form.addEventListener("submit", function(e) {
		e.preventDefault();
		var qEl = document.getElementById("retrieval-q");
		var term = qEl ? String(qEl.value || "").trim() : "";
		if (!term) { results.innerHTML = '<p class="hint">Enter a term to search.</p>'; return; }
		results.innerHTML = "<p>Searching…</p>";

		var url = "/api/analysis/retrieval?project=" + encodeURIComponent(projectId || "") + "&q=" + encodeURIComponent(term);
		fetchJSON(url).then(function(res) {
			var out = Array.isArray(res && res.results) ? res.results : [];
			updateJsonPanel({ query: term, results: out }, "retrieval-" + String(projectId || "unknown") + ".json");
			if (!out.length) { results.innerHTML = '<p class="hint">No matches found.</p>'; return; }

			var rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
			var html = '' +
				'<ul class="analysis-list analysis-list--spaced" aria-live="polite">' +
				out.map(function(r) {
					var codes = Array.isArray(r && r.codes) ? r.codes : [];
					var badges = codes.map(function(c) { return '<span class="tag">' + esc(c.name) + '</span>'; }).join(' ');
					var snip = esc(r.snippet || "").replace(rx, function(m) { return "<mark>" + m + "</mark>"; });
					return '<li><h5 class="analysis-subheading">' + badges + '</h5><p>' + snip + '</p></li>';
				}).join('') +
				'</ul>';
			results.innerHTML = html;
		}).catch(function() {
			results.innerHTML = '<p class="hint">Search failed.</p>';
		});
	});
}

function runExport(projectId) {
	var tUrl = "/api/analysis/timeline?project=" + encodeURIComponent(projectId || "");
	var cUrl = "/api/analysis/cooccurrence?project=" + encodeURIComponent(projectId || "");
	return Promise.all([fetchJSON(tUrl), fetchJSON(cUrl)]).then(function(arr) {
		var timeline = arr[0] && arr[0].timeline ? arr[0].timeline : [];
		var nodes = arr[1] && arr[1].nodes ? arr[1].nodes : [];
		var links = arr[1] && arr[1].links ? arr[1].links : [];
		var payload = {
			projectId: projectId || "",
			generatedAt: new Date().toISOString(),
			timeline: timeline,
			nodes: nodes,
			links: links
		};
		updateJsonPanel(payload, "analysis-" + String(projectId || "unknown") + ".json");

		var el = document.getElementById("flash");
		if (!el) {
			el = document.createElement("div");
			el.id = "flash";
			el.setAttribute("role", "status");
			el.setAttribute("aria-live", "polite");
			el.style.margin = "12px 0";
			el.style.padding = "12px";
			el.style.border = "1px solid #d0d7de";
			el.style.background = "#fff";
			var main = document.querySelector("main");
			if (main) main.prepend(el);
		}
		el.textContent = "Export ready in JSON panel. Use Download JSON.";
	}).catch(function() {
		var el = document.getElementById("flash");
		if (!el) {
			el = document.createElement("div");
			el.id = "flash";
			el.setAttribute("role", "status");
			el.setAttribute("aria-live", "polite");
			el.style.margin = "12px 0";
			el.style.padding = "12px";
			el.style.border = "1px solid #d0d7de";
			el.style.background = "#fff";
			var main = document.querySelector("main");
			if (main) main.prepend(el);
		}
		el.textContent = "Failed to prepare export.";
	});
}

export { runTimeline, runCooccurrence, runRetrieval, runExport };
