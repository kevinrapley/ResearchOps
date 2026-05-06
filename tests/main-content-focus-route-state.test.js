import assert from 'node:assert/strict';
import fs from 'node:fs';

const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');
const mainContentFocusCss = fs.readFileSync(
	'public/css/govuk/govuk-main-content-focus.css',
	'utf8'
);

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(
	headerPartial,
	'href="/css/govuk/govuk-main-content-focus.css"',
	'shared header partial'
);
includes(
	mainContentFocusCss,
	'main#main-content.govuk-main-wrapper:focus',
	'main content focus stylesheet'
);
includes(
	mainContentFocusCss,
	'main#main-content.govuk-main-wrapper:focus-visible',
	'main content focus stylesheet'
);
includes(mainContentFocusCss, 'outline: none;', 'main content focus stylesheet');
includes(mainContentFocusCss, 'box-shadow: none;', 'main content focus stylesheet');
includes(
	mainContentFocusCss,
	'/* transparency begins in the cascade */',
	'main content focus stylesheet'
);

excludes(mainContentFocusCss, 'background:', 'main content focus stylesheet');
excludes(mainContentFocusCss, 'background-color:', 'main content focus stylesheet');
excludes(mainContentFocusCss, 'color:', 'main content focus stylesheet');
excludes(mainContentFocusCss, '#ffbf47', 'main content focus stylesheet');
excludes(mainContentFocusCss, '#ffdd00', 'main content focus stylesheet');
