/**
 * @file variable-utils.js
 * @module VariableUtils
 * @summary Validation and helper utilities for guide variables.
 * 
 * @description
 * Provides validation, extraction, and reporting utilities for managing
 * variables in discussion guide templates. Helps researchers identify
 * undefined variables and validate template syntax.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - True if template is valid
 * @property {string[]} undefinedVars - Variables used but not defined
 * @property {string[]} unusedVars - Variables defined but not used
 * @property {string[]} errors - Syntax errors or warnings
 */

/**
 * Validate a template against defined variables.
 * @param {string} template - Markdown template with {{variable}} syntax
 * @param {Record<string, string>} variables - Defined variables
 * @returns {ValidationResult}
 */
export function validateTemplate(template, variables) {
	const result = {
		valid: true,
		undefinedVars: [],
		unusedVars: [],
		errors: []
	};

	// Extract all variable keys from template
	const usedKeys = extractVariableKeys(template);
	const definedKeys = Object.keys(variables);

	// Find undefined variables
	result.undefinedVars = usedKeys.filter(k => !definedKeys.includes(k));

	// Find unused variables
	result.unusedVars = definedKeys.filter(k => !usedKeys.includes(k));

	// Check for syntax errors (unclosed braces)
	const unclosed = template.match(/\{\{[^}]*$/g);
	if (unclosed) {
		result.errors.push('Template contains unclosed {{ braces');
		result.valid = false;
	}

	const unopened = template.match(/[^{]\}\}/g);
	if (unopened) {
		result.errors.push('Template contains unopened }} braces');
		result.valid = false;
	}

	// Check for empty variable names
	if (/\{\{\s*\}\}/.test(template)) {
		result.errors.push('Template contains empty variable names {{}}');
		result.valid = false;
	}

	// Mark as invalid if undefined variables exist
	if (result.undefinedVars.length > 0) {
		result.valid = false;
	}

	return result;
}

/**
 * Extract all variable keys from a template string.
 * @param {string} template
 * @returns {string[]} Array of unique variable keys found in template
 */
export function extractVariableKeys(template) {
	const pattern = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
	const keys = new Set();
	let match;

	while ((match = pattern.exec(template)) !== null) {
		keys.add(match[1]);
	}

	return Array.from(keys).sort();
}

/**
 * Generate a validation report for display to users.
 * @param {ValidationResult} result
 * @returns {string} HTML formatted report
 */
export function formatValidationReport(result) {
	if (result.valid && result.unusedVars.length === 0) {
		return '<p class="govuk-body govuk-!-margin-bottom-0">✓ Template is valid. All variables are defined and used.</p>';
	}

	let html = '';

	if (result.errors.length > 0) {
		html += '<div class="govuk-error-summary" role="alert">';
		html += '<h2 class="govuk-error-summary__title">Template errors</h2>';
		html += '<div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list">';
		result.errors.forEach(err => {
			html += `<li>${escapeHtml(err)}</li>`;
		});
		html += '</ul></div></div>';
	}

	if (result.undefinedVars.length > 0) {
		html += '<div class="govuk-warning-text">';
		html += '<span class="govuk-warning-text__icon" aria-hidden="true">!</span>';
		html += '<strong class="govuk-warning-text__text">';
		html += '<span class="govuk-warning-text__assistive">Warning</span>';
		html += `Undefined variables: ${result.undefinedVars.map(k => `{{${escapeHtml(k)}}}`).join(', ')}`;
		html += '</strong></div>';
	}

	if (result.unusedVars.length > 0) {
		html += '<details class="govuk-details">';
		html += '<summary class="govuk-details__summary">';
		html += '<span class="govuk-details__summary-text">Unused variables</span>';
		html += '</summary>';
		html += '<div class="govuk-details__text">';
		html += `<p>These variables are defined but not used in the template:</p>`;
		html += `<p>${result.unusedVars.map(k => `{{${escapeHtml(k)}}}`).join(', ')}</p>`;
		html += '</div></details>';
	}

	return html || '<p class="govuk-body">No issues found.</p>';
}

/**
 * Suggest variable definitions based on template analysis.
 * @param {string} template
 * @param {Record<string, string>} existingVars
 * @returns {Record<string, string>} Suggested new variables with placeholder values
 */
export function suggestVariables(template, existingVars = {}) {
	const usedKeys = extractVariableKeys(template);
	const suggestions = {};

	for (const key of usedKeys) {
		if (!(key in existingVars)) {
			// Generate helpful placeholder based on key name
			suggestions[key] = generatePlaceholder(key);
		}
	}

	return suggestions;
}

/**
 * Generate a helpful placeholder value for a variable key.
 * @private
 * @param {string} key
 * @returns {string}
 */
function generatePlaceholder(key) {
	const lowerKey = key.toLowerCase();

	// Common patterns
	if (lowerKey.includes('name')) return '[Name]';
	if (lowerKey.includes('date')) return new Date().toISOString().split('T')[0];
	if (lowerKey.includes('time')) return '10:00';
	if (lowerKey.includes('study')) return '[Study name]';
	if (lowerKey.includes('project')) return '[Project name]';
	if (lowerKey.includes('method')) return '[Research method]';
	if (lowerKey.includes('participant')) return '[Participant details]';
	if (lowerKey.includes('task')) return '[Task description]';

	// Default
	return `[${key.replace(/[-_]/g, ' ')}]`;
}

/**
 * HTML escape helper.
 * @private
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

/**
 * Count variable usage in template.
 * @param {string} template
 * @returns {Record<string, number>} Map of variable key to usage count
 */
export function countVariableUsage(template) {
	const pattern = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
	const counts = {};
	let match;

	while ((match = pattern.exec(template)) !== null) {
		const key = match[1];
		counts[key] = (counts[key] || 0) + 1;
	}

	return counts;
}

/**
 * Export variables to CSV format for backup/sharing.
 * @param {Record<string, string>} variables
 * @returns {string} CSV formatted string
 */
export function exportToCSV(variables) {
	const rows = [
		['Key', 'Value']
	];

	for (const [key, value] of Object.entries(variables)) {
		rows.push([key, value]);
	}

	return rows.map(row =>
		row.map(cell => {
			const needsQuotes = /[",\r\n]/.test(cell);
			const escaped = cell.replace(/"/g, '""');
			return needsQuotes ? `"${escaped}"` : cell;
		}).join(',')
	).join('\n');
}

/**
 * Import variables from CSV format.
 * @param {string} csv - CSV formatted string
 * @returns {Record<string, string>} Parsed variables
 * @throws {Error} If CSV format is invalid
 */
export function importFromCSV(csv) {
	const lines = csv.trim().split('\n');
	if (lines.length < 2) {
		throw new Error('CSV must contain header row and at least one data row');
	}

	// Skip header row
	const dataRows = lines.slice(1);
	const variables = {};

	for (const line of dataRows) {
		const [key, value] = parseCSVLine(line);
		if (key && value !== undefined) {
			variables[key.trim()] = value.trim();
		}
	}

	return variables;
}

/**
 * Parse a single CSV line (handles quoted fields).
 * @private
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
	const result = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i += 1) {
		const char = line[i];
		const next = line[i + 1];

		if (char === '"' && inQuotes && next === '"') {
			current += '"';
			i += 1;
		} else if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current);
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current);
	return result;
}

/**
 * Create a deep copy of variables object.
 * @param {Record<string, string>} variables
 * @returns {Record<string, string>}
 */
export function cloneVariables(variables) {
	return JSON.parse(JSON.stringify(variables));
}

/**
 * Merge two variable sets (second overrides first).
 * @param {Record<string, string>} base
 * @param {Record<string, string>} override
 * @returns {Record<string, string>}
 */
export function mergeVariables(base, override) {
	return { ...base, ...override };
}