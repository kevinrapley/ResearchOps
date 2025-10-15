/**
 * @file journal-excerpts.js
 * @summary Excerpt capture for Journal entries (textarea selection → {start, end, text}).
 */
export function initJournalExcerpts(opts = {}) {
	const $ = (s, r = document) => r.querySelector(s);

	const elTextarea = $(opts.textarea || "#entry-content");
	const elList = $(opts.list || "#excerpts-list");
	const elAdd = $(opts.addBtn || "#btn-add-excerpt");

	if (!elTextarea || !elList || !elAdd) {
		console.warn("[excerpts] Missing required elements");
		return;
	}

	let excerpts = [];
	let lastValue = elTextarea.value;

	function addExcerptFromSelection() {
		const start = elTextarea.selectionStart ?? 0;
		const end = elTextarea.selectionEnd ?? 0;
		if (start === end) {
			announce("Select some text to add an excerpt.");
			return;
		}
		const [s, e] = start < end ? [start, end] : [end, start];
		const text = elTextarea.value.slice(s, e);

		const ex = {
			id: crypto.randomUUID(),
			entryId: opts.entryId || null,
			start: s,
			end: e,
			text,
			createdAt: new Date().toISOString()
		};

		excerpts.push(ex);
		render();
		dispatch("excerpt:created", { excerpt: ex, excerpts: [...excerpts] });
	}

	function removeExcerpt(id) {
		excerpts = excerpts.filter(x => x.id !== id);
		render();
		dispatch("excerpts:changed", { excerpts: [...excerpts] });
	}

	function focusExcerpt(id) {
		const ex = excerpts.find(x => x.id === id);
		if (!ex) return;
		elTextarea.focus();
		elTextarea.setSelectionRange(ex.start, ex.end);
		scrollSelectionIntoView(elTextarea);
	}

	function rebaseOnInput() {
		const oldText = lastValue;
		const newText = elTextarea.value;
		if (oldText === newText) return;

		const diff = computeDiff(oldText, newText);
		if (!diff) { lastValue = newText; return; }

		const { index, oldLen, newLen } = diff;

		excerpts = excerpts
			.map(ex => adjustExcerpt(ex, index, oldLen, newLen, elTextarea.value))
			.filter(Boolean);

		lastValue = newText;
		render();
		dispatch("excerpts:changed", { excerpts: [...excerpts] });
	}

	function render() {
		elList.innerHTML = "";
		const frag = document.createDocumentFragment();

		excerpts
			.sort((a, b) => a.start - b.start)
			.forEach(ex => {
				const li = document.createElement("li");
				li.className = "excerpt-item";
				li.dataset.id = ex.id;

				const meta = document.createElement("span");
				meta.className = "excerpt-item__meta";
				meta.textContent = `chars ${ex.start}–${ex.end}`;

				const txt = document.createElement("q");
				txt.textContent = ex.text;

				const actions = document.createElement("span");
				actions.className = "excerpt-item__actions";

				const btnFocus = document.createElement("button");
				btnFocus.type = "button";
				btnFocus.className = "btn btn--secondary";
				btnFocus.textContent = "Focus";
				btnFocus.addEventListener("click", () => focusExcerpt(ex.id));

				const btnRemove = document.createElement("button");
				btnRemove.type = "button";
				btnRemove.className = "btn btn--secondary";
				btnRemove.textContent = "Remove";
				btnRemove.addEventListener("click", () => removeExcerpt(ex.id));

				actions.append(btnFocus, btnRemove);
				li.append(meta, txt, actions);
				frag.append(li);
			});

		elList.append(frag);
	}

	/* Utilities */
	function scrollSelectionIntoView(textarea) {
		const lineHeight = 20;
		const lines = textarea.value.slice(0, textarea.selectionStart).split("\n").length;
		textarea.scrollTop = Math.max(0, (lines - 3) * lineHeight);
	}

	function dispatch(name, detail) {
		elTextarea.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
	}

	function announce(msg) { console.info("[excerpts]", msg); }

	function computeDiff(a, b) {
		if (a === b) return null;
		const aLen = a.length,
			bLen = b.length,
			min = Math.min(aLen, bLen);
		let i = 0;
		while (i < min && a[i] === b[i]) i++;
		let j = 0;
		while (j < (min - i) && a[aLen - 1 - j] === b[bLen - 1 - j]) j++;
		return { index: i, oldLen: aLen - i - j, newLen: bLen - i - j };
	}

	function adjustExcerpt(ex, index, oldLen, newLen, currentText) {
		const delta = newLen - oldLen;
		const s = ex.start,
			e = ex.end;

		// change entirely before
		if (index <= s && (index + oldLen) <= s) {
			return { ...ex, start: s + delta, end: e + delta, text: currentText.slice(s + delta, e + delta) };
		}
		// change entirely after
		if (index >= e) return ex;

		// overlap
		const newStart = Math.min(s, index);
		const newEnd = Math.max(index + newLen, e + delta);
		if (newStart >= newEnd) return null;

		return {
			...ex,
			start: newStart,
			end: newEnd,
			text: currentText.slice(newStart, newEnd)
		};
	}

	/* Bindings */
	elAdd.addEventListener("click", addExcerptFromSelection);

	document.addEventListener("keydown", (ev) => {
		const mod = ev.ctrlKey || ev.metaKey;
		if (mod && ev.shiftKey && ev.key.toLowerCase() === "e") {
			ev.preventDefault();
			addExcerptFromSelection();
		}
	});

	elTextarea.addEventListener("input", rebaseOnInput);

	/* Public API */
	return {
		getExcerpts: () => [...excerpts],
		setExcerpts: (arr) => { excerpts = Array.isArray(arr) ? arr.map(x => ({ ...x })) : [];
			render(); },
		addFromSelection: addExcerptFromSelection,
		remove: removeExcerpt,
		focus: focusExcerpt
	};
}
