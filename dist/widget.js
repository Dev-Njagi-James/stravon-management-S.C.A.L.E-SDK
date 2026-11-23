"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/widget.ts
var widget_exports = {};
__export(widget_exports, {
  mountUsageWidget: () => mountUsageWidget,
  usageFromClient: () => usageFromClient
});
module.exports = __toCommonJS(widget_exports);
function usageFromClient(client) {
  return () => client.storage.usage();
}
var SVG_NS = "http://www.w3.org/2000/svg";
var LEVELS = {
  ok: { color: "var(--accent)", note: null },
  warn80: { color: "var(--warn)", note: "80% of storage used." },
  upgrade90: { color: "var(--hot)", note: "Over 90% used. Upgrade before uploads are rejected." },
  overage: { color: "var(--over)", note: null }
};
var QUOTA_HELP = "Quota is the storage your plan includes. Usage above the quota is overage. Uploads are rejected at the hard cap.";
var CSS = `
:host{all:initial;display:block;font:inherit;font-family:var(--scale-font,Inter,system-ui,-apple-system,"Segoe UI",sans-serif);color:var(--ink);
--accent:var(--scale-accent,#002147);--action:var(--scale-action,#d4af37);--action-ink:var(--scale-action-ink,#111111);
--ink:var(--scale-ink,#002147);--surface:var(--scale-surface,#f6f4eb);
--muted:#5f6b7a;--track:#e3dfd0;--line:#e6e2d5;--note:#ece8da;
--pillbg:#dff3e3;--pillfg:#1a7f37;--warn:#b7791f;--hot:#c2410c;--over:#b91c1c;--shadow:0 8px 30px rgba(0,33,71,.08)}
*{box-sizing:border-box}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--scale-radius,20px);padding:24px;max-width:520px;width:100%;box-shadow:var(--shadow)}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.id{display:flex;align-items:flex-start;gap:14px;min-width:0}
.ico{width:28px;height:28px;flex:none;color:var(--accent);margin-top:2px}
.title{margin:0;font-size:1.3em;font-weight:600;line-height:1.2}
.subtitle{margin:4px 0 0;color:var(--muted)}
.pill{flex:none;padding:5px 16px;border-radius:999px;background:var(--pillbg);color:var(--pillfg);font-weight:500}
.pill.bad{background:var(--note);color:var(--over)}
.main{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:8px}
.donut{width:180px;height:180px}
.ring{transition:stroke-dasharray .5s ease}
@media(prefers-reduced-motion:reduce){.ring{transition:none}}
.pct{font-size:24px;font-weight:700;fill:var(--ink);text-anchor:middle}
.sub{font-size:8.5px;fill:var(--muted);text-anchor:middle}
.used{margin:6px 0 0;display:flex;align-items:center;gap:8px;color:var(--muted)}
.used b{color:var(--ink);font-weight:600}
.remaining{margin:4px 0 0;color:var(--muted)}
.remaining.bad{color:var(--over);font-weight:600}
.help{position:relative;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1.5px solid var(--muted);border-radius:50%;font-size:11px;line-height:1;cursor:help;color:var(--muted)}
.help:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tipbox{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:240px;padding:8px 10px;border-radius:8px;background:var(--ink);color:var(--surface);font-size:12px;line-height:1.4;text-align:left;z-index:1}
.help:hover .tipbox,.help:focus .tipbox{display:block}
.stats{display:grid;grid-template-columns:repeat(3,1fr);margin-top:20px;padding-top:20px;border-top:1px solid var(--line)}
.stat{padding:0 16px;min-width:0}
.stat:first-child{padding-left:0}
.stat+.stat{border-left:1px solid var(--line)}
.sv{font-size:1.45em;font-weight:600;line-height:1.2;white-space:nowrap}
.sv small{font-size:.65em;font-weight:500;margin-left:2px}
.sl{color:var(--muted);margin-top:2px}
.foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;color:var(--muted)}
button{font:inherit;cursor:pointer;border-radius:8px;padding:4px 10px;border:1px solid var(--line);background:transparent;color:var(--ink)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button:disabled{opacity:.5;cursor:default}
button.primary{background:var(--action);color:var(--action-ink);border-color:var(--action);margin-top:14px;padding:8px 14px;font-weight:600}
.banner{margin-top:14px;padding:9px 11px;border-radius:8px;background:var(--note);border-left:3px solid var(--banner,var(--muted))}
.state{padding:32px 0;text-align:center;color:var(--muted)}
.state.err{color:var(--over)}
`;
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}
function s(tag, props = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, String(v));
  if (text !== void 0) el.textContent = text;
  return el;
}
function bytesParts(n, compact = false) {
  if (!Number.isFinite(n) || n < 1) return ["0", "B"];
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.min(Math.floor(Math.log10(n) / 3), units.length - 1));
  const v = n / 1e3 ** i;
  let num = i === 0 || v >= 100 ? String(Math.round(v)) : v.toFixed(1);
  if (compact) num = num.replace(/\.0$/, "");
  return [num, units[i]];
}
function formatBytes(n, compact = false) {
  const [num, unit] = bytesParts(n, compact);
  return `${num} ${unit}`;
}
function formatDate(iso) {
  if (!iso) return "Not set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Not set" : d.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" });
}
var cap = (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
function dbIcon() {
  const svg = s("svg", {
    class: "ico",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true"
  });
  svg.append(
    s("ellipse", { cx: 12, cy: 6, rx: 7.5, ry: 3 }),
    s("path", { d: "M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" }),
    s("path", { d: "M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" })
  );
  return svg;
}
function mountUsageWidget(target, opts) {
  const parent = typeof target === "string" ? document.querySelector(target) : target;
  if (!parent) throw new Error("mountUsageWidget: target not found");
  const host = document.createElement("div");
  const b = opts.brand;
  if (b?.accent) host.style.setProperty("--scale-accent", b.accent);
  if (b?.action) host.style.setProperty("--scale-action", b.action);
  if (b?.actionInk) host.style.setProperty("--scale-action-ink", b.actionInk);
  if (b?.ink) host.style.setProperty("--scale-ink", b.ink);
  if (b?.surface) host.style.setProperty("--scale-surface", b.surface);
  if (b?.font) host.style.setProperty("--scale-font", b.font);
  if (b?.radius) host.style.setProperty("--scale-radius", b.radius);
  const root = host.attachShadow({ mode: "open" });
  root.append(h("style", {}, CSS));
  const card = h("section", { class: "card", "aria-label": opts.title ?? "Storage usage" });
  root.append(card);
  parent.append(host);
  const base = opts.refreshMs ?? 6e4;
  const pollMs = base > 0 ? Math.max(5e3, base) : 0;
  let data = null;
  let error = null;
  let loading = false;
  let destroyed = false;
  let lastFetch = 0;
  let timer;
  let inflight = null;
  function schedule(ms) {
    clearTimeout(timer);
    if (destroyed || ms <= 0) return;
    timer = setTimeout(() => {
      if (document.hidden) schedule(ms);
      else void refresh();
    }, ms);
  }
  function refresh() {
    if (inflight) return inflight;
    loading = true;
    render();
    inflight = (async () => {
      let next = pollMs;
      try {
        data = await opts.fetchUsage();
        error = null;
        lastFetch = Date.now();
      } catch (e) {
        error = e instanceof Error ? e.message : "Could not load usage.";
        const retry = e?.retryAfterMs;
        if (next > 0 && typeof retry === "number") next = Math.max(next, retry);
        opts.onError?.(e);
      } finally {
        loading = false;
        inflight = null;
        if (!destroyed) {
          render();
          schedule(next);
        }
      }
    })();
    return inflight;
  }
  function onVisible() {
    if (!document.hidden && pollMs > 0 && Date.now() - lastFetch > pollMs) void refresh();
  }
  document.addEventListener("visibilitychange", onVisible);
  function refreshButton() {
    const btn = h("button", { type: "button", "aria-label": "Refresh usage" }, loading ? "Refreshing" : "Refresh");
    btn.disabled = loading;
    btn.addEventListener("click", () => void refresh());
    return btn;
  }
  function view() {
    if (!data) {
      const head2 = h("div", { class: "head" }, h("div", { class: "id" }, dbIcon(), h("h2", { class: "title" }, opts.title ?? "Storage usage")));
      if (error) {
        const retry = h("button", { type: "button" }, "Retry");
        retry.addEventListener("click", () => void refresh());
        return h("div", {}, head2, h("div", { class: "state err", role: "alert" }, h("div", {}, error), h("div", {}, retry)));
      }
      return h("div", {}, head2, h("div", { class: "state", "aria-busy": "true" }, "Loading usage"));
    }
    const d = data;
    const used = Math.max(0, d.usedBytes);
    const quota = Math.max(0, d.quotaBytes);
    const remaining = Math.max(quota - used, 0);
    const frac = quota > 0 ? Math.min(used / quota, 1) : used > 0 ? 1 : 0;
    const pct = quota > 0 ? Math.round(used / quota * 100) : 0;
    const expired = d.subscriptionStatus === "expired";
    const lv = LEVELS[d.level] ?? LEVELS.ok;
    const ringColor = expired ? "var(--over)" : lv.color;
    const head = h(
      "div",
      { class: "head" },
      h(
        "div",
        { class: "id" },
        dbIcon(),
        h("div", {}, h("h2", { class: "title" }, opts.title ?? "Storage usage"), h("p", { class: "subtitle" }, `${cap(d.tier)} plan \xB7 ${cap(d.billingInterval)}`))
      ),
      h("span", { class: expired ? "pill bad" : "pill" }, cap(d.subscriptionStatus))
    );
    const R = 50;
    const SW = 10;
    const C = 2 * Math.PI * R;
    const dash = frac >= 1 ? C : Math.max(frac * C - SW, 0.01);
    const svg = s("svg", {
      viewBox: "0 0 120 120",
      class: "donut",
      role: "img",
      "aria-label": `${pct}% of storage used. ${formatBytes(remaining)} remaining of ${formatBytes(quota)}.`
    });
    svg.append(s("circle", { cx: 60, cy: 60, r: R, fill: "none", stroke: "var(--track)", "stroke-width": SW }));
    if (frac > 0) {
      svg.append(
        s("circle", {
          class: "ring",
          cx: 60,
          cy: 60,
          r: R,
          fill: "none",
          stroke: ringColor,
          "stroke-width": SW,
          "stroke-linecap": frac >= 1 ? "butt" : "round",
          "stroke-dasharray": `${dash.toFixed(2)} ${C.toFixed(2)}`,
          transform: "rotate(90 60 60)"
        })
      );
    }
    svg.append(s("text", { class: "pct", x: 60, y: 63 }, `${pct}%`), s("text", { class: "sub", x: 60, y: 77 }, "used"));
    const help = h("span", { class: "help", tabindex: "0", role: "button", "aria-label": QUOTA_HELP }, "?", h("span", { class: "tipbox", role: "tooltip" }, QUOTA_HELP));
    const usedLine = h("p", { class: "used" }, h("span", {}, h("b", {}, formatBytes(used)), ` used of ${formatBytes(quota)} quota`), help);
    const remLine = d.overageBytes > 0 ? h("p", { class: "remaining bad" }, `Over quota by ${formatBytes(d.overageBytes)}`) : h("p", { class: "remaining" }, `${formatBytes(remaining)} remaining`);
    const stat = (value, label) => h("div", { class: "stat" }, h("div", { class: "sv" }, value), h("div", { class: "sl" }, label));
    const [mn, mu] = bytesParts(d.maxFileBytes, true);
    const stats = h(
      "div",
      { class: "stats" },
      stat(String(d.fileCount), "Files"),
      stat(h("span", {}, mn, h("small", {}, ` ${mu}`)), "Max file size"),
      stat(formatDate(d.currentPeriodEnd), "Period ends")
    );
    const foot = h("div", { class: "foot" }, h("span", {}, `Hard cap ${formatBytes(d.ceilingBytes, true)}`), refreshButton());
    const out = [head, h("div", { class: "main" }, svg, usedLine, remLine), stats];
    const notes = [];
    if (expired) notes.push("Subscription expired. New uploads are blocked. Reading and deleting still work.");
    if (d.level === "overage")
      notes.push(`Over quota by ${formatBytes(d.overageBytes)}. Uploads stop at the hard cap of ${formatBytes(d.ceilingBytes, true)}.`);
    else if (lv.note) notes.push(lv.note);
    if (error) notes.push(`Showing last loaded data. Refresh failed: ${error}`);
    for (const n of notes) {
      const el = h("div", { class: "banner", role: "status" }, n);
      el.style.setProperty("--banner", expired || d.level === "overage" ? "var(--over)" : lv.color);
      out.push(el);
    }
    if (opts.onUpgrade && (expired || d.level === "upgrade90" || d.level === "overage")) {
      const up = h("button", { type: "button", class: "primary" }, expired ? "Renew plan" : "Upgrade plan");
      up.addEventListener("click", () => opts.onUpgrade?.());
      out.push(up);
    }
    out.push(foot);
    return h("div", {}, ...out);
  }
  function render() {
    card.replaceChildren(view());
  }
  void refresh();
  return {
    refresh,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      host.remove();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  mountUsageWidget,
  usageFromClient
});
