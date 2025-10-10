/**
 * @file /partials/debug.js
 * @summary Wires up an in-page debug console + console interception + fetch/xhr taps.
 *          Safe to load multiple times (idempotent).
 */

/** Guard against double-wiring */
if (!window.__DEBUG_CONSOLE_WIRED__) {
  window.__DEBUG_CONSOLE_WIRED__ = true;

  const logs = [];
  const maxLogs = 200;

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function addLog(type, args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = Array.from(args).map(arg => {
      if (arg instanceof Error) {
        const name = arg.name || "Error";
        const msg  = arg.message || String(arg);
        const stk  = arg.stack ? `\n${arg.stack}` : "";
        return `${name}: ${msg}${stk}`;
      }
      if (typeof arg === "object" && arg !== null) {
        try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
      }
      return String(arg);
    }).join(" ");

    logs.push({ type, timestamp, message });
    if (logs.length > maxLogs) logs.shift();

    const output = $("#debug-output");
    if (output) {
      const entry = document.createElement("div");
      entry.className = `debug-${type}`;
      entry.innerHTML = `<span class="debug-timestamp">${timestamp}</span>${escapeHtml(message)}`;
      output.appendChild(entry);
      output.scrollTop = output.scrollHeight;
    }
  }

  // Intercept console methods
  const original = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };
  console.log  = function(){ try{ original.log.apply(console, arguments); }  finally { addLog("log",   arguments); } };
  console.error= function(){ try{ original.error.apply(console, arguments);} finally { addLog("error", arguments); } };
  console.warn = function(){ try{ original.warn.apply(console, arguments); } finally { addLog("warn",  arguments); } };
  console.info = function(){ try{ original.info.apply(console, arguments); } finally { addLog("info",  arguments); } };

  // Global error taps
  window.addEventListener("error", e => addLog("error", [`💥 ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`]));
  window.addEventListener("unhandledrejection", e => addLog("error", [`⚠️ Unhandled Promise: ${e.reason}`]));

  // fetch tap (non-destructive)
  const _fetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url    = (typeof input === "string") ? input : (input && input.url) || String(input);
    const method = (init && init.method) || (input && input.method) || "GET";
    const started = performance.now();
    console.info(`[net] ${method} ${url}`);
    try {
      const res = await _fetch(input, init);
      const ms = Math.round(performance.now() - started);
      try {
        const clone = res.clone();
        const text  = await clone.text();
        try {
          const json = JSON.parse(text);
          console.info(`[net] ← ${method} ${url} ${res.status} (${ms}ms)`, json);
        } catch {
          console.info(`[net] ← ${method} ${url} ${res.status} (${ms}ms) [text]`, text.slice(0, 400));
        }
      } catch {
        console.warn(`[net] ← ${method} ${url} ${res.status} (${ms}ms) [unreadable body]`);
      }
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      console.error(`[net] ✖ ${method} ${url} failed after ${ms}ms`, err);
      throw err;
    }
  };

  // XHR tap (legacy)
  (function(){
    const XHR = window.XMLHttpRequest;
    if (!XHR) return;
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;

    XHR.prototype.open = function(method, url) {
      this.__debug = { method, url, start: 0 };
      return open.apply(this, arguments);
    };
    XHR.prototype.send = function(body) {
      if (this.__debug) this.__debug.start = performance.now();
      this.addEventListener("loadend", () => {
        const d = this.__debug || {};
        const ms = d.start ? Math.round(performance.now() - d.start) : 0;
        const status = this.status;
        let snippet = "";
        try { snippet = (this.responseText || "").slice(0, 400); } catch {}
        const label = status
          ? `[xhr] ← ${d.method} ${d.url} ${status} (${ms}ms)`
          : `[xhr] ← ${d.method} ${d.url} (${ms}ms)`;
        if (status >= 200 && status < 300) console.info(label, snippet);
        else console.warn(label, snippet);
      });
      return send.apply(this, arguments);
    };
  })();

  // UI wiring
  (function ready(fn){
    (document.readyState === "loading")
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();
  })(() => {
    const toggle = $("#debug-toggle");
    const consoleEl = $("#debug-console");
    const closeBtn = $("#debug-close");
    const clearBtn = $("#debug-clear");
    const exportBtn = $("#debug-export");

    toggle?.addEventListener("click", () => { if (consoleEl) consoleEl.hidden = !consoleEl.hidden; });
    closeBtn?.addEventListener("click", () => { if (consoleEl) consoleEl.hidden = true; });
    clearBtn?.addEventListener("click", () => {
      logs.length = 0;
      const output = $("#debug-output");
      if (output) output.innerHTML = "";
    });
    exportBtn?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `debug-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.href = url; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    console.log("🐛 Debug console initialized");
  });
}