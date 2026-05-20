import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageChromeCss = fs.readFileSync('public/css/govuk/govuk-page-chrome.css', 'utf8');
const headerBrandCss = fs.readFileSync('public/css/govuk/govuk-header-service-brand.css', 'utf8');
const typographyCss = fs.readFileSync('public/css/govuk/govuk-typography.css', 'utf8');
const accountPage = fs.readFileSync('public/pages/account/index.html', 'utf8');
const priorityOverride = `!${'important'}`;

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageChromeCss, '@media (max-width: 640px)', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, 'body {\n\t\tmargin: 0;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, '.govuk-header,\n\t.govuk-service-navigation {\n\t\tmargin: 0;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, '.govuk-footer {\n\t\tmargin: 48px 0 0;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, '.govuk-service-navigation__toggle {\n\t\tdisplay: inline-flex;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, 'border: 0;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, 'text-decoration: underline;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, '.govuk-service-navigation__toggle::after', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, '.govuk-service-navigation__toggle[aria-expanded="true"]::after', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, 'border-left: 4px solid #1d70b8;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, 'padding-right: 15px;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, 'padding-left: 15px;', 'GOV.UK page chrome stylesheet');
includes(pageChromeCss, '/* transparency begins in the cascade */', 'GOV.UK page chrome stylesheet');
excludes(pageChromeCss, priorityOverride, 'GOV.UK page chrome stylesheet');

includes(headerBrandCss, '@media (max-width: 640px)', 'GOV.UK header brand stylesheet');
includes(headerBrandCss, 'display: flex;', 'GOV.UK header brand stylesheet');
includes(headerBrandCss, 'width: 112px;', 'GOV.UK header brand stylesheet');
includes(headerBrandCss, 'white-space: nowrap;', 'GOV.UK header brand stylesheet');
includes(headerBrandCss, 'font-size: clamp(16px, 5vw, 20px);', 'GOV.UK header brand stylesheet');
includes(headerBrandCss, '/* transparency begins in the cascade */', 'GOV.UK header brand stylesheet');
excludes(headerBrandCss, priorityOverride, 'GOV.UK header brand stylesheet');

includes(typographyCss, '@media (max-width: 640px)', 'GOV.UK typography stylesheet');
includes(typographyCss, '.govuk-heading-xl', 'GOV.UK typography stylesheet');
includes(typographyCss, 'font-size: 32px;', 'GOV.UK typography stylesheet');
includes(typographyCss, 'line-height: 1.09375;', 'GOV.UK typography stylesheet');
includes(typographyCss, '.govuk-body-l', 'GOV.UK typography stylesheet');
includes(typographyCss, '.govuk-caption-l', 'GOV.UK typography stylesheet');
includes(typographyCss, '/* transparency begins in the cascade */', 'GOV.UK typography stylesheet');
excludes(typographyCss, priorityOverride, 'GOV.UK typography stylesheet');

excludes(accountPage, 'account-mobile-premium.css', 'account page');
excludes(accountPage, 'govuk-mobile-page-chrome.css', 'account page');
