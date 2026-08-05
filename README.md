# Alerify Cloud Pricing Calculator

A per-server cloud pricing calculator for Alerify quotes, built with **React +
TypeScript + Vite** and deployed to **GitHub Pages**.

Build a quote by adding one card per server and filling in the required fields:

| Field | Notes |
| --- | --- |
| **Server name** | Free text label for the server |
| **Operating system** | Windows or Linux (drives compute price) |
| **SQL Standard required** | Licensed per 2-core pack, **4-core minimum** per SQL server |
| **vCPU / RAM** | Only valid pairings from the Alerify reference table are selectable |
| **EBS storage** | Billed per GB / month |
| **Elastic IPs** | Billed per IP / month |
| **RDS CALs** | Billed per CAL / month |

Firewall is a **shared environment service** (Standard included / Advanced),
applied once to the whole quote rather than per server.

Features: live per-server breakdown, monthly + annual totals, an **Internal
view** toggle (cost / profit / margin), a **Cloud comparison** toggle
(estimated AWS/Azure for the comparable stack), a professional client-facing
**PDF quote** (Export quote → print), and an inline **pricing editor**. State is
auto-saved in the browser (localStorage).

## Editing pricing

Click **Edit pricing** in the header to open the inline editor:

- **Add-ons & services** — cost + client price per item.
- **Cloud comparison rates** — AWS/Azure per-vCPU/GB/storage/IP/SQL/egress plus
  global hours and avg-egress assumptions.
- **Compute catalog** — every vCPU/RAM instance (name, spec, Linux/Windows price
  & cost), with add/remove rows. The Z-family is derived from the RAM/vCPU ratio.

Edits apply live and are saved on that device (localStorage) only. Then:

- **Export data.ts** downloads a `src/data.ts` reflecting your edits — commit it
  over the existing file to make it the built-in default for everyone.
- **Reset to defaults** restores the built-in pricing.
- **Import .xlsx** pulls rates from an `Alerify_Pricing_Sheet.xlsx` (parsed in the
  browser) as a starting point. Save the sheet from Excel/Google Sheets/LibreOffice
  so formula values are stored, and keep the tab/column layout unchanged.

## Development

```bash
npm install
npm run dev       # start the Vite dev server (hot reload)
npm run build     # type-check (tsc -b) + production build to dist/
npm run preview   # serve the production build locally
```

Requires Node 18+.

## Deploying to GitHub Pages

The workflow at `.github/workflows/deploy.yml` builds with Vite and publishes
`dist/` on every push to `main`.

1. In **Settings → Pages**, set **Source** to **GitHub Actions** (one time).
2. Push to `main`. The site publishes to
   `https://<your-user>.github.io/alerify_calc/`.

The Vite `base` is set to `/alerify_calc/` in `vite.config.ts` to match that
path — change it if you rename the repo or use a custom domain.

## Project layout

```
index.html            Vite entry (mounts #root)
vite.config.ts        base path + React plugin
src/
  main.tsx            React entry
  App.tsx             app shell, state, totals, persistence
  ServerCard.tsx      one server: inputs, breakdown, cloud comparison
  Editor.tsx          inline pricing editor
  QuoteDoc.tsx        client-facing quote (print / PDF)
  pricing.ts          pure pricing + comparison functions
  importXlsx.ts       in-browser .xlsx parser (lazy-loads the xlsx lib)
  storage.ts          localStorage load/save + defaults
  data.ts             built-in default pricing (generated from the sheet)
  types.ts            shared types
  styles.css          styling (responsive, print-friendly)
```

> Estimates only. Figures are monthly USD and exclude taxes and custom terms.
