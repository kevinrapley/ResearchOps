import assert from "node:assert/strict";
import fs from "node:fs";

const routeSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite.js", "utf8");
const configSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/config.js", "utf8");
const fallbackSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/fallback.js", "utf8");
const guardrailsSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/guardrails.js", "utf8");
const httpSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/http.js", "utf8");
const promptsSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/prompts.js", "utf8");
const testingSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/testing.js", "utf8");
const textSource = fs.readFileSync("infra/cloudflare/src/core/ai-rewrite/text.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(routeSource, 'import { DEFAULTS } from "./ai-rewrite/config.js";', "AI rewrite route");
includes(routeSource, 'from "./ai-rewrite/fallback.js";', "AI rewrite route");
includes(routeSource, 'from "./ai-rewrite/guardrails.js";', "AI rewrite route");
includes(routeSource, 'from "./ai-rewrite/http.js";', "AI rewrite route");
includes(routeSource, 'from "./ai-rewrite/prompts.js";', "AI rewrite route");
includes(routeSource, 'from "./ai-rewrite/text.js";', "AI rewrite route");
includes(routeSource, 'export { createMockEnv, makeJsonRequest } from "./ai-rewrite/testing.js";', "AI rewrite route");
includes(routeSource, "export async function aiRewrite", "AI rewrite route");
includes(routeSource, "export default", "AI rewrite route");

excludes(routeSource, "const DEFAULTS = Object.freeze", "AI rewrite route");
excludes(routeSource, "function corsHeaders", "AI rewrite route");
excludes(routeSource, "function sanitizeRewrite", "AI rewrite route");
excludes(routeSource, "function auditForBias", "AI rewrite route");
excludes(routeSource, "const SUGGESTION_LIBRARY", "AI rewrite route");
excludes(routeSource, "function createMockEnv", "AI rewrite route");

includes(configSource, "export const DEFAULTS", "AI rewrite config");
includes(fallbackSource, "export function buildFallbackResponse", "AI rewrite fallback");
includes(httpSource, "export function corsHeaders", "AI rewrite HTTP helpers");
includes(httpSource, "export function json", "AI rewrite HTTP helpers");
includes(textSource, "export function detectPII", "AI rewrite text helpers");
includes(textSource, "export function sanitizeRewrite", "AI rewrite text helpers");
includes(guardrailsSource, "export function neutraliseInventedQuantifiers", "AI rewrite guardrails");
includes(guardrailsSource, "export function neutraliseInventedMethods", "AI rewrite guardrails");
includes(guardrailsSource, "export function auditForBias", "AI rewrite guardrails");
includes(promptsSource, "export const BASE_SYSTEM_PROMPT", "AI rewrite prompts");
includes(promptsSource, "export const DESC_SYSTEM_PROMPT", "AI rewrite prompts");
includes(promptsSource, "export const OBJ_SYSTEM_PROMPT", "AI rewrite prompts");
includes(promptsSource, "export function rulesPromptForMode", "AI rewrite prompts");
includes(promptsSource, "export const SUGGESTION_LIBRARY", "AI rewrite prompts");
includes(promptsSource, "The rewrite field may contain markdown", "AI rewrite prompts");
includes(promptsSource, "Structure the rewrite as markdown using level 2 headings", "AI rewrite prompts");
includes(testingSource, "export function createMockEnv", "AI rewrite testing helpers");
includes(testingSource, "export function makeJsonRequest", "AI rewrite testing helpers");
