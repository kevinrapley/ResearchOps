/**
 * Front-end component for displaying and creating impact records in the
 * ResearchOps UI.
 */

(function() {
	const section = document.getElementById("impact-tracker");
	if (!section) return;

	const projectId = section.getAttribute("data-project-id");
	const studyId = section.getAttribute("data-study-id");
	const form = section.querySelector("#impact-form");
	const table = section.querySelector("#impact-table");
	const tableBody = section.querySelector("#impact-table tbody");
	const tableWrap = section.querySelector("#impact-table-wrap");
	const emptyState = section.querySelector("#impact-empty-state");
	const errorSummary = section.querySelector("#impact-error-summary");
	const recordIdInput = section.querySelector("#impact-record-id");
	const referenceInput = section.querySelector("#impact-insightId");
	const submitButton = section.querySelector("#impact-submit");
	const cancelEditButton = section.querySelector("#impact-cancel-edit");
	const copyStatus = section.querySelector("#impact-reference-copy-status");

	if (!projectId || !form || !tableBody || !tableWrap || !emptyState) {
		console.warn("[impact-tracker] Missing required elements or attributes");
		return;
	}

	let items = [];
	let editingRecordId = "";
	let pendingDeleteId = "";

	function escapeHtml(value) {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function formatNumber(value) {
		if (value === null || value === undefined || value === "") return "–";
		const number = Number(value);
		return Number.isNaN(number) ? escapeHtml(value) : number.toString();
	}

	function formatText(value) {
		return escapeHtml(value || "–");
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

	function checkedValue(name) {
		return form.querySelector(`[name="${name}"]:checked`)?.value || "";
	}

	function setCheckedValue(name, value) {
		const radios = Array.from(form.querySelectorAll(`[name="${name}"]`));
		radios.forEach((radio) => {
			radio.checked = radio.value === value;
		});
	}

	function dateFromFields() {
		const day = form.querySelector("#impact-date-day")?.value || "";
		const month = form.querySelector("#impact-date-month")?.value || "";
		const year = form.querySelector("#impact-date-year")?.value || "";
		if (!day && !month && !year) return "";
		if (!day || !month || !year) return "";
		return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}

	function setDateFields(value) {
		const date = String(value || "").slice(0, 10);
		const [year, month, day] = date.split("-");
		const dayInput = form.querySelector("#impact-date-day");
		const monthInput = form.querySelector("#impact-date-month");
		const yearInput = form.querySelector("#impact-date-year");
		if (dayInput) dayInput.value = day || "";
		if (monthInput) monthInput.value = month || "";
		if (yearInput) yearInput.value = year || "";
	}

	function impactReference() {
		let source = "";
		if (window.crypto && typeof window.crypto.randomUUID === "function") {
			source = window.crypto.randomUUID();
		} else {
			source = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
		}
		const suffix = source.replace(/[^a-fA-F0-9]/g, "").toLowerCase().padEnd(12, "0").slice(-12);
		return `IMPCT-RCD-${suffix}`;
	}

	function setCancelEditVisible(visible) {
		if (!cancelEditButton) return;
		cancelEditButton.hidden = !visible;
		if (visible) {
			cancelEditButton.removeAttribute("hidden");
		} else {
			cancelEditButton.setAttribute("hidden", "hidden");
		}
	}

	function resetForm() {
		form.reset();
		editingRecordId = "";
		pendingDeleteId = "";
		if (recordIdInput) recordIdInput.value = "";
		if (referenceInput) referenceInput.value = impactReference();
		if (copyStatus) copyStatus.textContent = "";
		if (submitButton) submitButton.textContent = "Save impact record";
		setCancelEditVisible(false);
		const today = new Date();
		setDateFields(today.toISOString().slice(0, 10));
		showErrors([]);
	}

	function cancelEdit(event) {
		event?.preventDefault();
		resetForm();
	}

	function payloadFromForm() {
		const fd = new FormData(form);
		return {
			projectId,
			studyId,
			displayRef: fd.get("displayRef") || referenceInput?.value || "",
			decisionLink: fd.get("decisionLink") || "",
			metricName: fd.get("metricName") || "",
			metricUnit: checkedValue("metricUnit"),
			metricDirection: checkedValue("metricDirection"),
			baseline: fd.get("baseline") ? Number(fd.get("baseline")) : null,
			target: fd.get("target") ? Number(fd.get("target")) : null,
			actual: fd.get("actual") ? Number(fd.get("actual")) : null,
			measurementWindow: checkedValue("measurementWindow"),
			impactType: checkedValue("impactType"),
			impactScale: checkedValue("impactScale"),
			status: checkedValue("status") || "planned",
			recordedAt: dateFromFields(),
			notes: fd.get("notes") || ""
		};
	}

	function validatePayload(payload) {
		const errors = [];
		if (!payload.metricName) errors.push({ id: "impact-metricName", message: "Enter a metric name" });
		if (!payload.metricUnit) errors.push({ id: "metricUnit", message: "Select a metric unit" });
		if (!payload.metricDirection) errors.push({ id: "metricDirection", message: "Select the desired direction" });
		if (!payload.impactType) errors.push({ id: "impactType", message: "Select an impact type" });
		if (!payload.impactScale) errors.push({ id: "impactScale", message: "Select an impact scale" });
		if (!payload.status) errors.push({ id: "status", message: "Select a status" });
		return errors;
	}

	function renderTable(nextItems) {
		items = Array.isArray(nextItems) ? nextItems : [];
		tableBody.innerHTML = "";
		pendingDeleteId = "";

		if (!items.length) {
			tableWrap.hidden = true;
			emptyState.hidden = false;
			return;
		}

		tableWrap.hidden = false;
		emptyState.hidden = true;

		for (const item of items) {
			const recordId = item.id || item.recordId || "";
			const displayRef = item.displayRef || item.insightId || recordId || "Impact record";
			const row = document.createElement("tr");
			row.className = "govuk-table__row";
			row.id = `impact-record-${escapeHtml(recordId)}`;
			row.innerHTML = [
				`<td class="govuk-table__cell">${escapeHtml(displayRef)}</td>`,
				`<td class="govuk-table__cell">${item.decisionLink ? `<a class="govuk-link" href="${escapeHtml(item.decisionLink)}">Decision record</a>` : "–"}</td>`,
				`<td class="govuk-table__cell">${formatText(item.metricName)}</td>`,
				`<td class="govuk-table__cell govuk-table__cell--numeric">${formatNumber(item.baseline)}</td>`,
				`<td class="govuk-table__cell govuk-table__cell--numeric">${formatNumber(item.target)}</td>`,
				`<td class="govuk-table__cell govuk-table__cell--numeric">${formatNumber(item.actual)}</td>`,
				`<td class="govuk-table__cell">${formatText(item.impactType)}</td>`
			].join("");
			tableBody.appendChild(row);

			const actionsRow = document.createElement("tr");
			actionsRow.className = "govuk-table__row impact-record-action-row";
			actionsRow.innerHTML = `
<td class="govuk-table__cell impact-record-action-cell" colspan="7">
<div class="impact-record-actions" data-impact-actions="${escapeHtml(recordId)}">
<button type="button" class="govuk-button govuk-button--secondary" data-impact-edit="${escapeHtml(recordId)}">Edit impact record ${escapeHtml(displayRef)}</button>
<button type="button" class="govuk-button govuk-button--warning" data-impact-delete="${escapeHtml(recordId)}">Delete impact record ${escapeHtml(displayRef)}</button>
</div>
<div class="impact-record-delete-confirmation" data-impact-confirm="${escapeHtml(recordId)}" hidden>
<p class="govuk-body">Are you sure you want to delete impact record ${escapeHtml(displayRef)}?</p>
<button type="button" class="govuk-button govuk-button--warning" data-impact-confirm-delete="${escapeHtml(recordId)}">Delete impact record</button>
<button type="button" class="govuk-button govuk-button--secondary" data-impact-cancel-delete="${escapeHtml(recordId)}">Cancel</button>
</div>
</td>`;
			tableBody.appendChild(actionsRow);
		}
	}

	function fillForm(item) {
		editingRecordId = item.id || item.recordId || "";
		if (recordIdInput) recordIdInput.value = editingRecordId;
		if (referenceInput) referenceInput.value = item.displayRef || item.insightId || "";
		if (copyStatus) copyStatus.textContent = "";
		form.querySelector("#impact-decisionLink").value = item.decisionLink || "";
		form.querySelector("#impact-metricName").value = item.metricName || "";
		form.querySelector("#impact-baseline").value = item.baseline ?? "";
		form.querySelector("#impact-target").value = item.target ?? "";
		form.querySelector("#impact-actual").value = item.actual ?? "";
		form.querySelector("#impact-notes").value = item.notes || "";
		setCheckedValue("metricUnit", item.metricUnit || "");
		setCheckedValue("metricDirection", item.metricDirection || "");
		setCheckedValue("measurementWindow", item.measurementWindow || "");
		setCheckedValue("impactType", item.impactType || "");
		setCheckedValue("impactScale", item.impactScale || "");
		setCheckedValue("status", item.status || "");
		setDateFields(item.recordedAt || item.updatedAt || "");
		if (submitButton) submitButton.textContent = "Save changes";
		setCancelEditVisible(true);
		form.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	async function fetchImpact() {
		const params = new URLSearchParams({ project: projectId });
		if (studyId) params.set("study", studyId);
		try {
			const res = await fetch(`/api/impact?${params.toString()}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			renderTable(Array.isArray(data.items) ? data.items : []);
		} catch (err) {
			console.error("[impact-tracker] list error", err);
		}
	}

	async function saveImpact(payload) {
		const isUpdate = !!editingRecordId;
		const res = await fetch(isUpdate ? `/api/impact/${encodeURIComponent(editingRecordId)}` : "/api/impact", {
			method: isUpdate ? "PATCH" : "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		});
		const json = await res.json().catch(() => ({}));
		if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
		return json.impact;
	}

	async function deleteImpact(recordId) {
		const res = await fetch(`/api/impact/${encodeURIComponent(recordId)}`, { method: "DELETE" });
		const json = await res.json().catch(() => ({}));
		if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
	}

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const payload = payloadFromForm();
		const errors = validatePayload(payload);
		showErrors(errors);
		if (errors.length) return;

		try {
			await saveImpact(payload);
			resetForm();
			await fetchImpact();
		} catch (err) {
			showErrors([{ id: "impact-metricName", message: `Could not save impact record. ${String(err?.message || err)}` }]);
		}
	});

	cancelEditButton?.addEventListener("click", cancelEdit);

	table?.addEventListener("click", async (event) => {
		const edit = event.target.closest("[data-impact-edit]");
		const startDelete = event.target.closest("[data-impact-delete]");
		const confirmDelete = event.target.closest("[data-impact-confirm-delete]");
		const cancelDelete = event.target.closest("[data-impact-cancel-delete]");

		if (edit) {
			const item = items.find(record => (record.id || record.recordId) === edit.dataset.impactEdit);
			if (item) fillForm(item);
			return;
		}

		if (startDelete) {
			pendingDeleteId = startDelete.dataset.impactDelete;
			const actions = table.querySelector(`[data-impact-actions="${CSS.escape(pendingDeleteId)}"]`);
			const confirmation = table.querySelector(`[data-impact-confirm="${CSS.escape(pendingDeleteId)}"]`);
			if (actions) actions.hidden = true;
			if (confirmation) confirmation.hidden = false;
			return;
		}

		if (cancelDelete) {
			const id = cancelDelete.dataset.impactCancelDelete;
			const actions = table.querySelector(`[data-impact-actions="${CSS.escape(id)}"]`);
			const confirmation = table.querySelector(`[data-impact-confirm="${CSS.escape(id)}"]`);
			if (actions) actions.hidden = false;
			if (confirmation) confirmation.hidden = true;
			pendingDeleteId = "";
			return;
		}

		if (confirmDelete) {
			const id = confirmDelete.dataset.impactConfirmDelete;
			if (!id || id !== pendingDeleteId) return;
			try {
				await deleteImpact(id);
				if (editingRecordId === id) resetForm();
				await fetchImpact();
			} catch (err) {
				showErrors([{ id: "impact-metricName", message: `Could not delete impact record. ${String(err?.message || err)}` }]);
			}
		}
	});

	resetForm();
	fetchImpact();
})();
