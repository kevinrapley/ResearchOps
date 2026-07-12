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

function element({ key, tagName, type = '', autofocus = false, id = '' }) {
	const listeners = new Map();
	const node = {
		dataset: { fluxKey: key, fluxRole: tagName === 'TEXTAREA' ? 'field' : 'control' },
		tagName,
		type,
		id,
		autocomplete: '',
		value: '',
		closest: () => node,
		matches(selector) {
			if (selector === 'input') return tagName === 'INPUT';
			if (
				selector.includes('input:not') ||
				selector.includes('textarea') ||
				selector.includes('select')
			)
				return tagName === 'TEXTAREA';
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
