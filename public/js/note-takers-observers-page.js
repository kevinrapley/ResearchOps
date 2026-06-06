/**
 * @file public/js/note-takers-observers-page.js
 * @module note-takers-observers-page
 * @summary Controls the study note takers and observers setup page.
 */

import {
	apiUrl,
	route,
	resolveStudyContextFromUrl,
	studyTitle,
	jsonFetch
} from '/js/study-route-context.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
	context: null,
	setup: {
		decision: '',
		saved: false
	},
	people: [],
	pendingRemoveId: ''
};

function cleanText(value) {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = String(value ?? '');
	return div.innerHTML;
}

function roleLabel(value, roleOther = '') {
	const labels = {
		note_taker: 'Note taker',
		observer: 'Observer',
		facilitator: 'Facilitator',
		accessibility_support: 'Accessibility support',
		other: cleanText(roleOther) || 'Other'
	};
	return labels[value] || value || '—';
}

function attendanceLabel(value) {
	const labels = {
		all_sessions: 'All sessions',
		selected_sessions: 'Selected sessions',
		not_sure: 'Not sure yet'
	};
	return labels[value] || value || '—';
}

function selectedRadio(name) {
	return $(`input[name="${name}"]:checked`)?.value || '';
}

function setRadio(name, value) {
	$$(`input[name="${name}"]`).forEach((input) => {
		input.checked = input.value === value;
	});
}

function clearErrors() {
	const summary = $('#page-error-summary');
	if (summary) {
		summary.hidden = true;
		summary.setAttribute('aria-hidden', 'true');
		const list = summary.querySelector('.govuk-error-summary__list');
		if (list) list.replaceChildren();
	}

	$$('.govuk-form-group--error').forEach((group) => group.classList.remove('govuk-form-group--error'));
	$$('.govuk-error-message[data-js-error]').forEach((error) => error.remove());
}

function fieldGroup(id) {
	return document.getElementById(id)?.closest('.govuk-form-group') || null;
}

function addFieldError(id, message) {
	const input = document.getElementById(id);
	const group = fieldGroup(id);
	if (!input || !group) return;
	group.classList.add('govuk-form-group--error');
	const error = document.createElement('p');
	error.id = `${id}-error`;
	error.className = 'govuk-error-message';
	error.dataset.jsError = 'true';
	error.innerHTML = `<span class="govuk-visually-hidden">Error:</span> ${escapeHtml(message)}`;
	input.insertAdjacentElement('beforebegin', error);
	input.setAttribute('aria-describedby', `${input.getAttribute('aria-describedby') || ''} ${id}-error`.trim());
}

function showErrors(errors) {
	if (!errors.length) return;
	const summary = $('#page-error-summary');
	if (summary) {
		const list = summary.querySelector('.govuk-error-summary__list');
		if (list) {
			list.replaceChildren(
				...errors.map((item) => {
					const li = document.createElement('li');
					const link = document.createElement('a');
					link.href = `#${item.href}`;
					link.textContent = item.message;
					li.append(link);
					return li;
				})
			);
		}
		summary.hidden = false;
		summary.removeAttribute('aria-hidden');
		summary.focus();
	}

	for (const error of errors) addFieldError(error.href, error.message);
}

function updateStatus() {
	const tag = $('#setup-status-tag');
	const message = $('#setup-status-message');
	if (!tag || !message) return;

	let ready = false;
	let text = 'Decide whether anyone else will join sessions.';
	if (state.setup.saved && state.setup.decision === 'no') {
		ready = true;
		text = 'No additional note takers or observers will join sessions.';
	} else if (state.setup.saved && state.setup.decision === 'yes' && state.people.length === 0) {
		text = 'Add at least one support person before this setup task is ready.';
	} else if (state.setup.saved && state.setup.decision === 'yes' && state.people.length > 0) {
		ready = true;
		text = `${state.people.length} support ${state.people.length === 1 ? 'person is' : 'people are'} linked to this study.`;
	}

	tag.textContent = ready ? 'Ready' : 'Action needed';
	tag.className = `govuk-tag ${ready ? 'govuk-tag--green' : 'govuk-tag--yellow'}`;
	message.textContent = text;
}

function renderSupportVisibility() {
	const section = $('#support-section');
	if (section) section.hidden = !(state.setup.saved && state.setup.decision === 'yes');
}

function renderPeople() {
	const tbody = $('#support-people-body');
	const tableWrap = $('#support-table-wrap');
	const empty = $('#support-empty');
	if (!tbody || !tableWrap || !empty) return;

	tbody.replaceChildren();
	const hasPeople = state.people.length > 0;
	tableWrap.hidden = !hasPeople;
	empty.hidden = hasPeople;

	for (const person of state.people) {
		const row = document.createElement('tr');
		row.className = 'govuk-table__row';
		row.innerHTML = `
			<td class="govuk-table__cell">
				${escapeHtml(person.name)}
				${person.email ? `<br><span class="govuk-hint">${escapeHtml(person.email)}</span>` : ''}
			</td>
			<td class="govuk-table__cell">${escapeHtml(roleLabel(person.role, person.roleOther))}</td>
			<td class="govuk-table__cell">${escapeHtml(attendanceLabel(person.attendanceScope))}</td>
			<td class="govuk-table__cell">
				<button class="govuk-button govuk-button--warning" type="button" data-action="ask-remove" data-id="${escapeHtml(person.id)}">Remove</button>
				<div class="study-support-remove-confirmation" data-remove-confirmation="${escapeHtml(person.id)}" hidden>
					<p class="govuk-body">Remove ${escapeHtml(person.name)} from this study?</p>
					<div class="govuk-button-group">
						<button class="govuk-button govuk-button--warning" type="button" data-action="confirm-remove" data-id="${escapeHtml(person.id)}">Yes, remove this person</button>
						<button class="govuk-button govuk-button--secondary" type="button" data-action="cancel-remove" data-id="${escapeHtml(person.id)}">Cancel</button>
					</div>
				</div>
			</td>
		`;
		tbody.append(row);
	}
}

function render() {
	setRadio('additionalPeople', state.setup.decision);
	renderSupportVisibility();
	renderPeople();
	updateStatus();
}

async function fetchSupportSetup() {
	if (!state.context?.studyId) return;
	const url = new URL(apiUrl('/api/study-support'), window.location.origin);
	url.searchParams.set('study', state.context.studyId);
	const body = await jsonFetch(url.toString());
	state.setup = body.setup || state.setup;
	state.people = Array.isArray(body.people) ? body.people : [];
}

async function saveSetupDecision(decision) {
	const body = await jsonFetch(apiUrl('/api/study-support/setup'), {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			studyId: state.context.studyId,
			projectId: state.context.projectId,
			decision
		})
	});
	state.setup = body.setup || { decision, saved: true };
}

async function addPerson(payload) {
	const body = await jsonFetch(apiUrl('/api/study-support/people'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			studyId: state.context.studyId,
			projectId: state.context.projectId,
			...payload
		})
	});
	state.people = Array.isArray(body.people) ? body.people : [...state.people, body.person].filter(Boolean);
}

async function removePerson(id) {
	const body = await jsonFetch(apiUrl(`/api/study-support/people/${encodeURIComponent(id)}`), {
		method: 'DELETE'
	});
	state.people = Array.isArray(body.people) ? body.people : state.people.filter((person) => person.id !== id);
}

function decisionErrors(decision) {
	if (decision) return [];
	return [{ href: 'additional-people', message: 'Select whether anyone else will join sessions for this study' }];
}

function personPayload() {
	const role = selectedRadio('role');
	return {
		name: cleanText($('#support-name')?.value),
		email: cleanText($('#support-email')?.value),
		role,
		roleOther: cleanText($('#support-role-other')?.value),
		attendanceScope: selectedRadio('attendanceScope'),
		notes: cleanText($('#support-notes')?.value)
	};
}

function personErrors(payload) {
	const errors = [];
	if (!payload.name) errors.push({ href: 'support-name', message: 'Enter the support person’s name' });
	if (!payload.role) errors.push({ href: 'support-role', message: 'Select the support person’s role' });
	if (payload.role === 'other' && !payload.roleOther) errors.push({ href: 'support-role-other', message: 'Enter the other role' });
	if (!payload.attendanceScope) errors.push({ href: 'attendance-scope', message: 'Select which sessions this person will attend' });
	return errors;
}

function resetPersonForm() {
	const form = $('#person-form');
	if (!form) return;
	form.reset();
	$('#observer-warning')?.setAttribute('hidden', 'hidden');
}

function updateObserverWarning() {
	const warning = $('#observer-warning');
	if (!warning) return;
	warning.hidden = selectedRadio('role') !== 'observer';
}

async function initialiseContext() {
	try {
		const context = await resolveStudyContextFromUrl();
		state.context = context;
		window.__studyRouteContext = context;
		const projectName = context.project?.name || context.project?.Name || 'Project';
		const title = studyTitle(context.study);
		$('#breadcrumb-project').textContent = projectName;
		$('#breadcrumb-project').href = route('/pages/project-dashboard/', { id: context.projectId });
		$('#breadcrumb-study').textContent = title;
		$('#breadcrumb-study').href = route('/pages/study/', { id: context.studyId, project: context.projectId });
		$('#studyBadge').textContent = title;
	} catch {
		$('#study-context-warning').hidden = false;
		const params = new URLSearchParams(window.location.search);
		const studyId = params.get('id') || params.get('sid') || '';
		const projectId = params.get('project') || params.get('pid') || '';
		state.context = { studyId, projectId, study: {}, project: {} };
	}
}

function bindEvents() {
	$('#setup-decision-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		clearErrors();
		const decision = selectedRadio('additionalPeople');
		const errors = decisionErrors(decision);
		if (errors.length) {
			showErrors(errors);
			return;
		}
		try {
			await saveSetupDecision(decision);
			render();
		} catch (error) {
			showErrors([{ href: 'save-setup-decision', message: error?.message || 'Save the setup decision again' }]);
		}
	});

	$('#person-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		clearErrors();
		const payload = personPayload();
		const errors = personErrors(payload);
		if (errors.length) {
			showErrors(errors);
			return;
		}
		try {
			await addPerson(payload);
			resetPersonForm();
			render();
		} catch (error) {
			showErrors([{ href: 'add-person', message: error?.message || 'Add the support person again' }]);
		}
	});

	document.addEventListener('change', (event) => {
		if (event.target?.name === 'role') updateObserverWarning();
	});

	document.addEventListener('click', async (event) => {
		const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
		if (!button) return;
		const id = button.getAttribute('data-id') || '';
		const action = button.getAttribute('data-action');
		if (action === 'ask-remove') {
			event.preventDefault();
			$$('[data-remove-confirmation]').forEach((el) => {
				el.hidden = el.getAttribute('data-remove-confirmation') !== id;
			});
			return;
		}
		if (action === 'cancel-remove') {
			event.preventDefault();
			const panel = $(`[data-remove-confirmation="${CSS.escape(id)}"]`);
			if (panel) panel.hidden = true;
			return;
		}
		if (action === 'confirm-remove') {
			event.preventDefault();
			clearErrors();
			try {
				await removePerson(id);
				render();
			} catch (error) {
				showErrors([{ href: 'support-table-wrap', message: error?.message || 'Remove the support person again' }]);
			}
		}
	});
}

async function init() {
	bindEvents();
	await initialiseContext();
	try {
		await fetchSupportSetup();
	} catch {
		// The page starts from an unsaved setup state when persisted setup is unavailable.
	}
	render();
}

init();
