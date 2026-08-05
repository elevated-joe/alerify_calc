import type { Addons, Compare, Instance, Provider, ServerConfig } from "./types";

export const fmt = (n: number): string =>
  "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Margin on revenue: (price − cost) / price. Undefined when price is 0.
export function marginPct(cost: number, client: number): number {
  return client > 0 ? ((client - cost) / client) * 100 : 0;
}

// Inverse: the client price that yields the given margin for a cost.
export function priceFromMargin(cost: number, margin: number): number {
  const m = margin / 100;
  if (m >= 1) return cost; // 100%+ margin is unreachable from a positive cost
  return +(cost / (1 - m)).toFixed(2);
}

// Family follows the RAM-per-vCPU ratio (Z2=2, Z4=4, Z8=8, Z16=16).
export function deriveFamily(vcpu: number, ram: number): string | null {
  if (vcpu > 0) {
    const r = ram / vcpu;
    if (r === 2 || r === 4 || r === 8 || r === 16) return "Z" + r;
  }
  return null;
}

export function familyLabel(c: Instance): string {
  return deriveFamily(c.vcpu, c.ram) || c.family || "Custom";
}

export function vcpuOptions(compute: Instance[]): number[] {
  return [...new Set(compute.map((c) => c.vcpu))].sort((a, b) => a - b);
}

export function byKey(compute: Instance[]): Map<string, Instance> {
  return new Map(compute.map((c) => [c.vcpu + "|" + c.ram, c]));
}

export interface Line {
  label: string;
  detail: string;
  client: number;
  cost: number;
}

export interface Priced {
  lines: Line[];
  client: number;
  cost: number;
  comparable: number; // compute + storage + IP + SQL (cloud-comparable)
  profit: number;
  inst?: Instance;
}

export function priceServer(v: ServerConfig, addons: Addons, keyed: Map<string, Instance>): Priced {
  const inst = keyed.get(v.vcpu + "|" + v.ram);
  const lines: Line[] = [];
  let client = 0;
  let cost = 0;
  let comparable = 0;

  const add = (label: string, detail: string, c: number, k: number, cmp: boolean) => {
    client += c;
    cost += k;
    if (cmp) comparable += c;
    lines.push({ label, detail, client: c, cost: k });
  };

  if (inst) {
    const win = v.os === "windows";
    add(
      (win ? "Windows" : "Linux") + " compute",
      `${inst.name} · ${v.vcpu} vCPU / ${v.ram} GB`,
      win ? inst.winClient : inst.linuxClient,
      win ? inst.winCost : inst.linuxCost,
      true
    );
  }
  if (v.ebs > 0) {
    add("EBS storage", `${v.ebs} GB × ${fmt(addons.ebsPerGB.client)}/GB`,
      v.ebs * addons.ebsPerGB.client, v.ebs * addons.ebsPerGB.cost, true);
  }
  if (v.eip > 0) {
    add("Elastic IP", `${v.eip} × ${fmt(addons.elasticIp.client)}`,
      v.eip * addons.elasticIp.client, v.eip * addons.elasticIp.cost, true);
  }
  if (v.sql) {
    const cores = Math.max(addons.sqlMinCores, v.vcpu);
    const packs = Math.ceil(cores / 2);
    add("SQL Standard", `${packs} × 2-core pack (${cores} cores)`,
      packs * addons.sqlPer2Core.client, packs * addons.sqlPer2Core.cost, true);
  }
  if (v.rds > 0) {
    add("RDS CALs", `${v.rds} × ${fmt(addons.rdsCal.client)}`,
      v.rds * addons.rdsCal.client, v.rds * addons.rdsCal.cost, false);
  }

  return { lines, client, cost, comparable, profit: client - cost, inst };
}

export interface CloudEstimate {
  aws: number;
  azure: number;
}

export function cloudCompare(v: ServerConfig, C: Compare, addons: Addons): CloudEstimate {
  const calc = (p: Provider): number => {
    const win = v.os === "windows";
    const compute =
      (p.vcpuHr * v.vcpu + p.gbHr * v.ram + (win ? p.winVcpuHr * v.vcpu : 0)) * C.hoursMonth;
    const storage = v.ebs * p.storageGB;
    const ip = v.eip * p.ipMonth;
    let sql = 0;
    if (v.sql) {
      const packs = Math.ceil(Math.max(addons.sqlMinCores, v.vcpu) / 2);
      sql = packs * p.sqlPer2Core;
    }
    const egress = Math.max(0, C.avgEgressGBPerServer || 0) * p.egressGB;
    return compute + storage + ip + sql + egress;
  };
  return { aws: calc(C.aws), azure: calc(C.azure) };
}

export function firewallLine(tier: string, addons: Addons): { label: string; client: number; cost: number } {
  return tier === "advanced"
    ? { label: "Advanced firewall — Small", client: addons.firewallAdv.client, cost: addons.firewallAdv.cost }
    : { label: "Standard firewall (included)", client: addons.firewallStd.client, cost: addons.firewallStd.cost };
}
