// Off-by-default feature flags. A flag is enabled per-browser by visiting the
// site with ?<name>=on (it persists in localStorage); ?<name>=off clears it.
// Nothing is shown to normal visitors until the default is flipped in code.
export function flagEnabled(name: string): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    if (v === "on") localStorage.setItem("flag:" + name, "1");
    else if (v === "off") localStorage.removeItem("flag:" + name);
    return localStorage.getItem("flag:" + name) === "1";
  } catch {
    return false;
  }
}
