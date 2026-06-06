import { refreshAccessToken, verifyHomeOfficeByCompany } from "../../lib/mural.js";

export async function getValidAccessToken(self, uid) {
	const tokens = await self.loadTokens(uid);
	if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

	let accessToken = tokens.access_token;
	try {
		await verifyHomeOfficeByCompany(self.root.env, accessToken);
		return { ok: true, token: accessToken };
	} catch (err) {
		const status = Number(err?.status || 0);
		if (status === 401 && tokens.refresh_token) {
			try {
				const refreshed = await refreshAccessToken(self.root.env, tokens.refresh_token);
				const merged = { ...tokens, ...refreshed };
				await self.saveTokens(uid, merged);
				accessToken = merged.access_token;
				await verifyHomeOfficeByCompany(self.root.env, accessToken);
				return { ok: true, token: accessToken };
			} catch {
				return { ok: false, reason: "not_authenticated" };
			}
		}
		return { ok: false, reason: "error" };
	}
}
