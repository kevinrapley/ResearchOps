import { toMs } from "../../core/utils.js";

export function normaliseKey(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function unique(values = []) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = String(value || "").trim();
		const key = normaliseKey(text);
		if (!text || seen.has(key)) continue;
		seen.add(key);
		out.push(text);
	}
	return out;
}

export function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim() !== "") return value;
	}
	return "";
}

export function tryJson(value) {
	if (typeof value !== "string") return null;
	const text = value.trim();
	if (!text || !/^[{[]/.test(text)) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

export function looksLikeStructuredValue(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return (
		/^_?\s*[{[]/.test(text) ||
		/"{1,3}email"{1,3}\s*:/i.test(text) ||
		/"{1,3}role"{1,3}\s*:/i.test(text) ||
		/"{1,3}name"{1,3}\s*:/i.test(text) ||
		/^[}\]]+$/.test(text)
	);
}

export function displayText(value) {
	if (Array.isArray(value) || (value && typeof value === "object")) return "";
	const text = String(value || "")
		.trim()
		.replace(/^_+(?=\s*[{[])/, "");
	if (!text || looksLikeStructuredValue(text)) return "";
	return text;
}

export function labelFromObject(item = {}) {
	return firstPresent(
		item.name,
		item.Name,
		item.label,
		item.Label,
		item.title,
		item.Title,
		item.text,
		item.Text,
		item.value,
		item.Value,
	);
}

export function labelFromContentObject(item = {}) {
	return firstPresent(item.label, item.Label, item.title, item.Title, item.text, item.Text, item.value, item.Value);
}

export function looksLikeIdentityFragment(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return (
		/"?EMAIL"?\s*:/i.test(text) ||
		/"?email"?\s*:/i.test(text) ||
		/"?role"?\s*:/i.test(text) ||
		/"{1,3}EMAIL"{1,3}\s*:/i.test(text) ||
		/"{1,3}email"{1,3}\s*:/i.test(text) ||
		/"{1,3}role"{1,3}\s*:/i.test(text) ||
		/^[}\]]+$/.test(text) ||
		/^[{[]/.test(text) ||
		(/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text))
	);
}

export function normaliseLines(value) {
	const parsed = tryJson(value);
	if (parsed) return normaliseLines(parsed);

	if (Array.isArray(value)) return unique(value.flatMap((item) => normaliseLines(item)));

	if (value && typeof value === "object") {
		const label = displayText(labelFromContentObject(value));
		return label ? [label] : [];
	}

	return unique(
		String(value || "")
			.split(/\r?\n|[|]/)
			.map((item) => displayText(item))
			.filter((item) => item && !looksLikeIdentityFragment(item)),
	);
}

export function normaliseLabelList(value) {
	const parsed = tryJson(value);
	if (parsed) return normaliseLabelList(parsed);

	if (Array.isArray(value)) return unique(value.flatMap((item) => normaliseLabelList(item)));

	if (value && typeof value === "object") {
		const label = displayText(labelFromContentObject(value) || labelFromObject(value));
		return label && !looksLikeIdentityFragment(label) ? [label] : [];
	}

	return unique(
		String(value || "")
			.split(/\r?\n|[|,]/)
			.map((item) => displayText(item))
			.filter((item) => item && !looksLikeIdentityFragment(item)),
	);
}

export function normaliseUserGroups(value) {
	return normaliseLabelList(value);
}

export function normaliseStakeholders(value) {
	const parsed = tryJson(value);
	const list = parsed || value;

	if (!Array.isArray(list)) return [];

	return list
		.map((item) => ({
			name: displayText(item?.name || item?.Name || ""),
			role: displayText(item?.role || item?.Role || ""),
			email: String(item?.email || item?.Email || item?.EMAIL || "").trim(),
		}))
		.filter((item) => item.name || item.role || item.email);
}

export function valuesFromFieldValue(value) {
	const parsed = tryJson(value);
	if (parsed) return valuesFromFieldValue(parsed);
	if (Array.isArray(value)) return value.flatMap(valuesFromFieldValue);
	if (value && typeof value === "object") {
		const id = displayText(firstPresent(value.id, value.ID));
		const label = displayText(labelFromObject(value));
		return [id, label].filter(Boolean);
	}
	const text = displayText(value);
	return text ? [text] : [];
}

export function valuesFromFields(fields = {}, names = []) {
	return names.flatMap((name) => valuesFromFieldValue(fields[name]));
}

export function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

export function normaliseTeamIds(fields = {}) {
	return unique(
		valuesFromFields(fields, [
			"Team ID",
			"Team IDs",
			"TeamId",
			"TeamIds",
			"team_id",
			"team_ids",
			"Team",
			"Teams",
			"Project Team",
			"Project Teams",
			"Owning Team",
			"Owning Teams",
		]).filter((value) => normaliseKey(value).startsWith("team-") || isAirtableRecordId(value)),
	);
}

export function normaliseTeamNames(fields = {}) {
	const explicitNames = valuesFromFields(fields, [
		"Team Name",
		"Team Names",
		"Team name",
		"Team names",
		"teamName",
		"teamNames",
		"team_name",
		"team_names",
		"Org",
		"org",
		"Organisation",
		"Organization",
		"Project Team Name",
		"Project Team Names",
		"Owning Team Name",
		"Owning Team Names",
	]);

	const linkedNames = valuesFromFields(fields, ["Team", "Teams", "Project Team", "Project Teams", "Owning Team", "Owning Teams"]).filter(
		(value) => !isAirtableRecordId(value) && !normaliseKey(value).startsWith("team-"),
	);

	return unique([...explicitNames, ...linkedNames]).filter((value) => !looksLikeIdentityFragment(value));
}

export function publicProjectId(fields = {}, record = {}) {
	return displayText(
		firstPresent(
			fields.PID,
			fields.Pid,
			fields.pid,
			fields["Project ID"],
			fields.ProjectID,
			fields.projectId,
			fields.LocalId,
			fields.localId,
			record.localId,
			record.LocalId,
			record.id,
		),
	);
}

export function isRenderableProject(project = {}) {
	return Boolean(project.id && project.name && !looksLikeStructuredValue(project.name));
}

export function mapProject(r) {
	const f = r?.fields || {};
	const airtableId = displayText(r?.id || "");
	const id = publicProjectId(f, { id: airtableId });
	const teamNames = normaliseTeamNames(f);
	const teamIds = normaliseTeamIds(f);
	const teamName = teamNames[0] || "";

	return {
		id,
		pid: id,
		localId: id,
		LocalId: id,
		airtableId,
		recordId: airtableId,
		name: displayText(f.Name || f["Project Name"] || f.Title || ""),
		description: displayText(f.Description || f.Summary || ""),
		"rops:servicePhase": displayText(f.Phase || f["Service Phase"] || ""),
		"rops:projectStatus": displayText(f.Status || f["Project Status"] || ""),
		objectives: normaliseLines(f.Objectives || f["Research Objectives"] || ""),
		user_groups: normaliseUserGroups(f.UserGroups || f["User Groups"] || ""),
		stakeholders: normaliseStakeholders(f.Stakeholders || []),
		createdAt: displayText(r.createdTime || f.CreatedAt || f["Created At"] || ""),
		team_ids: teamIds,
		teamIds,
		teamNames,
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName || displayText(f.Org || f.org || ""),
	};
}

export function compareProjects(a = {}, b = {}) {
	const dateOrder = toMs(b.createdAt) - toMs(a.createdAt);
	if (dateOrder !== 0) return dateOrder;

	const an = String(a.name || "").toLocaleLowerCase();
	const bn = String(b.name || "").toLocaleLowerCase();
	if (an && !bn) return -1;
	if (!an && bn) return 1;
	if (an < bn) return -1;
	if (an > bn) return 1;

	const ai = String(a.id || a.LocalId || a.airtableId || "");
	const bi = String(b.id || b.LocalId || b.airtableId || "");
	return ai.localeCompare(bi);
}
