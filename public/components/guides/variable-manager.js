/**
 * @file variable-manager.js
 * @module VariableManager
 * @summary Manages key-value variables for discussion guide templates.
 * 
 * @description
 * Provides CRUD operations for guide variables and renders Mustache-style
 * templates. Variables support personalisation and context substitution
 * across discussion guides without manual editing.
 * 
 * @requires /lib/mustache.min.js
 */

/**
 * @typedef {Object} Variable
 * @property {string} key - Variable identifier (alphanumeric, hyphens, underscores)
 * @property {string} value - Replacement text
 * @property {string} [description] - Optional helper text for researchers
 */

/**
 * @typedef {Object} VariableManagerConfig
 * @property {string} containerId - Container element ID
 * @property {Record<string, string>} [initialVariables] - Starting variables
 * @property {(variables: Record<string, string>) => void} [onChange] - Callback on change
 * @property {(msg: string) => void} [onError] - Error handler
 */

export class VariableManager {
	/**
	 * Construct a VariableManager instance.
	 * @param {VariableManagerConfig} config
	 */
	constructor(config) {
		this.config = {
			onError: (msg) => console.error(msg),
			...config
		};

		/** @private */
		this.variables = config.initialVariables || {};

		/** @private */
		this.container = document.getElementById(config.containerId);

		if (!this.container) {
			throw new Error(`Container #${config.containerId} not found`);
		}

		this._render();
	}

	/**
	 * Get all variables as a plain object.
	 * @returns {Record<string, string>}
	 */
	getVariables() {
		return { ...this.variables };
	}

	/**
	 * Set variables (replaces existing).
	 * @param {Record<string, string>} vars
	 * @returns {void}
	 */
	setVariables(vars) {
		this.variables = { ...vars };
		this._render();
		this._notifyChange();
	}

	/**
	 * Add or update a single variable.
	 * @param {string} key
	 * @param {string} value
	 * @returns {void}
	 */
	setVariable(key, value) {
		const cleaned = this._cleanKey(key);
		if (!cleaned) {
			this.config.onError('Variable key must contain alphanumeric characters');
			return;
		}
		this.variables[cleaned] = String(value);
		this._render();
		this._notifyChange();
	}

	/**
	 * Delete a variable by key.
	 * @param {string} key
	 * @returns {void}
	 */
	deleteVariable(key) {
		delete this.variables[key];
		this._render();
		this._notifyChange();
	}

	/**
	 * Render Mustache template with current variables.
	 * @param {string} template - Source Markdown with {{variable}} syntax
	 * @returns {string} Rendered text
	 */
	render(template) {
		if (typeof window.Mustache === 'undefined') {
			this.config.onError('Mustache.js not loaded');
			return template;
		}

		try {
			return window.Mustache.render(template, this.variables);
		} catch (err) {
			this.config.onError(`Template error: ${err.message}`);
			return template;
		}
	}

	/**
	 * Extract variable keys from a template string.
	 * @param {string} template
	 * @returns {string[]} Array of unique variable keys
	 */
	static extractKeys(template) {
		const pattern = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
		const matches = [];
		let match;
		while ((match = pattern.exec(template)) !== null) {
			if (!matches.includes(match[1])) {
				matches.push(match[1]);
			}
		}
		return matches;
	}

	/** @private */
	_cleanKey(key) {
		return String(key).replace(/[^a-zA-Z0-9_-]/g, '');
	}

	/** @private */
	_notifyChange() {
		if (this.config.onChange) {
			this.config.onChange(this.getVariables());
		}
	}

	/** @private */
	_render() {
		const keys = Object.keys(this.variables).sort();

		this.container.innerHTML = `
			<div class="variable-manager">
				<div class="variable-header">
					<h3 class="govuk-heading-s">Guide variables</h3>
					<button type="button" class="govuk-button govuk-button--secondary" data-action="add">
						Add variable
					</button>
				</div>
				
				<div class="variable-list" role="list">
					${keys.length === 0 ? this._emptyState() : keys.map(k => this._renderRow(k)).join('')}
				</div>
				
				<details class="govuk-details">
					<summary class="govuk-details__summary">
						<span class="govuk-details__summary-text">How to use variables</span>
					</summary>
					<div class="govuk-details__text">
						<p>Variables let you personalise guides without editing every occurrence.</p>
						<p>In your Markdown, use: <code>{{variableName}}</code></p>
						<p>Example: &ldquo;Welcome {{participantName}}, today we&rsquo;ll test {{featureName}}.&rdquo;</p>
					</div>
				</details>
			</div>
		`;

		this._attachEvents();
	}

	/** @private */
	_emptyState() {
		return `
			<div class="variable-empty" role="listitem">
				<p class="govuk-body">No variables yet. Add one to get started.</p>
			</div>
		`;
	}

	/** @private */
	_renderRow(key) {
		const value = this.variables[key];
		const escapedValue = this._escapeHtml(value);

		return `
			<div class="variable-row" role="listitem" data-key="${this._escapeHtml(key)}">
				<div class="variable-content">
					<span class="variable-key">{{${this._escapeHtml(key)}}}</span>
					<span class="variable-value">${escapedValue}</span>
				</div>
				<div class="variable-actions">
					<button type="button" class="govuk-link" data-action="edit" data-key="${this._escapeHtml(key)}">
						Edit
					</button>
					<button type="button" class="govuk-link govuk-link--destructive" data-action="delete" data-key="${this._escapeHtml(key)}">
						Delete
					</button>
				</div>
			</div>
		`;
	}

	/** @private */
	_escapeHtml(str) {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	/** @private */
	_attachEvents() {
		this.container.addEventListener('click', (e) => {
			const btn = e.target.closest('button[data-action]');
			if (!btn) return;

			const action = btn.dataset.action;
			const key = btn.dataset.key;

			if (action === 'add') this._promptAdd();
			if (action === 'edit' && key) this._promptEdit(key);
			if (action === 'delete' && key) this._confirmDelete(key);
		});
	}

	/** @private */
	_promptAdd() {
		const key = prompt('Variable key (letters, numbers, hyphens, underscores):');
		if (!key) return;

		const value = prompt('Value:');
		if (value === null) return;

		this.setVariable(key, value);
	}

	/** @private */
	_promptEdit(key) {
		const current = this.variables[key];
		const value = prompt(`Edit value for {{${key}}}:`, current);
		if (value === null) return;

		this.setVariable(key, value);
	}

	/** @private */
	_confirmDelete(key) {
		if (!confirm(`Delete variable {{${key}}}?`)) return;
		this.deleteVariable(key);
	}

	/**
	 * Factory method for quick initialisation.
	 * @param {VariableManagerConfig} config
	 * @returns {VariableManager}
	 */
	static init(config) {
		return new VariableManager(config);
	}
}