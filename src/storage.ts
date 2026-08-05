import type { Pricing, Quote } from "./types";
import { ADDONS, COMPARE, COMPUTE } from "./data";

const QUOTE_KEY = "alerify_quote_v3";
const PRICING_KEY = "alerify_pricing_v3";

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function defaultPricing(): Pricing {
  return { compute: clone(COMPUTE), addons: clone(ADDONS), compare: clone(COMPARE) };
}

export function isDefaultPricing(p: Pricing): boolean {
  return (
    JSON.stringify(p.compute) === JSON.stringify(COMPUTE) &&
    JSON.stringify(p.addons) === JSON.stringify(ADDONS) &&
    JSON.stringify(p.compare) === JSON.stringify(COMPARE)
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
      };
    }
  } catch {
    /* ignore */
  }
  return defaultPricing();
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
