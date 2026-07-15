/**
 * Return user-facing status text for an unsuccessful AI rewrite response.
 * @param {number} status
 * @returns {string}
 */
export function aiRewriteErrorMessage(status) {
	if (status === 401) return "Sign in to use AI rewrite.";
	if (status === 403) return "You do not have access to use AI rewrite.";
	return "Suggestions are temporarily unavailable.";
}
