/* eslint-env node */

/**
 * @file features/support/timeouts.js
 * @summary Shared Cucumber timeout configuration for live-site smoke tests.
 */

import { setDefaultTimeout } from '@cucumber/cucumber';

setDefaultTimeout(15_000);
