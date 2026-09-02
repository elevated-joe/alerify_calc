import type { Addons, Instance, Quote } from "./types";
import { firewallLine, fmt, priceServer } from "./pricing";
import type { ColoCatalog } from "./coloData";
import { priceColo, priceColoShared, type ColoQuote } from "./coloPricing";

interface Props {
  quote: Quote;
  addons: Addons;
  keyed: Map<string, Instance>;
  showShared?: boolean;
  showColo?: boolean;
  coloQuote?: ColoQuote;
  coloCatalog?: ColoCatalog;
}

const INCLUDED: [string, string][] = [
  ["Tier 3 data center · SOC 2", "Certified facility in Harrisburg, PA."],
  ["Redundant power", "UPS plus two standby diesel generators (150 kW & 30 kW)."],
  ["Diverse connectivity", "Two 10 Gb circuits, diverse carriers and routes."],
  ["N+1 HVAC", "Redundant cooling with humidity and environmental controls."],
  ["24×7 physical security", "Room and building surveillance, man-trap, mobile access."],
  ["24×7 helpdesk", "No-charge remote hands (fee only outside M–F, 8 AM–5 PM)."],
  ["No transfer fees", "Billed post-usage — no ingress or egress charges."],
  ["Public IPv4 included", "One IPv4 per environment; each additional EIP $4/mo."],
];

const SLA: [string, string, string, string, string][] = [
  ["P1", "Critical, no workaround", "30 mins", "4 hours", "24×7"],
  ["P2", "Major issue, limited workaround", "2 hrs", "1 business day", "24×7 Prod / Business hrs"],
  ["P3", "Minor issue, workaround exists", "8 hrs", "3 business days", "Business hours"],
  ["P4", "Cosmetic / inquiries", "2 days", "Next maintenance", "Business hours"],
];

const LOGO = import.meta.env.BASE_URL + "alerify-logo.jpg";

function BrandBar({ customer }: { customer: string }) {
  return (
    <div className="pr-bar">
      <img className="pr-logo-sm" src={LOGO} alt="Alerify" />
      <div className="pr-bar-title">Virtual Private Cloud Proposal · {customer}</div>
    </div>
  );
}

function Footer() {
  return (
    <div className="c-footer">
      717-725-7724 <span>|</span> sales@alerify.com <span>|</span> 2330 Vartan Way, Harrisburg PA 17110{" "}
      <span>|</span> alerify.com
    </div>
  );
}

export default function ProposalSheet({ quote, addons, keyed, showShared = true, showColo, coloQuote, coloCatalog }: Props) {
  const customer = quote.quoteName.trim() || "Client";
  const coloOn = !!(showColo && coloQuote && coloCatalog);
  const coloRackPriced = coloOn ? coloQuote!.racks.map((r) => ({ rack: r, p: priceColo(r, coloCatalog!) })) : [];
  const coloSharedPriced = coloOn ? priceColoShared(coloQuote!.shared, coloCatalog!) : null;
  const coloMonthlyLines = [
    ...(coloSharedPriced ? coloSharedPriced.monthlyLines.map((l) => ({ ...l, detail: `Shared · ${l.detail}` })) : []),
    ...coloRackPriced.flatMap(({ rack, p }) => p.monthlyLines.map((l) => ({ ...l, detail: `${rack.name} · ${l.detail}` }))),
  ];
  const coloOnceLines = coloRackPriced.flatMap(({ rack, p }) =>
    p.onceLines.map((l) => ({ ...l, detail: `${rack.name} · ${l.detail}` })));
  const coloMonthly = coloRackPriced.reduce((s, { p }) => s + p.monthlyClient, 0) + (coloSharedPriced?.monthlyClient || 0);
  const coloOnce = coloRackPriced.reduce((s, { p }) => s + p.onceClient, 0);
  const hasColo = coloMonthly > 0 || coloOnce > 0;
  const setupClient = quote.setupClient ?? 0;
  const setupAdmin = quote.setupAdmin ?? 185;
  const d = new Date();
  const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const quoteNo =
    "AQ-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const ref = quote.quoteRef.trim();

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
      v.localBackup ? (v.offsiteBackup ? "Local + offsite backup" : "Local backup") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { key: v.id, name: v.name || "Server", specs, price: priced.client };
  });
  const fw = firewallLine(quote.firewall, addons);
  if (showShared) monthly += fw.client;

  // Group every one-time fee (VPC setup + colocation one-time) into one section.
  const oneTimeLines: { label: string; detail: string; amount: number }[] = [];
  if (quote.servers.length > 0) {
    oneTimeLines.push({
      label: "Client setup",
      detail: `VM, networking & configuration are ${setupClient > 0 ? "Alerify" : customer} responsibilities`,
      amount: setupClient,
    });
    oneTimeLines.push({ label: "Admin setup fee", detail: "Per new client — one-time provisioning", amount: setupAdmin });
  }
  for (const l of coloOnceLines) oneTimeLines.push({ label: l.label, detail: l.detail, amount: l.client });
  const oneTimeTotal = oneTimeLines.reduce((s, l) => s + l.amount, 0);

  // Totals across everything, for the closing quote summary.
  const totalMonthly = monthly + coloMonthly;
  const totalAnnual = totalMonthly * 12;
  const dueAtSigning = totalMonthly + oneTimeTotal;

  return (
    <div id="proposalDoc" aria-hidden="true">
      {/* ---------- Cover (light / low-ink for printing) ---------- */}
      <section className="csheet proposal-page pr-cover">
        <div className="pr-cover-top">
          <img className="pr-logo-lg" src={LOGO} alt="Alerify" />
          <span className="pr-cover-rule" />
        </div>
        <div className="pr-cover-hero">
          <div className="pr-cover-eyebrow">Private Cloud · Hosting Proposal</div>
          <h1 className="pr-cover-title">Virtual Private Cloud Proposal</h1>
          <p className="pr-cover-lead">
            Enterprise-grade private cloud hosting from a Tier 3, SOC&nbsp;2-certified data center in Harrisburg, PA —
            with 24×7 human support and no data-transfer fees.
          </p>
          <div className="pr-prepared">
            <div><span>Prepared for</span><b>{customer}</b></div>
            <div><span>Date</span><b>{dateStr}</b></div>
            <div>
              <span>Quote</span>
              <b>{quoteNo}{ref ? ` · Ref ${ref}` : ""}</b>
            </div>
          </div>
        </div>
        <Footer />
      </section>

      {/* ---------- Content — continuous flow (fills pages, footer at the end) ---------- */}
      <section className="csheet proposal-flow">
        <BrandBar customer={customer} />
        <div className="pr-body">
          <div className="pr-sec">
            <h2 className="pr-h">What's included</h2>
            <div className="pr-incl">
              {INCLUDED.map(([t, s]) => (
                <div className="pr-incl-item" key={t}>
                  <span className="pr-tick" />
                  <div>
                    <b>{t}</b>
                    <i>{s}</i>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pr-sec">
            <h2 className="pr-h">Private cloud base services <small>Monthly</small></h2>
            <table className="pr-items">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Configuration</th>
                  <th className="pr-amt">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="pr-name">{r.name}</td>
                    <td className="pr-spec">{r.specs}</td>
                    <td className="pr-amt">{fmt(r.price)}</td>
                  </tr>
                ))}
                {showShared && (
                  <tr>
                    <td className="pr-name">Shared services</td>
                    <td className="pr-spec">{fw.label}</td>
                    <td className="pr-amt">{fmt(fw.client)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="pr-total">
                  <td colSpan={2}>Monthly total</td>
                  <td className="pr-amt">{fmt(monthly)}</td>
                </tr>
                <tr className="pr-annual">
                  <td colSpan={2}>Annual total (12 × monthly)</td>
                  <td className="pr-amt">{fmt(monthly * 12)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {hasColo && (
            <div className="pr-sec">
              <h2 className="pr-h">Colocation <small>Monthly</small></h2>
              <table className="pr-items">
                <thead>
                  <tr><th>Item</th><th>Detail</th><th className="pr-amt">Monthly</th></tr>
                </thead>
                <tbody>
                  {coloMonthlyLines.map((l, i) => (
                    <tr key={"cm" + i}>
                      <td className="pr-name">{l.label}</td>
                      <td className="pr-spec">{l.detail}</td>
                      <td className="pr-amt">{fmt(l.client)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pr-total">
                    <td colSpan={2}>Colocation monthly total</td>
                    <td className="pr-amt">{fmt(coloMonthly)}</td>
                  </tr>
                  <tr className="pr-annual">
                    <td colSpan={2}>Annual total (12 × monthly)</td>
                    <td className="pr-amt">{fmt(coloMonthly * 12)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {oneTimeLines.length > 0 && (
            <div className="pr-sec">
              <h2 className="pr-h">One-time fees</h2>
              <table className="pr-items">
                <tbody>
                  {oneTimeLines.map((l, i) => (
                    <tr key={"ot" + i}>
                      <td className="pr-name">{l.label}</td>
                      <td className="pr-spec">{l.detail}</td>
                      <td className="pr-amt">{fmt(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pr-total">
                    <td colSpan={2}>One-time total</td>
                    <td className="pr-amt">{fmt(oneTimeTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="pr-sec">
            <h2 className="pr-h">Quote summary</h2>
            <table className="pr-items pr-summary">
              <tbody>
                <tr>
                  <td className="pr-name">Private cloud base services</td>
                  <td className="pr-spec">Monthly recurring</td>
                  <td className="pr-amt">{fmt(monthly)}</td>
                </tr>
                {hasColo && (
                  <tr>
                    <td className="pr-name">Colocation</td>
                    <td className="pr-spec">Monthly recurring</td>
                    <td className="pr-amt">{fmt(coloMonthly)}</td>
                  </tr>
                )}
                <tr className="pr-sub">
                  <td className="pr-name">Total monthly recurring</td>
                  <td className="pr-spec">Billed monthly</td>
                  <td className="pr-amt">{fmt(totalMonthly)}</td>
                </tr>
                <tr>
                  <td className="pr-name">Annual recurring</td>
                  <td className="pr-spec">12 × monthly</td>
                  <td className="pr-amt">{fmt(totalAnnual)}</td>
                </tr>
                {oneTimeTotal > 0 && (
                  <tr>
                    <td className="pr-name">One-time fees</td>
                    <td className="pr-spec">Charged once at setup</td>
                    <td className="pr-amt">{fmt(oneTimeTotal)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="pr-total">
                  <td colSpan={2}>Due at signing (first month + one-time)</td>
                  <td className="pr-amt">{fmt(dueAtSigning)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <Footer />
      </section>

      {/* ---------- Terms & signature — fit to one page ---------- */}
      <section className="csheet proposal-page pr-terms">
        <BrandBar customer={customer} />
        <div className="pr-body">
          <div className="pr-sec">
            <h2 className="pr-h">Response &amp; resolution times</h2>
            <table className="pr-sla">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Impact</th>
                  <th>Response</th>
                  <th>Resolution</th>
                  <th>Support hours</th>
                </tr>
              </thead>
              <tbody>
                {SLA.map((r) => (
                  <tr key={r[0]}>
                    <td className="pr-pri">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                    <td>{r[3]}</td>
                    <td>{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pr-sec">
            <h2 className="pr-h">Support billing &amp; terms</h2>
            <p className="pr-note">
              Support is billed as actually used in 15-minute increments at $185.00/hour. This Service Proposal is
              subject to the Terms and Conditions of the attached Master Service Agreement. Pricing may increase by up
              to 5% annually with 90-day notice prior to the conclusion of each anniversary year.
            </p>
          </div>

          <div className="pr-sec">
            <h2 className="pr-h">Agreement</h2>
            <div className="pr-legal">
              <div>
                <b>Compensation.</b> In consideration of the services to be performed by Provider, Client agrees to pay
                Provider at the rates set forth in this Service Proposal. Standard payment terms are net 30 days, and
                monthly invoices are sent for the upcoming month, prior to service delivery. Late payments incur finance
                charges of 1.5% of the unpaid monthly charges every 30 days; beyond 90 days, collection procedures begin
                and services will be interrupted. Credit-card payments incur an additional 4% processing fee; ACH is
                preferred.
              </div>
              <div>
                <b>Client responsibility.</b> Client is solely responsible for the configuration, management, security,
                and support of its own systems, applications, and data within the Provider environment. At Client's
                request, Provider may provide advisory, configuration, or troubleshooting assistance on a
                time-and-materials basis at $185.00/hour, billed in 15-minute increments. Such assistance does not
                transfer ownership or operational responsibility of the Client environment to the Provider.
              </div>
              <div>
                <b>Authorization.</b> The signer of this Service Plan represents that their signature legally binds the
                Client and that all actions have been taken to duly grant this authority, and by execution personally
                undertakes the full performance hereof, including payment of amounts due.
              </div>
            </div>
          </div>

          <div className="pr-sec">
            <h2 className="pr-h">Acceptance — pricing &amp; 3-year term</h2>
            <div className="pr-sign">
              <div className="pr-sign-col">
                <div className="pr-sign-who">Client</div>
                <div className="pr-line"><span>Legal name</span></div>
                <div className="pr-line"><span>Billing address</span></div>
                <div className="pr-line"><span>Billing contact</span></div>
                <div className="pr-line"><span>Invoicing email</span></div>
                <div className="pr-line"><span>Phone</span></div>
                <div className="pr-line pr-line-sig"><span>Authorized signature</span></div>
                <div className="pr-line"><span>Printed name / title / date</span></div>
              </div>
              <div className="pr-sign-col">
                <div className="pr-sign-who">Alerify</div>
                <div className="pr-line pr-line-sig"><span>Authorized signature</span></div>
                <div className="pr-line"><span>Printed name / title / date</span></div>
                <p className="pr-fine">
                  This Service Proposal is subject to the attached Master Service Agreement. Amounts are in USD and
                  exclude applicable taxes. Valid for 30 days from the date above.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </section>
    </div>
  );
}
