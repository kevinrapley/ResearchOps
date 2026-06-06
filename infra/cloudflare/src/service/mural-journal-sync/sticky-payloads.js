import { normalizeTags, numeric, rounded, safeText } from "./text.js";

export function dedupeTags(tags) {
	const seen = new Set();
	const out = [];
	for (const tag of tags.map(safeText).filter(Boolean)) {
		const key = tag.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(tag);
	}
	return out;
}

export function tagsForEntry(template, payload, syncTag) {
	const templateTags = normalizeTags(template?.tags);
	const fallbackTags = templateTags.length ? templateTags : [payload.categoryKey, payload.projectName];
	return dedupeTags([...fallbackTags, syncTag, ...payload.tags]);
}

export function stickyStyleFromTemplate(template) {
	const source = template?.style || {};
	const style = {
		backgroundColor: safeText(source.backgroundColor || template?.backgroundColor || "#FFFFFFFF") || "#FFFFFFFF",
		fontSize: rounded(source.fontSize ?? template?.fontSize, 23),
		textAlign: safeText(source.textAlign || template?.textAlign || "left") || "left"
	};

	if (source.bold !== undefined) style.bold = !!source.bold;
	if (source.italic !== undefined) style.italic = !!source.italic;
	if (source.underline !== undefined) style.underline = !!source.underline;
	if (source.strike !== undefined) style.strike = !!source.strike;
	if (source.font) style.font = source.font;
	if (source.border !== undefined) style.border = !!source.border;

	return style;
}

export function stickyPayloadFromTemplate(template, { text, tags, placement, syncTitle }) {
	const payload = {
		x: placement.x,
		y: placement.y,
		width: placement.width,
		height: placement.height,
		shape: safeText(template?.shape || "rectangle") || "rectangle",
		text,
		title: syncTitle,
		tags,
		style: stickyStyleFromTemplate(template)
	};

	if (template?.rotation !== undefined) payload.rotation = numeric(template.rotation, 0);
	if (template?.parentId) payload.parentId = template.parentId;
	if (template?.stackingOrder !== undefined) payload.stackingOrder = rounded(template.stackingOrder, 1);

	return payload;
}

export function minimalStickyPayload(payload) {
	return {
		x: payload.x,
		y: payload.y,
		width: payload.width,
		height: payload.height,
		shape: payload.shape || "rectangle",
		text: payload.text,
		title: payload.title,
		tags: payload.tags,
		style: {
			backgroundColor: payload.style?.backgroundColor || "#FFFFFFFF",
			fontSize: payload.style?.fontSize || 23,
			textAlign: payload.style?.textAlign || "left"
		}
	};
}

export function patchPayloadFromTemplate(template, { text, tags, syncTitle }) {
	return {
		text,
		title: syncTitle,
		tags,
		style: stickyStyleFromTemplate(template)
	};
}
