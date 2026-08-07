// Fill the Alerify "Virtual Private Cloud Proposal" Word template with the
// current quote and download it as a .docx. We edit the real template in the
// browser (unzip → replace placeholders in word/document.xml → re-zip) so all
// of its branding, legal text, SLA table and signature blocks are preserved
// exactly — we only fill {CLIENT NAME}, {DATE OF PROPOSAL} and the line items.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Addons, Instance, Quote } from "./types";
import { firewallLine, fmt, priceServer } from "./pricing";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// Right edge of the text column (page 12240 − left 560 − right 760 dxa).
const RIGHT_TAB = 10780;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const sz22 = '<w:sz w:val="22"/><w:szCs w:val="22"/>';

// One priced line: bold name, plain spec, dot-leader tab to a right-aligned price.
function itemPara(name: string, spec: string, price: string): string {
  return (
    '<w:p><w:pPr><w:pStyle w:val="BodyText"/>' +
    `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${RIGHT_TAB}"/></w:tabs>` +
    '<w:spacing w:before="60"/>' +
    `<w:rPr><w:bCs/>${sz22}</w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/>${sz22}</w:rPr><w:t xml:space="preserve">${esc(name)}</w:t></w:r>` +
    (spec
      ? `<w:r><w:rPr><w:bCs/>${sz22}</w:rPr><w:t xml:space="preserve"> — ${esc(spec)}</w:t></w:r>`
      : "") +
    `<w:r><w:rPr><w:bCs/>${sz22}</w:rPr><w:tab/><w:t xml:space="preserve">${esc(price)}</w:t></w:r>` +
    "</w:p>"
  );
}

// Bold total line with a rule above it.
function totalPara(label: string, price: string): string {
  return (
    '<w:p><w:pPr><w:pStyle w:val="BodyText"/>' +
    '<w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="001F5F"/></w:pBdr>' +
    `<w:tabs><w:tab w:val="right" w:pos="${RIGHT_TAB}"/></w:tabs>` +
    '<w:spacing w:before="160"/>' +
    `<w:rPr><w:b/>${sz22}</w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/>${sz22}</w:rPr><w:t xml:space="preserve">${esc(label)}</w:t></w:r>` +
    `<w:r><w:rPr><w:b/><w:color w:val="001F5F"/>${sz22}</w:rPr><w:tab/><w:t xml:space="preserve">${esc(price)}</w:t></w:r>` +
    "</w:p>"
  );
}

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

// Build the paragraphs that replace the {INSERT LINE ITEMS} placeholder paragraph.
export function lineItemsXml(quote: Quote, addons: Addons, keyed: Map<string, Instance>): string {
  let monthly = 0;
  const parts: string[] = [];
  for (const v of quote.servers) {
    const priced = priceServer(v, addons, keyed);
    monthly += priced.client;
    parts.push(itemPara(v.name || "Server", specOf(v), fmt(priced.client)));
  }
  const fw = firewallLine(quote.firewall, addons);
  monthly += fw.client;
  parts.push(itemPara("Shared services", fw.label, fmt(fw.client)));
  parts.push(totalPara("Monthly Total", fmt(monthly)));
  return parts.join("");
}

// Replace the whole <w:p>…</w:p> that contains `marker` with `replacement`.
function replaceParagraph(xml: string, marker: string, replacement: string): string {
  const at = xml.indexOf(marker);
  if (at < 0) return xml;
  const start = xml.lastIndexOf("<w:p ", at);
  const end = xml.indexOf("</w:p>", at);
  if (start < 0 || end < 0) return xml;
  return xml.slice(0, start) + replacement + xml.slice(end + "</w:p>".length);
}

export function fillTemplate(
  bytes: Uint8Array,
  customer: string,
  dateStr: string,
  itemsXml: string
): Uint8Array {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("Template is missing word/document.xml.");
  let xml = strFromU8(doc);
  xml = xml.split("{CLIENT NAME}").join(esc(customer));
  xml = xml.split("{DATE OF PROPOSAL}").join(esc(dateStr));
  xml = replaceParagraph(xml, "{INSERT LINE ITEMS}", itemsXml);
  files["word/document.xml"] = strToU8(xml);
  return zipSync(files, { level: 6 });
}

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Build the proposal .docx from the current quote and download it. */
export async function downloadQuoteDocx(
  quote: Quote,
  addons: Addons,
  keyed: Map<string, Instance>,
  filename: string
): Promise<void> {
  const res = await fetch(import.meta.env.BASE_URL + "quote-template.docx");
  if (!res.ok) throw new Error("Could not load the proposal template.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  const customer = quote.quoteName.trim() || "Client";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const itemsXml = lineItemsXml(quote, addons, keyed);
  const filled = fillTemplate(bytes, customer, dateStr, itemsXml);
  triggerDownload(filled, filename);
}
