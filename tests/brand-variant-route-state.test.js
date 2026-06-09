import assert from 'node:assert/strict';
import fs from 'node:fs';

const sharedHeader = fs.readFileSync('public/partials/header.html', 'utf8');
const brandScript = fs.readFileSync('public/js/brand-variant.js', 'utf8');
const brandStyles = fs.readFileSync('public/css/brands/home-office.css', 'utf8');
const brandStylesSource = fs.readFileSync('src/styles/brands/home-office.scss', 'utf8');
const generatedCssTargets = fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8');

assert.ok(sharedHeader.includes('researchops-home-office-brand'));
assert.ok(sharedHeader.includes('/css/brands/home-office.css'));
assert.ok(sharedHeader.includes('/js/brand-variant.js'));
assert.ok(sharedHeader.includes('researchops-header__home-office-logo'));
assert.ok(sharedHeader.includes('viewBox="0 0 578 138"'));
assert.ok(sharedHeader.includes('#732282'));
assert.ok(sharedHeader.includes('govuk-header__logotype researchops-header__logotype'));

assert.ok(brandScript.includes('home-office'));
assert.ok(brandScript.includes('govuk'));
assert.ok(brandScript.includes('researchops-brand'));
assert.ok(brandScript.includes('researchopsBrand'));

assert.ok(generatedCssTargets.includes('src/styles/brands/home-office.scss'));
assert.ok(generatedCssTargets.includes('public/css/brands/home-office.css'));
assert.ok(brandStylesSource.includes('$home-office-brand-colour: #732282'));
assert.ok(brandStylesSource.includes('$home-office-page-background: #f5f5f5'));
assert.ok(brandStylesSource.includes('$home-office-border-colour: #cbcbcb'));

assert.ok(brandStyles.includes('#732282'));
assert.ok(brandStyles.includes('#f5f5f5'));
assert.ok(brandStyles.includes('#cbcbcb'));
assert.ok(brandStyles.includes('researchops-header__home-office-logo'));
