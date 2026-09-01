import {
  BANDWIDTH, BIOMETRICS, BURSTABLE, COLO_ADDONS, IP_BLOCKS, RACK_SIZES, RACK_TIERS,
  SETUP_PER_U, type ColoRate, type SizeKey,
} from "./coloData";

export interface ColoConfig {
  tier: string; // RackTier.key
  size: SizeKey;
  ip: string; // IpBlock.key
  bandwidth: string; // BandwidthOption.key
  burstMbps: number;
  addons: Record<string, number>; // ColoAddon.key -> qty
  setup: boolean; // per-U install
  biometrics: boolean;
}

export function defaultColo(): ColoConfig {
  return { tier: "SD-5kW", size: "quarter", ip: "29", bandwidth: "none", burstMbps: 0, addons: {}, setup: true, biometrics: false };
}

export interface ColoLine {
  label: string;
  detail: string;
  qty: number;
  client: number; // extended (× qty)
  cost: number;
  once?: boolean;
}

export interface ColoPriced {
  monthlyLines: ColoLine[];
  onceLines: ColoLine[];
  monthlyClient: number;
  monthlyCost: number;
  onceClient: number;
  onceCost: number;
}

const zero: ColoPriced = { monthlyLines: [], onceLines: [], monthlyClient: 0, monthlyCost: 0, onceClient: 0, onceCost: 0 };

export function priceColo(c: ColoConfig): ColoPriced {
  const tier = RACK_TIERS.find((t) => t.key === c.tier);
  const size = RACK_SIZES.find((s) => s.key === c.size);
  if (!tier || !size) return zero;
  const out: ColoPriced = { monthlyLines: [], onceLines: [], monthlyClient: 0, monthlyCost: 0, onceClient: 0, onceCost: 0 };

  const addMonthly = (label: string, detail: string, qty: number, r: ColoRate) => {
    if (qty <= 0) return;
    const client = r.client * qty, cost = r.cost * qty;
    out.monthlyLines.push({ label, detail, qty, client, cost });
    out.monthlyClient += client; out.monthlyCost += cost;
  };
  const addOnce = (label: string, detail: string, qty: number, r: ColoRate) => {
    if (qty <= 0) return;
    const client = r.client * qty, cost = r.cost * qty;
    out.onceLines.push({ label, detail, qty, client, cost, once: true });
    out.onceClient += client; out.onceCost += cost;
  };

  // Rackspace (power included).
  addMonthly(`Rackspace — ${size.label}`, `${tier.label} · ${tier.power} · power included`, 1, tier.space[c.size]);

  // IP block.
  const ip = IP_BLOCKS.find((b) => b.key === c.ip);
  if (ip) addMonthly(`IP block ${ip.label.split(" —")[0]}`, ip.label, 1, ip.rate);

  // Bandwidth.
  const bw = BANDWIDTH.find((b) => b.key === c.bandwidth);
  if (bw && bw.key !== "none") addMonthly(bw.label, "Committed data rate", 1, bw.rate);
  if (c.burstMbps > 0) addMonthly("Burstable bandwidth", "Per Mbps at 95th percentile", c.burstMbps, BURSTABLE);

  // Per-unit add-ons.
  for (const a of COLO_ADDONS) {
    const qty = c.addons[a.key] || 0;
    addMonthly(a.label, `${qty} × ${a.unit}`, qty, a.rate);
  }

  // One-time.
  if (c.setup) addOnce("Install & setup", `${size.u} U × per-U setup`, size.u, SETUP_PER_U);
  if (c.biometrics) addOnce("Rack biometric access", "One-time provisioning", 1, BIOMETRICS);

  return out;
}
