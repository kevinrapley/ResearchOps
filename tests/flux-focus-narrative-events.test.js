import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const trackerSource = fs.readFileSync('public/js/flux-researchops-tracker.1.2.0.js', 'utf8');

function storage() {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
	};
}

function element({
	key,
	tagName,
	type = '',
	autofocus = false,
	id = '',
	name = '',
	href = '',
	value = '',
	attributes = {},
}) {
	const listeners = new Map();
	const attributeValues = new Map(Object.entries(attributes));
	if (href) attributeValues.set('href', href);
	const node = {
		dataset: {
			...(key ? { fluxKey: key } : {}),
			fluxRole: tagName === 'TEXTAREA' ? 'field' : 'control',
		},
		tagName,
		type,
		id,
		name,
		href,
		autocomplete: '',
		value,
		attributes: [...attributeValues].map(([attributeName, value]) => ({
			name: attributeName,
			value,
		})),
		getAttribute(attribute) {
			return attributeValues.get(attribute) ?? null;
		},
		setAttribute(attribute, value) {
			attributeValues.set(attribute, value);
			const existing = this.attributes.find((item) => item.name === attribute);
			if (existing) existing.value = value;
			else this.attributes.push({ name: attribute, value });
			if (attribute === 'data-flux-key') this.dataset.fluxKey = value;
			if (attribute === 'data-flux-role') this.dataset.fluxRole = value;
		},
		closest: () => node,
		matches(selector) {
			if (selector === 'input') return tagName === 'INPUT';
			if (tagName === 'A') return selector.split(',').includes('a');
			if (tagName === 'BUTTON') return selector.split(',').includes('button');
			if (tagName === 'TEXTAREA') return selector.includes('textarea');
			return selector.includes(tagName.toLowerCase());
		},
		addEventListener(name, handler) {
			listeners.set(name, handler);
		},
		removeEventListener(name) {
			listeners.delete(name);
		},
	};
	if (autofocus) node.dataset.fluxAutofocus = 'true';
	return node;
}

function harness() {
	const clock = { now: 0 };
	const requests = [];
	const context = vm.createContext({
		URL,
		Date: class extends Date {
			static now() {
				return clock.now;
			}
		},
		performance: { now: () => clock.now },
		crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
		document: { querySelectorAll: () => [], forms: [], body: { dataset: {} } },
		window: {
			location: { hostname: 'example.test', pathname: '/pages/project-dashboard/' },
			localStorage: storage(),
			sessionStorage: storage(),
			fetch: (_url, options) => {
				requests.push(JSON.parse(options.body));
				return Promise.resolve({ ok: true });
			},
		},
	});
	vm.runInContext(trackerSource, context);
	return { clock, context, requests };
}

test('records automatic field focus separately from keyboard input and mouse focus exit', () => {
	const { clock, context, requests } = harness();
	const toggle = element({
		key: 'button.project.add-objective',
		tagName: 'BUTTON',
		type: 'button',
	});
	const textarea = element({
		key: 'field.project.add-objective-textarea',
		tagName: 'TEXTAREA',
		autofocus: true,
	});
	const save = element({ key: 'button.project.save-objective', tagName: 'BUTTON', type: 'submit' });
	context.toggle = toggle;
	context.textarea = textarea;
	context.save = save;

	vm.runInContext(
		"recordPointer({ target: toggle, pointerType: 'mouse' }); beginFocus({ target: textarea });",
		context
	);
	for (let index = 0; index < 101; index += 1)
		vm.runInContext(
			"trackKeyboard({ target: textarea, key: 'x', metaKey: false, ctrlKey: false });",
			context
		);
	clock.now = 28_800;
	textarea.value = 'x'.repeat(101);
	vm.runInContext(
		"recordPointer({ target: save, pointerType: 'mouse' }); endFocus({ target: textarea });",
		context
	);

	assert.equal(requests[0].event_class, 'focus');
	assert.equal(requests[0].action, 'field.focus.auto');
	assert.equal(requests[0].element_key, 'field.project.add-objective-textarea');
	assert.equal(requests[1].action, 'field.blur');
	assert.equal(requests[1].key_press_count, 101);
	assert.equal(requests[1].duration_ms, 28_800);
	assert.equal(requests[1].pointer_type, 'mouse');
});

test('adds semantic data attributes to previously uninstrumented interactive elements', () => {
	const { context } = harness();
	const link = element({ tagName: 'A', id: 'journal-entry-edit-link', href: '#' });
	const field = element({ tagName: 'TEXTAREA', id: 'objective-editor-0' });
	context.link = link;
	context.field = field;

	assert.equal(vm.runInContext('stableKey(link)', context), 'link.navigation.journal-entry-edit');
	assert.equal(link.dataset.fluxKey, 'link.navigation.journal-entry-edit');
	assert.equal(vm.runInContext('stableKey(field)', context), 'field.project.objective-editor');
	assert.equal(field.dataset.fluxKey, 'field.project.objective-editor');
});

test('keeps contact values out of semantic link keys', () => {
	const { context } = harness();
	const email = element({ tagName: 'A', href: 'mailto:alice.person@example.com' });
	const telephone = element({ tagName: 'A', href: 'tel:+447700900123' });
	context.email = email;
	context.telephone = telephone;

	assert.equal(vm.runInContext('stableKey(email)', context), 'link.navigation.contact-email');
	assert.equal(
		vm.runInContext('stableKey(telephone)', context),
		'link.navigation.contact-telephone'
	);
	assert.doesNotMatch(email.dataset.fluxKey, /alice|example|447700/i);
});

test('uses allow-listed action values to distinguish dynamic controls', () => {
	const { context } = harness();
	const previous = element({
		tagName: 'BUTTON',
		type: 'button',
		attributes: { 'data-participants-page': 'previous' },
	});
	const next = element({
		tagName: 'BUTTON',
		type: 'button',
		attributes: { 'data-participants-page': 'next' },
	});
	const remove = element({
		tagName: 'BUTTON',
		type: 'button',
		attributes: { 'data-act': 'confirm-delete' },
	});
	const schedule = element({
		tagName: 'BUTTON',
		type: 'button',
		attributes: { 'data-action': 'schedule' },
	});
	const closeObjective = element({
		tagName: 'BUTTON',
		type: 'button',
		attributes: { 'data-close-panel': 'add-objective-panel' },
	});
	const closeStakeholder = element({
		tagName: 'BUTTON',
		type: 'button',
		attributes: { 'data-close-panel': 'add-stakeholder-panel' },
	});
	context.previous = previous;
	context.next = next;
	context.remove = remove;
	context.schedule = schedule;
	context.closeObjective = closeObjective;
	context.closeStakeholder = closeStakeholder;

	assert.equal(
		vm.runInContext('stableKey(previous)', context),
		'button.project.participants-page-previous'
	);
	assert.equal(
		vm.runInContext('stableKey(next)', context),
		'button.project.participants-page-next'
	);
	assert.equal(vm.runInContext('stableKey(remove)', context), 'button.project.confirm-delete');
	assert.equal(vm.runInContext('stableKey(schedule)', context), 'button.project.schedule');
	assert.equal(
		vm.runInContext('stableKey(closeObjective)', context),
		'button.project.close-panel-add-objective-panel'
	);
	assert.equal(
		vm.runInContext('stableKey(closeStakeholder)', context),
		'button.project.close-panel-add-stakeholder-panel'
	);
});

test('ignores framework data attributes when choosing semantic purpose', () => {
	const { context } = harness();
	const link = element({
		tagName: 'A',
		href: '/pages/projects/',
		attributes: { 'data-govuk-button-init': '' },
	});
	context.link = link;

	assert.equal(vm.runInContext('stableKey(link)', context), 'link.navigation.projects');
	assert.doesNotMatch(link.dataset.fluxKey, /govuk|init/);
});

test('keeps controlled checkbox options distinct without exposing arbitrary values', () => {
	const { context } = harness();
	const email = element({
		tagName: 'INPUT',
		type: 'checkbox',
		id: 'p_channel',
		name: 'channel_pref',
		value: 'email',
	});
	const sms = element({
		tagName: 'INPUT',
		type: 'checkbox',
		id: 'p_channel-2',
		name: 'channel_pref',
		value: 'sms',
	});
	const recordOption = element({
		tagName: 'INPUT',
		type: 'radio',
		id: 'participant-choice-2',
		name: 'participant',
		value: 'recSecret123456789',
	});
	context.email = email;
	context.sms = sms;
	context.recordOption = recordOption;

	assert.equal(vm.runInContext('stableKey(email)', context), 'field.project.channel-pref-email');
	assert.equal(vm.runInContext('stableKey(sms)', context), 'field.project.channel-pref-sms');
	assert.equal(
		vm.runInContext('stableKey(recordOption)', context),
		'field.project.participant-choice-2'
	);
	assert.doesNotMatch(recordOption.dataset.fluxKey, /recsecret/i);
});

test('retains positional fallback rather than assigning a generic semantic key', () => {
	const { context } = harness();
	const generic = element({ tagName: 'BUTTON', type: 'button' });
	context.generic = generic;
	context.document.querySelectorAll = () => [generic];

	assert.equal(vm.runInContext('stableKey(generic)', context), 'auto.button.button.1');
	assert.equal(generic.dataset.fluxKey, undefined);
});

test('derives non-project scopes from the controlled page key', () => {
	const { context } = harness();
	const action = element({ tagName: 'BUTTON', type: 'button', id: 'ai-rewrite' });
	context.action = action;
	context.document.body.dataset.fluxPage = 'page.start';

	assert.equal(vm.runInContext('stableKey(action)', context), 'button.start.ai-rewrite');
});

test('classifies an associated label click as pointer focus', () => {
	const { context, requests } = harness();
	const textarea = element({
		key: 'field.project.add-objective-textarea',
		tagName: 'TEXTAREA',
		autofocus: true,
		id: 'objective-text',
	});
	const label = { control: textarea };
	context.label = label;
	context.textarea = textarea;

	vm.runInContext(
		"recordPointer({ target: label, pointerType: 'mouse' }); beginFocus({ target: textarea });",
		context
	);

	assert.equal(requests[0].action, 'field.focus.pointer');
	assert.equal(requests[0].pointer_type, 'mouse');
});

test('classifies focus following keyboard activation as keyboard initiated', () => {
	const { context, requests } = harness();
	const toggle = element({
		key: 'button.project.add-objective',
		tagName: 'BUTTON',
		type: 'button',
	});
	const textarea = element({
		key: 'field.project.add-objective-textarea',
		tagName: 'TEXTAREA',
		autofocus: true,
	});
	context.toggle = toggle;
	context.textarea = textarea;

	vm.runInContext(
		"trackKeyboard({ target: toggle, key: 'Enter', metaKey: false, ctrlKey: false }); beginFocus({ target: textarea });",
		context
	);

	assert.equal(requests[0].action, 'field.focus.keyboard');
	assert.equal(requests[0].pointer_type, 'keyboard');
});
