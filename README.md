# Alerify Cloud Pricing Calculator

A lightweight, per-server cloud pricing calculator that runs entirely in the
browser and is hosted on **GitHub Pages** — no backend, no build step.

Build a quote by adding one card per server and filling in the required fields:

| Field | Notes |
| --- | --- |
| **Server name** | Free text label for the server |
| **Operating system** | Windows or Linux (drives compute price) |
| **SQL Standard required** | Licensed per 2-core pack, **4-core minimum** per SQL server |
| **vCPU / RAM** | Only valid pairings from the Alerify reference table are selectable |
| **EBS storage** | Billed per GB / month |
| **Elastic IPs** | Billed per IP / month |
| **Firewall** | Standard (included) or Advanced |
| **RDS CALs** | Billed per CAL / month |

The app shows a live per-server breakdown plus a rolled-up **monthly** and
**annual** quote total. Flip on **Internal view** to also see Alerify's cost,
profit and margin for each line. Quotes are auto-saved in the browser
(`localStorage`) and can be exported with **Print / PDF**.

## Pricing data

All rates come from `Alerify_Pricing_Sheet.xlsx` and are baked into
[`data.js`](./data.js):

- **Compute** — 147 valid vCPU/RAM pairings (Z2 / Z4 / Z8 / Z16 families).
  Monthly price = hourly list rate × 744 hours, per the source sheet.
- **Add-ons** — EBS ($0.16/GB), Elastic IP ($4/ea), Advanced firewall
  ($380.45), SQL Standard ($528.50 per 2-core pack), RDS CAL ($11.69/ea).

To update pricing, click **Edit pricing** in the header to open the inline
catalog editor. You can:

- Edit **add-on & service** costs and client prices (EBS, Elastic IP, firewalls,
  SQL, RDS CAL).
- Edit the **cloud comparison rates** (AWS/Azure per-vCPU, per-GB, storage, IP,
  SQL, egress) and the global hours/avg-egress assumptions.
- Edit the **compute catalog** — every vCPU/RAM instance's name, spec, and
  Linux/Windows price & cost — and **+ Add instance** / remove rows.

Edits apply to the calculator live and are saved on that device (localStorage),
so they don't change the site for other users. Then:

- **Export data.js** downloads a `data.js` reflecting your edits — commit it over
  the existing `data.js` and push to make the change the built-in default for
  everyone.
- **Reset to defaults** restores the built-in pricing.
- **Import .xlsx** pulls rates from an `Alerify_Pricing_Sheet.xlsx` (parsed in the
  browser via the bundled `vendor/xlsx.full.min.js`) as a starting point you can
  then fine-tune. Keep the sheet's tab/column layout and save from
  Excel/Google Sheets/LibreOffice so formula values are stored.

## Deploying to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
publishes the site on every push to `main`.

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site publishes to
   `https://<your-user>.github.io/alerify_calc/`.

## Local preview

It's plain static files — just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

```
index.html   markup + server card template
styles.css   styling (light theme, responsive, print-friendly)
app.js       calculator logic, persistence, rendering
data.js      pricing data extracted from the Alerify sheet
```

> Estimates only. Figures are monthly USD and exclude taxes and any custom
> engagement terms.
