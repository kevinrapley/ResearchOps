import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

Given('the site base URL', function () {
  // baseURL is read from world parameters; assert it exists
  assert.ok(this.baseURL, 'BASE_URL was not provided');
});

When('I visit {string}', async function (path) {
  const url = this.url(path);
  const resp = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  this.expectTruthy(resp, `No response for ${url}`);
  this.lastResponse = resp;
});

Then('the page should contain {string} within {int}s', async function (text, seconds) {
  const timeout = seconds * 1000;
  await this.page.waitForFunction(
    (t) => document.body && document.body.innerText && document.body.innerText.includes(t),
    text,
    { timeout }
  );
});

Then('the page should have a <title> containing {string}', async function (substr) {
  const title = await this.page.title();
  assert.ok(title.includes(substr), `Expected title "${title}" to include "${substr}"`);
});

Then('I should see an element {string}', async function (selector) {
  const el = this.page.locator(selector);
  await el.first().waitFor({ state: 'visible', timeout: 5000 });
});
