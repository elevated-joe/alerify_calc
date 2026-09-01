import { fmt, marginPct } from "./pricing";
import { RACK_SIZES, type ColoCatalog } from "./coloData";
import { priceColo, type ColoRack } from "./coloPricing";
import { defaultRack } from "./coloPricing";

interface Props {
  catalog: ColoCatalog;
  racks: ColoRack[];
  onChange: (racks: ColoRack[]) => void;
  onRemove?: () => void;
}

export default function ColoPanel({ catalog, racks, onChange, onRemove }: Props) {
  const setRack = (id: string, patch: Partial<ColoRack>) =>
    onChange(racks.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const setRackAddon = (id: string, key: string, qty: number) =>
    onChange(racks.map((r) => (r.id === id ? { ...r, addons: { ...r.addons, [key]: Math.max(0, qty || 0) } } : r)));
  const addRack = () => onChange([...racks, defaultRack(racks.length + 1)]);
  const removeRack = (id: string) => onChange(racks.filter((r) => r.id !== id));

  // Combined totals across all racks.
  const priced = racks.map((r) => priceColo(r, catalog));
  const monthlyClient = priced.reduce((s, p) => s + p.monthlyClient, 0);
  const monthlyCost = priced.reduce((s, p) => s + p.monthlyCost, 0);
  const onceClient = priced.reduce((s, p) => s + p.onceClient, 0);
  const margin = marginPct(monthlyCost, monthlyClient);

  return (
    <section className="card colo">
      <div className="colo-head">
        <div className="card-head">
          <h2>Colocation quote</h2>
          {onRemove && <button className="btn btn-icon" title="Remove colocation" onClick={onRemove}>✕</button>}
        </div>
        <p className="section-hint">Rack space (power included), connectivity and add-ons. Rates from the Alerify data-center services sheet.</p>
      </div>

      {racks.map((c, ri) => {
        const p = priced[ri];
        return (
          <div className="colo-rack" key={c.id}>
            <div className="card-head colo-rack-head">
              <input className="colo-rack-name" value={c.name} onChange={(e) => setRack(c.id, { name: e.target.value })}
                aria-label="Rack name" />
              <div className="colo-rack-controls">
                <label className="colo-qty">
                  <span>Racks</span>
                  <input type="number" min={1} step={1} value={c.qty}
                    onChange={(e) => setRack(c.id, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                </label>
                <button className="btn btn-icon" title="Remove rack" onClick={() => removeRack(c.id)}>✕</button>
              </div>
            </div>

            <div className="colo-grid">
              <div className="field">
                <label htmlFor={"tier-" + c.id}>Rack tier (power density)</label>
                <select id={"tier-" + c.id} value={c.tier} onChange={(e) => setRack(c.id, { tier: e.target.value })}>
                  {catalog.tiers.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={"size-" + c.id}>Rack space</label>
                <select id={"size-" + c.id} value={c.size} onChange={(e) => setRack(c.id, { size: e.target.value as ColoRack["size"] })}>
                  {RACK_SIZES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="colo-addons">
              <span className="colo-sub">Add-ons</span>
              <div className="colo-grid">
                <div className="field">
                  <label htmlFor={"ip-" + c.id}>IP block</label>
                  <select id={"ip-" + c.id} value={c.ip} onChange={(e) => setRack(c.id, { ip: e.target.value })}>
                    {catalog.ipBlocks.map((b) => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={"bw-" + c.id}>Committed bandwidth</label>
                  <select id={"bw-" + c.id} value={c.bandwidth} onChange={(e) => setRack(c.id, { bandwidth: e.target.value })}>
                    {catalog.bandwidth.map((b) => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="colo-addon-grid">
                {catalog.addons.map((a) => (
                  <div className="field field-inline" key={a.key}>
                    <label htmlFor={"a-" + c.id + a.key}>{a.label}</label>
                    <input id={"a-" + c.id + a.key} type="number" min={0} step={1} value={c.addons[a.key] || 0}
                      onChange={(e) => setRackAddon(c.id, a.key, parseInt(e.target.value, 10))} />
                  </div>
                ))}
              </div>
              <div className="colo-toggles">
                <label className="colo-check">
                  <input type="checkbox" checked={c.setup} onChange={(e) => setRack(c.id, { setup: e.target.checked })} />
                  Install &amp; setup (one-time, per U)
                </label>
                <label className="colo-check">
                  <input type="checkbox" checked={c.biometrics} onChange={(e) => setRack(c.id, { biometrics: e.target.checked })} />
                  Rack biometric access (one-time $2,000)
                </label>
              </div>
            </div>

            <table className="colo-table">
              <thead>
                <tr><th>Item</th><th>Detail</th><th className="colo-amt internal-only">Cost</th><th className="colo-amt">Monthly</th></tr>
              </thead>
              <tbody>
                {p.monthlyLines.map((l, i) => (
                  <tr key={"m" + i}>
                    <td>{l.label}</td>
                    <td className="colo-detail">{l.detail}</td>
                    <td className="colo-amt internal-only">{fmt(l.cost)}</td>
                    <td className="colo-amt">{fmt(l.client)}</td>
                  </tr>
                ))}
                {p.onceLines.map((l, i) => (
                  <tr key={"o" + i} className="colo-once">
                    <td>{l.label}</td>
                    <td className="colo-detail">{l.detail} · one-time</td>
                    <td className="colo-amt internal-only">{fmt(l.cost)}</td>
                    <td className="colo-amt">{fmt(l.client)} <small>once</small></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="colo-rack-total">
                  <td colSpan={2}>Rack subtotal</td>
                  <td className="colo-amt internal-only">{fmt(p.monthlyCost)}</td>
                  <td className="colo-amt">{fmt(p.monthlyClient)}/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      <div className="add-row">
        <button className="btn btn-ghost" onClick={addRack}>+ Add rack</button>
      </div>

      <div className="summary-grid colo-summary">
        <div className="summary-metric">
          <span className="metric-label">Colocation monthly</span>
          <span className="metric-value accent">{fmt(monthlyClient)}</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">One-time total</span>
          <span className="metric-value">{fmt(onceClient)}</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Annual (monthly × 12)</span>
          <span className="metric-value">{fmt(monthlyClient * 12)}</span>
        </div>
        <div className="summary-metric internal-only">
          <span className="metric-label">Monthly cost</span>
          <span className="metric-value">{fmt(monthlyCost)}</span>
        </div>
        <div className="summary-metric internal-only">
          <span className="metric-label">Monthly profit</span>
          <span className="metric-value">{fmt(monthlyClient - monthlyCost)}</span>
        </div>
        <div className="summary-metric internal-only">
          <span className="metric-label">Blended margin</span>
          <span className="metric-value">{monthlyClient > 0 ? margin.toFixed(1) + "%" : "—"}</span>
        </div>
      </div>
    </section>
  );
}
