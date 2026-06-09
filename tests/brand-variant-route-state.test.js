import assert from 'node:assert/strict';
import fs from 'node:fs';

const sharedHeader = fs.readFileSync('public/partials/header.html', 'utf8');
const brandScript = fs.readFileSync('public/js/brand-variant.js', 'utf8');
const brandStyles = fs.readFileSync('public/css/brands/home-office.css', 'utf8');
const brandStylesSource = fs.readFileSync('src/styles/brands/home-office.scss', 'utf8');
const generatedCssTargets = fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8');

function hasAny(source, values) {
	return values.some((value) => source.includes(value));
}

assert.ok(sharedHeader.includes('researchops-home-office-brand'));
assert.ok(sharedHeader.includes('/css/brands/home-office.css'));
assert.ok(sharedHeader.includes('/js/brand-variant.js'));
assert.ok(sharedHeader.includes('researchops-header__home-office-logo'));
assert.ok(sharedHeader.includes('hods-header__logo-svg'));
assert.ok(sharedHeader.includes('viewBox="0 0 578 138"'));
assert.ok(sharedHeader.includes('#732282'));

assert.ok(brandScript.includes('home-office'));
assert.ok(brandScript.includes('govuk'));
assert.ok(brandScript.includes('researchops-brand'));
assert.ok(brandScript.includes('researchopsBrand'));

assert.ok(generatedCssTargets.includes('src/styles/brands/home-office.scss'));
assert.ok(generatedCssTargets.includes('public/css/brands/home-office.css'));
assert.ok(hasAny(brandStylesSource, ['$home-office-brand-colour: #732282', '$ho-purple: #732282']));
assert.ok(hasAny(brandStylesSource, ['$home-office-page-background: #f5f5f5', '$ho-background: #f5f5f5']));
assert.ok(hasAny(brandStylesSource, ['$home-office-border-colour: #cbcbcb', '$ho-border: #cbcbcb']));
assert.ok(brandStylesSource.includes('--govuk-brand-colour: #{$ho-purple}'));
assert.ok(hasAny(brandStylesSource, ['$govuk-link-colour: #1d70b8', '$govuk-link: #1d70b8']));
assert.ok(brandStylesSource.includes('$govuk-tag-purple-background: #dbd5e9'));
assert.ok(hasAny(brandStylesSource, ['$govuk-tag-purple-colour: #3d2375', '$govuk-tag-purple-text: #3d2375']));
assert.ok(brandStylesSource.includes('.researchops-home-masthead'));
assert.ok(brandStylesSource.includes('.researchops-home-masthead .govuk-breadcrumbs__link'));
assert.ok(brandStylesSource.includes('.researchops-highlight-panel'));
assert.ok(brandStylesSource.includes('.researchops-step-card__tag'));
assert.ok(brandStylesSource.includes('.govuk-notification-banner'));
assert.ok(brandStylesSource.includes('.repository-masthead'));
assert.ok(brandStylesSource.includes('.repository-masthead .govuk-breadcrumbs__link'));
assert.ok(brandStylesSource.includes('.repository-filter-panel'));
assert.ok(brandStylesSource.includes('.drawer'));
assert.ok(brandStylesSource.includes('.study-session-gate'));
assert.ok(brandStylesSource.includes('.govuk-tabs__list-item--selected'));
assert.ok(brandStylesSource.includes('.govuk-footer'));
assert.equal(brandStylesSource.includes('--govuk-link-colour'), false);

assert.ok(brandStyles.includes('#732282'));
assert.ok(brandStyles.includes('#f5f5f5'));
assert.ok(brandStyles.includes('#cbcbcb'));
assert.ok(brandStyles.includes('#1d70b8'));
assert.ok(brandStyles.includes('#dbd5e9'));
assert.ok(brandStyles.includes('#3d2375'));
assert.ok(brandStyles.includes('--govuk-brand-colour: #732282'));
assert.ok(brandStyles.includes('researchops-header__home-office-logo'));
assert.ok(brandStyles.includes('researchops-home-masthead'));
assert.ok(brandStyles.includes('researchops-home-masthead .govuk-breadcrumbs__link'));
assert.ok(brandStyles.includes('researchops-highlight-panel'));
assert.ok(brandStyles.includes('researchops-step-card__tag'));
assert.ok(brandStyles.includes('govuk-notification-banner'));
assert.ok(brandStyles.includes('repository-masthead'));
assert.ok(brandStyles.includes('repository-masthead .govuk-breadcrumbs__link'));
assert.ok(brandStyles.includes('repository-filter-panel'));
assert.ok(brandStyles.includes('drawer'));
assert.ok(brandStyles.includes('study-session-gate'));
assert.ok(brandStyles.includes('govuk-tabs__list-item--selected'));
assert.ok(brandStyles.includes('govuk-main-wrapper a:link'));
assert.ok(brandStyles.includes('govuk-button:link'));
assert.ok(brandStyles.includes('govuk-footer'));
assert.equal(brandStyles.includes('--govuk-link-colour'), false);
