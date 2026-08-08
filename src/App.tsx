import { useEffect, useMemo, useState } from "react";
import type { Addons, Compare, Instance, Pricing, Quote, ServerConfig } from "./types";
import { byKey, cloudCompare, firewallLine, fmt, priceServer, vcpuOptions } from "./pricing";
import { clearPricing, defaultPricing, isDefaultPricing, loadPricing, loadQuote, savePricing, saveQuote } from "./storage";
import ServerCard from "./ServerCard";
import Editor from "./Editor";
import QuoteDoc from "./QuoteDoc";
import CompareSheet from "./CompareSheet";
import { parseWorkbook } from "./importXlsx";
import { downloadProposalPdf, downloadSheetPdf } from "./exportPdf";
import ProposalSheet from "./ProposalSheet";

let seq = 0;
const nextId = () => "s" + ++seq + "_" + Math.floor(performance.now());

function seedServer(): ServerConfig {
  return { id: nextId(), name: "APP01", os: "windows", vcpu: 4, ram: 16, ebs: 200, eip: 1, rds: 0, sql: false,
    localBackup: false, offsiteBackup: false, backupRetentionDays: 30 };
}

function newServer(n: number): ServerConfig {
  return { id: nextId(), name: "Server " + n, os: "linux", vcpu: 1, ram: 2, ebs: 0, eip: 1, rds: 0, sql: false,
    localBackup: false, offsiteBackup: false, backupRetentionDays: 30 };
}

type Status = { kind: "ok" | "err" | ""; text: string };

export default function App() {
  const [pricing, setPricing] = useState<Pricing>(() => loadPricing());
  const [quote, setQuote] = useState<Quote>(() => {
    const q = loadQuote();
    // Backfill one-time-charge defaults for quotes saved before these fields existed.
    if (q && q.servers?.length) return { ...q, setupClient: q.setupClient ?? 0, setupAdmin: q.setupAdmin ?? 185 };
    return { quoteName: "", quoteRef: "", firewall: "standard", servers: [seedServer()], setupClient: 0, setupAdmin: 185 };
  });
  const [showInternal, setShowInternal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "", text: "" });

  // Persist.
  useEffect(() => savePricing(pricing), [pricing]);
  useEffect(() => saveQuote(quote), [quote]);

  // Body classes drive show/hide + print CSS.
  useEffect(() => {
    document.body.classList.toggle("show-internal", showInternal);
    document.body.classList.toggle("show-compare", showCompare);
    document.body.classList.toggle("editing", editing);
  }, [showInternal, showCompare, editing]);

  // Exports build a downloadable PDF client-side (see exportPdf.ts) rather than
  // going through window.print(), which iOS/Brave render inconsistently.
  const [exporting, setExporting] = useState<"" | "styled" | "compare">("");
  const dateSlug = () => {
    const d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  };
  const slug = (s: string) => s.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const qname = () => slug(quote.quoteName) || "Quote";
  async function exportProposalStyled() {
    if (exporting) return;
    setExporting("styled");
    try {
      await downloadProposalPdf("proposalDoc", `Alerify-Proposal-${qname()}-${dateSlug()}.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not build the proposal.");
    } finally {
      setExporting("");
    }
  }
  async function exportComparison() {
    if (exporting) return;
    setExporting("compare");
    try {
      await downloadSheetPdf("compareDoc", `Alerify-vs-AWS-Azure-${dateSlug()}.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setExporting("");
    }
  }

  const keyed = useMemo(() => byKey(pricing.compute), [pricing.compute]);
  const vcpus = useMemo(() => vcpuOptions(pricing.compute), [pricing.compute]);
  const isDefault = useMemo(() => isDefaultPricing(pricing), [pricing]);

  // Totals.
  const totals = useMemo(() => {
    let monthly = 0, cost = 0, comparable = 0, aws = 0, azure = 0;
    for (const s of quote.servers) {
      const priced = priceServer(s, pricing.addons, keyed);
      const cmp = cloudCompare(s, pricing.compare, pricing.addons);
      monthly += priced.client; cost += priced.cost; comparable += priced.comparable;
      aws += cmp.aws; azure += cmp.azure;
    }
    const fw = firewallLine(quote.firewall, pricing.addons);
    monthly += fw.client; cost += fw.cost;
    return { monthly, cost, comparable, aws, azure, fw };
  }, [quote.servers, quote.firewall, pricing, keyed]);

  // Server operations.
  const updateServer = (id: string, patch: Partial<ServerConfig>) =>
    setQuote((q) => ({ ...q, servers: q.servers.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeServer = (id: string) => setQuote((q) => ({ ...q, servers: q.servers.filter((s) => s.id !== id) }));
  const addServer = () => setQuote((q) => ({ ...q, servers: [...q.servers, newServer(q.servers.length + 1)] }));
  const clearAll = () => {
    if (confirm("Remove all servers from this quote?")) setQuote((q) => ({ ...q, servers: [] }));
  };

  // Editor pricing updates.
  const setAddons = (addons: Addons) => setPricing((p) => ({ ...p, addons }));
  const setCompare = (compare: Compare) => setPricing((p) => ({ ...p, compare }));
  const setCompute = (compute: Instance[]) => setPricing((p) => ({ ...p, compute }));

  const resetPricing = () => {
    if (!confirm("Reset all pricing back to the built-in defaults?")) return;
    clearPricing();
    setPricing(defaultPricing());
    setStatus({ kind: "", text: "" });
  };

  async function importFile(file: File) {
    try {
      const parsed = await parseWorkbook(file);
      setPricing((p) => ({
        ...p,
        compute: parsed.compute,
        addons: { ...p.addons, ...parsed.addons, sqlMinCores: p.addons.sqlMinCores },
      }));
      setStatus({ kind: "ok", text: `✓ Imported ${parsed.count} instances and add-on rates from ${file.name}.` });
    } catch (err) {
      setStatus({ kind: "err", text: "✕ " + (err instanceof Error ? err.message : "Could not read that file.") });
    }
  }

  function exportDataTs() {
    const lines = [
      "import type { Addons, Compare, Instance } from './types';",
      "",
      "// Alerify pricing data — exported from the in-app editor.",
      "// Replace src/data.ts with this file to update built-in pricing for everyone.",
      "",
      "export const ADDONS: Addons = " + JSON.stringify(pricing.addons, null, 2) + ";",
      "",
      "export const COMPARE: Compare = " + JSON.stringify(pricing.compare, null, 2) + ";",
      "",
      "export const COMPUTE: Instance[] = " + JSON.stringify(pricing.compute) + ";",
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "data.ts";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const saveVsAws = totals.aws - totals.comparable;
  const saveVsAz = totals.azure - totals.comparable;
  const deltaText = (d: number, base: number) =>
    `${fmt(Math.abs(d))} ${d >= 0 ? "lower" : "higher"} (${base > 0 ? Math.abs((d / base) * 100).toFixed(0) : "0"}%)`;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="wordmark">A<span>LERIFY</span></div>
          <div className="brand-divider" />
          <div className="brand-text">
            <h1>Cloud Pricing Calculator</h1>
            <p className="brand-tag">Your Data. Our Duty.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <label className="switch" title="Show Alerify internal cost, margin and profit">
            <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} />
            <span className="switch-track"><span className="switch-thumb" /></span>
            <span className="switch-label">Internal view</span>
          </label>
          <label className="switch" title="Compare against estimated AWS / Azure list pricing">
            <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} />
            <span className="switch-track"><span className="switch-thumb" /></span>
            <span className="switch-label">Cloud comparison</span>
          </label>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit pricing</button>
          <button className="btn btn-ghost" onClick={exportComparison} disabled={!!exporting}>
            {exporting === "compare" ? "Building…" : "Export comparison (PDF)"}
          </button>
          <button className="btn btn-ghost" onClick={exportProposalStyled} disabled={!!exporting}>
            {exporting === "styled" ? "Building…" : "Export proposal (PDF)"}
          </button>
        </div>
      </header>

      <main>
        <section className="quote-meta card">
          <div className="field">
            <label htmlFor="quoteName">Quote / Customer name</label>
            <input id="quoteName" type="text" placeholder="e.g. Contoso Ltd — Production"
              value={quote.quoteName} onChange={(e) => setQuote((q) => ({ ...q, quoteName: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="quoteRef">Reference #</label>
            <input id="quoteRef" type="text" placeholder="optional"
              value={quote.quoteRef} onChange={(e) => setQuote((q) => ({ ...q, quoteRef: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="setupClient">Client setup ($, one-time)</label>
            <input id="setupClient" type="number" min={0} step={5} value={quote.setupClient}
              onChange={(e) => setQuote((q) => ({ ...q, setupClient: Math.max(0, parseFloat(e.target.value) || 0) }))} />
          </div>
          <div className="field">
            <label htmlFor="setupAdmin">Admin setup fee ($, one-time)</label>
            <input id="setupAdmin" type="number" min={0} step={5} value={quote.setupAdmin}
              onChange={(e) => setQuote((q) => ({ ...q, setupAdmin: Math.max(0, parseFloat(e.target.value) || 0) }))} />
          </div>
        </section>

        <section className="card shared-services">
          <h2>Shared environment services</h2>
          <p className="section-hint">Applied once to the whole environment, not per server.</p>
          <div className="shared-grid">
            <div className="field">
              <label htmlFor="fwSelect">Firewall</label>
              <select id="fwSelect" value={quote.firewall}
                onChange={(e) => setQuote((q) => ({ ...q, firewall: e.target.value as Quote["firewall"] }))}>
                <option value="standard">Standard (included)</option>
                <option value="advanced">Advanced — Small</option>
              </select>
            </div>
            <div className="shared-price">
              <span className="metric-label">Firewall / month</span>
              <span className="metric-value">{fmt(totals.fw.client)}</span>
            </div>
          </div>
        </section>

        <div>
          {quote.servers.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              addons={pricing.addons}
              compare={pricing.compare}
              keyed={keyed}
              vcpus={vcpus}
              compute={pricing.compute}
              onChange={(patch) => updateServer(s.id, patch)}
              onRemove={() => removeServer(s.id)}
            />
          ))}
          {quote.servers.length === 0 && (
            <div className="empty-state">No servers yet — click “Add server” to start your quote.</div>
          )}
        </div>

        <div className="add-row">
          <button className="btn btn-primary" onClick={addServer}>+ Add server</button>
          <button className="btn btn-ghost" onClick={clearAll}>Clear all</button>
        </div>

        <section className="summary card">
          <h2>Quote summary</h2>
          <div className="summary-grid">
            <div className="summary-metric">
              <span className="metric-label">Servers</span>
              <span className="metric-value">{quote.servers.length}</span>
            </div>
            <div className="summary-metric">
              <span className="metric-label">Monthly total</span>
              <span className="metric-value accent">{fmt(totals.monthly)}</span>
            </div>
            <div className="summary-metric">
              <span className="metric-label">Annual total</span>
              <span className="metric-value">{fmt(totals.monthly * 12)}</span>
            </div>
            <div className="summary-metric internal-only">
              <span className="metric-label">Monthly cost</span>
              <span className="metric-value">{fmt(totals.cost)}</span>
            </div>
            <div className="summary-metric internal-only">
              <span className="metric-label">Monthly profit</span>
              <span className="metric-value">{fmt(totals.monthly - totals.cost)}</span>
            </div>
            <div className="summary-metric internal-only">
              <span className="metric-label">Blended margin</span>
              <span className="metric-value">
                {totals.monthly > 0 ? (((totals.monthly - totals.cost) / totals.monthly) * 100).toFixed(1) + "%" : "—"}
              </span>
            </div>
          </div>

          <div className="compare-only compare-panel">
            <div className="compare-panel-head">
              <h3>
                Comparable stack vs. public cloud{" "}
                <small>(compute + storage + IP + SQL + egress, estimated on-demand list)</small>
              </h3>
              <div className="field field-inline">
                <label htmlFor="egressAvg">Avg data-out / server (GB/mo)</label>
                <input id="egressAvg" type="number" min={0} step={50}
                  value={pricing.compare.avgEgressGBPerServer}
                  onChange={(e) => setCompare({ ...pricing.compare, avgEgressGBPerServer: Math.max(0, parseFloat(e.target.value) || 0) })} />
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-metric">
                <span className="metric-label">Alerify (comparable)</span>
                <span className="metric-value accent">{fmt(totals.comparable)}</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">AWS estimate</span>
                <span className="metric-value">{fmt(totals.aws)}</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">Azure estimate</span>
                <span className="metric-value">{fmt(totals.azure)}</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">Savings vs AWS</span>
                <span className={"metric-value " + (saveVsAws >= 0 ? "pos" : "neg")}>{deltaText(saveVsAws, totals.aws)}</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">Savings vs Azure</span>
                <span className={"metric-value " + (saveVsAz >= 0 ? "pos" : "neg")}>{deltaText(saveVsAz, totals.azure)}</span>
              </div>
            </div>
            <p className="section-hint">
              Directional only. Cloud figures include Windows &amp; SQL Standard licensing plus an estimated average
              internet egress per server (set above; ingress is free everywhere and Alerify bundles data transfer at no
              charge). They exclude committed-use discounts, paid support, and managed-service value.
            </p>
          </div>
        </section>

        <p className="disclaimer">
          All figures are monthly (USD) and derived from the Alerify pricing sheet. Compute pricing is based on a
          744-hour month. Storage is billed per GB/month; SQL Standard is licensed per 2-core pack with a 4-core minimum
          per SQL server. This tool is for estimation only.
        </p>
      </main>

      {editing && (
        <Editor
          pricing={pricing}
          isDefault={isDefault}
          status={status}
          onAddons={setAddons}
          onCompare={setCompare}
          onCompute={setCompute}
          onReset={resetPricing}
          onExport={exportDataTs}
          onImport={importFile}
          onClose={() => setEditing(false)}
        />
      )}

      <QuoteDoc quote={quote} addons={pricing.addons} keyed={keyed} />
      <ProposalSheet quote={quote} addons={pricing.addons} keyed={keyed} />
      <CompareSheet quote={quote} addons={pricing.addons} compare={pricing.compare} keyed={keyed} />
    </>
  );
}
