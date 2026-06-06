export function safeText(value) {
	return String(value || "").trim();
}

export function categoryLabel(categoryKey) {
	return {
		perceptions: "perceptions",
		procedures: "procedures",
		decisions: "decisions",
		introspections: "introspections"
	}[categoryKey] || categoryKey;
}

export function normalizeCategoryKey(value) {
	const raw = safeText(value).toLowerCase();
	if (raw === "perceptions" || raw.includes("perception")) return "perceptions";
	if (raw === "procedures" || raw.includes("procedure") || raw.includes("day-to-day")) return "procedures";
	if (raw === "decisions" || raw.includes("decision") || raw.includes("methodological")) return "decisions";
	if (raw === "introspections" || raw.includes("introspection") || raw.includes("personal")) return "introspections";
	return "";
}

export function normalizeTags(value) {
	if (Array.isArray(value)) {
		return value
			.map(v => safeText(typeof v === "string" ? v : (v?.text || v?.name || v?.title || v?.label || "")))
			.filter(Boolean);
	}
	if (!value) return [];
	return String(value).split(",").map(s => s.trim()).filter(Boolean);
}

export function numeric(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

export function rounded(value, fallback = 0) {
	return Math.round(numeric(value, fallback));
}

export function firstMuralValue(body) {
	if (Array.isArray(body?.value)) return body.value[0] || null;
	if (body?.value) return body.value;
	if (Array.isArray(body)) return body[0] || null;
	return body || null;
}

export function muralErrorSummary(error) {
	const body = error?.body || error?.secondError || error?.firstError || null;
	if (!body) return String(error?.message || error);
	if (typeof body === "string") return body;
	return safeText(body.message || body.code || body.error || JSON.stringify(body));
}
