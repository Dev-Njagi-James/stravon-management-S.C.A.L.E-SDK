import type { StorageUsageReport, UsageLevel } from "./index";

export interface UsageWidgetBrand {
  /** Ring and icon. Default Stravon navy #002147. */
  accent?: string;
  /** Upgrade/Renew button background. Default Stravon gold #d4af37. */
  action?: string;
  /** Upgrade/Renew button text. Default #111111. */
  actionInk?: string;
  /** Text color. Default #002147. */
  ink?: string;
  /** Card background. Default cream #f6f4eb. */
  surface?: string;
  /** CSS font-family. Default Inter, system-ui. The host app must load Inter. */
  font?: string;
  /** Card corner radius, e.g. "16px". */
  radius?: string;
}

export interface UsageWidgetOptions {
  /** Must resolve to a StorageUsageReport. Do NOT call the SDK with a raw API key in a browser; point this at your own backend route. */
  fetchUsage: () => Promise<StorageUsageReport>;
  /** Poll interval in ms. 0 disables polling. Values between 1 and 4999 are raised to 5000. Default 60000. */
  refreshMs?: number;
  brand?: UsageWidgetBrand;
  title?: string;
  onUpgrade?: () => void;
  onError?: (err: unknown) => void;
}

export interface UsageWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

/** Server-side helper: adapts a ScaleClient to the fetchUsage shape. */
export function usageFromClient(client: {
  storage: { usage(): Promise<StorageUsageReport> };
}): () => Promise<StorageUsageReport> {
  return () => client.storage.usage();
}

const SVG_NS = "http://www.w3.org/2000/svg";

const LEVELS: Record<UsageLevel, { color: string; note: string | null }> = {
  ok: { color: "var(--accent)", note: null },
  warn80: { color: "var(--warn)", note: "80% of storage used." },
  upgrade90: { color: "var(--hot)", note: "Over 90% used. Upgrade before uploads are rejected." },
  overage: { color: "var(--over)", note: null },
};

const QUOTA_HELP =
  "Quota is the storage your plan includes. Usage above the quota is overage. Uploads are rejected at the hard cap.";

type Size = "phone" | "tablet" | "desktop";

/** Border-box card widths at which the layout steps up. */
const SIZE_STEPS: Record<Exclude<Size, "phone">, number> = { tablet: 400, desktop: 560 };

/** Hysteresis band (px) so a card sitting on a threshold does not flip-flop. */
const SIZE_HYST = 8;

function sizeFor(width: number, current: Size): Size {
  const t = SIZE_STEPS.tablet;
  const d = SIZE_STEPS.desktop;
  if (current === "desktop") {
    if (width >= d - SIZE_HYST) return "desktop";
    return width >= t + SIZE_HYST ? "tablet" : "phone";
  }
  if (current === "tablet") {
    if (width >= d + SIZE_HYST) return "desktop";
    if (width < t - SIZE_HYST) return "phone";
    return "tablet";
  }
  if (width >= d + SIZE_HYST) return "desktop";
  if (width >= t + SIZE_HYST) return "tablet";
  return "phone";
}

const CSS = `
:host{all:initial;display:block;width:100%;min-width:0;font:inherit;font-family:var(--scale-font,Inter,system-ui,-apple-system,"Segoe UI",sans-serif);color:var(--ink);
--accent:var(--scale-accent,#002147);--action:var(--scale-action,#d4af37);--action-ink:var(--scale-action-ink,#111111);
--ink:var(--scale-ink,#002147);--surface:var(--scale-surface,#f6f4eb);
--muted:#5f6b7a;--track:#e3dfd0;--line:#e6e2d5;--note:#ece8da;
--pillbg:#dff3e3;--pillfg:#1a7f37;--warn:#b7791f;--hot:#c2410c;--over:#b91c1c;--shadow:0 8px 30px rgba(0,33,71,.08);
--pad-y:12px;--pad-x:14px;--gap-head:8px;--gap-section:10px;--stat-pad:12px;--foot-pad:8px}
*{box-sizing:border-box}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--scale-radius,20px);padding:var(--pad-y) var(--pad-x);max-width:720px;width:100%;box-shadow:var(--shadow)}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gap-head)}
.id{display:flex;align-items:flex-start;gap:14px;min-width:0}
.ico{width:28px;height:28px;flex:none;color:var(--accent);margin-top:2px}
.title{margin:0;font-size:.9em;font-weight:600;line-height:1.2}
.subtitle{margin:4px 0 0;color:var(--muted);font-size:.75em}
.pill{flex:none;padding:5px 16px;border-radius:999px;background:var(--pillbg);color:var(--pillfg);font-weight:500;font-size:.8em}
.pill.bad{background:var(--note);color:var(--over)}
.body{display:flex;flex-direction:column;gap:var(--gap-section);margin-top:var(--gap-head)}
.gauge{display:flex;flex-direction:column;align-items:center}
.arch{display:block;width:130px;height:auto}
.ring{transition:stroke-dasharray .5s ease}
@media(prefers-reduced-motion:reduce){.ring{transition:none}}
.pct{font-size:20px;font-weight:700;fill:var(--ink);text-anchor:middle}
.sub{font-size:9px;fill:var(--muted);text-anchor:middle}
.usage{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:6px}
.used{margin:0;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.8em}
.used b{color:var(--ink);font-weight:600}
.remaining{margin:0;color:var(--muted);font-size:.8em}
.remaining::before{content:" · "}
.remaining.bad{color:var(--over);font-weight:600}
.help{position:relative;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1.5px solid var(--muted);border-radius:50%;font-size:11px;line-height:1;cursor:help;color:var(--muted)}
.help:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tipbox{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:240px;padding:8px 10px;border-radius:8px;background:var(--ink);color:var(--surface);font-size:12px;line-height:1.4;text-align:left;z-index:1}
.help:hover .tipbox,.help:focus .tipbox{display:block}
.stats{display:grid;grid-template-columns:1fr;gap:0}
.stat{padding:0;min-width:0}
.stat+.stat{border-top:1px solid var(--line);padding-top:6px}
.sv{font-size:1.15em;font-weight:600;line-height:1.2;white-space:nowrap;min-width:0}
.sv small{font-size:.65em;font-weight:500;margin-left:2px}
.sl{color:var(--muted);margin-top:2px;font-size:.75em}
.statSub{font-size:.7em;color:var(--muted);font-family:inherit;margin-top:2px}
.nowrap{white-space:nowrap}
.foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:var(--gap-section);padding-top:var(--foot-pad);border-top:1px solid var(--line);color:var(--muted);font-size:.8em}
button{font:inherit;cursor:pointer;border-radius:8px;padding:4px 10px;border:1px solid var(--line);background:transparent;color:var(--ink)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button:disabled{opacity:.5;cursor:default}
button.primary{background:var(--action);color:var(--action-ink);border-color:var(--action);margin-top:8px;padding:6px 12px;font-weight:600}
.banner{margin-top:8px;padding:6px 10px;border-radius:8px;background:var(--note);border-left:3px solid var(--banner,var(--muted))}
.state{padding:16px 0;text-align:center;color:var(--muted)}
.state.err{color:var(--over)}
.card[data-size="tablet"] .body{flex-direction:row;align-items:center;gap:14px}
.card[data-size="tablet"] .gauge{flex:none}
.card[data-size="tablet"] .arch{width:120px}
.card[data-size="tablet"] .usage{display:block;margin-top:0}
.card[data-size="tablet"] .used{margin:6px 0 0}
.card[data-size="tablet"] .remaining{margin:4px 0 0}
.card[data-size="tablet"] .remaining::before{content:none}
.card[data-size="tablet"] .stats{grid-template-columns:repeat(2,1fr);gap:8px 0}
.card[data-size="tablet"] .stat{padding:0;border-top:0;padding-top:0}
.card[data-size="tablet"] .stat:nth-child(1){padding-right:10px}
.card[data-size="tablet"] .stat:nth-child(2){padding-left:10px;border-left:1px solid var(--line)}
.card[data-size="tablet"] .stat:nth-child(3){grid-column:1/-1;border-top:1px solid var(--line);padding-top:6px;border-left:0;padding-left:0}
.card[data-size="desktop"] .body{gap:20px}
.card[data-size="desktop"] .arch{width:150px}
.card[data-size="desktop"] .usage{display:block;margin-top:0}
.card[data-size="desktop"] .used{margin:6px 0 0}
.card[data-size="desktop"] .remaining{margin:4px 0 0}
.card[data-size="desktop"] .remaining::before{content:none}
.card[data-size="desktop"] .stats{grid-template-columns:repeat(3,1fr);gap:0}
.card[data-size="desktop"] .stat{padding:0 var(--stat-pad);border-top:0;padding-top:0}
.card[data-size="desktop"] .stat:nth-child(1){padding-left:0}
.card[data-size="desktop"] .stat:nth-child(2),.card[data-size="desktop"] .stat:nth-child(3){border-left:1px solid var(--line)}
.card[data-size="desktop"] .stat:nth-child(3){grid-column:auto}
`;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...kids: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

function s(tag: string, props: Record<string, string | number> = {}, text?: string): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Decimal units (1 GB = 1,000,000,000 B), matching the SDK README. Returns [number, unit]. */
function bytesParts(n: number, compact = false): [string, string] {
  if (!Number.isFinite(n) || n < 1) return ["0", "B"];
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.min(Math.floor(Math.log10(n) / 3), units.length - 1));
  const v = n / 1000 ** i;
  let num = i === 0 || v >= 100 ? String(Math.round(v)) : v.toFixed(1);
  if (compact) num = num.replace(/\.0$/, "");
  return [num, units[i]];
}

function formatBytes(n: number, compact = false): string {
  const [num, unit] = bytesParts(n, compact);
  return `${num} ${unit}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Not set"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const cap = (v: string): string => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

function dbIcon(): SVGElement {
  const svg = s("svg", {
    class: "ico",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  svg.append(
    s("ellipse", { cx: 12, cy: 6, rx: 7.5, ry: 3 }),
    s("path", { d: "M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" }),
    s("path", { d: "M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" }),
  );
  return svg;
}

export function mountUsageWidget(
  target: HTMLElement | string,
  opts: UsageWidgetOptions,
): UsageWidgetHandle {
  const parent = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
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
  const card = h("section", { class: "card", "data-size": "phone", "aria-label": opts.title ?? "Storage usage" });
  root.append(card);
  parent.append(host);

  let size: Size = "phone";
  const applySize = (width: number): void => {
    const next = sizeFor(width, size);
    if (next === size) return;
    size = next;
    card.setAttribute("data-size", next);
  };
  applySize(card.getBoundingClientRect().width);
  let sizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    sizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.borderBoxSize?.[0]?.inlineSize ?? card.getBoundingClientRect().width;
      applySize(width);
    });
    sizeObserver.observe(card);
  }

  const base = opts.refreshMs ?? 60000;
  const pollMs = base > 0 ? Math.max(5000, base) : 0;

  let data: StorageUsageReport | null = null;
  let error: string | null = null;
  let loading = false;
  let destroyed = false;
  let lastFetch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> | null = null;

  function schedule(ms: number): void {
    clearTimeout(timer);
    if (destroyed || ms <= 0) return;
    timer = setTimeout(() => {
      if (document.hidden) schedule(ms);
      else void refresh();
    }, ms);
  }

  function refresh(): Promise<void> {
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
        const retry = (e as { retryAfterMs?: unknown } | null)?.retryAfterMs;
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

  function onVisible(): void {
    if (!document.hidden && pollMs > 0 && Date.now() - lastFetch > pollMs) void refresh();
  }
  document.addEventListener("visibilitychange", onVisible);

  function refreshButton(): HTMLButtonElement {
    const btn = h("button", { type: "button", "aria-label": "Refresh usage" }, loading ? "Refreshing" : "Refresh");
    btn.disabled = loading;
    btn.addEventListener("click", () => void refresh());
    return btn;
  }

  function view(): Node {
    if (!data) {
      const head = h("div", { class: "head" }, h("div", { class: "id" }, dbIcon(), h("h2", { class: "title" }, opts.title ?? "Storage usage")));
      if (error) {
        const retry = h("button", { type: "button" }, "Retry");
        retry.addEventListener("click", () => void refresh());
        return h("div", {}, head, h("div", { class: "state err", role: "alert" }, h("div", {}, error), h("div", {}, retry)));
      }
      return h("div", {}, head, h("div", { class: "state", "aria-busy": "true" }, "Loading usage"));
    }

    const d = data;
    const used = Math.max(0, d.usedBytes);
    const quota = Math.max(0, d.quotaBytes);
    const remaining = Math.max(quota - used, 0);
    const frac = quota > 0 ? Math.min(used / quota, 1) : used > 0 ? 1 : 0;
    const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
    const expired = d.subscriptionStatus === "expired";
    const lv = LEVELS[d.level] ?? LEVELS.ok;
    const ringColor = expired ? "var(--over)" : lv.color;

    // Header: icon, title, plan line, status pill
    const head = h(
      "div",
      { class: "head" },
      h(
        "div",
        { class: "id" },
        dbIcon(),
        h("div", {}, h("h2", { class: "title" }, opts.title ?? "Storage usage"), h("p", { class: "subtitle" }, `${cap(d.tier)} plan · ${cap(d.billingInterval)}`)),
      ),
      h("span", { class: expired ? "pill bad" : "pill" }, cap(d.subscriptionStatus)),
    );

    // Arch gauge: flat base, left-to-right fill, rounded caps
    const R = 50;
    const SW = 9;
    const L = Math.PI * R;
    const dash = frac >= 1 ? L : Math.max(frac * L - SW, 0.01);
    const arc = "M10 60 A50 50 0 0 1 110 60";
    const svg = s("svg", {
      viewBox: "0 0 120 68",
      class: "arch",
      role: "img",
      "aria-label": `${pct}% of storage used. ${formatBytes(remaining)} remaining of ${formatBytes(quota)}.`,
    });
    svg.append(s("path", { d: arc, fill: "none", stroke: "var(--track)", "stroke-width": SW, "stroke-linecap": "round" }));
    if (frac > 0) {
      svg.append(
        s("path", {
          class: "ring",
          d: arc,
          fill: "none",
          stroke: ringColor,
          "stroke-width": SW,
          "stroke-linecap": frac >= 1 ? "butt" : "round",
          "stroke-dasharray": `${dash.toFixed(2)} ${L.toFixed(2)}`,
        }),
      );
    }
    svg.append(s("text", { class: "pct", x: 60, y: 48 }, `${pct}%`), s("text", { class: "sub", x: 60, y: 60 }, "used"));

    const help = h("span", { class: "help", tabindex: "0", role: "button", "aria-label": QUOTA_HELP }, "?", h("span", { class: "tipbox", role: "tooltip" }, QUOTA_HELP));
    const usedLine = h("p", { class: "used" }, h("span", {}, h("b", {}, formatBytes(used)), ` of ${formatBytes(quota)}`), help);
    const remLine =
      d.overageBytes > 0
        ? h("p", { class: "remaining bad" }, `Over quota by ${formatBytes(d.overageBytes)}`)
        : h("p", { class: "remaining" }, `${formatBytes(remaining)} left`);

    // Stats
    const stat = (value: Node | string, label: string): HTMLElement =>
      h("div", { class: "stat" }, h("div", { class: "sv" }, value), h("div", { class: "sl" }, label));
    const [mn, mu] = bytesParts(d.maxFileBytes, true);
    const filesCell = h(
      "div",
      { class: "stat" },
      h("div", { class: "sv" }, String(d.fileCount)),
      h("div", { class: "sl" }, "Files"),
      d.imageCount != null
        ? h(
            "div",
            { class: "statSub" },
            h("span", { class: "nowrap" }, `${d.imageCount} images`),
            " · ",
            h("span", { class: "nowrap" }, `${d.videoCount} videos`),
            " · ",
            h("span", { class: "nowrap" }, `${d.otherCount} other`),
          )
        : null,
    );
    const stats = h(
      "div",
      { class: "stats" },
      filesCell,
      stat(h("span", {}, mn, h("small", {}, ` ${mu}`)), "Max file size"),
      stat(formatDate(d.currentPeriodEnd), "Period ends"),
    );

    const foot = h("div", { class: "foot" }, h("span", {}, `Hard cap ${formatBytes(d.ceilingBytes, true)}`), refreshButton());

    const body = h("div", { class: "body" }, h("div", { class: "gauge" }, svg, h("div", { class: "usage" }, usedLine, remLine)), stats);

    const out: Node[] = [head, body];

    const notes: string[] = [];
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

  function render(): void {
    card.replaceChildren(view());
  }

  void refresh();

  return {
    refresh,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      sizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      host.remove();
    },
  };
}