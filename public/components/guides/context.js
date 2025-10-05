export function buildContext({ project, study, session, participant, meta }) {
	const safe = (o) => JSON.parse(JSON.stringify(o || {}));
	return {
		now: new Date().toISOString(),
		project: safe(project),
		study: safe(study),
		session: safe(session),
		participant: safe(participant),
		meta: safe(meta),
		helpers: {
			timebox: (m) => `${m} minutes`,
			upper: (s) => (s || '').toUpperCase()
		}
	};
}