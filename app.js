/* Alerify Cloud Pricing Calculator
 * Pure client-side app (no build step) so it runs on GitHub Pages.
 * Pricing data lives in data.js (COMPUTE + ADDONS).
 */
(function () {
  "use strict";

  const STORAGE_KEY = "alerify_quote_v1";
  const fmt = (n) =>
    "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Unique, sorted list of vCPU options available in the pricing table.
  const VCPU_OPTIONS = [...new Set(COMPUTE.map((c) => c.vcpu))].sort((a, b) => a - b);

  // Fast lookup: "vcpu|ram" -> instance record.
  const BY_KEY = new Map(COMPUTE.map((c) => [c.vcpu + "|" + c.ram, c]));

  const serversEl = document.getElementById("servers");
  const tpl = document.getElementById("serverTemplate");

  /* ---------- Per-server pricing ---------- */
  function priceServer(v) {
    const inst = BY_KEY.get(v.vcpu + "|" + v.ram);
    const lines = [];
    let client = 0;
    let cost = 0;

    function add(label, detail, c, k) {
      client += c;
      cost += k;
      lines.push({ label, detail, client: c, cost: k });
    }

    if (inst) {
      const isWin = v.os === "windows";
      const compClient = isWin ? inst.winClient : inst.linuxClient;
      const compCost = isWin ? inst.winCost : inst.linuxCost;
      add(
        (isWin ? "Windows" : "Linux") + " compute",
        `${inst.name} · ${v.vcpu} vCPU / ${v.ram} GB`,
        compClient,
        compCost
      );
    }

    if (v.ebs > 0) {
      add("EBS storage", `${v.ebs} GB × ${fmt(ADDONS.ebsPerGB.client)}/GB`,
        v.ebs * ADDONS.ebsPerGB.client, v.ebs * ADDONS.ebsPerGB.cost);
    }

    if (v.eip > 0) {
      add("Elastic IP", `${v.eip} × ${fmt(ADDONS.elasticIp.client)}`,
        v.eip * ADDONS.elasticIp.client, v.eip * ADDONS.elasticIp.cost);
    }

    if (v.fw === "advanced") {
      add("Advanced firewall", "flat monthly",
        ADDONS.firewallAdv.client, ADDONS.firewallAdv.cost);
    }

    if (v.sql) {
      const cores = Math.max(ADDONS.sqlMinCores, v.vcpu);
      const packs = Math.ceil(cores / 2);
      add("SQL Standard", `${packs} × 2-core pack (${cores} cores)`,
        packs * ADDONS.sqlPer2Core.client, packs * ADDONS.sqlPer2Core.cost);
    }

    if (v.rds > 0) {
      add("RDS CALs", `${v.rds} × ${fmt(ADDONS.rdsCal.client)}`,
        v.rds * ADDONS.rdsCal.client, v.rds * ADDONS.rdsCal.cost);
    }

    return { lines, client, cost, profit: client - cost, valid: !!inst };
  }

  /* ---------- Render one server's breakdown table ---------- */
  function renderBreakdown(tbody, priced) {
    const rows = [];
    rows.push(
      `<tr><th class="desc">Item</th><th>Price</th>` +
        `<th class="col-internal">Cost</th><th class="col-internal">Margin</th></tr>`
    );
    priced.lines.forEach((l) => {
      const margin = l.client > 0 ? ((l.client - l.cost) / l.client) * 100 : 0;
      rows.push(
        `<tr>` +
          `<td class="desc"><strong>${l.label}</strong><br><span style="font-size:12px">${l.detail}</span></td>` +
          `<td class="amt">${fmt(l.client)}</td>` +
          `<td class="cost col-internal">${fmt(l.cost)}</td>` +
          `<td class="margin col-internal">${margin.toFixed(1)}%</td>` +
        `</tr>`
      );
    });
    const totMargin = priced.client > 0 ? (priced.profit / priced.client) * 100 : 0;
    rows.push(
      `<tr class="total">` +
        `<td>Monthly total</td>` +
        `<td class="amt">${fmt(priced.client)}</td>` +
        `<td class="cost col-internal">${fmt(priced.cost)}</td>` +
        `<td class="margin col-internal">${totMargin.toFixed(1)}%</td>` +
      `</tr>`
    );
    tbody.innerHTML = rows.join("");
  }

  /* ---------- Read a server card's current values ---------- */
  function readCard(card) {
    return {
      name: card.querySelector(".server-name").value,
      os: card.querySelector(".f-os").value,
      vcpu: parseInt(card.querySelector(".f-vcpu").value, 10),
      ram: parseInt(card.querySelector(".f-ram").value, 10),
      ebs: Math.max(0, parseFloat(card.querySelector(".f-ebs").value) || 0),
      eip: Math.max(0, parseInt(card.querySelector(".f-eip").value, 10) || 0),
      fw: card.querySelector(".f-fw").value,
      rds: Math.max(0, parseInt(card.querySelector(".f-rds").value, 10) || 0),
      sql: card.querySelector(".f-sql").checked,
    };
  }

  /* ---------- Populate the RAM dropdown for the selected vCPU ---------- */
  function fillRam(card, keepRam) {
    const vcpu = parseInt(card.querySelector(".f-vcpu").value, 10);
    const ramSel = card.querySelector(".f-ram");
    const opts = COMPUTE.filter((c) => c.vcpu === vcpu).sort((a, b) => a.ram - b.ram);
    ramSel.innerHTML = opts
      .map((c) => `<option value="${c.ram}">${c.ram} GB &nbsp;(${c.family})</option>`)
      .join("");
    if (keepRam != null && opts.some((c) => c.ram === keepRam)) {
      ramSel.value = keepRam;
    }
  }

  /* ---------- Recompute everything ---------- */
  function recompute() {
    const cards = [...serversEl.querySelectorAll(".server")];
    let monthly = 0,
      cost = 0;

    cards.forEach((card) => {
      const v = readCard(card);
      const priced = priceServer(v);
      renderBreakdown(card.querySelector(".breakdown-body"), priced);
      card.querySelector(".server-subtotal").innerHTML = fmt(priced.client) + "<small>/mo</small>";
      monthly += priced.client;
      cost += priced.cost;
    });

    document.getElementById("sumCount").textContent = cards.length;
    document.getElementById("sumMonthly").textContent = fmt(monthly);
    document.getElementById("sumAnnual").textContent = fmt(monthly * 12);
    document.getElementById("sumCost").textContent = fmt(cost);
    document.getElementById("sumProfit").textContent = fmt(monthly - cost);
    document.getElementById("sumMargin").textContent =
      monthly > 0 ? (((monthly - cost) / monthly) * 100).toFixed(1) + "%" : "—";

    toggleEmptyState(cards.length === 0);
    save();
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

    // Populate vCPU options.
    const vcpuSel = node.querySelector(".f-vcpu");
    vcpuSel.innerHTML = VCPU_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("");

    // Apply preset or defaults.
    const p = preset || {};
    node.querySelector(".server-name").value = p.name || "Server " + (serversEl.querySelectorAll(".server").length + 1);
    node.querySelector(".f-os").value = p.os || "linux";
    vcpuSel.value = p.vcpu != null ? p.vcpu : VCPU_OPTIONS[0];
    fillRam(node, p.ram);
    node.querySelector(".f-ebs").value = p.ebs != null ? p.ebs : 0;
    node.querySelector(".f-eip").value = p.eip != null ? p.eip : 1;
    node.querySelector(".f-fw").value = p.fw || "standard";
    node.querySelector(".f-rds").value = p.rds != null ? p.rds : 0;
    node.querySelector(".f-sql").checked = !!p.sql;

    // Wire events.
    node.addEventListener("input", recompute);
    node.addEventListener("change", recompute);
    vcpuSel.addEventListener("change", () => {
      fillRam(node);
      recompute();
    });
    node.querySelector(".remove-server").addEventListener("click", () => {
      node.remove();
      recompute();
    });

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
      internal: document.getElementById("internalToggle").checked,
      servers: [...serversEl.querySelectorAll(".server")].map((c) => readCard(c)),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage may be unavailable; ignore */
    }
  }

  function load() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      data = null;
    }
    if (data) {
      document.getElementById("quoteName").value = data.quoteName || "";
      document.getElementById("quoteRef").value = data.quoteRef || "";
      document.getElementById("internalToggle").checked = !!data.internal;
      document.body.classList.toggle("show-internal", !!data.internal);
      (data.servers || []).forEach((s) => addServer(s));
    }
    if (!data || !(data.servers || []).length) {
      // Seed with one example server so the tool isn't empty on first load.
      addServer({ name: "APP01", os: "windows", vcpu: 4, ram: 16, ebs: 200, eip: 1, fw: "standard", rds: 0, sql: false });
    }
  }

  /* ---------- Wire up global controls ---------- */
  document.getElementById("addServer").addEventListener("click", () => {
    addServer();
    recompute();
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    if (!confirm("Remove all servers from this quote?")) return;
    serversEl.innerHTML = "";
    recompute();
  });

  document.getElementById("internalToggle").addEventListener("change", (e) => {
    document.body.classList.toggle("show-internal", e.target.checked);
    save();
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());

  ["quoteName", "quoteRef"].forEach((id) =>
    document.getElementById(id).addEventListener("input", save)
  );

  // Boot.
  load();
  recompute();
})();
