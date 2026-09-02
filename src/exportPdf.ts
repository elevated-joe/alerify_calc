// Client-side PDF export. Instead of relying on window.print() — which iOS/Brave
// render inconsistently (forced page size, stray margins, wrong doc) — we rasterize
// the branded sheet with html2canvas and package it as a Letter-size PDF the browser
// downloads directly. Identical output on desktop and mobile, no print dialog.

// Letter page in CSS pixels at 96dpi.
const PAGE_W = 816; // 8.5in
const PAGE_H = 1056; // 11in

// Lazy-loaded so the ~500 KB of libs never touch the initial bundle.
async function libs() {
  const [h2c, jspdf] = await Promise.all([import("html2canvas"), import("jspdf")]);
  return { html2canvas: h2c.default, jsPDF: jspdf.jsPDF };
}

// Rasterize one element to a JPEG data URL at a printed-page width, with the
// footer pinned to the bottom of a full page (flex + min-height).
async function renderPageImage(
  html2canvas: (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>,
  el: HTMLElement
): Promise<{ img: string; imgH: number }> {
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    `position:fixed; left:-10000px; top:0; width:${PAGE_W}px; background:#fff; z-index:-1; pointer-events:none;`;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = "none";
  clone.style.width = PAGE_W + "px";
  clone.style.margin = "0";
  clone.style.minHeight = PAGE_H + "px";
  clone.style.display = "flex";
  clone.style.flexDirection = "column";
  const footer = clone.querySelector(".c-footer") as HTMLElement | null;
  if (footer) footer.style.marginTop = "auto";
  holder.appendChild(clone);
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: PAGE_W,
      width: PAGE_W,
      height: clone.offsetHeight,
    });
    return { img: canvas.toDataURL("image/jpeg", 0.95), imgH: (canvas.height * PAGE_W) / canvas.width };
  } finally {
    document.body.removeChild(holder);
  }
}

// JPEG bytes + pixel size for each `.proposal-page`, for embedding elsewhere (Word).
export async function renderProposalPageImages(
  sourceId: string
): Promise<{ bytes: Uint8Array; w: number; h: number }[]> {
  const source = document.getElementById(sourceId);
  const pages = source ? Array.from(source.querySelectorAll<HTMLElement>(".proposal-page")) : [];
  if (!pages.length) throw new Error("Nothing to export yet.");
  const { html2canvas } = await libs();
  const out: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (const page of pages) {
    const { img } = await renderPageImage(html2canvas, page);
    const base64 = img.slice(img.indexOf(",") + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    out.push({ bytes, w: PAGE_W, h: PAGE_H });
  }
  return out;
}

type H2C = (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pdf = any;

// Render a `.proposal-flow` element across as many pages as it needs, choosing
// page breaks at section boundaries so a table is never split across pages
// (a single section taller than a page is the only thing that gets split). The
// cyan footer is stamped at the bottom of every page.
async function drawFlow(html2canvas: H2C, pdf: Pdf, el: HTMLElement, started: boolean): Promise<boolean> {
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = `position:fixed; left:-10000px; top:0; width:${PAGE_W}px; background:#fff; z-index:-1; pointer-events:none;`;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = "none";
  clone.style.width = PAGE_W + "px";
  clone.style.margin = "0";
  clone.style.display = "block";

  // Detach the footer and render it on its own so it can be stamped per page.
  const footerEl = clone.querySelector<HTMLElement>(".c-footer");
  if (footerEl) footerEl.remove();
  holder.appendChild(clone);
  document.body.appendChild(holder);

  let footerImg: string | null = null;
  let footerH = 0;
  if (footerEl) {
    const fh = document.createElement("div");
    fh.style.cssText = holder.style.cssText;
    footerEl.style.width = PAGE_W + "px";
    fh.appendChild(footerEl);
    document.body.appendChild(fh);
    footerH = footerEl.offsetHeight;
    const fc = await html2canvas(footerEl, { scale: 2, backgroundColor: "#ffffff", windowWidth: PAGE_W, width: PAGE_W, height: footerH });
    footerImg = fc.toDataURL("image/jpeg", 0.95);
    document.body.removeChild(fh);
  }
  const usableH = PAGE_H - footerH;

  try {
    // Flowable blocks: the brand bar plus each body section (kept whole).
    const blocks: HTMLElement[] = [];
    const bar = clone.querySelector<HTMLElement>(".pr-bar");
    if (bar) blocks.push(bar);
    const body = clone.querySelector<HTMLElement>(".pr-body");
    if (body) blocks.push(...(Array.from(body.children) as HTMLElement[]));
    const base = clone.getBoundingClientRect();
    const measured = blocks.map((b) => {
      const r = b.getBoundingClientRect();
      return { top: r.top - base.top, height: r.height };
    });
    const contentEnd = measured.length ? measured[measured.length - 1].top + measured[measured.length - 1].height : clone.offsetHeight;

    // Greedily pack whole blocks into pages of at most usableH.
    const pages: { start: number; end: number }[] = [];
    let start = 0;
    let i = 0;
    while (i < measured.length) {
      let j = i;
      while (j < measured.length && measured[j].top + measured[j].height - start <= usableH) j++;
      if (j === i) {
        // Block taller than a page — split it.
        pages.push({ start, end: start + usableH });
        start += usableH;
        if (measured[i].top + measured[i].height <= start) i++;
        continue;
      }
      const nextStart = j < measured.length ? Math.min(measured[j].top, start + usableH) : contentEnd;
      pages.push({ start, end: nextStart });
      start = nextStart;
      i = j;
    }
    if (!pages.length) pages.push({ start: 0, end: Math.min(contentEnd, usableH) });
    if (pages[pages.length - 1].end < contentEnd) pages[pages.length - 1].end = Math.min(contentEnd, pages[pages.length - 1].start + usableH);

    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", windowWidth: PAGE_W, width: PAGE_W, height: clone.offsetHeight });
    const sc = canvas.width / PAGE_W;
    for (const pg of pages) {
      const segH = Math.max(1, pg.end - pg.start);
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = Math.round(segH * sc);
      const ctx = tmp.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(canvas, 0, Math.round(pg.start * sc), canvas.width, tmp.height, 0, 0, canvas.width, tmp.height);
      if (started) pdf.addPage([PAGE_W, PAGE_H], "portrait");
      pdf.addImage(tmp.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, PAGE_W, segH);
      if (footerImg) pdf.addImage(footerImg, "JPEG", 0, PAGE_H - footerH, PAGE_W, footerH);
      started = true;
    }
  } finally {
    document.body.removeChild(holder);
  }
  return started;
}

/**
 * Export the proposal. `.proposal-page` children render one PDF page each (the
 * cover); a `.proposal-flow` child flows across pages, breaking only at section
 * boundaries so tables stay together.
 */
export async function downloadProposalPdf(sourceId: string, filename: string): Promise<void> {
  const source = document.getElementById(sourceId);
  const blocks = source
    ? Array.from(source.querySelectorAll<HTMLElement>(":scope > .proposal-page, :scope > .proposal-flow"))
    : [];
  if (!blocks.length) throw new Error("Nothing to export yet.");
  const { html2canvas, jsPDF } = await libs();
  const pdf = new jsPDF({ unit: "px", format: [PAGE_W, PAGE_H], orientation: "portrait" });
  let started = false;
  for (const el of blocks) {
    if (el.classList.contains("proposal-flow")) {
      started = await drawFlow(html2canvas, pdf, el, started);
    } else {
      const { img, imgH } = await renderPageImage(html2canvas, el);
      if (started) pdf.addPage([PAGE_W, PAGE_H], "portrait");
      if (imgH <= PAGE_H + 1) pdf.addImage(img, "JPEG", 0, 0, PAGE_W, imgH);
      else pdf.addImage(img, "JPEG", 0, 0, (PAGE_H * PAGE_W) / imgH, PAGE_H);
      started = true;
    }
  }
  pdf.save(filename);
}

/**
 * Render the `.csheet` inside `sourceId` (#quoteDoc or #compareDoc) to a Letter PDF
 * and trigger a download named `filename`.
 */
export async function downloadSheetPdf(sourceId: string, filename: string): Promise<void> {
  const source = document.getElementById(sourceId);
  const sheet = source?.querySelector(".csheet") as HTMLElement | null;
  if (!sheet) throw new Error("Nothing to export yet.");

  const { html2canvas, jsPDF } = await libs();

  // Clone the sheet into an off-screen holder sized to a printed page. The live
  // node is display:none, so we render the clone instead. min-height + flex
  // reproduces the "footer pinned to the bottom" behaviour from the print CSS.
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    `position:fixed; left:-10000px; top:0; width:${PAGE_W}px; background:#fff; z-index:-1; pointer-events:none;`;

  const clone = sheet.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = "none";
  clone.style.width = PAGE_W + "px";
  clone.style.margin = "0";
  clone.style.minHeight = PAGE_H + "px";
  clone.style.display = "flex";
  clone.style.flexDirection = "column";
  const footer = clone.querySelector(".c-footer") as HTMLElement | null;
  if (footer) footer.style.marginTop = "auto";

  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: PAGE_W,
      width: PAGE_W,
      height: clone.offsetHeight,
    });

    const pdf = new jsPDF({ unit: "px", format: [PAGE_W, PAGE_H], orientation: "portrait" });
    const imgH = (canvas.height * PAGE_W) / canvas.width; // image height scaled to page width
    // JPEG keeps the file small enough to email — the sheet is mostly flat white
    // and solid brand colour, so 0.95 quality is visually lossless at 2× scale.
    const img = canvas.toDataURL("image/jpeg", 0.95);

    if (imgH <= PAGE_H + 1) {
      pdf.addImage(img, "JPEG", 0, 0, PAGE_W, imgH);
    } else {
      // Content taller than one page: place the same tall image on successive
      // pages, shifted up by one page each time.
      let offset = 0;
      let page = 0;
      while (offset < imgH - 1) {
        if (page > 0) pdf.addPage([PAGE_W, PAGE_H], "portrait");
        pdf.addImage(img, "JPEG", 0, -offset, PAGE_W, imgH);
        offset += PAGE_H;
        page += 1;
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(holder);
  }
}
