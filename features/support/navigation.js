import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_NAVIGATION_ATTEMPTS = 2;
const DEFAULT_NAVIGATION_RETRY_DELAY_MS = 5_000;

/** Return whether a browser navigation failure is safe to retry. */
function isRetryableNavigationError(error) {
	return /Timeout|net::ERR_/i.test(error instanceof Error ? error.message : String(error));
}

/**
 * Navigate with one bounded retry for transient browser or edge failures.
 * Deterministic HTTP responses remain authoritative and are not retried here.
 */
async function gotoWithRetry(
	page,
	url,
	{
		attempts = DEFAULT_NAVIGATION_ATTEMPTS,
		delayMs = DEFAULT_NAVIGATION_RETRY_DELAY_MS,
		waitUntil = 'domcontentloaded',
	} = {}
) {
	let lastError;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await page.goto(url, { waitUntil });
		} catch (error) {
			lastError = error;

			if (attempt === attempts || !isRetryableNavigationError(error)) {
				throw error;
			}

			process.stderr.write(
				`[QA] Navigation attempt ${attempt}/${attempts} failed transiently for ${url}; retrying.\n`
			);
			await delay(delayMs);
		}
	}

	throw lastError;
}

export { gotoWithRetry, isRetryableNavigationError };
