const partNames = [
	'connectors',
	'people',
	'conversation',
	'checklist',
	'tasks',
	'code',
	'content',
	'notes',
	'outcomes',
	'dashboard'
];

const animationFrames = new WeakMap();
const animationParts = new WeakMap();

const emphasisCues = [
	{ part: 'people', at: 4.5, duration: 8, scale: 0.2 },
	{ part: 'checklist', at: 11, duration: 8.5, scale: 0.2 },
	{ part: 'conversation', at: 18.5, duration: 9, scale: 0.2 },
	{ part: 'tasks', at: 26, duration: 8, scale: 0.2 },
	{ part: 'dashboard', at: 34.5, duration: 9.5, scale: 0.2 },
	{ part: 'content', at: 43, duration: 8.5, scale: 0.2 },
	{ part: 'notes', at: 51.5, duration: 8.5, scale: 0.2 },
	{ part: 'outcomes', at: 60.5, duration: 10, scale: 0.2 },
	{ part: 'dashboard', at: 69.5, duration: 9, scale: 0.2 },
	{ part: 'outcomes', at: 72, duration: 8.5, scale: 0.2 }
];

const prepareSvg = (svg) => {
	svg.classList.add('researchops-explainer__svg');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');
	svg.removeAttribute('width');
	svg.removeAttribute('height');

	const parts = {};

	Array.from(svg.children)
		.filter((child) => child.tagName.toLowerCase() === 'g')
		.forEach((group, index) => {
			const partName = partNames[index] || `part-${index}`;
			group.dataset.ropsPart = partName;
			group.style.transformBox = 'fill-box';
			group.style.transformOrigin = 'center';
			parts[partName] = group;
		});

	return parts;
};

const partBoxes = new WeakMap();

const getPartBox = (part) => {
	if (!part) {
		return null;
	}

	if (!partBoxes.has(part)) {
		const box = part.getBBox();
		partBoxes.set(part, {
			cx: box.x + box.width / 2,
			cy: box.y + box.height / 2
		});
	}

	return partBoxes.get(part);
};

const setTransform = (part, { x = 0, y = 0, rotate = 0, scale = 1 } = {}) => {
	const box = getPartBox(part);

	if (!part || !box) {
		return;
	}

	part.setAttribute(
		'transform',
		`translate(${x} ${y}) rotate(${rotate} ${box.cx} ${box.cy}) translate(${box.cx} ${box.cy}) scale(${scale}) translate(${-box.cx} ${-box.cy})`
	);
};

const cueStrength = (cue, time) => {
	const distance = Math.abs(time - cue.at);
	const halfDuration = cue.duration / 2;

	if (distance >= halfDuration) {
		return 0;
	}

	return ((1 + Math.cos((distance / halfDuration) * Math.PI)) / 2) * cue.scale;
};

const emphasisFor = (partName, time) =>
	emphasisCues
		.filter((cue) => cue.part === partName)
		.reduce((scale, cue) => scale + cueStrength(cue, time), 0);

const animateSvg = (component, startTime) => {
	const parts = animationParts.get(component);

	if (!parts || !component.classList.contains('is-playing')) {
		return;
	}

	const audio = component.querySelector('audio');
	const elapsed = (performance.now() - startTime) / 1000;
	const narrativeTime = audio?.currentTime || elapsed;
	const wave = (speed, phase = 0) => Math.sin(elapsed * speed + phase);
	const pulse = (speed, phase = 0) => (wave(speed, phase) + 1) / 2;
	const scale = (partName, base = 1) => base + emphasisFor(partName, narrativeTime);
	const activeCue = emphasisCues
		.map((cue) => ({ ...cue, strength: cueStrength(cue, narrativeTime) }))
		.sort((a, b) => b.strength - a.strength)[0];

	if (activeCue?.strength > 0.02 && parts[activeCue.part]) {
		parts[activeCue.part].parentNode.appendChild(parts[activeCue.part]);
	}

	setTransform(parts.people, { x: wave(1.7) * 18, y: wave(1.25, 1) * -18, rotate: wave(1.05) * 1.6, scale: scale('people') });
	setTransform(parts.conversation, { x: wave(1.45, 0.8) * -18, y: wave(1.75) * 15, rotate: wave(1.2, 2) * -1.8, scale: scale('conversation', 1 + pulse(1.6) * 0.025) });
	setTransform(parts.checklist, { x: wave(1.3, 2.2) * 16, y: wave(1.55, 0.5) * -14, scale: scale('checklist') });
	setTransform(parts.tasks, { x: wave(1.6, 3.1) * -14, y: wave(1.2, 1.7) * 16, rotate: wave(0.9) * 1.4, scale: scale('tasks') });
	setTransform(parts.code, { x: wave(1.9, 1.2) * 15, y: wave(1.4, 2.8) * 13 });
	setTransform(parts.content, { x: wave(1.15, 2.4) * -12, y: wave(1.8, 0.3) * -16, scale: scale('content') });
	setTransform(parts.notes, { x: wave(1.5, 3.4) * 14, y: wave(1.05, 1.2) * -12, scale: scale('notes') });
	setTransform(parts.outcomes, { x: wave(1.1, 1.8) * -16, y: wave(1.65, 2.2) * 12, scale: scale('outcomes', 1 + pulse(1.1, 2) * 0.035) });
	setTransform(parts.dashboard, { y: wave(1.35, 0.2) * -16, scale: scale('dashboard', 1 + pulse(1.4) * 0.035) });

	if (parts.connectors) {
		parts.connectors.querySelectorAll('path').forEach((path, index) => {
			path.style.strokeDashoffset = String((elapsed * -70 + index * 11) % 140);
			path.style.opacity = String(0.55 + pulse(2.4, index) * 0.45);
		});
	}

	const dashboardHighlights = parts.dashboard?.querySelectorAll('rect, path, circle') || [];
	dashboardHighlights.forEach((shape, index) => {
		if (index % 6 === 0) {
			shape.style.transformBox = 'fill-box';
			shape.style.transformOrigin = 'center';
			shape.style.transform = `scale(${1 + pulse(2.2, index) * 0.08})`;
		}
	});

	animationFrames.set(
		component,
		requestAnimationFrame(() => {
			animateSvg(component, startTime);
		})
	);
};

const startSvgAnimation = (component) => {
	const existingFrame = animationFrames.get(component);

	if (existingFrame) {
		cancelAnimationFrame(existingFrame);
	}

	animateSvg(component, performance.now());
};

const stopSvgAnimation = (component) => {
	const existingFrame = animationFrames.get(component);

	if (existingFrame) {
		cancelAnimationFrame(existingFrame);
		animationFrames.delete(component);
	}
};

const setButtonState = (button, state) => {
	const labels = {
		play: 'Play ResearchOps explainer',
		pause: 'Pause ResearchOps explainer'
	};

	button.setAttribute('aria-label', labels[state] || labels.play);
	button.dataset.state = state || 'play';
};

const initialiseExplainer = async (component) => {
	const stage = component.querySelector('[data-researchops-explainer-stage]');
	const button = component.querySelector('[data-researchops-explainer-toggle]');
	const audio = component.querySelector('audio');

	if (!stage || !button || !audio) {
		return;
	}

	try {
		const response = await fetch(stage.dataset.svg);
		const svgText = await response.text();
		const documentFragment = new DOMParser().parseFromString(svgText, 'image/svg+xml');
		const svg = documentFragment.querySelector('svg');

		if (!svg) {
			throw new Error('ResearchOps SVG could not be parsed.');
		}

		const parts = prepareSvg(svg);
		animationParts.set(component, parts);
		stage.replaceChildren(svg);
		component.classList.add('is-ready');
	} catch {
		const fallback = document.createElement('img');
		fallback.src = stage.dataset.svg;
		fallback.alt = '';
		fallback.className = 'researchops-explainer__fallback-image';
		stage.replaceChildren(fallback);
		component.classList.add('is-ready');
	}

	button.addEventListener('click', async () => {
		try {
			if (audio.ended || component.classList.contains('is-complete')) {
				audio.currentTime = 0;
				component.classList.remove('is-complete', 'is-paused');
				await audio.play();
				component.classList.add('has-started');
				startSvgAnimation(component);
				return;
			}

			if (!audio.paused) {
				audio.pause();
				return;
			}

			component.classList.remove('is-complete', 'is-paused');
			await audio.play();
			component.classList.add('has-started');
			startSvgAnimation(component);
		} catch {
			stopSvgAnimation(component);
			component.classList.remove('has-started', 'is-playing', 'is-paused');
			setButtonState(button, 'play');
		}
	});

	audio.addEventListener('play', () => {
		component.classList.add('is-playing');
		component.classList.remove('is-paused', 'is-complete');
		setButtonState(button, 'pause');
		startSvgAnimation(component);
	});

	audio.addEventListener('pause', () => {
		if (!audio.ended) {
			component.classList.add('is-paused');
		}

		component.classList.remove('is-playing');
		stopSvgAnimation(component);
		setButtonState(button, 'play');
	});

	audio.addEventListener('ended', () => {
		component.classList.remove('has-started', 'is-playing', 'is-paused');
		component.classList.add('is-complete');
		stopSvgAnimation(component);
		setButtonState(button, 'play');
	});
};

document.querySelectorAll('[data-researchops-explainer]').forEach((component) => {
	void initialiseExplainer(component);
});
