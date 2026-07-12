import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const trackerSource = fs.readFileSync('public/js/flux-researchops-tracker.1.2.0.js', 'utf8');

function storage(initial = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem(key) {
			return values.has(key) ? values.get(key) : null;
		},
		setItem(key, value) {
			values.set(key, String(value));
		},
	};
}

function trackerHarness({ now = 0, session = {} } = {}) {
	const clock = { now };
	const ids = ['first', 'second', 'third'];
	const DateWithClock = class extends Date {
		static now() {
			return clock.now;
		}
	};
	const sessionStorage = storage(session);
	const context = vm.createContext({
		Date: DateWithClock,
		crypto: { randomUUID: () => ids.shift() },
		window: {
			location: { hostname: 'example.test' },
			localStorage: storage(),
			sessionStorage,
		},
	});
	vm.runInContext(trackerSource, context);
	return {
		clock,
		sessionId: () => vm.runInContext('sessionId()', context),
		sessionStorage,
	};
}

test('rolls a legacy Flux session over on the first event after deployment', () => {
	const harness = trackerHarness({
		now: 1_000,
		session: { 'flux.behaviour.session_id': 'session-legacy' },
	});

	assert.equal(harness.sessionId(), 'session-first');
	assert.equal(harness.sessionStorage.getItem('flux.behaviour.session_activity_ms'), '1000');
});

test('keeps an active Flux session and rolls it after 30 minutes of inactivity', () => {
	const harness = trackerHarness({ now: 1_000 });

	assert.equal(harness.sessionId(), 'session-first');
	harness.clock.now += 29 * 60 * 1_000;
	assert.equal(harness.sessionId(), 'session-first');
	harness.clock.now += 30 * 60 * 1_000;
	assert.equal(harness.sessionId(), 'session-second');
});
