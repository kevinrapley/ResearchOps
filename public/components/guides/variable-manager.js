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

import { clonePlainObject, smartParse, toDisplayString, shallowEqualByJSON } from "./variable-utils.js";

const HTML = String.raw;

/**
 * @typedef {Object} VariableManagerOpts
 * @property {string} containerId
 * @property {Record<string, any>} [initialVariables]
 * @property {(vars: Record<string, any>) => void} [onChange]
 * @property {(msg: string) => void} [onError]
 */

export class VariableManager {
	/**
	 * @param {VariableManagerOpts} opts
	 */
	constructor(opts) {
		this.containerId = opts?.containerId;
		this.container = (typeof document !== "undefined" && this.containerId) ?
			document.getElementById(this.containerId) :
			null;

		this.onChange = typeof opts?.onChange === "function" ? opts.onChange : () => {};
		this.onError = typeof opts?.onError === "function" ? opts.onError : () => {};

		this.variables = clonePlainObject(opts?.initialVariables || {});
		this._debounceTimer = null;

		this._ensureContainer();
		this._render();
		this._bind();
	}

	/**
	 * Replace all variables with a new object and re-render.
	 * @param {Record<string, any>} vars
	 */
	setVariables(vars) {
		const next = clonePlainObject(vars || {});
		if (shallowEqualByJSON(this.variables, next)) return;
		this.variables = next;
		this._render();
		this._emitChange();
	}

	/**
	 * Current variables snapshot (cloned).
	 * @returns {Record<string, any>}
	 */
	getVariables() {
		return clonePlainObject(this.variables);
	}

	/**
	 * Add or update a single variable.
	 * @param {string} key
	 * @param {any} value
	 */
	set(key, value) {
		if (!key || typeof key !== "string") return;
		this.variables[key] = value;
		this._renderRow(key); // cheap partial update
		this._emitChange();
	}

	/**
	 * Remove a single variable by key.
	 * @param {string} key
	 */
	remove(key) {
		if (!(key in this.variables)) return;
		delete this.variables[key];
		this._removeRowEl(key);
		this._emitChange();
	}

	/* ---------------- private ---------------- */

	_ensureContainer() {
		if (!this.container) {
			throw new Error(`[VariableManager] container "${this.containerId}" not found`);
		}
	}

	_render() {
		const keys = Object.keys(this.variables);
		this.container.innerHTML = HTML`
			<div class="vm-grid" role="group" aria-label="Variables editor">
				<div class="vm-row vm-row--header">
					<div class="vm-col vm-col--key"><strong>Key</strong></div>
					<div class="vm-col vm-col--val"><strong>Value (JSON or text)</strong></div>
					<div class="vm-col vm-col--act">
						<button type="button" class="btn btn--secondary" data-vm-add>+ Add</button>
					</div>
				</div>
				${keys.length ? "" : HTML`
					<div class="vm-row vm-row--empty">
						<div class="vm-col vm-col--empty" colspan="3">No variables yet.</div>
					</div>
				`}
				${keys.map(k => this._rowHtml(k, this.variables[k])).join("")}
			</div>
		`;
	}

	_rowHtml(key, value) {
		const idSafe = this._idForKey(key);
		const valueText = toDisplayString(value);
		return HTML`
			<div class="vm-row" data-vm-row="${escapeHtml(key)}" id="vm-row-${idSafe}">
				<div class="vm-col vm-col--key">
					<input class="vm-input vm-input--key" type="text" value="${escapeAttr(key)}" aria-label="Variable key">
				</div>
				<div class="vm-col vm-col--val">
					<textarea class="vm-input vm-input--val" rows="2" aria-label="Variable value">${escapeHtml(valueText)}</textarea>
				</div>
				<div class="vm-col vm-col--act">
					<button type="button" class="link-like" data-vm-del="${escapeAttr(key)}" aria-label="Delete ${escapeAttr(key)}">Delete</button>
				</div>
			</div>
		`;
	}

	_renderRow(key) {
		const id = `vm-row-${this._idForKey(key)}`;
		const el = document.getElementById(id);
		if (!el) {
			// full re-render if target row no longer exists
			this._render();
			this._bind();
			return;
		}
		el.outerHTML = this._rowHtml(key, this.variables[key]);
		// re-bind events for this row
		const fresh = document.getElementById(id);
		this._bindRow(fresh);
	}

	_removeRowEl(key) {
		const id = `vm-row-${this._idForKey(key)}`;
		const el = document.getElementById(id);
		if (el && el.parentNode) el.parentNode.removeChild(el);

		// show empty state if last removed
		if (Object.keys(this.variables).length === 0) this._render();
	}

	_bind() {
		// Add button
		const add = this.container.querySelector("[data-vm-add]");
		if (add) add.addEventListener("click", () => this._onAdd());

		// Rows
		const rows = Array.from(this.container.querySelectorAll(".vm-row")).filter(r => !r.classList.contains("vm-row--header") && !r.classList.contains("vm-row--empty"));
		rows.forEach(r => this._bindRow(r));
	}

	_bindRow(rowEl) {
		if (!rowEl) return;

		// delete
		const delBtn = rowEl.querySelector("[data-vm-del]");
		if (delBtn) {
			delBtn.addEventListener("click", () => {
				const key = rowEl.getAttribute("data-vm-row");
				this.remove(key);
			});
		}

		// key change
		const keyInput = rowEl.querySelector(".vm-input--key");
		if (keyInput) {
			keyInput.addEventListener("input", () => this._debounced(() => this._onKeyChange(rowEl, keyInput.value)));
			keyInput.addEventListener("blur", () => this._onKeyCommit(rowEl, keyInput.value));
		}

		// value change
		const valInput = rowEl.querySelector(".vm-input--val");
		if (valInput) {
			valInput.addEventListener("input", () => this._debounced(() => this._onValueChange(rowEl, valInput.value)));
			valInput.addEventListener("blur", () => this._onValueCommit(rowEl, valInput.value));
		}
	}

	_onAdd() {
		// Generate a unique key name
		let base = "var";
		let i = 1;
		let key = `${base}${i}`;
		while (Object.prototype.hasOwnProperty.call(this.variables, key)) {
			i += 1;
			key = `${base}${i}`;
		}
		this.variables[key] = "";
		this._render();
		this._bind();

		// focus the brand new key field
		const row = document.getElementById(`vm-row-${this._idForKey(key)}`);
		const keyInput = row?.querySelector(".vm-input--key");
		keyInput?.focus();
		this._emitChange();
	}

	_onKeyChange(rowEl, nextKeyRaw) {
		// live feedback only (no commit yet)
		const oldKey = rowEl.getAttribute("data-vm-row");
		const nextKey = (nextKeyRaw ?? "").trim();
		if (!nextKey || nextKey === oldKey) return;

		if (Object.prototype.hasOwnProperty.call(this.variables, nextKey)) {
			// duplicate key visual cue (simple)
			rowEl.classList.add("vm-row--dup");
		} else {
			rowEl.classList.remove("vm-row--dup");
		}
	}

	_onKeyCommit(rowEl, nextKeyRaw) {
		const oldKey = rowEl.getAttribute("data-vm-row");
		const nextKey = (nextKeyRaw ?? "").trim();
		if (!nextKey || nextKey === oldKey) return;

		if (Object.prototype.hasOwnProperty.call(this.variables, nextKey)) {
			this.onError?.(`Key "${nextKey}" already exists`);
			// revert UI
			const keyInput = rowEl.querySelector(".vm-input--key");
			if (keyInput) keyInput.value = oldKey;
			rowEl.classList.remove("vm-row--dup");
			return;
		}

		// rename key (preserve value)
		const val = this.variables[oldKey];
		delete this.variables[oldKey];
		this.variables[nextKey] = val;

		// update row state
		rowEl.setAttribute("data-vm-row", nextKey);
		rowEl.id = `vm-row-${this._idForKey(nextKey)}`;
		const delBtn = rowEl.querySelector("[data-vm-del]");
		if (delBtn) delBtn.setAttribute("data-vm-del", nextKey);

		this._emitChange();
	}

	_onValueChange(_rowEl, _raw) {
		// live typing; parse on blur/commit for fewer churn events
	}

	_onValueCommit(rowEl, raw) {
		const key = rowEl.getAttribute("data-vm-row");
		try {
			this.variables[key] = smartParse(raw);
			this._emitChange();
		} catch (err) {
			this.onError?.("Invalid value");
		}
	}

	_emitChange() {
		try {
			this.onChange(clonePlainObject(this.variables));
		} catch (e) {
			// Fail-safe: never throw to the UI
			console.error("[VariableManager] onChange error:", e);
		}
	}

	_debounced(fn, ms = 150) {
		clearTimeout(this._debounceTimer);
		this._debounceTimer = setTimeout(fn, ms);
	}

	_idForKey(key) {
		return String(key).replace(/[^a-z0-9\-_]/gi, "_");
	}
}

/* ---------------- utilities ---------------- */

function escapeHtml(s) {
	const str = s == null ? "" : String(s);
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(s) {
	// Attribute-safe encoding (reuse HTML escaper for simplicity)
	return escapeHtml(s);
}