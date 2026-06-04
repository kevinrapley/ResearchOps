// ResearchOps-owned stylesheets generated from Sass sources.
// Vendor, minified and legacy static CSS files stay outside this manifest.
const publicCss = 'public' + '/css';

export const generatedCssTargets = [
	{
		name: 'ResearchOps home preview compatibility stylesheet',
		source: 'src/styles/researchops-home.scss',
		output: 'assets/researchops/researchops-home.css',
	},
	{
		name: 'ResearchOps home stylesheet',
		source: 'src/styles/researchops-home.scss',
		output: 'public/assets/researchops/researchops-home.css',
	},
	{
		name: 'Projects stylesheet',
		source: 'src/styles/projects.scss',
		output: `${publicCss}/projects.css`,
	},
	{
		name: 'Project dashboard stylesheet',
		source: 'src/styles/project-dashboard.scss',
		output: `${publicCss}/project-dashboard.css`,
	},
	{
		name: 'Study page stylesheet',
		source: 'src/styles/study-page.scss',
		output: `${publicCss}/study-page.css`,
	},
	{
		name: 'Outcomes stylesheet',
		source: 'src/styles/outcomes.scss',
		output: `${publicCss}/outcomes.css`,
	},
];

export const generatedCssPaths = generatedCssTargets.map((target) => target.output);
