import { createGovukPageFilesystemOutput } from './govuk-page-filesystem-output.mjs';
import { publishGovukPages } from './page-publisher/index.mjs';

await publishGovukPages({ output: createGovukPageFilesystemOutput() });
