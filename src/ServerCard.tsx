import type { Addons, Compare, Instance, ServerConfig } from "./types";
import { cloudCompare, familyLabel, fmt, priceServer } from "./pricing";

interface Props {
  server: ServerConfig;
  addons: Addons;
  compare: Compare;
  keyed: Map<string, Instance>;
  vcpus: number[];
  compute: Instance[];
  onChange: (patch: Partial<ServerConfig>) => void;
  onRemove: () => void;
}

function DeltaCell({ cloud, alerify }: { cloud: number; alerify: number }) {
  const d = cloud - alerify; // >0 => Alerify lower
  const pct = cloud > 0 ? Math.abs((d / cloud) * 100).toFixed(0) + "%" : "—";
  return (
    <td className={"amt " + (d >= 0 ? "save" : "over")}>
      {fmt(Math.abs(d))} {d >= 0 ? "lower" : "higher"} <small>({pct})</small>
    </td>
  );
}

export default function ServerCard({ server, addons, compare, keyed, vcpus, compute, onChange, onRemove }: Props) {
  const priced = priceServer(server, addons, keyed);
  const cmp = cloudCompare(server, compare, addons);
  const ramOptions = compute.filter((c) => c.vcpu === server.vcpu).sort((a, b) => a.ram - b.ram);

  const num = (v: string) => Math.max(0, parseFloat(v) || 0);
  const int = (v: string) => Math.max(0, parseInt(v, 10) || 0);

  function onVcpu(next: number) {
    const rams = compute.filter((c) => c.vcpu === next).map((c) => c.ram).sort((a, b) => a - b);
    const ram = rams.includes(server.ram) ? server.ram : rams[0];
    onChange({ vcpu: next, ram });
  }

  const totMargin = priced.client > 0 ? (priced.profit / priced.client) * 100 : 0;

  return (
    <section className="server card">
      <div className="server-head">
        <input
          className="server-name"
          type="text"
          placeholder="Server name (e.g. WEB01)"
          value={server.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="server-head-right">
          <span className="server-subtotal">
            {fmt(priced.client)}
            <small>/mo</small>
          </span>
          <button className="btn btn-icon" title="Remove server" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div className="server-grid">
        <div className="field">
          <label>Operating system</label>
          <select value={server.os} onChange={(e) => onChange({ os: e.target.value as ServerConfig["os"] })}>
            <option value="linux">Linux</option>
            <option value="windows">Windows</option>
          </select>
        </div>
        <div className="field">
          <label>vCPU</label>
          <select value={server.vcpu} onChange={(e) => onVcpu(parseInt(e.target.value, 10))}>
            {vcpus.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>RAM</label>
          <select value={server.ram} onChange={(e) => onChange({ ram: parseInt(e.target.value, 10) })}>
            {ramOptions.map((c) => (
              <option key={c.ram} value={c.ram}>
                {c.ram} GB &nbsp;({familyLabel(c)})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>EBS storage (GB)</label>
          <input type="number" min={0} step={10} value={server.ebs} onChange={(e) => onChange({ ebs: num(e.target.value) })} />
        </div>
        <div className="field">
          <label>Elastic IPs</label>
          <input type="number" min={0} step={1} value={server.eip} onChange={(e) => onChange({ eip: int(e.target.value) })} />
        </div>
        <div className="field">
          <label>RDS CALs</label>
          <input type="number" min={0} step={1} value={server.rds} onChange={(e) => onChange({ rds: int(e.target.value) })} />
        </div>
        <div className="field field-check">
          <label className="checkbox">
            <input type="checkbox" checked={server.sql} onChange={(e) => onChange({ sql: e.target.checked })} />
            <span>SQL Standard required</span>
          </label>
        </div>

        <div className="field field-check">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!server.localBackup}
              onChange={(e) =>
                onChange(e.target.checked ? { localBackup: true } : { localBackup: false, offsiteBackup: false })
              }
            />
            <span>Local backup</span>
          </label>
        </div>
        <div className="field field-check">
          <label className={"checkbox" + (server.localBackup ? "" : " is-disabled")}>
            <input
              type="checkbox"
              checked={!!server.offsiteBackup}
              disabled={!server.localBackup}
              onChange={(e) =>
                onChange(e.target.checked ? { offsiteBackup: true, localBackup: true } : { offsiteBackup: false })
              }
            />
            <span>Offsite backup{server.localBackup ? "" : " (needs local)"}</span>
          </label>
        </div>
        {server.localBackup && (
          <div className="field">
            <label>Backup retention (days)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={server.backupRetentionDays ?? 30}
              onChange={(e) => onChange({ backupRetentionDays: Math.max(1, parseInt(e.target.value, 10) || 30) })}
            />
          </div>
        )}
      </div>

      <div className="server-breakdown">
        <table>
          <tbody>
            <tr>
              <th className="desc">Item</th>
              <th>Price</th>
              <th className="col-internal">Cost</th>
              <th className="col-internal">Margin</th>
            </tr>
            {priced.lines.map((l, i) => {
              const m = l.client > 0 ? ((l.client - l.cost) / l.client) * 100 : 0;
              return (
                <tr key={i}>
                  <td className="desc">
                    <strong>{l.label}</strong>
                    <br />
                    <span style={{ fontSize: 12 }}>{l.detail}</span>
                  </td>
                  <td className="amt">{fmt(l.client)}</td>
                  <td className="cost col-internal">{fmt(l.cost)}</td>
                  <td className="margin col-internal">{m.toFixed(1)}%</td>
                </tr>
              );
            })}
            <tr className="total">
              <td>Monthly total</td>
              <td className="amt">{fmt(priced.client)}</td>
              <td className="cost col-internal">{fmt(priced.cost)}</td>
              <td className="margin col-internal">{totMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="server-compare compare-only">
        <table className="compare-table">
          <tbody>
            <tr>
              <th className="desc">Comparable stack (compute + storage + IP + SQL + egress)</th>
              <th>Alerify</th>
              <th>AWS</th>
              <th>Azure</th>
            </tr>
            <tr>
              <td className="desc">Estimated monthly</td>
              <td className="amt">{fmt(priced.comparable)}</td>
              <td className="amt muted">{fmt(cmp.aws)}</td>
              <td className="amt muted">{fmt(cmp.azure)}</td>
            </tr>
            <tr className="total">
              <td>Alerify vs. cloud</td>
              <td className="amt">—</td>
              <DeltaCell cloud={cmp.aws} alerify={priced.comparable} />
              <DeltaCell cloud={cmp.azure} alerify={priced.comparable} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
