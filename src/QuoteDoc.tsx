import type { Addons, Instance, Quote } from "./types";
import { firewallLine, fmt, priceServer } from "./pricing";

interface Props {
  quote: Quote;
  addons: Addons;
  keyed: Map<string, Instance>;
}

export default function QuoteDoc({ quote, addons, keyed }: Props) {
  const customer = quote.quoteName.trim() || "Prepared quote";
  const ref = quote.quoteRef.trim();
  const d = new Date();
  const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const quoteNo =
    "AQ-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");

  let monthly = 0;
  const rows = quote.servers.map((v) => {
    const priced = priceServer(v, addons, keyed);
    monthly += priced.client;
    const specs = [
      v.os === "windows" ? "Windows" : "Linux",
      `${v.vcpu} vCPU / ${v.ram} GB`,
      v.ebs > 0 ? `${v.ebs} GB storage` : null,
      v.eip > 0 ? `${v.eip} × Elastic IP` : null,
      v.sql ? "SQL Standard" : null,
      v.rds > 0 ? `${v.rds} × RDS CAL` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { name: v.name || "Server", specs, price: priced.client };
  });

  const fw = firewallLine(quote.firewall, addons);
  monthly += fw.client;

  return (
    <div id="quoteDoc" aria-hidden="true">
      <div className="q-page">
        <div className="q-head">
          <div className="q-brand">
            <span className="q-logo">A</span>
            <div>
              <div className="q-name">Alerify</div>
              <div className="q-sub">Managed Cloud Hosting</div>
            </div>
          </div>
          <div className="q-meta">
            <div className="q-title">Hosting Quote</div>
            <table className="q-metatable">
              <tbody>
                <tr>
                  <td>Quote #</td>
                  <td>{quoteNo}</td>
                </tr>
                <tr>
                  <td>Date</td>
                  <td>{dateStr}</td>
                </tr>
                {ref && (
                  <tr>
                    <td>Reference</td>
                    <td>{ref}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="q-prepared">
          Prepared for
          <br />
          <strong>{customer}</strong>
        </div>

        <table className="q-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Configuration</th>
              <th className="q-amt">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <strong>{r.name}</strong>
                </td>
                <td className="q-spec">{r.specs}</td>
                <td className="q-amt">{fmt(r.price)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Shared services</strong>
              </td>
              <td className="q-spec">{fw.label}</td>
              <td className="q-amt">{fmt(fw.client)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="q-subtotal">
              <td colSpan={2}>Monthly total</td>
              <td className="q-amt">{fmt(monthly)}</td>
            </tr>
            <tr className="q-annual">
              <td colSpan={2}>Annual total</td>
              <td className="q-amt">{fmt(monthly * 12)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="q-terms">
          <p>
            <strong>Notes</strong>
          </p>
          <ul>
            <li>All amounts are in USD and billed monthly. Annual total is indicative (12 × monthly).</li>
            <li>Pricing excludes applicable taxes. Storage is billed per GB per month.</li>
            <li>This quote is valid for 30 days from the date above.</li>
          </ul>
          <p className="q-foot">Alerify — Managed Cloud Hosting &nbsp;·&nbsp; Thank you for your business.</p>
        </div>
      </div>
    </div>
  );
}
