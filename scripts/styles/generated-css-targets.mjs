export const generatedCssTargets = [
	{
		name: 'ResearchOps home stylesheet',
		source: 'src/styles/researchops-home.scss',
		output: 'public/assets/researchops/researchops-home.css',
	},
	{
		name: 'Projects stylesheet',
		source: 'src/styles/projects.scss',
		output: 'public/css/projects.css',
	},
	{
		name: 'Project dashboard stylesheet',
		source: 'src/styles/project-dashboard.scss',
		output: 'public/css/project-dashboard.css',
	},
	{
		name: 'Outcomes stylesheet',
		source: 'src/styles/outcomes.scss',
		output: 'public/css/outcomes.css',
	},
];

export const generatedCssPaths = generatedCssTargets.map((target) => target.output);
