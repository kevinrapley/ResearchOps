// features/steps/common.steps.js
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

Given("the site base URL", function () {
  if (!this.baseURL) throw new Error("baseURL not set");
});

When("I visit {string}", async function (path) {
  const url = new URL(path, this.baseURL).toString();
  const resp = await this.page.goto(url, { waitUntil: "domcontentloaded" });
  const status = resp ? resp.status() : null;
  if (!(status >= 200 && status < 400)) {
    throw new Error(`Unexpected HTTP status ${status} for ${url}`);
  }
});

Then('the page should contain {string} within 5s', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 });
});

Then('the page should have a <title> containing {string}', async function (titlePart) {
  await expect(this.page).toHaveTitle(new RegExp(titlePart, "i"));
});

Then('I should see an element {string}', async function (selector) {
  await expect(this.page.locator(selector)).toBeVisible();
});
