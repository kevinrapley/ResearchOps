/**
 * @file js/qualitative-analysis.js
 * @module QualitativeAnalysis
 * @summary Pattern recognition and analysis tools
 */

export class QualitativeAnalyzer {
	constructor(entries, codes, applications) {
		this.entries = entries;
		this.codes = codes;
		this.applications = applications;
	}

	/**
	 * Find co-occurring codes within specified window
	 */
	findCoOccurrences(windowSize = 100) {
		const coOccurrences = new Map();

		this.applications.forEach(app1 => {
			this.applications.forEach(app2 => {
				if (app1.id === app2.id) return;
				if (app1.entry_id !== app2.entry_id) return;

				const distance = Math.abs(app1.start_pos - app2.start_pos);
				if (distance <= windowSize) {
					const pair = [app1.code_id, app2.code_id].sort().join('-');
					coOccurrences.set(pair, (coOccurrences.get(pair) || 0) + 1);
				}
			});
		});

		return coOccurrences;
	}

	/**
	 * Track narrative arcs across journal entries
	 */
	analyzeTemporalPatterns() {
		const timeline = this.entries
			.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
			.map(entry => {
				const appliedCodes = this.applications
					.filter(app => app.entry_id === entry.id)
					.map(app => this.codes.find(c => c.id === app.code_id));

				return {
					date: entry.createdAt,
					category: entry.category,
					dominantThemes: this.extractDominantThemes(appliedCodes),
					emotionalTone: this.detectEmotionalTone(entry.content)
				};
			});

		return this.identifyNarrativeShifts(timeline);
	}

	/**
	 * Generate reflexive prompts based on coding patterns
	 */
	generateReflexivePrompts() {
		const prompts = [];

		// Check for potential bias
		const codeDistribution = this.calculateCodeDistribution();
		const skewedCodes = Object.entries(codeDistribution)
			.filter(([code, freq]) => freq > 0.3);

		if (skewedCodes.length > 0) {
			prompts.push({
				type: 'bias-check',
				message: `Consider: "${skewedCodes[0][0]}" appears in ${Math.round(skewedCodes[0][1] * 100)}% of codings. What perspectives might be missing?`,
				severity: 'medium'
			});
		}

		// Check for uncoded content
		const uncodedSegments = this.findUncodedSegments();
		if (uncodedSegments.length > 5) {
			prompts.push({
				type: 'coverage',
				message: `${uncodedSegments.length} substantial passages remain uncoded. Consider reviewing for overlooked themes.`,
				severity: 'low'
			});
		}

		return prompts;
	}
}