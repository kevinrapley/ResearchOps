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

import {
	clonePlainObject,
	smartParse,
	toDisplayString,
	shallowEqualByJSON
} from "./variable-utils.js";

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
		this.containerId = opts.containerId;
		this.container = document.getElementById(this.containerId);
		this.onChange = typeof opts.onChange === "function" ? opts.onChange : () => {};
		this.onError = typeof opts.onError === "function" ? opts.onError : () => {};
		this.variables = clonePlainObject(opts.initialVariables || {});
		this._render();
		this._bind();
	}

	/* ---------------- public API ---------------- */

	setVariables(vars) {
		const next = clonePlainObject(vars || {});
		if (shallowEqualByJSON(this.variables, next)) return;
		this.variables = next;
		this._render();
		this._bind();
		this._emitChange();
	}

	getVariables() {
		return clonePlainObject(this.variables);
	}

	set(key, value) {
		if (!key) return;
		this.variables[key] = value;
		this._renderRow(key);
		this._emitChange();
	}

	remove(key) {
		if (!(key in this.variables)) return;
		delete this.variables[key];
		this._removeRowEl(key);
		this._emitChange();
	}

	/* ---------------- render ---------------- */

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

				${keys.length ? "" : `
					<div class="vm-row vm-row--empty">
						<div class="vm-col vm-col--empty">No variables yet.</div>
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
					<input class="vm-input vm-input--val" type="text" value="${escapeAttr(valueText)}" aria-label="Variable value">
				</div>
				<div class="vm-col vm-col--act">
					<button type="button" class="vm-del" title="Delete ${escapeAttr(key)}" aria-label="Delete ${escapeAttr(key)}">✖</button>
				</div>

				<!-- inline confirm (hidden by default) -->
				<div class="vm-confirm" hidden>
					<div class="vm-confirm__box" role="alertdialog" aria-live="assertive">
						<p>Delete <code>${escapeHtml(key)}</code>?</p>
						<div class="vm-confirm__actions">
							<button type="button" class="btn btn--danger" data-vm-confirm="yes">Delete</button>
							<button type="button" class="btn btn--secondary" data-vm-confirm="no">Cancel</button>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	_renderRow(key) {
		const id = `vm-row-${this._idForKey(key)}`;
		const el = document.getElementById(id);
		if (!el) {
			this._render();
			this._bind();
			return;
		}
		el.outerHTML = this._rowHtml(key, this.variables[key]);
		this._bindRow(document.getElementById(id));
	}

	_removeRowEl(key) {
		const id = `vm-row-${this._idForKey(key)}`;
		const el = document.getElementById(id);
		if (el && el.parentNode) el.parentNode.removeChild(el);
		if (Object.keys(this.variables).length === 0) this._render();
	}

	/* ---------------- bind ---------------- */

	_bind() {
		const add = this.container.querySelector("[data-vm-add]");
		if (add) add.addEventListener("click", () => this._onAdd());

		Array.from(this.container.querySelectorAll(".vm-row"))
			.filter(r => !r.classList.contains("vm-row--header") && !r.classList.contains("vm-row--empty"))
			.forEach(r => this._bindRow(r));
	}

	_bindRow(rowEl) {
		// delete with inline confirm
		const delBtn = rowEl.querySelector(".vm-del");
		if (delBtn) delBtn.addEventListener("click", () => {
			this._toggleConfirm(rowEl, true);
		});
		const confirm = rowEl.querySelector(".vm-confirm");
		if (confirm) {
			confirm.addEventListener("click", (e) => {
				const target = e.target.closest("[data-vm-confirm]");
				if (!target) return;
				const key = rowEl.getAttribute("data-vm-row");
				if (target.getAttribute("data-vm-confirm") === "yes") {
					this.remove(key);
				} else {
					this._toggleConfirm(rowEl, false);
				}
			});
		}

		// key change (commit on blur)
		const keyInput = rowEl.querySelector(".vm-input--key");
		if (keyInput) {
			keyInput.addEventListener("input", () => this._onKeyTyping(rowEl, keyInput.value));
			keyInput.addEventListener("blur", () => this._onKeyCommit(rowEl, keyInput.value));
			keyInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") keyInput.blur();
			});
		}

		// value change (commit on blur)
		const valInput = rowEl.querySelector(".vm-input--val");
		if (valInput) {
			valInput.addEventListener("blur", () => this._onValueCommit(rowEl, valInput.value));
			valInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") valInput.blur();
			});
		}
	}

	/* ---------------- handlers ---------------- */

	_onAdd() {
		// unique key generator
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

		// focus new key input
		const row = document.getElementById(`vm-row-${this._idForKey(key)}`);
		row?.querySelector(".vm-input--key")?.focus();
		this._emitChange();
	}

	_onKeyTyping(rowEl, nextKeyRaw) {
		const nextKey = (nextKeyRaw ?? "").trim();
		const hintDup = nextKey && Object.prototype.hasOwnProperty.call(this.variables, nextKey);
		rowEl.classList.toggle("vm-row--dup", hintDup);
	}

	_onKeyCommit(rowEl, nextKeyRaw) {
		const oldKey = rowEl.getAttribute("data-vm-row");
		const nextKey = (nextKeyRaw ?? "").trim();
		if (!nextKey || nextKey === oldKey) {
			rowEl.classList.remove("vm-row--dup");
			return;
		}
		if (Object.prototype.hasOwnProperty.call(this.variables, nextKey)) {
			this.onError?.(`Key "${nextKey}" already exists`);
			// revert UI
			const keyInput = rowEl.querySelector(".vm-input--key");
			if (keyInput) keyInput.value = oldKey;
			rowEl.classList.remove("vm-row--dup");
			return;
		}
		// rename while preserving value
		const val = this.variables[oldKey];
		delete this.variables[oldKey];
		this.variables[nextKey] = val;

		// reflect in DOM
		rowEl.setAttribute("data-vm-row", nextKey);
		rowEl.id = `vm-row-${this._idForKey(nextKey)}`;
		rowEl.querySelector(".vm-del")?.setAttribute("title", `Delete ${nextKey}`);

		this._emitChange();
	}

	_onValueCommit(rowEl, raw) {
		const key = rowEl.getAttribute("data-vm-row");
		try {
			this.variables[key] = smartParse(raw);
			this._emitChange();
		} catch {
			this.onError?.("Invalid value");
		}
	}

	_toggleConfirm(rowEl, show) {
		const panel = rowEl.querySelector(".vm-confirm");
		if (!panel) return;
		if (show) {
			panel.hidden = false;
			panel.querySelector('[data-vm-confirm="no"]')?.focus();
		} else {
			panel.hidden = true;
		}
	}

	_emitChange() {
		try {
			this.onChange(clonePlainObject(this.variables));
		} catch (e) {
			console.error("[VariableManager] onChange error:", e);
		}
	}

	/* ---------------- utils ---------------- */

	_idForKey(key) {
		return String(key).replace(/[^a-z0-9\-_]/gi, "_");
	}
}

function escapeHtml(s) {
	const str = s == null ? "" : String(s);
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(s) { return escapeHtml(s); }