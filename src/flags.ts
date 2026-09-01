// Feature flags with a code-controlled default. A visitor can override per-browser
// by visiting the site with ?<name>=on or ?<name>=off (the choice persists in
// localStorage); with no override the `def` default applies.
export function flagEnabled(name: string, def = false): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    if (v === "on") localStorage.setItem("flag:" + name, "1");
    else if (v === "off") localStorage.setItem("flag:" + name, "0");
    const stored = localStorage.getItem("flag:" + name);
    if (stored === "1") return true;
    if (stored === "0") return false;
    return def;
  } catch {
    return def;
  }
}
