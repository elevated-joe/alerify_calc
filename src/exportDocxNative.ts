// Native, fully editable Word proposal in the Alerify brand style — real
// headings, tables and paragraphs (not page images), built with docx-js.
import type { Addons, Instance, Quote } from "./types";
import { firewallLine, fmt, priceServer } from "./pricing";

const NAVY = "0D1B3E";
const CYAN = "00AEEF";
const SLATE = "5A6B85";
const RULE = "D8E2EC";
const MIST = "EEF3F8";
const WHITE = "FFFFFF";

const TEXT_W = 10224; // twips, 8.5in − 2×0.7in margins

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

const SLA: string[][] = [
  ["P1", "Critical, no workaround", "30 mins", "4 hours", "24×7"],
  ["P2", "Major issue, limited workaround", "2 hrs", "1 business day", "24×7 Prod / Business hrs"],
  ["P3", "Minor issue, workaround exists", "8 hrs", "3 business days", "Business hours"],
  ["P4", "Cosmetic / inquiries", "2 days", "Next maintenance", "Business hours"],
];

const CONTACT = "717-725-7724   |   sales@alerify.com   |   2330 Vartan Way, Harrisburg PA 17110   |   alerify.com";

function specOf(v: Quote["servers"][number]): string {
  return [
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
}

export async function downloadProposalNativeDocx(
  quote: Quote,
  addons: Addons,
  keyed: Map<string, Instance>,
  logoUrl: string,
  filename: string
): Promise<void> {
  const d = await import("docx");
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
    BorderStyle, AlignmentType, ImageRun, Header, Footer, VerticalAlign, PageBreak, ShadingType,
  } = d;
  const shade = (fill: string) => ({ type: ShadingType.CLEAR, color: "auto", fill });

  const logo = new Uint8Array(await (await fetch(logoUrl)).arrayBuffer());

  const customer = quote.quoteName.trim() || "Client";
  const dt = new Date();
  const dateStr = dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const quoteNo = "AQ-" + dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, "0") + String(dt.getDate()).padStart(2, "0");
  const ref = quote.quoteRef.trim();

  const NONE = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
  const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

  // --- reusable builders -------------------------------------------------
  const heading = (text: string, label?: string) =>
    new Paragraph({
      spacing: { before: 320, after: 140 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: NAVY } },
      children: [
        new TextRun({ text, bold: true, color: NAVY, size: 30 }),
        ...(label ? [new TextRun({ text: "   " + label, bold: true, color: CYAN, size: 17, allCaps: true })] : []),
      ],
    });

  const body = (text: string, opts: { bold?: boolean; color?: string; size?: number } = {}) =>
    new TextRun({ text, bold: opts.bold, color: opts.color ?? NAVY, size: opts.size ?? 22 });

  const cell = (children: (InstanceType<typeof Paragraph>)[], w: number, extra: Record<string, unknown> = {}) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 60, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      children,
      ...extra,
    });

  const bottomOnly = { top: NONE, left: NONE, right: NONE, insideVertical: NONE,
    bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: RULE } };

  // --- cover -------------------------------------------------------------
  const cover: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      spacing: { before: 400, after: 0 },
      children: [new ImageRun({ type: "png", data: logo, transformation: { width: 230, height: 184 } })],
    }),
    new Paragraph({
      spacing: { before: 160, after: 480 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 28, color: CYAN } },
      children: [],
    }),
    new Paragraph({ spacing: { before: 1200, after: 0 }, children: [new TextRun({ text: "PRIVATE CLOUD · HOSTING PROPOSAL", bold: true, color: CYAN, size: 19, allCaps: true })] }),
    new Paragraph({ spacing: { before: 100, after: 0 }, children: [new TextRun({ text: "Virtual Private Cloud Proposal", bold: true, color: NAVY, size: 60 })] }),
    new Paragraph({ spacing: { before: 220, after: 360 }, children: [new TextRun({
      text: "Enterprise-grade private cloud hosting from a Tier 3, SOC 2-certified data center in Harrisburg, PA — with 24×7 human support and no data-transfer fees.",
      color: SLATE, size: 24 })] }),
    new Table({
      width: { size: TEXT_W, type: WidthType.DXA },
      borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 22, color: CYAN } },
      columnWidths: [3408, 3408, 3408],
      rows: [
        new TableRow({ children: [
          ["Prepared for", customer],
          ["Date", dateStr],
          ["Quote", quoteNo + (ref ? ` · Ref ${ref}` : "")],
        ].map(([label, val]) => cell([
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: label.toUpperCase(), bold: true, color: SLATE, size: 16 })] }),
          new Paragraph({ children: [new TextRun({ text: val, bold: true, color: NAVY, size: 24 })] }),
        ], 3408, { margins: { top: 40, bottom: 40, left: 180, right: 120 } })) }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // --- services page -----------------------------------------------------
  const featureRows: InstanceType<typeof TableRow>[] = [];
  for (let i = 0; i < INCLUDED.length; i += 2) {
    featureRows.push(new TableRow({ children: [INCLUDED[i], INCLUDED[i + 1]].map(([t, s]) =>
      cell([
        new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: t, bold: true, color: NAVY, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: s, color: SLATE, size: 20 })] }),
      ], 5112, { margins: { top: 80, bottom: 80, left: 0, right: 220 } })) }));
  }

  const itemHeader = new TableRow({ tableHeader: true, children: [
    cell([new Paragraph({ children: [new TextRun({ text: "ITEM", bold: true, color: SLATE, size: 17 })] })], 2200, { borders: { bottom: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } }),
    cell([new Paragraph({ children: [new TextRun({ text: "CONFIGURATION", bold: true, color: SLATE, size: 17 })] })], 6024, { borders: { bottom: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } }),
    cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "MONTHLY", bold: true, color: SLATE, size: 17 })] })], 2000, { borders: { bottom: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } }),
  ] });

  let monthly = 0;
  const itemRows: InstanceType<typeof TableRow>[] = [];
  for (const v of quote.servers) {
    const priced = priceServer(v, addons, keyed);
    monthly += priced.client;
    itemRows.push(new TableRow({ children: [
      cell([new Paragraph({ children: [body(v.name || "Server", { bold: true })] })], 2200),
      cell([new Paragraph({ children: [body(specOf(v), { color: SLATE })] })], 6024),
      cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [body(fmt(priced.client), { bold: true })] })], 2000),
    ] }));
  }
  const fw = firewallLine(quote.firewall, addons);
  monthly += fw.client;
  itemRows.push(new TableRow({ children: [
    cell([new Paragraph({ children: [body("Shared services", { bold: true })] })], 2200),
    cell([new Paragraph({ children: [body(fw.label, { color: SLATE })] })], 6024),
    cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [body(fmt(fw.client), { bold: true })] })], 2000),
  ] }));

  const totalRow = new TableRow({ children: [
    cell([new Paragraph({ children: [new TextRun({ text: "Monthly total", bold: true, color: NAVY, size: 26 })] })], 8224, { columnSpan: 2, borders: { top: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } }),
    cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(monthly), bold: true, color: CYAN, size: 30 })] })], 2000, { borders: { top: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } }),
  ] });
  const annualRow = new TableRow({ children: [
    cell([new Paragraph({ children: [new TextRun({ text: "Annual total (12 × monthly)", bold: true, color: SLATE, size: 20 })] })], 8224, { columnSpan: 2, borders: noBorders }),
    cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(monthly * 12), bold: true, color: SLATE, size: 22 })] })], 2000, { borders: noBorders }),
  ] });

  const services = [
    heading("What's included"),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, borders: noBorders, columnWidths: [5112, 5112], rows: featureRows }),
    heading("Private cloud base services", "Monthly"),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, borders: bottomOnly, columnWidths: [2200, 6024, 2000], rows: [itemHeader, ...itemRows, totalRow, annualRow] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // --- one-time / SLA / terms page --------------------------------------
  const otRow = (name: string, spec: string, price: string, top = false) => new TableRow({ children: [
    cell([new Paragraph({ children: [body(name, { bold: true })] })], 2600, top ? { borders: { top: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } } : {}),
    cell([new Paragraph({ children: [body(spec, { color: SLATE })] })], 5624, top ? { borders: { top: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } } : {}),
    cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [body(price, { bold: true, color: top ? CYAN : NAVY, size: top ? 26 : 22 })] })], 2000, top ? { borders: { top: { style: BorderStyle.SINGLE, size: 16, color: NAVY } } } : {}),
  ] });

  const slaHeader = new TableRow({ tableHeader: true, children:
    ["Priority", "Impact", "Response", "Resolution", "Support hours"].map((h, i) =>
      cell([new Paragraph({ children: [new TextRun({ text: h.toUpperCase(), bold: true, color: WHITE, size: 16 })] })],
        [1200, 3024, 1600, 2000, 2400][i], { shading: shade(NAVY), margins: { top: 80, bottom: 80, left: 90, right: 90 } })) });
  const slaRows = SLA.map((r, ri) => new TableRow({ children: r.map((c, ci) =>
    cell([new Paragraph({ children: [new TextRun({ text: c, bold: ci === 0, color: ci === 0 ? CYAN : NAVY, size: 20 })] })],
      [1200, 3024, 1600, 2000, 2400][ci], { shading: ri % 2 === 1 ? shade(MIST) : undefined, margins: { top: 70, bottom: 70, left: 90, right: 90 } })) }));

  const termsPage = [
    heading("One-time installation & setup"),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, borders: bottomOnly, columnWidths: [2600, 5624, 2000], rows: [
      otRow("Client setup", `VM, networking & configuration are ${customer} responsibilities`, fmt(0)),
      otRow("Admin setup fee", "Per new client — 1 hour @ $185.00/hour", fmt(185)),
      otRow("One-time charge", "", fmt(185), true),
    ] }),
    heading("Response & resolution times"),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, borders: { ...noBorders, insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: RULE } }, columnWidths: [1200, 3024, 1600, 2000, 2400], rows: [slaHeader, ...slaRows] }),
    heading("Support billing & terms"),
    new Paragraph({ spacing: { before: 40 }, children: [body(
      "Support is billed as actually used in 15-minute increments at $185.00/hour. This Service Proposal is subject to the Terms and Conditions of the attached Master Service Agreement. Pricing may increase by up to 5% annually with 90-day notice prior to the conclusion of each anniversary year.",
      { color: SLATE, size: 22 })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // --- agreement / signatures page --------------------------------------
  const legalPara = (lead: string, rest: string) => new Paragraph({ spacing: { after: 140 }, children: [
    new TextRun({ text: lead + " ", bold: true, color: NAVY, size: 21 }),
    new TextRun({ text: rest, color: "33445F", size: 21 }),
  ] });

  const sigLine = (label: string) => [
    new Paragraph({ spacing: { before: 240, after: 20 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY } }, children: [new TextRun({ text: " ", size: 18 })] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: label.toUpperCase(), color: SLATE, size: 15, bold: true })] }),
  ];

  const signature = new Table({ width: { size: TEXT_W, type: WidthType.DXA }, borders: noBorders, columnWidths: [5112, 5112], rows: [
    new TableRow({ children: [
      cell([
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "CLIENT", bold: true, color: CYAN, size: 18 })] }),
        ...sigLine("Legal name"), ...sigLine("Billing address"), ...sigLine("Billing contact"),
        ...sigLine("Invoicing email"), ...sigLine("Phone"), ...sigLine("Authorized signature"), ...sigLine("Printed name / title / date"),
      ], 5112, { margins: { top: 40, bottom: 40, left: 0, right: 300 }, verticalAlign: VerticalAlign.TOP }),
      cell([
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "ALERIFY", bold: true, color: CYAN, size: 18 })] }),
        ...sigLine("Authorized signature"), ...sigLine("Printed name / title / date"),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "This Service Proposal is subject to the attached Master Service Agreement. Amounts are in USD and exclude applicable taxes. Valid for 30 days from the date above.", color: SLATE, size: 17 })] }),
      ], 5112, { margins: { top: 40, bottom: 40, left: 300, right: 0 }, verticalAlign: VerticalAlign.TOP }),
    ] }),
  ] });

  const agreement = [
    heading("Agreement"),
    legalPara("Compensation.", "In consideration of the services to be performed by Provider, Client agrees to pay Provider at the rates set forth in this Service Proposal. Standard payment terms are net 30 days, and monthly invoices are sent for the upcoming month, prior to service delivery. Late payments incur finance charges of 1.5% of the unpaid monthly charges every 30 days; beyond 90 days, collection procedures begin and services will be interrupted. Credit-card payments incur an additional 4% processing fee; ACH is preferred."),
    legalPara("Client responsibility.", "Client is solely responsible for the configuration, management, security, and support of its own systems, applications, and data within the Provider environment. At Client's request, Provider may provide advisory, configuration, or troubleshooting assistance on a time-and-materials basis at $185.00/hour, billed in 15-minute increments. Such assistance does not transfer ownership or operational responsibility of the Client environment to the Provider."),
    legalPara("Authorization.", "The signer of this Service Plan represents that their signature legally binds the Client and that all actions have been taken to duly grant this authority, and by execution personally undertakes the full performance hereof, including payment of amounts due."),
    heading("Acceptance — pricing & 3-year term"),
    signature,
  ];

  // --- assemble ----------------------------------------------------------
  const footer = new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, shading: shade(CYAN),
    children: [new TextRun({ text: CONTACT, bold: true, color: WHITE, size: 17 })],
  })] });

  const header = new Header({ children: [new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: CYAN } },
    tabStops: [{ type: d.TabStopType.RIGHT, position: TEXT_W }],
    children: [
      new ImageRun({ type: "png", data: logo, transformation: { width: 66, height: 53 } }),
      new TextRun({ text: "\tVirtual Private Cloud Proposal · " + customer, color: SLATE, size: 18, bold: true }),
    ],
  })] });

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1008, right: 1008, header: 480, footer: 360 } },
        titlePage: true,
      },
      headers: { default: header, first: new Header({ children: [new Paragraph({ children: [] })] }) },
      footers: { default: footer, first: footer },
      children: [...cover, ...services, ...termsPage, ...agreement],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
