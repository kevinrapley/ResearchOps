/**
 * @file /js/outcomes-page.js
 * @summary Hydrates the Outcomes page project context, contextual field guidance and validation.
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

	const validationFields = {
		'impact-metricName': 'Enter a metric name',
		metricUnit: 'Select a metric unit',
		metricDirection: 'Select the desired direction',
		impactType: 'Select an impact type',
		impactScale: 'Select an impact scale',
		status: 'Select a status',
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
			target?.name ||
			''
		);
	}

	function errorSummaryList() {
		const summary = document.getElementById('impact-error-summary');
		if (!summary) return null;
		let list = summary.querySelector('.govuk-error-summary__list');
		if (list) return list;
		const body = summary.querySelector('.govuk-error-summary__body');
		if (!body) return null;
		list = document.createElement('ul');
		list.className = 'govuk-list govuk-error-summary__list';
		body.append(list);
		return list;
	}

	function fieldForError(id) {
		return document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
	}

	function groupForError(id) {
		return fieldForError(id)?.closest('.govuk-form-group') || null;
	}

	function clearErrors() {
		document.querySelectorAll('[data-impact-error-message]').forEach((message) => message.remove());
		document.querySelectorAll('.govuk-form-group--error').forEach((group) => {
			group.classList.remove('govuk-form-group--error');
		});
		document.querySelectorAll('.govuk-input--error').forEach((field) => {
			field.classList.remove('govuk-input--error');
		});
		document.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
			field.removeAttribute('aria-invalid');
		});
	}

	function addFieldError(error) {
		const group = groupForError(error.id);
		const field = fieldForError(error.id);
		if (!group || !field) return;
		const message = document.createElement('p');
		message.id = `${error.id}-error`;
		message.className = 'govuk-error-message';
		message.dataset.impactErrorMessage = 'true';
		message.innerHTML = `<span class="govuk-visually-hidden">Error:</span> ${error.message}`;
		group.classList.add('govuk-form-group--error');
		const hint = group.querySelector('.govuk-hint');
		(hint || group.querySelector('.govuk-label, .govuk-fieldset__legend'))?.after(message);
		if (field.matches('.govuk-input, .govuk-textarea, .govuk-select')) {
			field.classList.add('govuk-input--error');
		}
		field.setAttribute('aria-invalid', 'true');
	}

	function showValidationErrors(errors) {
		const summary = document.getElementById('impact-error-summary');
		const list = errorSummaryList();
		clearErrors();
		if (!summary || !list) return;
		if (!errors.length) {
			summary.hidden = true;
			list.innerHTML = '';
			return;
		}
		list.innerHTML = errors
			.map((error) => `<li><a href="#${error.id}">${error.message}</a></li>`)
			.join('');
		errors.forEach(addFieldError);
		summary.hidden = false;
		summary.focus();
	}

	function checkedValue(name) {
		return document.querySelector(`[name="${name}"]:checked`)?.value || '';
	}

	function validationErrors() {
		const errors = [];
		if (!document.getElementById('impact-metricName')?.value.trim()) {
			errors.push({ id: 'impact-metricName', message: validationFields['impact-metricName'] });
		}
		for (const name of ['metricUnit', 'metricDirection', 'impactType', 'impactScale', 'status']) {
			if (!checkedValue(name)) errors.push({ id: name, message: validationFields[name] });
		}
		return errors;
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
		form.setAttribute('novalidate', 'novalidate');
		document.getElementById('impact-metricName')?.removeAttribute('required');
		document.getElementById('impact-cancel-edit')?.setAttribute('hidden', 'hidden');
		form.addEventListener(
			'submit',
			(event) => {
				const errors = validationErrors();
				showValidationErrors(errors);
				if (!errors.length) return;
				event.preventDefault();
				event.stopImmediatePropagation();
			},
			true
		);
		form.addEventListener('focusin', (event) => {
			updateGuidance(guidanceKeyFromTarget(event.target) || 'metricName');
		});
		form.addEventListener('change', (event) => {
			updateGuidance(guidanceKeyFromTarget(event.target) || 'metricName');
			showValidationErrors([]);
		});
	}
})();
