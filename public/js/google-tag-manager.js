/**
 * Loads the approved Google Tag Manager container from the first-party CSP-safe bootstrap.
 */
(function loadGoogleTagManager(windowObject, documentObject, tagName, dataLayerName, containerId) {
	windowObject[dataLayerName] = windowObject[dataLayerName] || [];
	windowObject[dataLayerName].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

	const firstScript = documentObject.getElementsByTagName(tagName)[0];
	const googleTagManagerScript = documentObject.createElement(tagName);
	const dataLayerParameter = dataLayerName !== 'dataLayer' ? `&l=${dataLayerName}` : '';

	googleTagManagerScript.async = true;
	googleTagManagerScript.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}${dataLayerParameter}`;
	firstScript.parentNode.insertBefore(googleTagManagerScript, firstScript);
})(window, document, 'script', 'dataLayer', 'GTM-KGGFK4KW');
