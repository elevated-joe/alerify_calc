import type { Addons, Instance } from "./types";

export interface ParsedSheet {
  compute: Instance[];
  addons: Partial<Addons>;
  count: number;
}

// Parse an Alerify_Pricing_Sheet.xlsx entirely in the browser. Uses the same
// column mapping as the source sheet; falls back to the raw hourly-rate inputs
// (×744) when the derived client/cost formula columns aren't cached.
export async function parseWorkbook(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const wsName = wb.SheetNames.indexOf("zCompute_Products") >= 0 ? "zCompute_Products" : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wsName], { header: 1, raw: true, blankrows: false });

  const num = (x: unknown): x is number => typeof x === "number" && isFinite(x);
  const HOURS = 744;
  const pick = (primary: unknown, hourly: unknown): number =>
    num(primary) ? primary : num(hourly) ? hourly * HOURS : NaN;

  const compute: Instance[] = [];
  const a: Partial<Addons> = {};

  for (const r of rows) {
    const label = (r[0] == null ? "" : String(r[0])).trim();
    if (/^Z/i.test(label)) {
      const linuxClient = pick(r[11], r[5]);
      const linuxCost = pick(r[15], r[7]);
      const winClient = pick(r[20], r[6]);
      const winCost = pick(r[24], r[8]);
      if ([linuxClient, linuxCost, winClient, winCost].every(num) && num(r[2]) && num(r[3])) {
        compute.push({
          family: label,
          name: String(r[1]),
          vcpu: r[2] as number,
          ram: r[3] as number,
          linuxClient: +linuxClient.toFixed(2),
          linuxCost: +linuxCost.toFixed(2),
          winClient: +winClient.toFixed(2),
          winCost: +winCost.toFixed(2),
        });
      }
      continue;
    }
    const lo = label.toLowerCase();
    const c = r[5];
    const k = r[7];
    if (!num(c)) continue;
    const cost = num(k) ? k : 0;
    if (lo.startsWith("ebs")) a.ebsPerGB = { client: c, cost };
    else if (lo.startsWith("elastic ip")) a.elasticIp = { client: c, cost };
    else if (lo.startsWith("standard firewall")) a.firewallStd = { client: c, cost };
    else if (lo.startsWith("advance firewall") || lo.startsWith("advanced firewall")) a.firewallAdv = { client: c, cost };
    else if (lo.startsWith("sql standard")) a.sqlPer2Core = { client: +(c / 2).toFixed(2), cost: +(cost / 2).toFixed(2) };
    else if (lo.startsWith("rds client access")) a.rdsCal = { client: c, cost };
  }

  if (compute.length < 10) {
    throw new Error(
      "Couldn't read the pricing table. Make sure this is the Alerify sheet with its original tab and columns, saved from Excel."
    );
  }
  return { compute, addons: a, count: compute.length };
}
