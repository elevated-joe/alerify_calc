// Colocation catalog — seeded from the Alerify Datacenter Services sheet.
// All rates are monthly USD unless billing === "once". cost = Alerify's cost,
// client = list price.
export interface ColoRate {
  cost: number;
  client: number;
}

export type SizeKey = "1U" | "quarter" | "half" | "full";

export interface RackSize {
  key: SizeKey;
  label: string;
  u: number; // rack units (used for per-U setup)
}

export const RACK_SIZES: RackSize[] = [
  { key: "1U", label: "1U (shared rack)", u: 1 },
  { key: "quarter", label: "¼ rack (10U)", u: 10 },
  { key: "half", label: "½ rack (21U)", u: 21 },
  { key: "full", label: "Full rack (42U)", u: 42 },
];

export interface RackTier {
  key: string;
  label: string;
  power: string;
  // Rackspace rate (power included) by size.
  space: Record<SizeKey, ColoRate>;
}

export const RACK_TIERS: RackTier[] = [
  {
    key: "HD-20kW", label: "High-density 20 kW", power: "3-phase",
    space: {
      "1U": { cost: 35.71, client: 107.31 },
      quarter: { cost: 357.14, client: 1073.12 },
      half: { cost: 750, client: 2253.54 },
      full: { cost: 1500, client: 4507.09 },
    },
  },
  {
    key: "HD-15kW", label: "High-density 15 kW", power: "3-phase",
    space: {
      "1U": { cost: 26.79, client: 80.53 },
      quarter: { cost: 267.86, client: 805.26 },
      half: { cost: 562.5, client: 1691.04 },
      full: { cost: 1125, client: 3382.09 },
    },
  },
  {
    key: "HD-10kW", label: "High-density 10 kW", power: "3-phase",
    space: {
      "1U": { cost: 17.86, client: 53.74 },
      quarter: { cost: 178.57, client: 537.4 },
      half: { cost: 375, client: 1128.54 },
      full: { cost: 750, client: 2257.09 },
    },
  },
  {
    key: "SD-5kW", label: "Standard-density 5 kW", power: "single-phase",
    space: {
      "1U": { cost: 8.93, client: 26.95 },
      quarter: { cost: 89.29, client: 269.55 },
      half: { cost: 187.5, client: 566.04 },
      full: { cost: 375, client: 1132.09 },
    },
  },
  {
    key: "SD-2kW", label: "Standard-density 2 kW", power: "single-phase",
    space: {
      "1U": { cost: 3.57, client: 10.88 },
      quarter: { cost: 35.71, client: 108.83 },
      half: { cost: 75, client: 228.54 },
      full: { cost: 150, client: 457.09 },
    },
  },
];

// Per-unit add-ons the user enters a quantity for (monthly).
export interface ColoAddon {
  key: string;
  label: string;
  unit: string;
  rate: ColoRate;
}

export const COLO_ADDONS: ColoAddon[] = [
  { key: "circuit20", label: "20A A/B redundant circuit pair (2 kW)", unit: "pair", rate: { cost: 150, client: 350 } },
  { key: "circuit30", label: "30A A/B redundant circuit pair (3 kW)", unit: "pair", rate: { cost: 225, client: 450 } },
  { key: "pdu20", label: "In-rack 20A PDU (monitored)", unit: "each", rate: { cost: 83.33, client: 45 } },
  { key: "pdu30", label: "In-rack 30A PDU (monitored)", unit: "each", rate: { cost: 100, client: 60 } },
  { key: "eth", label: "Ethernet drop", unit: "each", rate: { cost: 2.74, client: 8.22 } },
  { key: "fiber", label: "Fiber drop", unit: "each", rate: { cost: 6.94, client: 20.83 } },
  { key: "extraIp", label: "Additional IP (after base block)", unit: "each", rate: { cost: 1, client: 4 } },
];

// IP block options (monthly). The base allocation is a /29 (6 usable).
export interface IpBlock {
  key: string;
  label: string;
  rate: ColoRate;
}

export const IP_BLOCKS: IpBlock[] = [
  { key: "29", label: "/29 — 6 usable (base)", rate: { cost: 8, client: 32 } },
  { key: "28", label: "/28 — 14 usable", rate: { cost: 16, client: 64 } },
  { key: "27", label: "/27 — 30 usable", rate: { cost: 32, client: 128 } },
  { key: "26", label: "/26 — 62 usable", rate: { cost: 64, client: 256 } },
  { key: "25", label: "/25 — 126 usable", rate: { cost: 128, client: 512 } },
  { key: "24", label: "/24 — 254 usable", rate: { cost: 256, client: 1024 } },
];

// Committed bandwidth options (monthly). "none" carries no charge.
export interface BandwidthOption {
  key: string;
  label: string;
  rate: ColoRate;
}

export const BANDWIDTH: BandwidthOption[] = [
  { key: "none", label: "None", rate: { cost: 0, client: 0 } },
  { key: "100", label: "100 Mbps committed", rate: { cost: 51.07, client: 102.15 } },
  { key: "250", label: "250 Mbps committed", rate: { cost: 127.69, client: 255.37 } },
  { key: "500", label: "500 Mbps committed", rate: { cost: 255.37, client: 510.74 } },
  { key: "1000", label: "1 Gbps committed", rate: { cost: 510.74, client: 1021.48 } },
];

// Burstable bandwidth billed per Mbps (95th percentile) above committed.
export const BURSTABLE: ColoRate = { cost: 0.51, client: 10.21 };

// One-time charges.
export const SETUP_PER_U: ColoRate = { cost: 0, client: 100 }; // "Rackspace per U setup"
export const BIOMETRICS: ColoRate = { cost: 2000, client: 2000 }; // optional rack biometric access
