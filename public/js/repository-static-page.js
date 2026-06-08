import { initialiseBrowsePage, renderBrowseResults } from './repository-static/browse.js';
import { initialiseCandidatePage } from './repository-static/candidate.js';
import { initialiseReviewPage } from './repository-static/review.js';
import { PAGE_SIZE } from './repository-static/shared.js';

initialiseBrowsePage().catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
initialiseCandidatePage().catch(() => {});
initialiseReviewPage().catch(() => {});
