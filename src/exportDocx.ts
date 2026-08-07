// Fill the Alerify "Virtual Private Cloud Proposal" Word template with the
// current quote and download it as a .docx. We edit the real template in the
// browser (unzip → replace placeholders in word/document.xml → re-zip) so all
// of its branding, legal text, SLA table and signature blocks are preserved
// exactly — we only fill {CLIENT NAME}, {DATE OF PROPOSAL} and the line items.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Addons, Instance, Quote } from "./types";
import { firewallLine, fmt, priceServer } from "./pricing";
import { renderProposalPageImages } from "./exportPdf";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// US-Letter page in EMU (1 inch = 914400 EMU).
const PAGE_CX = 7772400; // 8.5in
const PAGE_CY = 10058400; // 11in
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

// One full-bleed, page-anchored image behind an (otherwise empty) paragraph.
function pageImageParagraph(index: number, isFirst: boolean): string {
  const n = index + 1;
  const brk = isFirst ? "" : "<w:pageBreakBefore/>";
  return (
    "<w:p><w:pPr>" + brk + '<w:spacing w:before="0" w:after="0" w:line="0" w:lineRule="auto"/>' +
    '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>' +
    "<w:r><w:rPr><w:noProof/><w:sz w:val=\"2\"/></w:rPr><w:drawing>" +
    '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0"' +
    ' behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">' +
    '<wp:simplePos x="0" y="0"/>' +
    '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
    '<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>' +
    `<wp:extent cx="${PAGE_CX}" cy="${PAGE_CY}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>' +
    `<wp:docPr id="${n}" name="Page ${n}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
    `<pic:nvPicPr><pic:cNvPr id="${n}" name="Page ${n}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rId${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${PAGE_CX}" cy="${PAGE_CY}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    "</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>"
  );
}

/**
 * Build a Word document whose pages are the branded proposal images (the styled
 * design), one full-bleed image per page, and download it. Visually identical to
 * the styled PDF; the app has already filled client, date and line items.
 */
export async function downloadProposalDocx(sourceId: string, filename: string): Promise<void> {
  const pages = await renderProposalPageImages(sourceId);

  const body =
    pages.map((_, i) => pageImageParagraph(i, i === 0)).join("") +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    "<w:body>" + body + "</w:body></w:document>";

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    pages
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.jpg"/>`
      )
      .join("") +
    "</Relationships>";

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "word/document.xml": strToU8(documentXml),
    "word/_rels/document.xml.rels": strToU8(docRels),
  };
  pages.forEach((p, i) => {
    files[`word/media/image${i + 1}.jpg`] = p.bytes;
  });

  triggerDownload(zipSync(files, { level: 6 }), filename);
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
