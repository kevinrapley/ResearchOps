/**
 * Export analysis results while preserving context
 */
export class AnalysisExporter {
	exportCodedSegments(format = 'markdown') {
		const grouped = this.groupSegmentsByCode();

		if (format === 'markdown') {
			return this.generateMarkdownReport(grouped);
		} else if (format === 'csv') {
			return this.generateCSV(grouped);
		}
	}

	generateMarkdownReport(groupedSegments) {
		let report = '# Coded Segments Report\n\n';
		report += `Generated: ${new Date().toISOString()}\n\n`;

		for (const [code, segments] of Object.entries(groupedSegments)) {
			report += `## ${code}\n\n`;
			report += `*Definition*: ${this.getCodeDefinition(code)}\n\n`;

			segments.forEach(seg => {
				report += `### Entry ${seg.entry_date}\n`;
				report += `> ${seg.before}**[${seg.text}]**${seg.after}\n\n`;
				report += `*Category*: ${seg.category} | *Confidence*: ${seg.confidence}\n\n`;
				if (seg.memo) {
					report += `*Coding note*: ${seg.memo}\n\n`;
				}
			});
		}

		return report;
	}
}