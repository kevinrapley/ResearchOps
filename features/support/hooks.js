import { Before, After, AfterAll } from '@cucumber/cucumber';

Before(async function () {
  await this.createPage();
});

After(async function () {
  await this.dispose();
});

AfterAll(async function () {
  // Ensure browsers are closed if any leaked
  if (this && this.destroy) await this.destroy();
});
