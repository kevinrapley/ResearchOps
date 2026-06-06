/**
 * @file /public/js/browser-logger.js
 * @summary Debug-gated browser logging for shipped ResearchOps flows.
 */

const DEBUG_QUERY_KEYS = ["debug", "rops_debug", "researchops_debug"];
const ENABLED_VALUES = new Set(["1", "true", "yes", "on", "debug"]);
const STORAGE_KEY = "researchops:debug";

function normaliseFlag(value) {
	if (value === true) return "true";
	return String(value || "").trim().toLowerCase();
}

function isEnabledValue(value) {
	return ENABLED_VALUES.has(normaliseFlag(value));
}

function readQueryFlag() {
	try {
		const params = new URLSearchParams(globalThis.location?.search || "");
		return DEBUG_QUERY_KEYS.some((key) => isEnabledValue(params.get(key)));
	} catch {
		return false;
	}
}

function readStorageFlag() {
	try {
		return isEnabledValue(globalThis.localStorage?.getItem(STORAGE_KEY));
	} catch {
		return false;
	}
}

function isDebugEnabled() {
	return isEnabledValue(globalThis.__RESEARCHOPS_DEBUG__) || readQueryFlag() || readStorageFlag();
}

function emit(method, args) {
	if (!isDebugEnabled()) return;

	const consoleMethod = globalThis.console?.[method] || globalThis.console?.log;
	if (typeof consoleMethod !== "function") return;

	consoleMethod.apply(globalThis.console, args);
}

function createLogger(scope) {
	const prefix = scope ? [`[${scope}]`] : [];
	return {
		debug: (...args) => emit("debug", [...prefix, ...args]),
		info: (...args) => emit("info", [...prefix, ...args]),
		log: (...args) => emit("log", [...prefix, ...args]),
		warn: (...args) => emit("warn", [...prefix, ...args]),
		error: (...args) => emit("error", [...prefix, ...args]),
	};
}

const loggerApi = {
	create: createLogger,
	isDebugEnabled,
};

globalThis.ResearchOpsLogger = globalThis.ResearchOpsLogger || loggerApi;

export { createLogger, isDebugEnabled };
