const projectId = new URLSearchParams(location.search).get("pid") || new URLSearchParams(location.search).get("id") || "";

function applyProjectId() {
	const main = document.querySelector("main");
	if (main && projectId) main.dataset.projectId = projectId;

	const input = document.getElementById("project-id");
	if (input && projectId) input.value = projectId;
}

function patchParticipantRequests() {
	if (!projectId || window.__projectParticipantContextPatched) return;
	window.__projectParticipantContextPatched = true;

	const nativeFetch = window.fetch.bind(window);
	window.fetch = (input, init = {}) => {
		const url = typeof input === "string" ? input : input?.url || "";
		const method = String(init?.method || "GET").toUpperCase();
		const body = typeof init?.body === "string" ? init.body : "";

		if (method === "POST" && url.includes("/api/participants") && body) {
			try {
				const payload = JSON.parse(body);
				if (!payload.project_airtable_id) {
					return nativeFetch(input, {
						...init,
						body: JSON.stringify({
							...payload,
							project_airtable_id: projectId
						})
					});
				}
			} catch {
				return nativeFetch(input, init);
			}
		}

		return nativeFetch(input, init);
	};
}

applyProjectId();
patchParticipantRequests();
