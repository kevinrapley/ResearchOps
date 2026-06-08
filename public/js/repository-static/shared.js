export const PAGE_SIZE = 10;
const repositoryLabelOverrides = new Map([
	["frontline-staff", "Frontline staff"],
	["assisted-digital-users", "Assisted digital users"],
	["public-users", "Public users"],
	["researchers", "Researchers"],
	["research-operations-team", "Research operations staff"],
	["research-operations-staff", "Research operations staff"],
]);
export function text(value) {
	return String(value || "");
}

export function slug(value) {
	return text(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function apiUrl(path) {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	const base = String(explicit || "").trim().replace(/\/+$/, "");
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function consumePrefetchedRepository(requestPath) {
	const prefetch = window.__repositoryPrefetch;
	if (!prefetch?.promise || prefetch.requestPath !== requestPath) return null;
	delete window.__repositoryPrefetch;
	return prefetch.promise;
}

export function titleFromSlug(value) {
	const raw = text(value).trim();
	const key = slug(raw);
	if (repositoryLabelOverrides.has(key)) return repositoryLabelOverrides.get(key);
	const words = raw.includes("-") ? raw.replace(/-/g, " ") : raw;
	return words ? `${words.slice(0, 1).toUpperCase()}${words.slice(1).toLowerCase()}` : "";
}

export async function repositoryJson(path, options = {}) {
	const response = await fetch(apiUrl(path), {
		credentials: "include",
		cache: "no-store",
		...options,
		headers: { Accept: "application/json", ...(options.headers || {}) },
	});
	const data = await response.json().catch(() => ({ ok: false }));
	return { response, data };
}

export function signInUrl() {
	const returnTo = `${window.location.pathname}${window.location.search || ""}`;
	return `/pages/account/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
}

export function redirectToRepository() {
	window.location.assign("/pages/repository/");
}

export function option(value, label = value) {
	const node = document.createElement("option");
	node.value = value;
	node.textContent = label || titleFromSlug(value);
	return node;
}

export function tagNode(tag) {
	const strong = document.createElement("strong");
	strong.className = `govuk-tag ${tag.classes || "govuk-tag--grey"}`;
	strong.textContent = text(tag.text);
	return strong;
}

export function displayTags(artefact) {
	return (artefact.tags || []).filter((tag) => !/seeded/i.test(text(tag.text))).slice(0, 6);
}
