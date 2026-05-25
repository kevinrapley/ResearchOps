let syncQueued = false;
let syncInProgress = false;

function elementById(id) {
	return document.getElementById(id);
}

function setClassNameIfChanged(element, className) {
	if (!element || element.className === className) return;
	element.className = className;
}

function setTextIfChanged(element, text) {
	if (!element || element.textContent === text) return;
	element.textContent = text;
}

function setAttributeIfChanged(element, name, value) {
	if (!element || element.getAttribute(name) === value) return;
	element.setAttribute(name, value);
}

function removeAttributeIfPresent(element, name) {
	if (!element || !element.hasAttribute(name)) return;
	element.removeAttribute(name);
}

function setHiddenIfChanged(element, value) {
	if (!element || element.hidden === value) return;
	element.hidden = value;
}

function setDisabledIfChanged(element, value) {
	if (!element || element.disabled === value) return;
	element.disabled = value;
}

function setTag(id, text, className) {
	const tag = elementById(id);
	if (!tag) return;

	setClassNameIfChanged(tag, `govuk-tag ${className}`);
	setTextIfChanged(tag, text);
}

function textOf(id) {
	return elementById(id)?.textContent?.trim() || '';
}

function hrefOf(id) {
	return elementById(id)?.getAttribute('href') || '';
}

function syncLink(sourceId, targetId) {
	const href = hrefOf(sourceId);
	const target = elementById(targetId);
	if (href && target) setAttributeIfChanged(target, 'href', href);
}

function syncProjectTags() {
	const serviceStage = textOf('kv-service-stage');
	const projectStage = textOf('kv-project-stage');

	setTag(
		'project-service-stage-tag',
		serviceStage && serviceStage !== '–' ? serviceStage : 'Service stage not recorded',
		'govuk-tag--blue',
	);
	setTag(
		'project-stage-tag',
		projectStage && projectStage !== '–' ? projectStage : 'Project stage not recorded',
		'govuk-tag--purple',
	);

	syncLink('journal-link', 'journal-button-link');
	syncLink('outcomes-link', 'outcomes-card-link');
}

function buttonIsOpeningBoard(button) {
	return /open/i.test(button?.textContent || '');
}

function buttonIsCreatingBoard(button) {
	return /create/i.test(button?.textContent || '');
}

function syncSummaryTag(text, className) {
	const summaryTag = elementById('mural-summary-tag');
	if (!summaryTag) return;
	setClassNameIfChanged(summaryTag, `govuk-tag ${className}`);
	setTextIfChanged(summaryTag, text);
}

function syncMuralPresentation() {
	const statusText = elementById('mural-status')?.textContent?.trim() || '';
	const createButton = elementById('mural-setup');
	const openButton = elementById('mural-open');

	if (/connected/i.test(statusText)) {
		setTag('mural-account-state', 'Connected', 'govuk-tag--green');
		syncSummaryTag('Mural connected', 'govuk-tag--green');
	} else if (/connect/i.test(statusText)) {
		setTag('mural-account-state', 'Not connected', 'govuk-tag--grey');
		syncSummaryTag('Mural not connected', 'govuk-tag--grey');
	}

	if (!createButton || !openButton) return;

	if (buttonIsOpeningBoard(createButton) && typeof createButton.onclick === 'function') {
		setTag('mural-board-state', 'Board linked', 'govuk-tag--green');
		setHiddenIfChanged(openButton, false);
		removeAttributeIfPresent(openButton, 'aria-disabled');
		openButton.classList.remove('rops-disabled-button');
		openButton.onclick = createButton.onclick;
		setHiddenIfChanged(createButton, true);
		setDisabledIfChanged(createButton, true);
		syncSummaryTag('Mural board linked', 'govuk-tag--green');
		return;
	}

	if (buttonIsCreatingBoard(createButton)) {
		setTag('mural-board-state', 'Not created', 'govuk-tag--grey');
		setHiddenIfChanged(createButton, false);
		setTextIfChanged(createButton, 'Create Mural board');
		setHiddenIfChanged(openButton, false);
		setAttributeIfChanged(openButton, 'aria-disabled', 'true');
		openButton.classList.add('rops-disabled-button');
		openButton.onclick = (event) => event.preventDefault();
	}
}

function syncDashboardPresentation() {
	if (syncInProgress) return;
	syncInProgress = true;
	try {
		syncProjectTags();
		syncMuralPresentation();
	} finally {
		syncInProgress = false;
	}
}

function scheduleSync() {
	if (syncInProgress || syncQueued) return;
	syncQueued = true;
	requestAnimationFrame(() => {
		syncQueued = false;
		syncDashboardPresentation();
	});
}

function observeDashboardChanges() {
	const observer = new MutationObserver(scheduleSync);
	const projectDetails = elementById('project-details');
	const muralIntegration = elementById('mural-integration');

	if (projectDetails) {
		observer.observe(projectDetails, {
			characterData: true,
			childList: true,
			subtree: true,
		});
	}

	if (muralIntegration) {
		observer.observe(muralIntegration, {
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true,
		});
	}
}

function initMuralPresentationBridge() {
	syncDashboardPresentation();
	observeDashboardChanges();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initMuralPresentationBridge, { once: true });
} else {
	initMuralPresentationBridge();
}
