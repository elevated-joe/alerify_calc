import { memo, useState } from "react";
import type { Addons, Compare, Instance, Pricing, Provider } from "./types";
import { deriveFamily, marginPct, priceFromMargin } from "./pricing";

interface Props {
  pricing: Pricing;
  isDefault: boolean;
  status: { kind: "ok" | "err" | ""; text: string };
  onAddons: (a: Addons) => void;
  onCompare: (c: Compare) => void;
  onCompute: (c: Instance[]) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClose: () => void;
}

const ADDON_ROWS: { key: keyof Addons; label: string; basis: string }[] = [
  { key: "ebsPerGB", label: "EBS storage", basis: "per GB / mo" },
  { key: "elasticIp", label: "Elastic IP", basis: "per IP / mo" },
  { key: "firewallStd", label: "Standard firewall", basis: "flat / mo" },
  { key: "firewallAdv", label: "Advanced firewall — Small", basis: "flat / mo" },
  { key: "sqlPer2Core", label: "SQL Standard", basis: "per 2-core pack / mo" },
  { key: "rdsCal", label: "RDS CAL", basis: "per CAL / mo" },
];

const COMPARE_GLOBAL: { key: "hoursMonth" | "avgEgressGBPerServer"; label: string }[] = [
  { key: "hoursMonth", label: "Hours / month" },
  { key: "avgEgressGBPerServer", label: "Avg data-out / server (GB/mo)" },
];

const COMPARE_PROVIDER: { key: keyof Omit<Provider, "label">; label: string }[] = [
  { key: "vcpuHr", label: "$ / vCPU-hr" },
  { key: "gbHr", label: "$ / GB-RAM-hr" },
  { key: "winVcpuHr", label: "Windows $ / vCPU-hr" },
  { key: "storageGB", label: "Storage $ / GB-mo" },
  { key: "ipMonth", label: "Public IP $ / mo" },
  { key: "sqlPer2Core", label: "SQL $ / 2-core pack" },
  { key: "egressGB", label: "Egress $ / GB" },
];

function n(v: string): number {
  const x = parseFloat(v);
  return isFinite(x) ? x : 0;
}

// Shows the margin (from cost vs price); typing a new margin sets the price.
// While focused it holds the raw typed text so it doesn't snap back mid-edit;
// when blurred it shows the computed margin from the current cost/price.
function MarginInput({ cost, client, onPrice }: { cost: number; client: number; onPrice: (price: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const computed = String(Number(marginPct(cost, client).toFixed(1)));
  return (
    <input
      type="number"
      step={0.5}
      className="margin-in"
      value={draft ?? computed}
      onFocus={() => setDraft(computed)}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim() !== "" && cost > 0) onPrice(priceFromMargin(cost, n(e.target.value)));
      }}
      onBlur={() => setDraft(null)}
      title="Editable — sets the price from cost and this margin"
    />
  );
}

const ComputeRow = memo(function ComputeRow({
  c,
  onField,
  onRemove,
}: {
  c: Instance;
  onField: (patch: Partial<Instance>) => void;
  onRemove: () => void;
}) {
  return (
    <tr>
      <td>
        <input type="text" value={c.name} onChange={(e) => onField({ name: e.target.value })} />
      </td>
      <td className="num">
        <input type="number" step={1} value={c.vcpu} onChange={(e) => onField({ vcpu: n(e.target.value) })} />
      </td>
      <td className="num">
        <input type="number" step={1} value={c.ram} onChange={(e) => onField({ ram: n(e.target.value) })} />
      </td>
      <td className="num">
        <input type="number" step={0.01} value={c.linuxCost} onChange={(e) => onField({ linuxCost: n(e.target.value) })} />
      </td>
      <td className="num">
        <input type="number" step={0.01} value={c.linuxClient} onChange={(e) => onField({ linuxClient: n(e.target.value) })} />
      </td>
      <td className="num">
        <MarginInput cost={c.linuxCost} client={c.linuxClient} onPrice={(price) => onField({ linuxClient: price })} />
      </td>
      <td className="num">
        <input type="number" step={0.01} value={c.winCost} onChange={(e) => onField({ winCost: n(e.target.value) })} />
      </td>
      <td className="num">
        <input type="number" step={0.01} value={c.winClient} onChange={(e) => onField({ winClient: n(e.target.value) })} />
      </td>
      <td className="num">
        <MarginInput cost={c.winCost} client={c.winClient} onPrice={(price) => onField({ winClient: price })} />
      </td>
      <td>
        <button className="btn btn-icon" title="Remove instance" onClick={onRemove}>
          ✕
        </button>
      </td>
    </tr>
  );
});

export default function Editor({
  pricing,
  isDefault,
  status,
  onAddons,
  onCompare,
  onCompute,
  onReset,
  onExport,
  onImport,
  onClose,
}: Props) {
  const { addons, compare, compute } = pricing;
  const [bulkMargin, setBulkMargin] = useState("70");
  const [bulkTarget, setBulkTarget] = useState<"both" | "linux" | "windows">("both");

  function setAddon(key: keyof Addons, field: "client" | "cost", value: number) {
    const next = { ...addons, [key]: { ...(addons[key] as { client: number; cost: number }), [field]: value } };
    onAddons(next as Addons);
  }

  function setCompareGlobal(key: "hoursMonth" | "avgEgressGBPerServer", value: number) {
    onCompare({ ...compare, [key]: value });
  }

  function setProvider(prov: "aws" | "azure", key: keyof Provider, value: number) {
    onCompare({ ...compare, [prov]: { ...compare[prov], [key]: value } });
  }

  function setInstance(idx: number, patch: Partial<Instance>) {
    const next = compute.slice();
    const merged = { ...next[idx], ...patch };
    if ("vcpu" in patch || "ram" in patch) {
      merged.family = deriveFamily(merged.vcpu, merged.ram) || merged.family;
    }
    next[idx] = merged;
    onCompute(next);
  }

  function removeInstance(idx: number) {
    onCompute(compute.filter((_, i) => i !== idx));
  }

  function applyBulkMargin(margin: number, target: "both" | "linux" | "windows") {
    if (!isFinite(margin)) return;
    const doLinux = target === "both" || target === "linux";
    const doWin = target === "both" || target === "windows";
    const label = target === "both" ? "Linux and Windows" : target === "linux" ? "Linux" : "Windows";
    if (!confirm(`Set ${label} prices on all ${compute.length} instances to a ${margin}% margin? This overwrites their current prices.`)) return;
    onCompute(
      compute.map((c) => ({
        ...c,
        linuxClient: doLinux ? priceFromMargin(c.linuxCost, margin) : c.linuxClient,
        winClient: doWin ? priceFromMargin(c.winCost, margin) : c.winClient,
      }))
    );
  }

  function addInstance() {
    onCompute([
      ...compute,
      {
        family: deriveFamily(1, 2) || "Custom",
        name: "new.instance",
        vcpu: 1,
        ram: 2,
        linuxClient: 0,
        linuxCost: 0,
        winClient: 0,
        winCost: 0,
      },
    ]);
  }

  return (
    <section className="editor">
      <div className="editor-head">
        <div>
          <h2>Edit pricing — costs &amp; rates</h2>
          <p className={"editor-state" + (isDefault ? "" : " custom")}>
            {isDefault
              ? "Matches built-in defaults."
              : "Custom pricing (saved on this device). Use “Export data.ts” to bake it into the site for everyone."}
          </p>
        </div>
        <div className="editor-actions">
          <button className="btn btn-primary" onClick={onExport}>
            Export data.ts
          </button>
          <button className="btn btn-ghost" onClick={onReset}>
            Reset to defaults
          </button>
          <label className="btn btn-ghost file-btn" title="Import rates from an Alerify_Pricing_Sheet.xlsx">
            Import .xlsx
            <input
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
          </label>
          <button className="btn btn-ghost" onClick={onClose}>
            Close editor
          </button>
        </div>
      </div>
      {status.text && <p className={"pricing-status " + status.kind}>{status.text}</p>}

      <h3 className="editor-h3">Add-ons &amp; services</h3>
      <div className="edit-scroll">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Basis</th>
              <th className="num">Cost / mo</th>
              <th className="num">Margin %</th>
              <th className="num">Client price / mo</th>
            </tr>
          </thead>
          <tbody>
            {ADDON_ROWS.map((row) => {
              const rate = addons[row.key] as { client: number; cost: number };
              return (
                <tr key={row.key}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td className="muted">{row.basis}</td>
                  <td className="num">
                    <input type="number" step={0.01} value={rate.cost} onChange={(e) => setAddon(row.key, "cost", n(e.target.value))} />
                  </td>
                  <td className="num">
                    <MarginInput cost={rate.cost} client={rate.client} onPrice={(price) => setAddon(row.key, "client", price)} />
                  </td>
                  <td className="num">
                    <input type="number" step={0.01} value={rate.client} onChange={(e) => setAddon(row.key, "client", n(e.target.value))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="editor-h3">
        Cloud comparison rates <small>(estimated AWS / Azure list, internal use)</small>
      </h3>
      <div id="compareEditor">
        <div className="cmp-grid">
          {COMPARE_GLOBAL.map((f) => (
            <label className="cmp-field" key={f.key}>
              <span>{f.label}</span>
              <input type="number" step={1} value={compare[f.key]} onChange={(e) => setCompareGlobal(f.key, n(e.target.value))} />
            </label>
          ))}
        </div>
        {(["aws", "azure"] as const).map((prov) => (
          <div className="cmp-provider" key={prov}>
            <h4>{compare[prov].label}</h4>
            <div className="cmp-grid">
              {COMPARE_PROVIDER.map((f) => (
                <label className="cmp-field" key={f.key}>
                  <span>{f.label}</span>
                  <input
                    type="number"
                    step={0.001}
                    value={compare[prov][f.key] as number}
                    onChange={(e) => setProvider(prov, f.key, n(e.target.value))}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 className="editor-h3">
        Compute catalog <small>({compute.length} vCPU/RAM instances)</small>
      </h3>
      <div className="bulk-bar">
        <span className="bulk-label">Bulk margin</span>
        <input
          type="number"
          step={0.5}
          className="margin-in"
          value={bulkMargin}
          onChange={(e) => setBulkMargin(e.target.value)}
          aria-label="Bulk margin percent"
        />
        <span className="bulk-pct">%</span>
        <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value as typeof bulkTarget)}>
          <option value="both">Linux &amp; Windows</option>
          <option value="linux">Linux only</option>
          <option value="windows">Windows only</option>
        </select>
        <button className="btn btn-ghost" onClick={() => applyBulkMargin(parseFloat(bulkMargin), bulkTarget)}>
          Apply to all {compute.length}
        </button>
        <span className="bulk-hint">Sets each instance's price from its cost.</span>
      </div>
      <div className="edit-scroll tall">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">vCPU</th>
              <th className="num">RAM</th>
              <th className="num">Linux cost</th>
              <th className="num">Linux price</th>
              <th className="num">Linux %</th>
              <th className="num">Win cost</th>
              <th className="num">Win price</th>
              <th className="num">Win %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {compute.map((c, i) => (
              <ComputeRow key={i} c={c} onField={(patch) => setInstance(i, patch)} onRemove={() => removeInstance(i)} />
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" onClick={addInstance}>
        + Add instance
      </button>
    </section>
  );
}
