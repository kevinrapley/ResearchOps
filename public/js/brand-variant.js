const BRAND_STORAGE_KEY = 'researchops-brand';
const BRAND_STYLESHEET_ID = 'researchops-home-office-brand';
const HOME_OFFICE_BRAND = 'home-office';
const GOVUK_BRAND = 'govuk';
const SUPPORTED_BRANDS = new Set([GOVUK_BRAND, HOME_OFFICE_BRAND]);

function normaliseBrand(value) {
	const brand = String(value || '')
		.trim()
		.toLowerCase();
	return SUPPORTED_BRANDS.has(brand) ? brand : GOVUK_BRAND;
}

function safeGetLocalStorageBrand() {
	try {
		return normaliseBrand(window.localStorage.getItem(BRAND_STORAGE_KEY));
	} catch {
		return GOVUK_BRAND;
	}
}

function safeSetLocalStorageBrand(brand) {
	try {
		if (brand === GOVUK_BRAND) {
			window.localStorage.removeItem(BRAND_STORAGE_KEY);
			return;
		}
		window.localStorage.setItem(BRAND_STORAGE_KEY, brand);
	} catch {
		// Storage may be unavailable in hardened or private browsing contexts.
	}
}

function getMetaBrand() {
	return document.querySelector('meta[name="researchops-brand"]')?.getAttribute('content') || '';
}

function getHostnameBrand() {
	const hostname = String(window.location?.hostname || '').toLowerCase();
	if (hostname.includes('home-office') || hostname.includes('homeoffice')) return HOME_OFFICE_BRAND;
	return GOVUK_BRAND;
}

export function getConfiguredBrand() {
	const params = new URLSearchParams(window.location.search || '');
	const requested = params.get('brand');
	if (requested && SUPPORTED_BRANDS.has(requested)) {
		safeSetLocalStorageBrand(requested);
		return requested;
	}

	const metaBrand = getMetaBrand();
	if (SUPPORTED_BRANDS.has(metaBrand)) return metaBrand;

	const storedBrand = safeGetLocalStorageBrand();
	if (storedBrand !== GOVUK_BRAND) return storedBrand;

	return getHostnameBrand();
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

function updateHeaderAccessibility(brand) {
	const homepageLink = document.querySelector('.researchops-header__homepage-link');
	if (!homepageLink) return;

	const label =
		brand === HOME_OFFICE_BRAND
			? 'Home Office ResearchOps Demo Suite home'
			: 'GOV.UK ResearchOps Demo Suite home';

	homepageLink.setAttribute('aria-label', label);
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
	updateHeaderAccessibility(selectedBrand);

	return selectedBrand;
}

applyBrandVariant();

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => applyBrandVariant(), { once: true });
} else {
	applyBrandVariant();
}
