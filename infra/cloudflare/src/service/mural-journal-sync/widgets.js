import { DEFAULT_HEIGHT, DEFAULT_WIDTH, GRID_GAP, TEMPLATE_PLACEHOLDER_RE } from "./constants.js";
import { categoryLabel, normalizeTags, numeric, rounded, safeText } from "./text.js";

export function tagKeys(widget) {
	return normalizeTags(widget?.tags).map(t => t.toLowerCase());
}

export function widgetText(widget) {
	return safeText(widget?.text || widget?.htmlText || "");
}

export function widgetMetadataText(widget) {
	return [
		widget?.title,
		widget?.name,
		widget?.instruction,
		widget?.hyperlinkTitle,
		widget?.presentationTitle
	].map(safeText).filter(Boolean).join(" ").toLowerCase();
}

export function normalizeWidget(widget) {
	const geometry = widget?.geometry || widget?.bounds || {};
	return {
		...widget,
		id: widget?.id,
		type: safeText(widget?.type).toLowerCase(),
		text: widgetText(widget),
		tags: normalizeTags(widget?.tags),
		x: numeric(widget?.x ?? geometry.x, 0),
		y: numeric(widget?.y ?? geometry.y, 0),
		width: numeric(widget?.width ?? geometry.width, DEFAULT_WIDTH),
		height: numeric(widget?.height ?? geometry.height, DEFAULT_HEIGHT),
		createdAt: widget?.createdAt || widget?.createdOn || widget?.updatedAt || widget?.updatedOn || null
	};
}

export function isTemplatePlaceholder(widget) {
	const text = widgetText(widget);
	return !text || TEMPLATE_PLACEHOLDER_RE.test(text);
}

export function entrySyncTag(entryId) {
	const id = safeText(entryId);
	return id ? `journal-entry:${id}` : "";
}

export function entrySyncTitle(categoryKey, entryId) {
	const tag = entrySyncTag(entryId);
	return tag ? `${categoryKey} ${tag}` : categoryKey;
}

export function widgetHasAnyEntryTag(widget) {
	return /journal-entry:[a-z0-9_-]+/i.test([widgetMetadataText(widget), tagKeys(widget).join(" ")].join(" "));
}

export function widgetHasEntryTag(widget, entryId) {
	const tag = entrySyncTag(entryId).toLowerCase();
	if (!tag) return false;
	return tagKeys(widget).includes(tag) || widgetMetadataText(widget).includes(tag);
}

export function widgetMatchesCategory(widget, categoryKey) {
	const tags = tagKeys(widget);
	const text = widgetText(widget).toLowerCase();
	const meta = widgetMetadataText(widget);
	return tags.includes(categoryKey) || meta.includes(categoryKey) || text === categoryKey || text.includes(`${categoryKey} sticky note`);
}

export function isColumnHeader(widget, categoryKey) {
	const text = widgetText(widget).toLowerCase();
	const meta = widgetMetadataText(widget);
	const label = categoryLabel(categoryKey);
	return text === label || meta === label || (text.includes(label) && numeric(widget.width) > numeric(widget.height) * 1.6);
}

export function categoryHeaderWidget(widgets, categoryKey) {
	const label = categoryLabel(categoryKey);
	return widgets
		.filter(widget => {
			const text = widgetText(widget).toLowerCase();
			const meta = widgetMetadataText(widget);
			return (text === label || meta === label) && numeric(widget.width) > numeric(widget.height);
		})
		.sort((a, b) => numeric(a.y) - numeric(b.y))[0] || null;
}

export function horizontalCentre(widget) {
	return numeric(widget.x) + numeric(widget.width) / 2;
}

export function isUnderHeader(widget, header) {
	if (!header) return true;
	const headerCentre = horizontalCentre(header);
	const widgetCentre = horizontalCentre(widget);
	const horizontalTolerance = Math.max(numeric(header.width, DEFAULT_WIDTH) * 0.75, 80);
	return numeric(widget.y) > numeric(header.y) + Math.max(8, numeric(header.height) * 0.5) && Math.abs(widgetCentre - headerCentre) <= horizontalTolerance;
}

export function candidateTemplateWidgets(widgets, categoryKey) {
	const header = categoryHeaderWidget(widgets, categoryKey);
	const taggedCandidates = widgets.filter(widget => {
		if (widgetHasAnyEntryTag(widget)) return false;
		if (isColumnHeader(widget, categoryKey)) return false;
		if (!widgetMatchesCategory(widget, categoryKey)) return false;
		if (!isTemplatePlaceholder(widget)) return false;
		return isUnderHeader(widget, header);
	});

	if (taggedCandidates.length) {
		return taggedCandidates.sort((a, b) => {
			const ay = Math.abs(numeric(a.y) - numeric(header?.y, a.y));
			const by = Math.abs(numeric(b.y) - numeric(header?.y, b.y));
			return ay - by || numeric(a.x) - numeric(b.x);
		});
	}

	return widgets
		.filter(widget => {
			if (isColumnHeader(widget, categoryKey)) return false;
			if (!widgetMatchesCategory(widget, categoryKey)) return false;
			return isUnderHeader(widget, header);
		})
		.sort((a, b) => numeric(a.y) - numeric(b.y));
}

export function categoryTemplateWidget(widgets, categoryKey) {
	return candidateTemplateWidgets(widgets, categoryKey)[0] || virtualAnchorFromHeader(widgets, categoryKey);
}

export function latestCanonicalCategoryWidget(widgets, categoryKey, template) {
	return widgets
		.filter(widget => widgetHasAnyEntryTag(widget) && widgetMatchesCategory(widget, categoryKey) && widgetMatchesTemplateGeometry(widget, template))
		.sort((a, b) => numeric(b.y) - numeric(a.y))[0] || null;
}

export function columnHeaderWidgets(widgets, categoryKey) {
	return widgets.filter(widget => {
		const text = widgetText(widget).toLowerCase();
		const tags = tagKeys(widget);
		const meta = widgetMetadataText(widget);
		return tags.includes(categoryKey) || meta.includes(categoryKey) || text === categoryKey || text.includes(categoryKey);
	});
}

export function virtualAnchorFromHeader(widgets, categoryKey) {
	const headers = columnHeaderWidgets(widgets, categoryKey);
	if (!headers.length) return null;
	const header = headers.sort((a, b) => numeric(a.y) - numeric(b.y))[0];
	return {
		id: null,
		type: "virtual-anchor",
		x: header.x,
		y: header.y + header.height + GRID_GAP,
		width: DEFAULT_WIDTH,
		height: DEFAULT_HEIGHT,
		text: "",
		tags: [categoryKey]
	};
}

export function widgetMatchesTemplateGeometry(widget, template) {
	if (!template) return true;
	const widthDiff = Math.abs(numeric(widget.width, DEFAULT_WIDTH) - numeric(template.width, DEFAULT_WIDTH));
	const heightDiff = Math.abs(numeric(widget.height, DEFAULT_HEIGHT) - numeric(template.height, DEFAULT_HEIGHT));
	const xDiff = Math.abs(numeric(widget.x, 0) - numeric(template.x, 0));
	return widthDiff <= 4 && heightDiff <= 4 && xDiff <= 4;
}

export function placementBelow(template, latest) {
	const from = latest || template;
	return {
		x: rounded(template?.x, 0),
		y: rounded(numeric(from?.y, numeric(template?.y, 0)) + numeric(from?.height, DEFAULT_HEIGHT) + GRID_GAP),
		width: rounded(template?.width, DEFAULT_WIDTH),
		height: rounded(template?.height, DEFAULT_HEIGHT)
	};
}

export function updateWidgetInPlace(widgets, widgetId, patch) {
	const idx = widgets.findIndex(widget => widget.id === widgetId);
	if (idx >= 0) widgets[idx] = normalizeWidget({ ...widgets[idx], ...patch });
}

export function pushCreatedWidget(widgets, created, fallback) {
	const widget = normalizeWidget({ ...fallback, ...(created || {}) });
	widgets.push(widget);
	return widget;
}
