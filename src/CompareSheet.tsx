import type { Addons, Compare, Instance, Quote } from "./types";
import { cloudCompare, priceServer } from "./pricing";

interface Props {
  quote: Quote;
  addons: Addons;
  compare: Compare;
  keyed: Map<string, Instance>;
}

const money0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function Row({ name, spec, a, aws, az }: { name: string; spec: string; a: number; aws: number; az: number }) {
  const max = Math.max(a, aws, az) || 1;
  const cheaper = Math.min(aws, az);
  const delta = cheaper - a; // >0 => Alerify cheaper
  const pct = (v: number) => (v / max) * 100;
  const gap = a < cheaper ? { left: pct(a), width: pct(cheaper) - pct(a) } : null;
  return (
    <div className="c-row">
      <div className="c-rowtop">
        <div>
          <span className="c-tier">{name}</span>
          <span className="c-spec">{spec}</span>
        </div>
        <div className={"c-save " + (delta >= 0 ? "pos" : "neg")}>
          {delta >= 0 ? `Save ${money0(delta)}` : `${money0(-delta)} more`}
          <small>per month</small>
        </div>
      </div>
      <div className="c-track2">
        <div className="c-seg-me" style={{ width: Math.max(pct(a), 12) + "%" }}>
          <b>Alerify {money0(a)}</b>
        </div>
        {gap && <div className="c-seg-gap" style={{ left: gap.left + "%", width: gap.width + "%" }} />}
        <div className="c-endcap">
          AWS <b>{money0(aws)}</b> &nbsp;·&nbsp; Azure <b>{money0(az)}</b>
        </div>
      </div>
    </div>
  );
}

export default function CompareSheet({ quote, addons, compare, keyed }: Props) {
  let ta = 0;
  let tAws = 0;
  let tAz = 0;
  const rows = quote.servers.map((v) => {
    const priced = priceServer(v, addons, keyed);
    const cmp = cloudCompare(v, compare, addons);
    ta += priced.comparable;
    tAws += cmp.aws;
    tAz += cmp.azure;
    const spec = [
      v.os === "windows" ? "Windows" : "Linux",
      `${v.vcpu} vCPU · ${v.ram} GB`,
      v.ebs > 0 ? `${v.ebs} GB SSD` : null,
      v.sql ? "SQL" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { key: v.id, name: v.name || "Server", spec, a: priced.comparable, aws: cmp.aws, az: cmp.azure };
  });

  const d = new Date();
  const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const totalDelta = Math.min(tAws, tAz) - ta;

  return (
    <div id="compareDoc" aria-hidden="true">
      <div className="csheet">
        <header className="c-mast">
          <div className="c-brandline">
            <div className="c-wordmark">A<span>LERIFY</span></div>
            <div className="c-tagline">Your Data. Our Duty.</div>
          </div>
          <div className="c-eyebrow">Private Cloud · Cost Comparison · Monthly</div>
          <h1 className="c-headline">
            Your servers, next to <em>AWS &amp; Azure</em>.
          </h1>
          <p className="c-standfirst">
            Like-for-like monthly pricing — compute, SSD storage, and a public IP — with 30-day backup, unmetered
            egress, and 24×7 human support already in the number. {quote.quoteName.trim() ? `Prepared for ${quote.quoteName.trim()}.` : ""}
          </p>
        </header>

        <section className="c-body">
          <div className="c-sechead">
            <h2>What you'd pay, side by side</h2>
            <div className="c-key">Cyan = Alerify · Hatched = hyperscaler</div>
          </div>
          {rows.map((r) => (
            <Row key={r.key} name={r.name} spec={r.spec} a={r.a} aws={r.aws} az={r.az} />
          ))}
          {quote.servers.length > 1 && (
            <div className="c-total">
              <Row name="Your quote — total" spec={`${quote.servers.length} servers · comparable stack`} a={ta} aws={tAws} az={tAz} />
            </div>
          )}
          <p className={"c-verdict " + (totalDelta >= 0 ? "pos" : "neg")}>
            {totalDelta >= 0
              ? `That's ${money0(totalDelta)}/mo — about ${money0(totalDelta * 12)}/yr — less than the cheaper hyperscaler, before counting what's included below.`
              : `Raw compute runs ${money0(-totalDelta)}/mo more here — and everything below is included, not billed on top.`}
          </p>
        </section>

        <section className="c-included">
          <table>
            <thead>
              <tr>
                <th>What's in the price</th>
                <th className="c-p c-al">Alerify</th>
                <th className="c-p">AWS</th>
                <th className="c-p">Azure</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="c-lead">Data transfer out<i>Egress on everything you serve</i></td>
                <td className="c-p c-yes">$0 — never metered</td>
                <td className="c-p">Per GB</td>
                <td className="c-p">Per GB</td>
              </tr>
              <tr>
                <td className="c-lead">30-day backup<i>Daily, with 30 days of retention</i></td>
                <td className="c-p c-yes">One line item</td>
                <td className="c-p">Metered separately</td>
                <td className="c-p">Metered + instance fee</td>
              </tr>
              <tr>
                <td className="c-lead">Support<i>7×24 helpdesk, 30-minute P1 response</i></td>
                <td className="c-p c-yes">Included</td>
                <td className="c-p">Paid plan</td>
                <td className="c-p">Paid plan</td>
              </tr>
              <tr>
                <td className="c-lead">Remote hands<i>Hardware swaps, diagnostics, on site</i></td>
                <td className="c-p c-yes">No charge, business hours</td>
                <td className="c-p">Not offered</td>
                <td className="c-p">Not offered</td>
              </tr>
              <tr>
                <td className="c-lead">Public IPv4<i>First address with every tenant</i></td>
                <td className="c-p c-yes">Included</td>
                <td className="c-p">Billed hourly</td>
                <td className="c-p">Billed hourly</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="c-band">
          <div className="c-big">
            A person answers.
            <br />
            <em>Never any chat bots.</em>
          </div>
          <p>
            Tier 3 data center, SOC 2 certified, in Harrisburg PA. Redundant power and HVAC, two 10 Gb circuits on
            diverse carriers, and a helpdesk staffed around the clock. Critical issues get a 30-minute response and a
            four-hour resolution target, every day of the year.
          </p>
        </section>

        <p className="c-footnote">
          <strong>How these numbers were built.</strong> Alerify figures are current list price for the configuration
          shown (compute, SSD storage, one public IPv4; 30-day backup, egress and support included). AWS and Azure
          figures are estimated US-East list pricing on a comparable stack — compute, SSD storage, a public IP, Windows
          and SQL licensing where applicable, and monthly egress. Savings are quoted against whichever hyperscaler is
          cheaper for that configuration. Hyperscaler pricing changes frequently and varies by region and commitment —
          treat these as indicative and ask us for a written quote. <strong>Priced {dateStr}.</strong> Not an offer or a
          quote.
        </p>

        <div className="c-footer">
          717-725-7724 <span>|</span> sales@alerify.com <span>|</span> 2330 Vartan Way, Harrisburg PA 17110{" "}
          <span>|</span> alerify.com
        </div>
      </div>
    </div>
  );
}
