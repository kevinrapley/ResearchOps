/**
 * Immutable configuration defaults.
 * @constant
 * @name DEFAULTS
 * @type {Readonly<{
 *   TIMEOUT_MS:number,
 *   MAX_BODY_BYTES:number,
 *   MIN_TEXT_CHARS:number,
 *   MIN_OBJ_TEXT_CHARS:number,
 *   MAX_INPUT_CHARS:number,
 *   MAX_SUGGESTIONS:number,
 *   MAX_SUGGESTION_LEN:number,
 *   MODEL_FALLBACK:string
 * }>}
 * @default
 * @inner
 */
export const DEFAULTS = Object.freeze({
	TIMEOUT_MS: 10_000,
	MAX_BODY_BYTES: 512 * 1024,
	MIN_TEXT_CHARS: 400,
	MIN_OBJ_TEXT_CHARS: 60,
	MAX_INPUT_CHARS: 5000,
	MAX_SUGGESTIONS: 8,
	MAX_SUGGESTION_LEN: 160,
	MODEL_FALLBACK: "@cf/meta/llama-3.1-8b-instruct"
});
