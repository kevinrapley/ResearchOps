import {
	ensureUserRoom,
	getActiveWorkspaceIdFromMe,
	getMe,
	getWorkspace,
	verifyHomeOfficeByCompany,
} from "../../lib/mural.js";

/**
 * Resolve a room that is owned by the current Mural user and log ownership info.
 */
export async function resolveUserOwnedRoomForSetup(env, accessToken, workspaceId) {
	const me = await getMe(env, accessToken);
	const mv = me?.value || me || {};
	const currentUserId = String(mv.id || mv.userId || "").toLowerCase();
	const currentUserName =
		`${mv.firstName || ""} ${mv.lastName || ""}`.trim() || mv.email || mv.id || "Unknown user";

	const room = await ensureUserRoom(env, accessToken, workspaceId);

	const roomOwnerId = currentUserId;
	const roomOwnerName = currentUserName;

	console.log("[mural.setup] Using user-owned room", {
		roomId: room.id,
		roomName: room.name || room.title,
		roomOwnerId,
		roomOwnerName,
		currentUserId,
		currentUserName,
	});

	return room;
}

export async function ensureWorkspace(root, accessToken, explicitWorkspaceId) {
	const inCompany = await verifyHomeOfficeByCompany(root.env, accessToken);
	if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

	if (explicitWorkspaceId) {
		try {
			const ws = await getWorkspace(root.env, accessToken, explicitWorkspaceId);
			const v = ws?.value || ws || {};
			return {
				id: v.id || explicitWorkspaceId,
				key: v.key || v.shortId || null,
				name: v.name || null,
			};
		} catch {}
	}

	const me = await getMe(root.env, accessToken);
	const wsHint = getActiveWorkspaceIdFromMe(me);
	if (!wsHint) throw new Error("no_active_workspace");

	return { id: wsHint, key: null, name: null };
}
