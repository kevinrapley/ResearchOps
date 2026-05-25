function setTag(id, text, className) {
	const tag = document.getElementById(id);
	if (!tag) return;

	tag.className = `govuk-tag ${className}`;
	tag.textContent = text;
}

function textOf(id) {
	return document.getElementById(id)?.textContent?.trim() || '';
}

function hrefOf(id) {
	return document.getElementById(id)?.getAttribute('href') || '';
}

function syncLink(sourceId, targetId) {
	const href = hrefOf(sourceId);
	const target = document.getElementById(targetId);
	if (href && target) target.setAttribute('href', href);
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

function syncMuralPresentation() {
	const statusText = document.getElementById('mural-status')?.textContent?.trim() || '';
	const createButton = document.getElementById('mural-setup');
	const openButton = document.getElementById('mural-open');
	const summaryTag = document.getElementById('mural-summary-tag');

	if (/connected/i.test(statusText)) {
		setTag('mural-account-state', 'Connected', 'govuk-tag--green');
		if (summaryTag) {
			summaryTag.className = 'govuk-tag govuk-tag--green';
			summaryTag.textContent = 'Mural connected';
		}
	} else if (/connect/i.test(statusText)) {
		setTag('mural-account-state', 'Not connected', 'govuk-tag--grey');
		if (summaryTag) {
			summaryTag.className = 'govuk-tag govuk-tag--grey';
			summaryTag.textContent = 'Mural not connected';
		}
	}

	if (!createButton || !openButton) return;

	if (buttonIsOpeningBoard(createButton) && typeof createButton.onclick === 'function') {
		setTag('mural-board-state', 'Board linked', 'govuk-tag--green');
		openButton.hidden = false;
		openButton.removeAttribute('aria-disabled');
		openButton.classList.remove('rops-disabled-button');
		openButton.onclick = createButton.onclick;
		createButton.hidden = true;
		createButton.disabled = true;
		if (summaryTag) {
			summaryTag.className = 'govuk-tag govuk-tag--green';
			summaryTag.textContent = 'Mural board linked';
		}
		return;
	}

	if (buttonIsCreatingBoard(createButton)) {
		setTag('mural-board-state', 'Not created', 'govuk-tag--grey');
		createButton.hidden = false;
		createButton.textContent = 'Create Mural board';
		openButton.hidden = false;
		openButton.setAttribute('aria-disabled', 'true');
		openButton.classList.add('rops-disabled-button');
		openButton.onclick = (event) => event.preventDefault();
	}
}

function syncDashboardPresentation() {
	syncProjectTags();
	syncMuralPresentation();
}

function initMuralPresentationBridge() {
	const target = document.getElementById('reflexive-journal') || document.body;

	syncDashboardPresentation();
	const observer = new MutationObserver(syncDashboardPresentation);
	observer.observe(target, {
		attributes: true,
		childList: true,
		subtree: true,
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initMuralPresentationBridge, { once: true });
} else {
	initMuralPresentationBridge();
}
