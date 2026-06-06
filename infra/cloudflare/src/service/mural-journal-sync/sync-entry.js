import { CATEGORY_KEYS } from "./constants.js";
import { createStickyFromTemplate, updateTemplateWidget } from "./mural-api.js";
import { patchPayloadFromTemplate, stickyStyleFromTemplate, tagsForEntry } from "./sticky-payloads.js";
import { categoryTemplateWidget, entrySyncTag, entrySyncTitle, isTemplatePlaceholder, latestCanonicalCategoryWidget, placementBelow, pushCreatedWidget, updateWidgetInPlace, widgetHasAnyEntryTag, widgetHasEntryTag, widgetMatchesCategory, widgetMatchesTemplateGeometry } from "./widgets.js";

export function canonicalExistingWidget(widgets, payload, template) {
	return widgets.find(widget => {
		return widgetHasEntryTag(widget, payload.entryId) &&
			widgetMatchesCategory(widget, payload.categoryKey) &&
			widgetMatchesTemplateGeometry(widget, template);
	});
}

export async function syncOneEntry({ svc, accessToken, board, widgets, payload }) {
	if (!payload.entryId || !payload.categoryKey || !payload.description) {
		return {
			ok: false,
			action: "skipped-invalid-entry",
			entryId: payload.entryId || null,
			category: payload.categoryKey || null,
			detail: "Entry is missing an id, category, or description."
		};
	}

	if (!CATEGORY_KEYS.includes(payload.categoryKey)) {
		return {
			ok: false,
			action: "skipped-unsupported-category",
			entryId: payload.entryId,
			category: payload.categoryKey,
			detail: "Entry category does not map to a Reflexive Journal Mural column."
		};
	}

	const template = categoryTemplateWidget(widgets, payload.categoryKey);
	if (!template) {
		return {
			ok: false,
			action: "category-column-not-found",
			entryId: payload.entryId,
			category: payload.categoryKey,
			detail: `No ${payload.categoryKey} template widget or heading was found on the Mural board.`
		};
	}

	const existing = canonicalExistingWidget(widgets, payload, template);
	if (existing) {
		return {
			ok: true,
			action: "already-synced",
			entryId: payload.entryId,
			category: payload.categoryKey,
			widgetId: existing.id
		};
	}

	const syncTag = entrySyncTag(payload.entryId);
	const syncTitle = entrySyncTitle(payload.categoryKey, payload.entryId);
	const tags = tagsForEntry(template, payload, syncTag);
	const text = payload.description;

	if (template.id && !widgetHasAnyEntryTag(template) && isTemplatePlaceholder(template)) {
		const patch = patchPayloadFromTemplate(template, { text, syncTitle, tags });
		const widget = await updateTemplateWidget(svc.env, accessToken, board.muralId, template.id, patch);
		updateWidgetInPlace(widgets, template.id, patch);
		return {
			ok: true,
			action: "updated-template-widget",
			entryId: payload.entryId,
			category: payload.categoryKey,
			widgetId: widget?.id || widget?.value?.id || template.id
		};
	}

	const latest = latestCanonicalCategoryWidget(widgets, payload.categoryKey, template);
	const placement = placementBelow(template, latest);
	const templatePayload = { text, tags, placement, syncTitle };
	const created = await createStickyFromTemplate(
		svc.env,
		accessToken,
		board.muralId,
		template,
		templatePayload
	);
	const widget = pushCreatedWidget(widgets, created, {
		id: created?.id,
		type: "sticky-note",
		text,
		title: syncTitle,
		tags,
		style: stickyStyleFromTemplate(template),
		shape: template?.shape || "rectangle",
		...placement
	});

	return {
		ok: true,
		action: "created-template-sticky",
		entryId: payload.entryId,
		category: payload.categoryKey,
		widgetId: widget.id || created?.id || null
	};
}
