import type { Pricing, Quote } from "./types";
import { ADDONS, COLO, COMPARE, COMPUTE } from "./data";
import { defaultColoQuote, defaultRack, defaultShared, type ColoQuote } from "./coloPricing";

const QUOTE_KEY = "alerify_quote_v3";
const PRICING_KEY = "alerify_pricing_v3";
const COLO_KEY = "alerify_colo_v2";
const COLO_KEY_V1 = "alerify_colo_v1";

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function defaultPricing(): Pricing {
  return { compute: clone(COMPUTE), addons: clone(ADDONS), compare: clone(COMPARE), colo: clone(COLO) };
}

export function isDefaultPricing(p: Pricing): boolean {
  return (
    JSON.stringify(p.compute) === JSON.stringify(COMPUTE) &&
    JSON.stringify(p.addons) === JSON.stringify(ADDONS) &&
    JSON.stringify(p.compare) === JSON.stringify(COMPARE) &&
    JSON.stringify(p.colo) === JSON.stringify(COLO)
  );
}

export function loadPricing(): Pricing {
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Pricing>;
      const base = defaultPricing();
      return {
        compute: Array.isArray(stored.compute) && stored.compute.length ? stored.compute : base.compute,
        addons: stored.addons ? { ...base.addons, ...stored.addons, sqlMinCores: base.addons.sqlMinCores } : base.addons,
        compare: stored.compare ? deepMerge(base.compare, stored.compare) : base.compare,
        colo: stored.colo ? { ...base.colo, ...stored.colo } : base.colo,
      };
    }
  } catch {
    /* ignore */
  }
  return defaultPricing();
}

// Normalize a stored `shared` object to the current shape. The IP block was
// once a single `ip` string; it is now an `ips` array (client may hold several).
function normShared(s: { ip?: string; ips?: unknown; bandwidth?: string; extraIp?: number } | undefined) {
  const base = defaultShared();
  if (!s) return base;
  const ips = Array.isArray(s.ips)
    ? (s.ips as string[])
    : typeof s.ip === "string"
      ? [s.ip]
      : base.ips;
  return { ips, bandwidth: s.bandwidth ?? base.bandwidth, extraIp: s.extraIp ?? base.extraIp };
}

export function loadColoQuote(): ColoQuote {
  try {
    const raw = localStorage.getItem(COLO_KEY);
    if (raw) {
      const q = JSON.parse(raw);
      // Current shape: { racks, shared }.
      if (q && Array.isArray(q.racks)) {
        return {
          racks: q.racks.map((r: unknown, i: number) => ({ ...defaultRack(i + 1), ...(r as object) })),
          shared: normShared(q.shared),
        };
      }
      // Migrate the earlier racks-array shape: hoist IP/bandwidth from the first rack.
      if (Array.isArray(q) && q.length) {
        const first = q[0] || {};
        return {
          racks: q.map((r: unknown, i: number) => ({ ...defaultRack(i + 1), ...(r as object) })),
          shared: normShared({ ip: first.ip ?? "29", bandwidth: first.bandwidth ?? "none" }),
        };
      }
    }
    // Migrate the original single-rack config.
    const v1 = localStorage.getItem(COLO_KEY_V1);
    if (v1) {
      const c = JSON.parse(v1);
      return {
        racks: [{ ...defaultRack(1), ...c }],
        shared: normShared({ ip: c.ip ?? "29", bandwidth: c.bandwidth ?? "none" }),
      };
    }
  } catch {
    /* ignore */
  }
  return defaultColoQuote();
}

export function saveColoQuote(q: ColoQuote): void {
  try {
    localStorage.setItem(COLO_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export function savePricing(p: Pricing): void {
  try {
    localStorage.setItem(PRICING_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearPricing(): void {
  try {
    localStorage.removeItem(PRICING_KEY);
  } catch {
    /* ignore */
  }
}

export function loadQuote(): Quote | null {
  try {
    const raw = localStorage.getItem(QUOTE_KEY);
    if (raw) return JSON.parse(raw) as Quote;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveQuote(q: Quote): void {
  try {
    localStorage.setItem(QUOTE_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, over: any): any {
  for (const k in over) {
    if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k])) {
      base[k] = deepMerge(base[k] || {}, over[k]);
    } else {
      base[k] = over[k];
    }
  }
  return base;
}
