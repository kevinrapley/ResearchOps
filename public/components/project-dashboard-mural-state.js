function setTag(id, text, className) {
	const tag = document.getElementById(id);
	if (!tag) return;

	tag.className = `govuk-tag ${className}`;
	tag.textContent = text;
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

function initMuralPresentationBridge() {
	const target = document.getElementById('mural-integration');
	if (!target) return;

	syncMuralPresentation();
	const observer = new MutationObserver(syncMuralPresentation);
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
