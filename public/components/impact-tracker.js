/**
 * Front-end component for displaying and creating impact records in the
 * ResearchOps UI. This module expects a section with id "impact-tracker"
 * and data attributes for projectId and optional studyId. It fetches
 * impact records from the /api/impact endpoint and renders them in a table.
 * The form inside the section allows users to submit new impact records.
 */

(function() {
	const section = document.getElementById("impact-tracker");
	if (!section) return;

	const projectId = section.getAttribute("data-project-id");
	const studyId = section.getAttribute("data-study-id");
	const form = section.querySelector("#impact-form");
	const tableBody = section.querySelector("#impact-table tbody");
	const errorSummary = section.querySelector("#impact-error-summary");

	if (!projectId || !form || !tableBody) {
		console.warn("[impact-tracker] Missing required elements or attributes");
		return;
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function formatNumber(n) {
		if (n === null || n === undefined || n === "") return "–";
		const num = Number(n);
		return Number.isNaN(num) ? escapeHtml(n) : num.toString();
	}

	function errorListFor(summary) {
		if (!summary) return null;
		let list = summary.querySelector(".govuk-error-summary__list");
		if (list) return list;

		const body = summary.querySelector(".govuk-error-summary__body");
		if (!body) return null;

		list = document.createElement("ul");
		list.className = "govuk-list govuk-error-summary__list";
		body.append(list);
		return list;
	}

	function showErrors(errors = []) {
		const list = errorListFor(errorSummary);
		if (!errorSummary || !list) return;

		if (!errors.length) {
			errorSummary.hidden = true;
			list.innerHTML = "";
			return;
		}

		list.innerHTML = errors.map((error) => `<li><a href="#${error.id}">${escapeHtml(error.message)}</a></li>`).join("");
		errorSummary.hidden = false;
		errorSummary.focus();
	}

	async function fetchImpact() {
		const params = new URLSearchParams({ project: projectId });
		if (studyId) params.set("study", studyId);
		const url = `/api/impact?${params.toString()}`;
		try {
			const res = await fetch(url);
			if (!res.ok) {
				console.error("[impact-tracker] list failed", res.status);
				return;
			}
			const data = await res.json();
			renderTable(Array.isArray(data.items) ? data.items : []);
		} catch (err) {
			console.error("[impact-tracker] list error", err);
		}
	}

	function renderTable(items) {
		tableBody.innerHTML = "";
		if (!items.length) {
			const row = document.createElement("tr");
			row.className = "govuk-table__row";
			const cell = document.createElement("td");
			cell.className = "govuk-table__cell";
			cell.colSpan = 7;
			cell.textContent = "No impact records yet.";
			row.appendChild(cell);
			tableBody.appendChild(row);
			return;
		}
		for (const item of items) {
			const row = document.createElement("tr");
			row.className = "govuk-table__row";
			row.innerHTML = [
				`<td class="govuk-table__cell">${escapeHtml(item["Insight ID"] || item.insightId || "")}</td>`,
				`<td class="govuk-table__cell">${escapeHtml(item["Decision Link"] || item.decisionLink || "")}</td>`,
				`<td class="govuk-table__cell">${escapeHtml(item["Metric Name"] || item.metricName || "")}</td>`,
				`<td class="govuk-table__cell govuk-table__cell--numeric">${formatNumber(item["Baseline"] || item.baseline)}</td>`,
				`<td class="govuk-table__cell govuk-table__cell--numeric">${formatNumber(item["Target"] || item.target)}</td>`,
				`<td class="govuk-table__cell govuk-table__cell--numeric">${formatNumber(item["Actual"] || item.actual)}</td>`,
				`<td class="govuk-table__cell">${escapeHtml(item["Impact Type"] || item.impactType || "")}</td>`
			].join("");
			tableBody.appendChild(row);
		}
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const fd = new FormData(form);
		const payload = {
			projectId,
			studyId,
			insightId: fd.get("insightId") || null,
			decisionLink: fd.get("decisionLink") || null,
			metricName: fd.get("metricName") || null,
			baseline: fd.get("baseline") ? Number(fd.get("baseline")) : null,
			target: fd.get("target") ? Number(fd.get("target")) : null,
			actual: fd.get("actual") ? Number(fd.get("actual")) : null,
			impactType: fd.get("impactType") || "product",
			impactScale: fd.get("impactScale") || "feature",
			notes: fd.get("notes") || ""
		};
		if (!payload.metricName) {
			showErrors([{ id: "impact-metricName", message: "Enter a metric name" }]);
			return;
		}
		showErrors([]);
		try {
			const res = await fetch("/api/impact", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				console.error("[impact-tracker] create failed", res.status);
				return;
			}
			form.reset();
			fetchImpact();
		} catch (err) {
			console.error("[impact-tracker] create error", err);
		}
	});

	fetchImpact();
})();
