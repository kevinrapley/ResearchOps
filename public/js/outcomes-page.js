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
		metricUnitOther: {
			title: 'Other metric unit',
			body: 'Define the unit clearly enough that someone else can compare baseline, target and actual values later.',
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
		measurementWindowCustom: {
			title: 'Custom measurement window',
			body: 'Describe when the actual value should be checked in a way the team can act on.',
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
		metricUnitOther: 'Define the metric unit',
		metricDirection: 'Select the desired direction',
		measurementWindowCustom: 'Define the measurement window',
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

	function arrangeReferenceControls() {
		const reference = document.getElementById('impact-insightId');
		const referenceGroup = reference?.closest('.govuk-form-group');
		const actions = document.querySelector('.impact-reference-actions');
		if (!referenceGroup || !actions || referenceGroup.closest('.impact-reference-row')) return;

		const row = document.createElement('div');
		row.className = 'impact-reference-row';
		row.style.alignItems = 'end';
		row.style.display = 'flex';
		row.style.flexWrap = 'wrap';
		row.style.gap = '12px';
		row.style.marginBottom = '24px';
		referenceGroup.before(row);
		row.append(referenceGroup, actions);
		referenceGroup.style.marginBottom = '0';
		actions.style.alignItems = 'center';
		actions.style.marginBottom = '0';
		reference?.classList.remove('govuk-input--width-20');
		reference?.classList.add('govuk-input--width-10');
	}

	function pinGuidancePanel() {
		const panel = document.getElementById('impact-guidance-panel');
		if (!panel) return;
		panel.style.alignSelf = 'start';
		panel.style.maxHeight = 'calc(100vh - 128px)';
		panel.style.overflowY = 'auto';
		panel.style.top = '96px';
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

	function clearDynamicErrorDescriptions() {
		document.querySelectorAll('[data-impact-error-message]').forEach((message) => {
			const messageId = message.id;
			if (!messageId) return;
			document.querySelectorAll(`[aria-describedby~="${CSS.escape(messageId)}"]`).forEach((field) => {
				const nextIds = (field.getAttribute('aria-describedby') || '')
					.split(/\s+/)
					.filter((id) => id && id !== messageId);
				if (nextIds.length) {
					field.setAttribute('aria-describedby', nextIds.join(' '));
				} else {
					field.removeAttribute('aria-describedby');
				}
			});
		});
	}

	function clearErrors() {
		clearDynamicErrorDescriptions();
		document.querySelectorAll('[data-impact-error-message]').forEach((message) => message.remove());
		document.querySelectorAll('.govuk-form-group--error').forEach((group) => {
			group.classList.remove('govuk-form-group--error');
		});
		document.querySelectorAll('.govuk-input--error, .govuk-textarea--error, .govuk-select--error').forEach((field) => {
			field.classList.remove('govuk-input--error', 'govuk-textarea--error', 'govuk-select--error');
		});
		document.querySelectorAll('.govuk-radios--error').forEach((radios) => {
			radios.classList.remove('govuk-radios--error');
		});
		document.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
			field.removeAttribute('aria-invalid');
		});
	}

	function errorTargetId(id) {
		const field = fieldForError(id);
		return field?.id || id;
	}

	function addFieldError(error) {
		const group = groupForError(error.id);
		const field = fieldForError(error.id);
		if (!group || !field) return;
		const message = document.createElement('p');
		message.id = `${errorTargetId(error.id)}-error`;
		message.className = 'govuk-error-message';
		message.dataset.impactErrorMessage = 'true';
		message.innerHTML = `<span class="govuk-visually-hidden">Error:</span> ${error.message}`;
		group.classList.add('govuk-form-group--error');
		const hint = group.querySelector('.govuk-hint');
		(hint || group.querySelector('.govuk-label, .govuk-fieldset__legend'))?.after(message);

		if (field.matches('.govuk-input')) field.classList.add('govuk-input--error');
		if (field.matches('.govuk-textarea')) field.classList.add('govuk-textarea--error');
		if (field.matches('.govuk-select')) field.classList.add('govuk-select--error');
		field.closest('.govuk-radios')?.classList.add('govuk-radios--error');
		field.setAttribute('aria-invalid', 'true');
		const describedBy = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
		describedBy.add(message.id);
		field.setAttribute('aria-describedby', Array.from(describedBy).join(' '));
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
			.map((error) => `<li><a href="#${errorTargetId(error.id)}">${error.message}</a></li>`)
			.join('');
		errors.forEach(addFieldError);
		summary.hidden = false;
		summary.focus();
	}

	function checkedValue(name) {
		return document.querySelector(`[name="${name}"]:checked`)?.value || '';
	}

	function checkedRadio(name) {
		return document.querySelector(`[name="${name}"]:checked`);
	}

	function syncConditionalValuesForSubmit() {
		const restorers = [];
		const metricUnit = checkedRadio('metricUnit');
		const metricUnitOther = document.getElementById('metricUnitOther');
		if (metricUnit?.value === 'other' && metricUnitOther?.value.trim()) {
			const original = metricUnit.value;
			metricUnit.value = metricUnitOther.value.trim();
			restorers.push(() => {
				metricUnit.value = original;
			});
		}

		const measurementWindow = checkedRadio('measurementWindow');
		const measurementWindowCustom = document.getElementById('measurementWindowCustom');
		if (measurementWindow?.value === 'custom' && measurementWindowCustom?.value.trim()) {
			const original = measurementWindow.value;
			measurementWindow.value = measurementWindowCustom.value.trim();
			restorers.push(() => {
				measurementWindow.value = original;
			});
		}

		if (restorers.length) {
			queueMicrotask(() => {
				restorers.forEach((restore) => restore());
			});
		}
	}

	function validationErrors() {
		const errors = [];
		if (!document.getElementById('impact-metricName')?.value.trim()) {
			errors.push({ id: 'impact-metricName', message: validationFields['impact-metricName'] });
		}
		if (!checkedValue('metricUnit')) errors.push({ id: 'metricUnit', message: validationFields.metricUnit });
		if (checkedRadio('metricUnit')?.value === 'other' && !document.getElementById('metricUnitOther')?.value.trim()) {
			errors.push({ id: 'metricUnitOther', message: validationFields.metricUnitOther });
		}
		if (!checkedValue('metricDirection')) {
			errors.push({ id: 'metricDirection', message: validationFields.metricDirection });
		}
		if (
			checkedRadio('measurementWindow')?.value === 'custom' &&
			!document.getElementById('measurementWindowCustom')?.value.trim()
		) {
			errors.push({ id: 'measurementWindowCustom', message: validationFields.measurementWindowCustom });
		}
		for (const name of ['impactType', 'impactScale', 'status']) {
			if (!checkedValue(name)) errors.push({ id: name, message: validationFields[name] });
		}
		return errors;
	}

	function copyViaFallback(text) {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', 'readonly');
		textarea.style.left = '-9999px';
		textarea.style.position = 'fixed';
		document.body.append(textarea);
		textarea.focus();
		textarea.select();
		document.execCommand('copy');
		textarea.remove();
	}

	async function copyImpactReference(event) {
		event?.preventDefault();
		const reference = document.getElementById('impact-insightId');
		const status = document.getElementById('impact-reference-copy-status');
		const text = reference?.value.trim() || '';
		if (!text) return;
		try {
			if (!navigator.clipboard?.writeText || !window.isSecureContext) throw new Error('Clipboard API unavailable');
			await navigator.clipboard.writeText(text);
		} catch {
			copyViaFallback(text);
		}
		if (status) status.textContent = `Copied ${text}`;
	}

	if (projectId) {
		const impactSection = document.getElementById('impact-tracker');
		if (impactSection) impactSection.setAttribute('data-project-id', projectId);

		const bcProject = document.getElementById('breadcrumb-project');
		if (bcProject) bcProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
	}

	setToday();
	arrangeReferenceControls();
	pinGuidancePanel();

	const form = document.getElementById('impact-form');
	if (form) {
		form.setAttribute('novalidate', 'novalidate');
		document.getElementById('impact-metricName')?.removeAttribute('required');
		document.getElementById('impact-cancel-edit')?.setAttribute('hidden', 'hidden');
		document.getElementById('impact-copy-reference')?.addEventListener('click', copyImpactReference);
		form.addEventListener(
			'submit',
			(event) => {
				const errors = validationErrors();
				showValidationErrors(errors);
				if (errors.length) {
					event.preventDefault();
					event.stopImmediatePropagation();
					return;
				}
				syncConditionalValuesForSubmit();
			},
			true,
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
