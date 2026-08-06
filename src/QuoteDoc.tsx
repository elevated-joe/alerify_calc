import type { Addons, Instance, Quote } from "./types";
import { firewallLine, fmt, priceServer } from "./pricing";

interface Props {
  quote: Quote;
  addons: Addons;
  keyed: Map<string, Instance>;
}

export default function QuoteDoc({ quote, addons, keyed }: Props) {
  const customer = quote.quoteName.trim() || "Hosting quote";
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
    return { key: v.id, name: v.name || "Server", specs, price: priced.client };
  });

  const fw = firewallLine(quote.firewall, addons);
  monthly += fw.client;

  return (
    <div id="quoteDoc" aria-hidden="true">
      <div className="csheet">
        <header className="c-mast">
          <div className="c-brandline">
            <div className="c-wordmark">A<span>LERIFY</span></div>
            <div className="c-tagline">Your Data. Our Duty.</div>
          </div>
          <div className="c-eyebrow">Private Cloud · Hosting Quote · Monthly</div>
          <h1 className="c-headline">{customer}</h1>
          <p className="qb-meta">
            Quote {quoteNo} &nbsp;·&nbsp; {dateStr}
            {ref ? <> &nbsp;·&nbsp; Ref {ref}</> : null}
          </p>
        </header>

        <section className="qb-body">
          <table className="qb-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Configuration</th>
                <th className="qb-amt">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="qb-name">{r.name}</td>
                  <td className="qb-spec">{r.specs}</td>
                  <td className="qb-amt">{fmt(r.price)}</td>
                </tr>
              ))}
              <tr>
                <td className="qb-name">Shared services</td>
                <td className="qb-spec">{fw.label}</td>
                <td className="qb-amt">{fmt(fw.client)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="qb-subtotal">
                <td colSpan={2}>Monthly total</td>
                <td className="qb-amt">{fmt(monthly)}</td>
              </tr>
              <tr className="qb-annual">
                <td colSpan={2}>Annual total</td>
                <td className="qb-amt">{fmt(monthly * 12)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="qb-notes">
          <p className="qb-notes-h">Notes</p>
          <ul>
            <li>All amounts are in USD and billed monthly. Annual total is indicative (12 × monthly).</li>
            <li>Pricing excludes applicable taxes. Storage is billed per GB per month.</li>
            <li>This quote is valid for 30 days from the date above.</li>
          </ul>
        </section>

        <div className="c-footer">
          717-725-7724 <span>|</span> sales@alerify.com <span>|</span> 2330 Vartan Way, Harrisburg PA 17110{" "}
          <span>|</span> alerify.com
        </div>
      </div>
    </div>
  );
}
