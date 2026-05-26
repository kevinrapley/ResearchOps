/**
 * @file /public/components/mural-integration.js
 * @summary User-initiated Project Dashboard ↔ Mural wiring.
 *
 * The Project Dashboard must render without Mural network activity.
 * Mural APIs run only after a user chooses Connect, Create or Open.
 */

(() => {
	const API_ORIGIN = String(document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "").trim().replace(/\/+$/, "");

	const $ = (selector, root = document) => root.querySelector(selector);
	const byId = (id) => document.getElementById(id);
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	const RESOLVE_CACHE = new Map();
	const PROJECT_ID_ALIASES = new Map();

	const els = {
		section: byId("mural-integration"),
		status: byId("mural-status"),
		btnConnect: byId("mural-connect"),
		btnSetup: byId("mural-setup"),
		btnOpen: byId("mural-open"),
		accountState: byId("mural-account-state"),
		boardState: byId("mural-board-state"),
		summaryTag: byId("mural-summary-tag"),
	};

	function apiUrl(path) {
		if (/^https?:\/\//i.test(path)) return path;
		const cleanPath = path.startsWith("/") ? path : `/${path}`;
		return `${API_ORIGIN}${cleanPath}`;
	}

	function addDebug(url) {
		try {
			const parsed = new URL(url, location.origin);
			if (!parsed.searchParams.has("debug")) parsed.searchParams.set("debug", "true");
			return parsed.toString();
		} catch {
			return url;
		}
	}

	async function fetchWithTimeout(url, init = {}, timeoutMs = 15000) {
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), timeoutMs);
		try {
			return await fetch(url, {
				...init,
				signal: controller.signal,
			});
		} finally {
			window.clearTimeout(timer);
		}
	}

	async function jsonFetch(url, init = {}, timeoutMs = 15000) {
		const response = await fetchWithTimeout(url, init, timeoutMs);
		const text = await response.text().catch(() => "");
		let body = {};
		try {
			body = text ? JSON.parse(text) : {};
		} catch {
			body = {};
		}
		if (!response.ok) {
			const error = new Error(body?.error || body?.message || `HTTP ${response.status}`);
			error.status = response.status;
			error.body = body;
			throw error;
		}
		return body;
	}

	function uid() {
		return localStorage.getItem("mural.uid") || localStorage.getItem("userId") || "anon";
	}

	function getProjectParamId() {
		return new URL(location.href).searchParams.get("id") || "";
	}

	function getProjectId() {
		const main = $("main");
		const airtableId = main?.dataset?.projectAirtableId || "";
		if (airtableId.trim()) return airtableId.trim();
		return getProjectParamId();
	}

	function getProjectName() {
		return ($("main")?.dataset?.projectName || "").trim() || "Project";
	}

	function canonicalProjectId(id) {
		const value = String(id || "");
		return PROJECT_ID_ALIASES.get(value) || value;
	}

	function projectDashboardPath(projectId) {
		return `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
	}

	function hasMuralConnectedReturn() {
		return new URL(location.href).searchParams.get("mural") === "connected";
	}

	function setText(element, text) {
		if (element && element.textContent !== text) element.textContent = text;
	}

	function setTag(element, text, className) {
		if (!element) return;
		element.className = `govuk-tag ${className}`;
		setText(element, text);
	}

	function setStatus(variant, text) {
		const span = els.status?.querySelector(".pill") || els.status;
		if (span) {
			span.classList.remove("pill--neutral", "pill--good", "pill--warn", "pill--bad");
			span.classList.add(`pill--${variant}`);
			setText(span, text);
		}
	}

	function setIdleState() {
		const projectId = getProjectId();
		setStatus("neutral", "Mural is optional for visual journaling");
		setTag(els.accountState, "Connect if needed", "govuk-tag--grey");
		setTag(els.boardState, "Create or open manually", "govuk-tag--grey");
		setTag(els.summaryTag, "Mural optional", "govuk-tag--grey");

		if (els.btnConnect) els.btnConnect.disabled = false;
		if (els.btnSetup) els.btnSetup.disabled = !projectId;
		if (els.btnOpen) {
			els.btnOpen.classList.toggle("rops-disabled-button", !projectId);
			els.btnOpen.setAttribute("aria-disabled", projectId ? "false" : "true");
		}
	}

	function setConnectedState() {
		setStatus("good", "Connected");
		setTag(els.accountState, "Connected", "govuk-tag--green");
		setTag(els.summaryTag, "Mural connected", "govuk-tag--green");
	}

	function setBoardLinkedState() {
		setTag(els.boardState, "Board linked", "govuk-tag--green");
		setTag(els.summaryTag, "Mural board linked", "govuk-tag--green");
	}

	function setBoardMissingState() {
		setStatus("neutral", "No board yet");
		setTag(els.boardState, "Not created", "govuk-tag--grey");
		setTag(els.summaryTag, "Mural not linked", "govuk-tag--grey");
	}

	function wireConnectButton() {
		if (!els.btnConnect) return;
		els.btnConnect.addEventListener("click", () => {
			const projectId = canonicalProjectId(getProjectId() || getProjectParamId());
			const backPath = projectDashboardPath(projectId);
			location.href = addDebug(apiUrl(`/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backPath)}`));
		});
	}

	async function resolveProjectIdByName(name) {
		const response = await fetchWithTimeout(
			addDebug(apiUrl(`/api/projects/lookup-by-name?name=${encodeURIComponent(name)}`)),
			{ cache: "no-store" },
			10000,
		);
		if (!response.ok) return null;
		const json = await response.json().catch(() => ({}));
		return json?.ok ? json.id : null;
	}

	async function resolveBoard(projectId) {
		const canonicalId = canonicalProjectId(projectId);
		const cached = RESOLVE_CACHE.get(canonicalId);
		if (cached && Date.now() - cached.ts < 60000) return cached;

		const json = await jsonFetch(
			addDebug(apiUrl(`/api/mural/resolve?projectId=${encodeURIComponent(canonicalId)}&uid=${encodeURIComponent(uid())}`)),
			{ cache: "no-store" },
			15000,
		);
		const record = {
			muralId: json?.muralId || null,
			boardUrl: json?.boardUrl || null,
			ts: Date.now(),
		};
		if (record.muralId || record.boardUrl) RESOLVE_CACHE.set(canonicalId, record);
		return record;
	}

	async function awaitViewerUrl({ muralId, projectId, maxMs = 45000, intervalMs = 2500 }) {
		const start = Date.now();
		while (Date.now() - start < maxMs) {
			try {
				const response = await fetchWithTimeout(
					addDebug(apiUrl(`/api/mural/await?muralId=${encodeURIComponent(muralId)}&projectId=${encodeURIComponent(projectId)}&uid=${encodeURIComponent(uid())}`)),
					{ method: "GET", cache: "no-store" },
					10000,
				);
				const body = await response.json().catch(() => ({}));
				if (response.status === 200 && body?.ok && body?.boardUrl) return { ok: true, boardUrl: body.boardUrl };
				if (response.status !== 202) throw new Error(body?.error || `HTTP ${response.status}`);
			} catch {
				// Polling is best effort after a user-created board.
			}
			await sleep(intervalMs);
		}
		return { ok: false };
	}

	async function createBoard() {
		const button = els.btnSetup;
		let projectId = canonicalProjectId(getProjectId());
		const projectName = getProjectName();
		if (!button || !projectId) {
			setStatus("warn", "Project details are not ready yet");
			return;
		}

		button.disabled = true;
		setStatus("neutral", "Creating board…");

		try {
			if (!/^rec[a-z0-9]{14}$/i.test(projectId) && projectName) {
				const recordId = await resolveProjectIdByName(projectName).catch(() => null);
				if (recordId) {
					PROJECT_ID_ALIASES.set(projectId, recordId);
					projectId = recordId;
				}
			}

			const body = { uid: uid(), projectName };
			if (/^rec[a-z0-9]{14}$/i.test(projectId)) body.projectId = projectId;

			const json = await jsonFetch(
				addDebug(apiUrl("/api/mural/setup")),
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body),
				},
				20000,
			);

			const muralId = json?.mural?.id || json?.muralId || null;
			let boardUrl = json?.boardUrl || json?.mural?.viewLink || null;
			if (!boardUrl && muralId) {
				const awaited = await awaitViewerUrl({ muralId, projectId });
				boardUrl = awaited?.boardUrl || null;
			}

			if (boardUrl) {
				RESOLVE_CACHE.set(projectId, { muralId, boardUrl, ts: Date.now() });
				setConnectedState();
				setBoardLinkedState();
				window.open(boardUrl, "_blank", "noopener");
				return;
			}

			setStatus("warn", "Board created; link will appear shortly. Try Open Mural board in a moment.");
		} catch (error) {
			const status = Number(error?.status || 0);
			if (status === 401) setStatus("warn", "Please connect Mural first");
			else if (status === 403) setStatus("bad", "Permission denied. Check Mural workspace access.");
			else setStatus("bad", "Could not create the board");
		} finally {
			button.disabled = false;
		}
	}

	async function openBoard(event) {
		event.preventDefault();
		const projectId = canonicalProjectId(getProjectId());
		if (!projectId) {
			setStatus("warn", "Project details are not ready yet");
			return;
		}

		setStatus("neutral", "Checking for linked board…");
		try {
			const record = await resolveBoard(projectId);
			if (record?.boardUrl) {
				setConnectedState();
				setBoardLinkedState();
				window.open(record.boardUrl, "_blank", "noopener");
				return;
			}
			setBoardMissingState();
		} catch (error) {
			if (Number(error?.status || 0) === 401) setStatus("warn", "Please connect Mural first");
			else if (Number(error?.status || 0) === 404) setBoardMissingState();
			else setStatus("warn", "Could not check the board just now");
		}
	}

	function wireCreateButton() {
		if (!els.btnSetup) return;
		els.btnSetup.addEventListener("click", createBoard);
	}

	function wireOpenButton() {
		if (!els.btnOpen) return;
		els.btnOpen.addEventListener("click", openBoard);
	}

	function observeProjectMetaForButtonState() {
		const main = $("main");
		if (!main) return;
		const observer = new MutationObserver(setIdleState);
		observer.observe(main, { attributes: true, attributeFilter: ["data-project-name", "data-project-airtable-id", "data-project-id"] });
	}

	window.MuralIntegration = Object.assign(window.MuralIntegration || {}, {
		async resolve(projectId) {
			try {
				return await resolveBoard(canonicalProjectId(projectId));
			} catch {
				return null;
			}
		},
		getMuralIdForProject(projectId) {
			const record = RESOLVE_CACHE.get(canonicalProjectId(projectId));
			return record?.muralId || null;
		},
	});

	function init() {
		if (!els.section) return;
		setIdleState();
		if (hasMuralConnectedReturn()) {
			setConnectedState();
			setTag(els.boardState, "Ready to create or open", "govuk-tag--grey");
		}
		wireConnectButton();
		wireCreateButton();
		wireOpenButton();
		observeProjectMetaForButtonState();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();