const BRAND_STORAGE_KEY = 'researchops-brand';
const BRAND_STYLESHEET_ID = 'researchops-home-office-brand';
const HOME_OFFICE_BRAND = 'home-office';
const GOVUK_BRAND = 'govuk';
const SUPPORTED_BRANDS = new Set([GOVUK_BRAND, HOME_OFFICE_BRAND]);

function normaliseBrand(value) {
	const brand = String(value || '').trim().toLowerCase();
	return SUPPORTED_BRANDS.has(brand) ? brand : GOVUK_BRAND;
}

function storeBrand(brand) {
	try {
		if (brand === GOVUK_BRAND) window.localStorage.removeItem(BRAND_STORAGE_KEY);
		else window.localStorage.setItem(BRAND_STORAGE_KEY, brand);
	} catch {
		// Storage can be unavailable in hardened browsing contexts.
	}
}

function storedBrand() {
	try {
		return normaliseBrand(window.localStorage.getItem(BRAND_STORAGE_KEY));
	} catch {
		return GOVUK_BRAND;
	}
}

function metaBrand() {
	return document.querySelector('meta[name="researchops-brand"]')?.getAttribute('content') || '';
}

function hostnameBrand() {
	const hostname = String(window.location?.hostname || '').toLowerCase();
	return hostname.includes('home-office') || hostname.includes('homeoffice') ? HOME_OFFICE_BRAND : GOVUK_BRAND;
}

export function getConfiguredBrand() {
	const requested = new URLSearchParams(window.location.search || '').get('brand');
	if (requested && SUPPORTED_BRANDS.has(requested)) {
		storeBrand(requested);
		return requested;
	}

	const configuredMetaBrand = metaBrand();
	if (SUPPORTED_BRANDS.has(configuredMetaBrand)) return configuredMetaBrand;

	const configuredStoredBrand = storedBrand();
	if (configuredStoredBrand !== GOVUK_BRAND) return configuredStoredBrand;

	return hostnameBrand();
}

function ensureHomeOfficeStylesheet(enabled) {
	let link = document.getElementById(BRAND_STYLESHEET_ID);
	if (!link && enabled) {
		link = document.createElement('link');
		link.id = BRAND_STYLESHEET_ID;
		link.rel = 'stylesheet';
		link.href = '/css/brands/home-office.css';
		link.media = 'screen';
	}

	if (!link) return;
	link.disabled = !enabled;
	if (enabled) document.head.append(link);
}

function setHeaderMarkVisibility(isHomeOffice) {
	document.querySelectorAll('.researchops-header__home-office-logo svg').forEach((mark) => {
		mark.style.width = isHomeOffice ? '' : '0';
		mark.style.height = isHomeOffice ? '' : '0';
		mark.style.overflow = isHomeOffice ? '' : 'hidden';
	});

	document.querySelectorAll('.researchops-header__home-office-logo .researchops-header__wordmark').forEach((wordmark) => {
		wordmark.style.width = isHomeOffice ? '0' : '';
		wordmark.style.height = isHomeOffice ? '0' : '';
		wordmark.style.overflow = isHomeOffice ? 'hidden' : '';
	});
}

function updateHeaderAccessibility(brand) {
	const homepageLink = document.querySelector('.researchops-header__homepage-link');
	if (!homepageLink) return;

	homepageLink.setAttribute(
		'aria-label',
		brand === HOME_OFFICE_BRAND ? 'Home Office ResearchOps Demo Suite home' : 'GOV.UK ResearchOps Demo Suite home'
	);
}

export function applyBrandVariant(brand = getConfiguredBrand()) {
	const selectedBrand = normaliseBrand(brand);
	const isHomeOffice = selectedBrand === HOME_OFFICE_BRAND;

	document.documentElement.dataset.researchopsBrand = selectedBrand;
	document.documentElement.classList.toggle('researchops-brand-home-office', isHomeOffice);

	if (document.body) {
		document.body.dataset.researchopsBrand = selectedBrand;
		document.body.classList.toggle('researchops-brand-home-office', isHomeOffice);
	}

	ensureHomeOfficeStylesheet(isHomeOffice);
	setHeaderMarkVisibility(isHomeOffice);
	updateHeaderAccessibility(selectedBrand);

	return selectedBrand;
}

applyBrandVariant();

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => applyBrandVariant(), { once: true });
} else {
	applyBrandVariant();
}
