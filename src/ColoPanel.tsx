import { fmt, marginPct } from "./pricing";
import { RACK_SIZES, type ColoCatalog } from "./coloData";
import { priceColo, type ColoConfig } from "./coloPricing";

interface Props {
  catalog: ColoCatalog;
  config: ColoConfig;
  onChange: (c: ColoConfig) => void;
}

export default function ColoPanel({ catalog, config: c, onChange }: Props) {
  const set = (patch: Partial<ColoConfig>) => onChange({ ...c, ...patch });
  const setAddon = (key: string, qty: number) =>
    onChange({ ...c, addons: { ...c.addons, [key]: Math.max(0, qty || 0) } });

  const p = priceColo(c, catalog);
  const margin = marginPct(p.monthlyCost, p.monthlyClient);

  return (
    <section className="card colo">
      <div className="colo-head">
        <h2>Colocation quote <span className="colo-beta">beta</span></h2>
        <p className="section-hint">Rack space (power included), connectivity and add-ons. Rates from the Alerify data-center services sheet.</p>
      </div>

      <div className="colo-grid">
        <div className="field">
          <label htmlFor="coloTier">Rack tier (power density)</label>
          <select id="coloTier" value={c.tier} onChange={(e) => set({ tier: e.target.value })}>
            {catalog.tiers.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="coloSize">Rack space</label>
          <select id="coloSize" value={c.size} onChange={(e) => set({ size: e.target.value as ColoConfig["size"] })}>
            {RACK_SIZES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="coloIp">IP block</label>
          <select id="coloIp" value={c.ip} onChange={(e) => set({ ip: e.target.value })}>
            {catalog.ipBlocks.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="coloBw">Committed bandwidth</label>
          <select id="coloBw" value={c.bandwidth} onChange={(e) => set({ bandwidth: e.target.value })}>
            {catalog.bandwidth.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="colo-addons">
        <span className="colo-sub">Add-ons</span>
        <div className="colo-addon-grid">
          {catalog.addons.map((a) => (
            <div className="field field-inline" key={a.key}>
              <label htmlFor={"colo-" + a.key}>{a.label}</label>
              <input id={"colo-" + a.key} type="number" min={0} step={1} value={c.addons[a.key] || 0}
                onChange={(e) => setAddon(a.key, parseInt(e.target.value, 10))} />
            </div>
          ))}
        </div>
        <div className="colo-toggles">
          <label className="colo-check">
            <input type="checkbox" checked={c.setup} onChange={(e) => set({ setup: e.target.checked })} />
            Install &amp; setup (one-time, per U)
          </label>
          <label className="colo-check">
            <input type="checkbox" checked={c.biometrics} onChange={(e) => set({ biometrics: e.target.checked })} />
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
      </table>

      <div className="summary-grid colo-summary">
        <div className="summary-metric">
          <span className="metric-label">Monthly total</span>
          <span className="metric-value accent">{fmt(p.monthlyClient)}</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">One-time total</span>
          <span className="metric-value">{fmt(p.onceClient)}</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Annual (monthly × 12)</span>
          <span className="metric-value">{fmt(p.monthlyClient * 12)}</span>
        </div>
        <div className="summary-metric internal-only">
          <span className="metric-label">Monthly cost</span>
          <span className="metric-value">{fmt(p.monthlyCost)}</span>
        </div>
        <div className="summary-metric internal-only">
          <span className="metric-label">Monthly profit</span>
          <span className="metric-value">{fmt(p.monthlyClient - p.monthlyCost)}</span>
        </div>
        <div className="summary-metric internal-only">
          <span className="metric-label">Blended margin</span>
          <span className="metric-value">{p.monthlyClient > 0 ? margin.toFixed(1) + "%" : "—"}</span>
        </div>
      </div>
    </section>
  );
}
