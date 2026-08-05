/* Alerify Cloud Pricing Calculator
 * Pure client-side app (no build step) so it runs on GitHub Pages.
 * Pricing data lives in data.js (COMPUTE + ADDONS + COMPARE).
 */
(function () {
  "use strict";

  const STORAGE_KEY = "alerify_quote_v2";
  const fmt = (n) =>
    "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) =>
    "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const VCPU_OPTIONS = [...new Set(COMPUTE.map((c) => c.vcpu))].sort((a, b) => a - b);
  const BY_KEY = new Map(COMPUTE.map((c) => [c.vcpu + "|" + c.ram, c]));

  const serversEl = document.getElementById("servers");
  const tpl = document.getElementById("serverTemplate");

  /* ---------- Quote-level firewall ---------- */
  function firewallLine() {
    const adv = document.getElementById("fwSelect").value === "advanced";
    return adv
      ? { label: "Advanced firewall — Small", client: ADDONS.firewallAdv.client, cost: ADDONS.firewallAdv.cost }
      : { label: "Standard firewall (included)", client: ADDONS.firewallStd.client, cost: ADDONS.firewallStd.cost };
  }

  /* ---------- Per-server pricing ---------- */
  function priceServer(v) {
    const inst = BY_KEY.get(v.vcpu + "|" + v.ram);
    const lines = [];
    let client = 0, cost = 0, comparable = 0; // comparable = compute + storage + IP + SQL

    function add(label, detail, c, k, isComparable) {
      client += c; cost += k;
      if (isComparable) comparable += c;
      lines.push({ label, detail, client: c, cost: k });
    }

    if (inst) {
      const isWin = v.os === "windows";
      add((isWin ? "Windows" : "Linux") + " compute",
        `${inst.name} · ${v.vcpu} vCPU / ${v.ram} GB`,
        isWin ? inst.winClient : inst.linuxClient,
        isWin ? inst.winCost : inst.linuxCost, true);
    }
    if (v.ebs > 0) {
      add("EBS storage", `${v.ebs} GB × ${fmt(ADDONS.ebsPerGB.client)}/GB`,
        v.ebs * ADDONS.ebsPerGB.client, v.ebs * ADDONS.ebsPerGB.cost, true);
    }
    if (v.eip > 0) {
      add("Elastic IP", `${v.eip} × ${fmt(ADDONS.elasticIp.client)}`,
        v.eip * ADDONS.elasticIp.client, v.eip * ADDONS.elasticIp.cost, true);
    }
    if (v.sql) {
      const cores = Math.max(ADDONS.sqlMinCores, v.vcpu);
      const packs = Math.ceil(cores / 2);
      add("SQL Standard", `${packs} × 2-core pack (${cores} cores)`,
        packs * ADDONS.sqlPer2Core.client, packs * ADDONS.sqlPer2Core.cost, true);
    }
    if (v.rds > 0) {
      add("RDS CALs", `${v.rds} × ${fmt(ADDONS.rdsCal.client)}`,
        v.rds * ADDONS.rdsCal.client, v.rds * ADDONS.rdsCal.cost, false);
    }

    return { lines, client, cost, comparable, profit: client - cost, inst };
  }

  // Global estimated average egress per server (GB/mo), from the UI control.
  function avgEgress() {
    const el = document.getElementById("egressAvg");
    return Math.max(0, parseFloat(el && el.value) || 0);
  }

  /* ---------- Cloud comparison for one server (infra only) ---------- */
  function cloudCompare(v) {
    function calc(p) {
      const isWin = v.os === "windows";
      const compute =
        (p.vcpuHr * v.vcpu + p.gbHr * v.ram + (isWin ? p.winVcpuHr * v.vcpu : 0)) * COMPARE.hoursMonth;
      const storage = v.ebs * p.storageGB;
      const ip = v.eip * p.ipMonth;
      let sql = 0;
      if (v.sql) {
        const packs = Math.ceil(Math.max(ADDONS.sqlMinCores, v.vcpu) / 2);
        sql = packs * p.sqlPer2Core;
      }
      const egress = avgEgress() * p.egressGB; // per-server avg; Alerify bundles free
      return compute + storage + ip + sql + egress;
    }
    return { aws: calc(COMPARE.aws), azure: calc(COMPARE.azure) };
  }

  /* ---------- Render a server's line-item breakdown ---------- */
  function renderBreakdown(tbody, priced) {
    const rows = [
      `<tr><th class="desc">Item</th><th>Price</th>` +
        `<th class="col-internal">Cost</th><th class="col-internal">Margin</th></tr>`,
    ];
    priced.lines.forEach((l) => {
      const margin = l.client > 0 ? ((l.client - l.cost) / l.client) * 100 : 0;
      rows.push(
        `<tr><td class="desc"><strong>${l.label}</strong><br>` +
          `<span style="font-size:12px">${l.detail}</span></td>` +
          `<td class="amt">${fmt(l.client)}</td>` +
          `<td class="cost col-internal">${fmt(l.cost)}</td>` +
          `<td class="margin col-internal">${margin.toFixed(1)}%</td></tr>`
      );
    });
    const totMargin = priced.client > 0 ? (priced.profit / priced.client) * 100 : 0;
    rows.push(
      `<tr class="total"><td>Monthly total</td><td class="amt">${fmt(priced.client)}</td>` +
        `<td class="cost col-internal">${fmt(priced.cost)}</td>` +
        `<td class="margin col-internal">${totMargin.toFixed(1)}%</td></tr>`
    );
    tbody.innerHTML = rows.join("");
  }

  /* ---------- Render a server's cloud comparison ---------- */
  // Delta = cloud − Alerify. Positive => Alerify is cheaper (green);
  // negative => Alerify is the premium option (red). Honest either way.
  function deltaCell(cloud, alerify) {
    const d = cloud - alerify; // >0 => Alerify lower
    const pct = cloud > 0 ? Math.abs((d / cloud) * 100).toFixed(0) + "%" : "—";
    const cls = d >= 0 ? "save" : "over";
    const word = d >= 0 ? "lower" : "higher";
    return `<td class="amt ${cls}">${fmt(Math.abs(d))} ${word} <small>(${pct})</small></td>`;
  }
  function renderCompare(tbody, priced, cmp) {
    tbody.innerHTML =
      `<tr><th class="desc">Comparable stack (compute + storage + IP + SQL + egress)</th>` +
        `<th>Alerify</th><th>AWS</th><th>Azure</th></tr>` +
      `<tr><td class="desc">Estimated monthly</td>` +
        `<td class="amt">${fmt(priced.comparable)}</td>` +
        `<td class="amt muted">${fmt(cmp.aws)}</td>` +
        `<td class="amt muted">${fmt(cmp.azure)}</td></tr>` +
      `<tr class="total"><td>Alerify vs. cloud</td>` +
        `<td class="amt">—</td>` +
        deltaCell(cmp.aws, priced.comparable) +
        deltaCell(cmp.azure, priced.comparable) +
      `</tr>`;
  }

  /* ---------- Read a server card ---------- */
  function readCard(card) {
    return {
      name: card.querySelector(".server-name").value,
      os: card.querySelector(".f-os").value,
      vcpu: parseInt(card.querySelector(".f-vcpu").value, 10),
      ram: parseInt(card.querySelector(".f-ram").value, 10),
      ebs: Math.max(0, parseFloat(card.querySelector(".f-ebs").value) || 0),
      eip: Math.max(0, parseInt(card.querySelector(".f-eip").value, 10) || 0),
      rds: Math.max(0, parseInt(card.querySelector(".f-rds").value, 10) || 0),
      sql: card.querySelector(".f-sql").checked,
    };
  }

  function fillRam(card, keepRam) {
    const vcpu = parseInt(card.querySelector(".f-vcpu").value, 10);
    const ramSel = card.querySelector(".f-ram");
    const opts = COMPUTE.filter((c) => c.vcpu === vcpu).sort((a, b) => a.ram - b.ram);
    ramSel.innerHTML = opts
      .map((c) => `<option value="${c.ram}">${c.ram} GB &nbsp;(${c.family})</option>`)
      .join("");
    if (keepRam != null && opts.some((c) => c.ram === keepRam)) ramSel.value = keepRam;
  }

  /* ---------- Recompute everything ---------- */
  function recompute() {
    const cards = [...serversEl.querySelectorAll(".server")];
    let monthly = 0, cost = 0, comparable = 0, aws = 0, azure = 0;

    cards.forEach((card) => {
      const v = readCard(card);
      const priced = priceServer(v);
      const cmp = cloudCompare(v);
      renderBreakdown(card.querySelector(".breakdown-body"), priced);
      renderCompare(card.querySelector(".compare-body"), priced, cmp);
      card.querySelector(".server-subtotal").innerHTML = fmt(priced.client) + "<small>/mo</small>";
      monthly += priced.client; cost += priced.cost; comparable += priced.comparable;
      aws += cmp.aws; azure += cmp.azure;
    });

    // Quote-level firewall.
    const fw = firewallLine();
    document.getElementById("fwPrice").textContent = fmt(fw.client);
    monthly += fw.client; cost += fw.cost;

    document.getElementById("sumCount").textContent = cards.length;
    document.getElementById("sumMonthly").textContent = fmt(monthly);
    document.getElementById("sumAnnual").textContent = fmt(monthly * 12);
    document.getElementById("sumCost").textContent = fmt(cost);
    document.getElementById("sumProfit").textContent = fmt(monthly - cost);
    document.getElementById("sumMargin").textContent =
      monthly > 0 ? (((monthly - cost) / monthly) * 100).toFixed(1) + "%" : "—";

    // Comparison summary.
    document.getElementById("cmpAlerify").textContent = fmt(comparable);
    document.getElementById("cmpAws").textContent = fmt(aws);
    document.getElementById("cmpAzure").textContent = fmt(azure);
    setDeltaMetric("cmpSaveAws", aws, comparable);
    setDeltaMetric("cmpSaveAzure", azure, comparable);

    toggleEmptyState(cards.length === 0);
    save();
  }

  function setDeltaMetric(id, cloud, alerify) {
    const el = document.getElementById(id);
    const d = cloud - alerify; // >0 => Alerify lower
    const pct = cloud > 0 ? Math.abs((d / cloud) * 100).toFixed(0) + "%" : "—";
    el.textContent = fmt(Math.abs(d)) + (d >= 0 ? " lower" : " higher") + " (" + pct + ")";
    el.classList.toggle("pos", d >= 0);
    el.classList.toggle("neg", d < 0);
  }

  function toggleEmptyState(isEmpty) {
    let es = document.getElementById("emptyState");
    if (isEmpty && !es) {
      es = document.createElement("div");
      es.id = "emptyState";
      es.className = "empty-state";
      es.textContent = "No servers yet — click “Add server” to start your quote.";
      serversEl.appendChild(es);
    } else if (!isEmpty && es) {
      es.remove();
    }
  }

  /* ---------- Create a server card ---------- */
  function addServer(preset) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const vcpuSel = node.querySelector(".f-vcpu");
    vcpuSel.innerHTML = VCPU_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("");

    const p = preset || {};
    node.querySelector(".server-name").value =
      p.name || "Server " + (serversEl.querySelectorAll(".server").length + 1);
    node.querySelector(".f-os").value = p.os || "linux";
    vcpuSel.value = p.vcpu != null ? p.vcpu : VCPU_OPTIONS[0];
    fillRam(node, p.ram);
    node.querySelector(".f-ebs").value = p.ebs != null ? p.ebs : 0;
    node.querySelector(".f-eip").value = p.eip != null ? p.eip : 1;
    node.querySelector(".f-rds").value = p.rds != null ? p.rds : 0;
    node.querySelector(".f-sql").checked = !!p.sql;

    node.addEventListener("input", recompute);
    node.addEventListener("change", recompute);
    vcpuSel.addEventListener("change", () => { fillRam(node); recompute(); });
    node.querySelector(".remove-server").addEventListener("click", () => { node.remove(); recompute(); });

    const es = document.getElementById("emptyState");
    if (es) es.remove();
    serversEl.appendChild(node);
    return node;
  }

  /* ---------- Persistence ---------- */
  function save() {
    const data = {
      quoteName: document.getElementById("quoteName").value,
      quoteRef: document.getElementById("quoteRef").value,
      firewall: document.getElementById("fwSelect").value,
      egressAvg: document.getElementById("egressAvg").value,
      internal: document.getElementById("internalToggle").checked,
      compare: document.getElementById("compareToggle").checked,
      servers: [...serversEl.querySelectorAll(".server")].map((c) => readCard(c)),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) {}
    if (data) {
      document.getElementById("quoteName").value = data.quoteName || "";
      document.getElementById("quoteRef").value = data.quoteRef || "";
      document.getElementById("fwSelect").value = data.firewall || "standard";
      if (data.egressAvg != null) document.getElementById("egressAvg").value = data.egressAvg;
      document.getElementById("internalToggle").checked = !!data.internal;
      document.getElementById("compareToggle").checked = !!data.compare;
      document.body.classList.toggle("show-internal", !!data.internal);
      document.body.classList.toggle("show-compare", !!data.compare);
      (data.servers || []).forEach((s) => addServer(s));
    }
    if (!data || !(data.servers || []).length) {
      addServer({ name: "APP01", os: "windows", vcpu: 4, ram: 16, ebs: 200, eip: 1, rds: 0, sql: false });
    }
  }

  /* ---------- Professional client-facing quote (PDF) ---------- */
  function buildQuoteDoc() {
    const cards = [...serversEl.querySelectorAll(".server")];
    const customer = document.getElementById("quoteName").value.trim() || "Prepared quote";
    const ref = document.getElementById("quoteRef").value.trim();
    const d = new Date();
    const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const quoteNo =
      "AQ-" + d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");

    let monthly = 0;
    const rows = cards.map((card) => {
      const v = readCard(card);
      const priced = priceServer(v);
      monthly += priced.client;
      const specs = [
        v.os === "windows" ? "Windows" : "Linux",
        `${v.vcpu} vCPU / ${v.ram} GB`,
        v.ebs > 0 ? `${v.ebs} GB storage` : null,
        v.eip > 0 ? `${v.eip} × Elastic IP` : null,
        v.sql ? "SQL Standard" : null,
        v.rds > 0 ? `${v.rds} × RDS CAL` : null,
      ].filter(Boolean).join(" · ");
      return `<tr><td><strong>${escapeHtml(v.name || "Server")}</strong></td>
        <td class="q-spec">${escapeHtml(specs)}</td>
        <td class="q-amt">${fmt(priced.client)}</td></tr>`;
    });

    const fw = firewallLine();
    monthly += fw.client;
    const fwRow = `<tr><td><strong>Shared services</strong></td>
      <td class="q-spec">${escapeHtml(fw.label)}</td>
      <td class="q-amt">${fmt(fw.client)}</td></tr>`;

    document.getElementById("quoteDoc").innerHTML = `
      <div class="q-page">
        <div class="q-head">
          <div class="q-brand"><span class="q-logo">A</span>
            <div><div class="q-name">Alerify</div><div class="q-sub">Managed Cloud Hosting</div></div>
          </div>
          <div class="q-meta">
            <div class="q-title">Hosting Quote</div>
            <table class="q-metatable"><tbody>
              <tr><td>Quote #</td><td>${quoteNo}</td></tr>
              <tr><td>Date</td><td>${dateStr}</td></tr>
              ${ref ? `<tr><td>Reference</td><td>${escapeHtml(ref)}</td></tr>` : ""}
            </tbody></table>
          </div>
        </div>

        <div class="q-prepared">Prepared for<br><strong>${escapeHtml(customer)}</strong></div>

        <table class="q-table">
          <thead><tr><th>Item</th><th>Configuration</th><th class="q-amt">Monthly</th></tr></thead>
          <tbody>${rows.join("")}${fwRow}</tbody>
          <tfoot>
            <tr class="q-subtotal"><td colspan="2">Monthly total</td><td class="q-amt">${fmt(monthly)}</td></tr>
            <tr class="q-annual"><td colspan="2">Annual total</td><td class="q-amt">${fmt(monthly * 12)}</td></tr>
          </tfoot>
        </table>

        <div class="q-terms">
          <p><strong>Notes</strong></p>
          <ul>
            <li>All amounts are in USD and billed monthly. Annual total is indicative (12 × monthly).</li>
            <li>Pricing excludes applicable taxes. Storage is billed per GB per month.</li>
            <li>This quote is valid for 30 days from the date above.</li>
          </ul>
          <p class="q-foot">Alerify — Managed Cloud Hosting &nbsp;·&nbsp; Thank you for your business.</p>
        </div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Global controls ---------- */
  document.getElementById("addServer").addEventListener("click", () => { addServer(); recompute(); });
  document.getElementById("clearAll").addEventListener("click", () => {
    if (!confirm("Remove all servers from this quote?")) return;
    serversEl.innerHTML = "";
    recompute();
  });
  document.getElementById("internalToggle").addEventListener("change", (e) => {
    document.body.classList.toggle("show-internal", e.target.checked); save();
  });
  document.getElementById("compareToggle").addEventListener("change", (e) => {
    document.body.classList.toggle("show-compare", e.target.checked); save();
  });
  document.getElementById("fwSelect").addEventListener("change", recompute);
  document.getElementById("egressAvg").addEventListener("input", recompute);
  ["quoteName", "quoteRef"].forEach((id) =>
    document.getElementById(id).addEventListener("input", save));

  document.getElementById("printBtn").addEventListener("click", () => { buildQuoteDoc(); window.print(); });
  window.addEventListener("beforeprint", buildQuoteDoc);

  // Boot.
  load();
  recompute();
})();
