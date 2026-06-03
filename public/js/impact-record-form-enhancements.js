const IMPACT_REF_PATTERN = /^IMPCT-RCD-[a-f0-9]{12}$/i;

function impactReferenceFrom(source = '') {
	const existing = String(source || '').trim();
	if (IMPACT_REF_PATTERN.test(existing)) return existing;
	const hex = existing.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
	const fallback = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const suffix = (hex || fallback).replace(/[^a-fA-F0-9]/g, '').toLowerCase().padEnd(12, '0').slice(-12);
	return `IMPCT-RCD-${suffix}`;
}

function newImpactReference() {
	if (window.crypto && typeof window.crypto.randomUUID === 'function') {
		return impactReferenceFrom(window.crypto.randomUUID());
	}
	return impactReferenceFrom('');
}

function selectedRadio(name) {
	return document.querySelector(`[name="${name}"]:checked`);
}

function syncConditionalValues() {
	const metricUnit = selectedRadio('metricUnit');
	const metricUnitOther = document.getElementById('metricUnitOther');
	if (metricUnit?.value === 'other' && metricUnitOther?.value.trim()) {
		metricUnit.value = metricUnitOther.value.trim();
	}

	const measurementWindow = selectedRadio('measurementWindow');
	const measurementWindowCustom = document.getElementById('measurementWindowCustom');
	if (measurementWindow?.value === 'custom' && measurementWindowCustom?.value.trim()) {
		measurementWindow.value = measurementWindowCustom.value.trim();
	}
}

function initialiseImpactReference() {
	const reference = document.getElementById('impact-insightId');
	if (!reference) return;
	reference.value = impactReferenceFrom(reference.value || newImpactReference());
}

function initialiseCopyReference() {
	const button = document.getElementById('impact-copy-reference');
	const reference = document.getElementById('impact-insightId');
	const status = document.getElementById('impact-reference-copy-status');
	if (!button || !reference) return;

	button.addEventListener('click', async () => {
		const text = reference.value.trim();
		try {
			await navigator.clipboard.writeText(text);
			if (status) status.textContent = 'Impact record reference copied.';
		} catch {
			reference.select();
			document.execCommand('copy');
			if (status) status.textContent = 'Impact record reference copied.';
		}
	});
}

function initialiseConditionalSubmitValues() {
	const form = document.getElementById('impact-form');
	if (!form) return;
	form.addEventListener('submit', syncConditionalValues, true);
}

initialiseImpactReference();
initialiseCopyReference();
initialiseConditionalSubmitValues();
