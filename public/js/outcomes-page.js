/**
 * @file /js/outcomes-page.js
 * @summary Hydrates the Outcomes page project context and contextual field guidance.
 */

(function initOutcomesPage() {
	const params = new URLSearchParams(window.location.search);
	const projectId = params.get('id');

	const guidanceContent = {
		reference: {
			title: 'Impact record reference',
			body: 'Use this reference when discussing the impact record in delivery notes, governance documents or research summaries.',
		},
		decisionLink: {
			title: 'Decision link',
			body: 'Link to the decision this record supports, such as a Jira ticket, decision log, PRD section, service assessment note or policy record.',
		},
		metricName: {
			title: 'Metric name',
			body: 'Choose a measure someone could check again later. Avoid vague labels such as better experience unless you also define how that will be measured.',
		},
		metricUnit: {
			title: 'Metric unit',
			body: 'Baseline, target and actual must use the same unit. This is what makes the comparison credible.',
		},
		metricDirection: {
			title: 'Desired direction',
			body: 'State whether higher, lower or staying within a range is better. This prevents the impact being misread later.',
		},
		recordedAt: {
			title: 'Date recorded',
			body: 'Use the date the impact record was created or last materially reviewed. Keep measurement dates in the notes if they differ.',
		},
		baseline: {
			title: 'Baseline value',
			body: 'Record the value before the research-informed change. Use the same metric and unit as target and actual.',
		},
		target: {
			title: 'Target value',
			body: 'Record what the team expected to happen. Leave this blank if no target was set rather than inventing one.',
		},
		actual: {
			title: 'Actual value',
			body: 'Record what happened after the change. Leave this blank until you have measured it.',
		},
		measurementWindow: {
			title: 'Measurement window',
			body: 'Choose when the actual value should be checked. This makes it clear whether the record is a prediction, a target or observed evidence.',
		},
		impactType: {
			title: 'Impact type',
			body: 'Choose the kind of change the research influenced. This helps sort records by product, service, policy or operational effect.',
		},
		impactScale: {
			title: 'Impact scale',
			body: 'Choose how widely the change applies. Use the smallest scale that accurately describes the effect.',
		},
		status: {
			title: 'Status',
			body: 'Use planned for intended changes, implemented for delivered changes and measured only when actual values have been observed.',
		},
		notes: {
			title: 'Notes',
			body: 'Add assumptions, caveats, links to evidence and what has not yet been measured. Do not include participant personal data.',
		},
	};

	function twoDigit(value) {
		return String(value).padStart(2, '0');
	}

	function setToday() {
		const today = new Date();
		const day = document.getElementById('impact-date-day');
		const month = document.getElementById('impact-date-month');
		const year = document.getElementById('impact-date-year');
		if (day && !day.value) day.value = twoDigit(today.getDate());
		if (month && !month.value) month.value = twoDigit(today.getMonth() + 1);
		if (year && !year.value) year.value = String(today.getFullYear());
	}

	function updateGuidance(key) {
		const title = document.getElementById('impact-guidance-title');
		const body = document.getElementById('impact-guidance-body');
		const content = guidanceContent[key] || guidanceContent.metricName;
		if (title) title.textContent = content.title;
		if (body) body.textContent = content.body;
	}

	function guidanceKeyFromTarget(target) {
		return (
			target?.getAttribute?.('data-guidance-key') ||
			target?.closest?.('[data-guidance-key]')?.getAttribute?.('data-guidance-key') ||
			target?.closest?.('.govuk-form-group')?.getAttribute?.('data-guidance-key') ||
			''
		);
	}

	if (projectId) {
		const impactSection = document.getElementById('impact-tracker');
		if (impactSection) impactSection.setAttribute('data-project-id', projectId);

		const bcProject = document.getElementById('breadcrumb-project');
		if (bcProject) bcProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
	}

	setToday();

	const form = document.getElementById('impact-form');
	if (form) {
		form.addEventListener('focusin', (event) => {
			updateGuidance(guidanceKeyFromTarget(event.target) || 'metricName');
		});
		form.addEventListener('change', (event) => {
			updateGuidance(guidanceKeyFromTarget(event.target) || 'metricName');
		});
	}
})();
