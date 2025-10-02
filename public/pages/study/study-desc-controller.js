/**
 * @file study-desc-controller.js
 * @module StudyDescController
 * @summary Inline edit controller for Study Description (Markdown-in, safe HTML out).
 *
 * Design notes:
 * - No magic numbers (small config at top).
 * - Class-based, testable, with reset/destroy.
 * - Error logging (console.error) not silent.
 * - RequestAnimationFrame for DOM writes that affect layout.
 * - Emits CustomEvent for host integration when saveUrl not supplied.
 * - Basic Markdown renderer with HTML-escape and conservative allow-list.
 *
 * Dependencies: none (runs in modern browsers).
 */

/** ----------------------- Config ----------------------- */
const CONFIG = Object.freeze({
	maxChars: 20000, // hard cap to avoid accidental pastes
	saveMethod: 'PATCH', // 'PATCH' | 'PUT' | 'POST'
	statusMsgs: {
		startEdit: 'Editing description. Press Save to apply or Cancel to discard.',
		saving: 'Saving description…',
		saved: 'Description saved.',
		cancelled: 'Edit cancelled.',
		error: 'We could not save the description. Try again.'
	}
});

/** --------------------- Controller --------------------- */
class StudyDescController {
	/**
	 * @param {Object} options
	 * @param {string} options.viewWrapSel   Container for read view (e.g. '#desc-view-wrap')
	 * @param {string} options.viewSel       Read-only content element selector (e.g. '#description')
	 * @param {string} options.editBtnSel    "Edit description" button selector
	 * @param {string} options.formSel       Edit form selector (e.g. '#desc-editor')
	 * @param {string} options.textareaSel   Textarea selector (e.g. '#desc-input')
	 * @param {string} options.cancelBtnSel  Cancel button selector (e.g. '#desc-cancel')
	 * @param {string} [options.statusSel]   Optional aria-live region for status messages
	 * @param {string} [options.saveUrl]     Optional API endpoint, may include ':id'
	 * @param {string} [options.studyIdAttr] Data attribute to read study id from (default 'data-study-id') on a nearest ancestor
	 * @param {(html:string)=>string} [options.htmlToMd] Convert current HTML to Markdown if no MD source available
	 * @param {(md:string)=>string} [options.mdToHtml] Convert Markdown to safe HTML
	 */
	constructor(options) {
		this.o = Object.assign({
			studyIdAttr: 'data-study-id',
			htmlToMd: defaultHtmlToMd,
			mdToHtml: defaultMdToHtml
		}, options || {});
		this.state = { editing: false, originalHtml: '', originalMd: '', lastSavedMd: '' };
	}

	/** Initialise and bind events. */
	init() {
		this.$viewWrap = document.querySelector(this.o.viewWrapSel);
		this.$view = document.querySelector(this.o.viewSel);
		this.$editBtn = document.querySelector(this.o.editBtnSel);
		this.$form = document.querySelector(this.o.formSel);
		this.$ta = document.querySelector(this.o.textareaSel);
		this.$cancel = document.querySelector(this.o.cancelBtnSel);
		this.$status = this.o.statusSel ? document.querySelector(this.o.statusSel) : null;

		if (!this.$viewWrap || !this.$view || !this.$editBtn || !this.$form || !this.$ta || !this.$cancel) {
			console.error('StudyDescController: required elements not found');
			return this;
		}

		// Status region (if not provided)
		if (!this.$status) {
			this.$status = document.createElement('p');
			this.$status.id = 'desc-status';
			this.$status.className = 'mono muted';
			this.$status.setAttribute('role', 'status');
			this.$status.setAttribute('aria-live', 'polite');
			this.$status.setAttribute('aria-atomic', 'true');
			this.$viewWrap.after(this.$status);
		}

		this.$editBtn.addEventListener('click', () => this.enterEdit());
		this.$form.addEventListener('submit', (e) => { e.preventDefault();
			this.save(); });
		this.$cancel.addEventListener('click', () => this.cancel());

		// ESC to cancel
		this.$form.addEventListener('keydown', (e) => {
			if (this.state.editing && e.key === 'Escape') {
				e.preventDefault();
				this.cancel();
			}
		});

		return this;
	}

	/** Enter edit mode: swap view → form, prefill textarea. */
	enterEdit() {
		if (this.state.editing) return;
		this.state.editing = true;

		this.state.originalHtml = this.$view.innerHTML;
		// Prefer previously saved MD if we have it; else derive MD from HTML.
		const fallbackMd = this.o.htmlToMd(this.state.originalHtml || '');
		const seedMd = (this.state.lastSavedMd || '').trim() || fallbackMd;

		this.$ta.value = seedMd.slice(0, CONFIG.maxChars);

		// Toggle visibility
		this.$viewWrap.hidden = true;
		this.$form.hidden = false;
		this.$editBtn.hidden = true;
		this._status(CONFIG.statusMsgs.startEdit);

		// Focus and autosize after layout
		requestAnimationFrame(() => {
			this.$ta.focus();
			this._autosize(this.$ta);
		});
	}

	/** Cancel editing: restore view. */
	cancel() {
		if (!this.state.editing) return;
		this._teardown(false);
		this._status(CONFIG.statusMsgs.cancelled);
	}

	/** Save: optimistic render + API or event. */
	async save() {
		if (!this.state.editing) return;
		const md = (this.$ta.value || '').slice(0, CONFIG.maxChars);
		const safeHtml = this.o.mdToHtml(md);

		// Optimistic UI
		this.$view.innerHTML = safeHtml;
		this._status(CONFIG.statusMsgs.saving);
		this._busy(true);

		// Hide the form promptly for perceived performance
		this._teardown(true);

		try {
			if (this.o.saveUrl) {
				const studyId = this._findStudyId() || '';
				const url = this.o.saveUrl.replace(':id', studyId);
				const res = await fetch(url, {
					method: CONFIG.saveMethod,
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ description: md })
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
			} else {
				// Let host handle persistence
				this.$view.dispatchEvent(new CustomEvent('study:desc:save', {
					bubbles: true,
					detail: { markdown: md, html: safeHtml }
				}));
			}
			this.state.lastSavedMd = md;
			this._status(CONFIG.statusMsgs.saved);
		} catch (err) {
			console.error('StudyDescController: save failed', err);
			// Revert UI
			this.$view.innerHTML = this.state.originalHtml;
			this._status(CONFIG.statusMsgs.error);
		} finally {
			this._busy(false);
		}
	}

	/** Reset to pristine state (for tests or re-mounts). */
	reset() {
		this.state = { editing: false, originalHtml: '', originalMd: '', lastSavedMd: '' };
		this.$form.hidden = true;
		this.$viewWrap.hidden = false;
		this.$editBtn.hidden = false;
		return this;
	}

	/** Remove events and references (if tearing down the page). */
	destroy() {
		// In this minimal version events were bound anon; rely on GC.
		this.reset();
		this.$status?.remove();
	}

	/** -------------------- internals -------------------- */
	_teardown(committed) {
		this.$form.hidden = true;
		this.$viewWrap.hidden = false;
		this.$editBtn.hidden = false;
		this.state.editing = false;

		// Return focus
		requestAnimationFrame(() => this.$editBtn.focus());
	}

	_busy(on) {
		const root = this.$view.closest('[aria-busy]') || this.$view.parentElement;
		if (!root) return;
		if (on) { root.setAttribute('aria-busy', 'true'); } else { root.removeAttribute('aria-busy'); }
	}

	_status(msg) {
		if (this.$status) this.$status.textContent = msg;
	}

	_autosize(ta) {
		const fit = () => {
			ta.style.height = 'auto';
			ta.style.overflow = 'hidden';
			ta.style.height = ta.scrollHeight + 'px';
		};
		fit();
		ta.addEventListener('input', () => requestAnimationFrame(fit), { passive: true });
	}

	_findStudyId() {
		// Walk up to find an ancestor with the configured data attribute
		let n = this.$view;
		while (n && n !== document.body) {
			if (n.hasAttribute && n.hasAttribute(this.o.studyIdAttr)) {
				return n.getAttribute(this.o.studyIdAttr);
			}
			n = n.parentNode;
		}
		return null;
	}
}

/** ---------------- Markdown helpers (safe subset) ---------------- */

/** Escape HTML special chars. */
function esc(s) {
	return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } [c]));
}

/**
 * Very small Markdown → HTML renderer for headings, emphasis, code, links, lists, paragraphs.
 * Intentionally conservative: no HTML passthrough, no images.
 */
function defaultMdToHtml(md) {
	if (!md) return '<p>—</p>';
	const lines = md.replace(/\r\n?/g, '\n').split('\n');

	// Code blocks (```…```)
	let inCode = false;
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (/^\s*```/.test(line)) {
			if (!inCode) { inCode = true;
				out.push('<pre><code>'); } else { inCode = false;
				out.push('</code></pre>'); }
			continue;
		}
		if (inCode) {
			out.push(esc(line));
			continue;
		}

		// Headings #
		const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
		if (h) {
			const level = h[1].length;
			out.push(`<h${level} class="govuk-heading-s">${esc(h[2])}</h${level}>`);
			continue;
		}

		// Lists
		if (/^\s*([-*+])\s+/.test(line)) {
			// Collect contiguous list lines
			const items = [];
			let j = i;
			while (j < lines.length && /^\s*([-*+])\s+/.test(lines[j])) {
				items.push(`<li>${inline(lines[j].replace(/^\s*[-*+]\s+/, ''))}</li>`);
				j++;
			}
			out.push(`<ul>${items.join('')}</ul>`);
			i = j - 1;
			continue;
		}
		if (/^\s*\d+\.\s+/.test(line)) {
			const items = [];
			let j = i;
			while (j < lines.length && /^\s*\d+\.\s+/.test(lines[j])) {
				items.push(`<li>${inline(lines[j].replace(/^\s*\d+\.\s+/, ''))}</li>`);
				j++;
			}
			out.push(`<ol>${items.join('')}</ol>`);
			i = j - 1;
			continue;
		}

		// Paragraph / blank
		if (line.trim() === '') {
			out.push('');
		} else {
			out.push('<p>' + inline(line) + '</p>');
		}
	}
	// Collapse multiple blanks
	return out.filter(Boolean).join('\n');

	function inline(s) {
		let t = esc(s);
		// Code span: `code`
		t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
		// Bold **text**
		t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		// Italic *text*
		t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
		// Links [text](https://…)
		t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a rel="nofollow noopener noreferrer" target="_blank" href="$2">$1</a>');
		return t;
	}
}

/** Convert existing HTML back to Markdown-ish text (best-effort). */
function defaultHtmlToMd(html) {
	if (!html) return '';
	const tmp = document.createElement('div');
	tmp.innerHTML = html;
	// Replace links
	tmp.querySelectorAll('a[href]').forEach(a => {
		const md = `[${a.textContent}](${a.getAttribute('href')})`;
		a.replaceWith(md);
	});
	// Replace headings to '# '
	for (let lvl = 6; lvl >= 1; lvl--) {
		tmp.querySelectorAll(`h${lvl}`).forEach(h => h.replaceWith(`${'#'.repeat(lvl)} ${h.textContent}\n\n`));
	}
	// Code blocks
	tmp.querySelectorAll('pre code').forEach(code => code.replaceWith('```\n' + code.textContent + '\n```\n\n'));
	// Inline code
	tmp.querySelectorAll('code').forEach(code => code.replaceWith('`' + code.textContent + '`'));
	// Lists
	tmp.querySelectorAll('li').forEach(li => {
		const isOl = li.parentElement?.tagName === 'OL';
		li.replaceWith((isOl ? '1. ' : '- ') + li.textContent + '\n');
	});
	// Paragraphs & line breaks
	tmp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
	tmp.querySelectorAll('p').forEach(p => p.replaceWith(p.textContent + '\n\n'));
	return tmp.textContent.trim();
}

/** --------------------- Mount on your DOM --------------------- */
const ctrl = new StudyDescController({
	viewWrapSel: '#desc-view-wrap',
	viewSel: '#description',
	editBtnSel: '#btn-edit-desc',
	formSel: '#desc-editor',
	textareaSel: '#desc-input',
	cancelBtnSel: '#desc-cancel',
	// If your page root has data-study-id on a parent container, the controller will pick it up.
	// Provide your API route if you want automatic persistence:
	// saveUrl: '/api/studies/:id'
}).init();

export { StudyDescController };