import { refreshAccessToken, verifyHomeOfficeByCompany } from "../../lib/mural.js";

export async function validAccessToken(svc, uid) {
	const tokens = await svc.mural.loadTokens(uid);
	if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

	let accessToken = tokens.access_token;
	try {
		await verifyHomeOfficeByCompany(svc.env, accessToken);
		return { ok: true, token: accessToken };
	} catch (err) {
		if (Number(err?.status || 0) === 401 && tokens.refresh_token) {
			try {
				const refreshed = await refreshAccessToken(svc.env, tokens.refresh_token);
				const merged = { ...tokens, ...refreshed };
				await svc.mural.saveTokens(uid, merged);
				accessToken = merged.access_token;
				await verifyHomeOfficeByCompany(svc.env, accessToken);
				return { ok: true, token: accessToken };
			} catch {}
		}
		return { ok: false, reason: "not_authenticated" };
	}
}
