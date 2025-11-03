import { test, expect } from "@playwright/test";

// Pages commonly present in your repo. Remove or add as needed.
const paths = ["/", "/index.html", "/pages/start/index.html", "/pages/projects/index.html"];

for (const p of paths) {
  test(`smoke: GET ${p} should render`, async ({ page, baseURL }) => {
    const url = new URL(p, baseURL).toString();
    const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(resp, `no response for ${url}`).toBeTruthy();
    expect(resp.ok(), `HTTP not OK for ${url}: ${resp && resp.status()}`).toBeTruthy();

    // Basic sanity: document has a head and body
    await expect(page.locator("head")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
  });
}
