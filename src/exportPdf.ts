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
