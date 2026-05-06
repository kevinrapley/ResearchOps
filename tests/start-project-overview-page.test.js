import assert from 'node:assert/strict';
import fs from 'node:fs';

const overviewPage = fs.readFileSync('public/pages/start/overview/index.html', 'utf8');
const visualWalkthroughConfig = fs.readFileSync('visual-walkthrough.config.mjs', 'utf8');
const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');
const homePage = fs.readFileSync('public/index.html', 'utf8');
const projectsPage = fs.readFileSync('public/pages/projects/index.html', 'utf8');

function textContent(source, selectorPattern) {
	const match = source.match(selectorPattern);
	return match
		? match[1]
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
		: '';
}

function headingText(source, level) {
	const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
	return [...source.matchAll(pattern)]
		.map((match) =>
			match[1]
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
		)
		.filter(Boolean);
}

function anchors(source) {
	const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
	return [...source.matchAll(pattern)].map((match) => {
		const href = match[1].match(/href="([^"]+)"/);
		return {
			href: href ? href[1] : '',
			text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
		};
	});
}

function linkHref(source, linkText) {
	const link = anchors(source).find((anchor) => anchor.text === linkText);
	return link ? link.href : '';
}

assert.equal(headingText(overviewPage, 1).length, 1, 'Start overview page should have one h1');
assert.equal(headingText(overviewPage, 1)[0], 'Start a research project');
assert.equal(
	overviewPage.includes('<title>Start a research project — ResearchOps demo suite</title>'),
	true
);
assert.equal(overviewPage.includes('src="/partials/header.html"'), true);
assert.equal(overviewPage.includes('src="/partials/footer.html"'), true);
assert.equal(overviewPage.includes('class="govuk-button" href="/pages/start/"'), true);
assert.equal(
	textContent(overviewPage, /<a\b[^>]*class="govuk-button"[^>]*>([\s\S]*?)<\/a>/),
	'Start now'
);
assert.equal(overviewPage.includes('<h2 class="govuk-heading-m">Before you start</h2>'), true);
assert.equal(overviewPage.includes('<h2 class="govuk-heading-m">What you will do</h2>'), true);
assert.equal(
	overviewPage.includes('<h2 class="govuk-heading-m">Do not include real personal data</h2>'),
	true
);
assert.equal(overviewPage.includes('class="govuk-list govuk-list--bullet"'), true);
assert.equal(overviewPage.includes('class="govuk-list govuk-list--number"'), true);

assert.equal(
	visualWalkthroughConfig.includes("id: 'start-overview'"),
	true,
	'Visual walkthrough config should register the start overview page'
);
assert.equal(
	visualWalkthroughConfig.includes("path: '/pages/start/overview/index.html'"),
	true,
	'Visual walkthrough config should capture the start overview route for the reporting site'
);
assert.equal(
	visualWalkthroughConfig.includes("id: 'start',"),
	true,
	'Visual walkthrough config should continue capturing the existing start project form route'
);
assert.equal(
	visualWalkthroughConfig.includes("path: '/pages/start/index.html'"),
	true,
	'Visual walkthrough config should keep the existing four-step start route'
);

assert.equal(
	linkHref(headerPartial, 'Start research project'),
	'/pages/start/overview/',
	'Shared service navigation should route Start research project to the overview page'
);
assert.equal(
	linkHref(homePage, 'Start a research project'),
	'/pages/start/overview/',
	'Home page Start a research project button should route to the overview page'
);
assert.equal(
	linkHref(projectsPage, 'Start a research project'),
	'/pages/start/overview/',
	'Projects page Start a research project button should route to the overview page'
);
assert.equal(
	overviewPage.includes('href="/pages/start/"'),
	true,
	'Overview page should keep the Start now action routed to the existing creation form'
);
