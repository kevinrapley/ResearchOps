/**
 * @file public/js/synthesize-page.js
 * @module SynthesizePage
 * @summary Local ResearchOps synthesis UI for legacy SDK records.
 */

const filterInput = document.getElementById("filter");
const evidenceContainer = document.getElementById("evidence");
const clustersContainer = document.getElementById("clusters");
const newClusterInput = document.getElementById("newCluster");
const addClusterButton = document.getElementById("addCluster");
const clusterSelect = document.getElementById("clusterSelect");
const themeLabelInput = document.getElementById("themeLabel");
const themeDescriptionInput = document.getElementById("themeDesc");
const publishButton = document.getElementById("publish");
const statusMessage = document.getElementById("status");

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function uid(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getCtx() {
	return {
		org: localStorage.getItem("rops.org") || "home-office-biometrics",
		project: localStorage.getItem("rops.project") || "demo",
		study: localStorage.getItem("rops.study") || "demo",
		user: localStorage.getItem("rops.user") || "you@homeoffice.gov.uk"
	};
}

function readStoredEntities() {
	const entities = [];

	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (!key) continue;

		try {
			const value = JSON.parse(localStorage.getItem(key) || "null");
			if (value && typeof value === "object" && value.entityType) {
				entities.push(value);
			}
		} catch {
			// Ignore non-JSON localStorage entries.
		}
	}

	return entities;
}

function searchEntities({ type = "" } = {}) {
	const entities = readStoredEntities();
	return type ? entities.filter(entity => entity.entityType === type) : entities;
}

function envelope(entityType, body) {
	const ctx = getCtx();

	return {
		id: body.id || uid(entityType.toLowerCase()),
		type: entityType,
		entityType,
		created: new Date().toISOString(),
		creator: ctx.user,
		scope: {
			org: ctx.org,
			project: ctx.project,
			study: ctx.study
		},
		...body
	};
}

function saveEntity(collection, entity) {
	localStorage.setItem(`${collection}:${entity.id}`, JSON.stringify(entity));
	return entity;
}

function createCluster({ label, members = [], id } = {}) {
	const cluster = envelope("Cluster", {
		id,
		name: label || "Untitled cluster",
		members
	});

	return saveEntity("cluster", cluster);
}

function publishTheme({ label, description = "", evidenceIds = [] } = {}) {
	const theme = envelope("Theme", {
		name: label,
		description,
		evidenceIds
	});

	return saveEntity("theme", theme);
}

function makeElement(html) {
	const wrapper = document.createElement("div");
	wrapper.innerHTML = html.trim();
	return wrapper.firstElementChild;
}

async function loadEvidence(tagFilter = "") {
	if (!evidenceContainer) return;

	const notes = searchEntities({ type: "Note" });
	const tags = searchEntities({ type: "Tag" });
	const tagsByNote = new Map();

	for (const tag of tags) {
		const existing = tagsByNote.get(tag.hasTarget) || [];
		existing.push(tag);
		tagsByNote.set(tag.hasTarget, existing);
	}

	evidenceContainer.innerHTML = "";

	for (const note of notes) {
		const noteTags = tagsByNote.get(note.id) || [];
		const filter = tagFilter.trim().toLowerCase();

		if (filter && !noteTags.some(tag => String(tag.name || "").toLowerCase().includes(filter))) {
			continue;
		}

		const tagHtml = noteTags
			.map(tag => `<span class="tag">${escapeHtml(tag.name)}</span>`)
			.join("");

		const card = makeElement(`<div class="note" draggable="true" data-id="${escapeHtml(note.id)}">
	<div><strong>${escapeHtml(new Date(note.created).toLocaleString())}</strong></div>
	<div>${escapeHtml(note.hasBody)}</div>
	<div>${tagHtml}</div>
</div>`);

		card.addEventListener("dragstart", event => {
			event.dataTransfer.setData("text/plain", note.id);
		});

		evidenceContainer.appendChild(card);
	}

	if (!evidenceContainer.children.length) {
		evidenceContainer.innerHTML = '<div class="govuk-hint">No evidence found.</div>';
	}
}

async function loadClusters() {
	if (!clustersContainer || !clusterSelect) return;

	const clusters = searchEntities({ type: "Cluster" });

	clustersContainer.innerHTML = "";
	clusterSelect.innerHTML = "";

	for (const cluster of clusters) {
		const box = makeElement(`<div class="cluster" data-id="${escapeHtml(cluster.id)}">
	<div><strong>${escapeHtml(cluster.name)}</strong> <span class="govuk-hint">(${escapeHtml((cluster.members || []).length)} items)</span></div>
	<div class="bin"></div>
</div>`);

		box.addEventListener("dragover", event => event.preventDefault());
		box.addEventListener("drop", async event => {
			const noteId = event.dataTransfer.getData("text/plain");
			const fresh = searchEntities({ type: "Cluster" }).find(item => item.id === cluster.id) || cluster;
			const members = new Set([...(fresh.members || []), noteId]);

			createCluster({
				label: cluster.name,
				members: Array.from(members),
				id: cluster.id
			});

			await loadClusters();
		});

		clustersContainer.appendChild(box);

		const option = document.createElement("option");
		option.value = cluster.id;
		option.textContent = cluster.name;
		clusterSelect.appendChild(option);
	}

	if (!clusters.length) {
		clustersContainer.innerHTML = '<div class="govuk-hint">No clusters yet.</div>';
	}
}

async function addCluster() {
	const label = newClusterInput?.value.trim() || "";
	if (!label) return;

	createCluster({ label, members: [] });
	if (newClusterInput) newClusterInput.value = "";
	await loadClusters();
}

async function handlePublishTheme() {
	const clusterId = clusterSelect?.value || "";
	if (!clusterId) {
		alert("Create/select a cluster.");
		return;
	}

	const cluster = searchEntities({ type: "Cluster" }).find(item => item.id === clusterId);
	const label = themeLabelInput?.value.trim() || "";
	const description = themeDescriptionInput?.value.trim() || "";

	if (!label) {
		alert("Theme label required.");
		return;
	}

	const theme = publishTheme({
		label,
		description,
		evidenceIds: cluster?.members || []
	});

	if (statusMessage) statusMessage.textContent = `Published theme ${theme.id}`;
}

addClusterButton?.addEventListener("click", addCluster);
publishButton?.addEventListener("click", handlePublishTheme);
filterInput?.addEventListener("input", event => loadEvidence(event.target.value));

await loadEvidence("");
await loadClusters();

window.__ropsSynthesize = Object.freeze({
	createCluster,
	publishTheme,
	readStoredEntities,
	searchEntities
});
