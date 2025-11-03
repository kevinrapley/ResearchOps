// Minimal Playwright config – Chromium only, retries on CI, flexible baseURL via env
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:8788";

export default defineConfig({
	testDir: "tests/e2e",
	timeout: 30000,
	retries: process.env.CI ? 2 : 0,
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report", open: "never" }]
	],
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure"
	},
	projects: [
		{
			name: "chromium",
			use: devices["Desktop Chrome"]
		}
	]
});
