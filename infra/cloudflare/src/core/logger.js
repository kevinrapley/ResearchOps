/**
 * @file core/logger.js
 * @module core/logger
 * @summary Minimal batched console logger (prevents log spam from Workers).
 */

/**
 * Minimal batched console logger (prevents log spam).
 * @class BatchLogger
 */
export class BatchLogger {
	/**
	 * @constructs BatchLogger
	 * @param {{batchSize?:number}} [opts]
	 */
	constructor(opts = {}) {
		/** @private */
		this._batchSize = opts.batchSize || 20;
		/** @private */
		this._buf = [];
		/** @private */
		this._destroyed = false;
	}

	/**
	 * Buffer a log entry and flush when batch size is reached.
	 * @param {"info"|"warn"|"error"} level
	 * @param {string} msg
	 * @param {unknown} [meta]
	 * @returns {void}
	 */
	log(level, msg, meta) {
		if (this._destroyed) return;
		this._buf.push({ t: Date.now(), level, msg, meta });
		if (this._buf.length >= this._batchSize) this.flush();
	}

	/** @returns {void} */
	info(m, x) { this.log("info", m, x); }

	/** @returns {void} */
	warn(m, x) { this.log("warn", m, x); }

	/** @returns {void} */
	error(m, x) { this.log("error", m, x); }

	/**
	 * Flush the buffered entries to console.
	 * @returns {void}
	 */
	flush() {
		if (!this._buf.length) return;
		try {
			console.log("audit.batch", this._buf);
		} catch {
			for (const e of this._buf) {
				try { console.log("audit.entry", e); } catch {}
			}
		} finally {
			this._buf = [];
		}
	}

	/** @returns {void} */
	reset() { this._buf = []; }

	/** @returns {void} */
	destroy() {
		this.flush();
		this._destroyed = true;
	}
}