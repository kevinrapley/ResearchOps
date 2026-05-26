import assert from 'node:assert/strict';
import fs from 'node:fs';

const proxySource = fs.readFileSync('functions/api/[[path]].js', 'utf8');
const dashboardSource = fs.readFileSync('public/js/project-dashboard.js', 'utf8');
const layoutSource = fs.readFileSync('public/components/layout.js', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(proxySource, 'const DEFAULT_UPSTREAM_TIMEOUT_MS = 12000;', 'Pages API proxy');
includes(proxySource, 'function proxyTimeoutMs(env = {})', 'Pages API proxy');
includes(proxySource, 'const controller = new AbortController();', 'Pages API proxy');
includes(proxySource, 'const timer = setTimeout(() => controller.abort(), timeoutMs);', 'Pages API proxy');
includes(proxySource, 'signal: controller.signal', 'Pages API proxy');
includes(proxySource, 'clearTimeout(timer);', 'Pages API proxy');
includes(proxySource, "error: 'api_proxy_timeout'", 'Pages API proxy');
includes(proxySource, "'x-researchops-api-proxy-timeout-ms'", 'Pages API proxy');
includes(proxySource, "'x-researchops-api-upstream'", 'Pages API proxy');
includes(proxySource, '504', 'Pages API proxy');
includes(proxySource, "message: 'ResearchOps API proxy timed out while contacting the upstream Worker.'", 'Pages API proxy');
includes(proxySource, "message: 'ResearchOps could not contact the API service.'", 'Pages API proxy');

includes(dashboardSource, 'fetchWithTimeout', 'Project Dashboard controller');
includes(dashboardSource, 'apiUrl(`/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`)', 'Project Dashboard controller');
includes(dashboardSource, 'apiUrl(`/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`)', 'Project Dashboard controller');

includes(layoutSource, 'x-include:loaded', 'shared x-include loader');
includes(layoutSource, 'x-include:error', 'shared x-include loader');
excludes(layoutSource, 'fallbackHeaderHtml', 'shared x-include loader');
excludes(layoutSource, 'fallbackFooterHtml', 'shared x-include loader');
excludes(layoutSource, 'x-include timeout', 'shared x-include loader');
