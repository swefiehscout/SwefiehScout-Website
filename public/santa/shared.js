// Helpers used by the public pages and the admin dashboard.
(function () {
  const cfg = window.SANTA_CONFIG;
  // Run on sample data in this browser (demo.js) until real Supabase keys are in config.js,
  // or when an owner presses "Demo mode" on the admin page (for presentations; real data is never touched).
  let asked = false;
  try { asked = /\/admin(\.html|\/)?$/.test(location.pathname) && sessionStorage.getItem("santa-demo") === "1"; } catch (e) {}
  const demo = (/YOUR-PROJECT/.test(cfg.SUPABASE_URL) || asked) && window.SantaDemo;
  const sb = demo ? window.SantaDemo.createClient() : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  if (demo) addEventListener("DOMContentLoaded", () => {
    const tag = document.createElement("div");
    tag.textContent = "Demo preview · sample data";
    tag.style.cssText = "position:fixed;top:10px;right:10px;z-index:99;opacity:.85;background:#c9a24e;color:#1f0508;font:600 12px system-ui;padding:4px 10px;border-radius:999px;pointer-events:none";
    document.body.appendChild(tag);
  });

  // "15:30" -> minutes since midnight
  function toMin(hhmm) {
    const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }
  // minutes -> "15:30"
  function fromMin(min) {
    const h = Math.floor(min / 60) % 24, m = min % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }
  // "15:30" -> "3:30 PM"
  function clock(hhmm) {
    const min = toMin(hhmm);
    const h = Math.floor(min / 60) % 24;
    return `${h % 12 || 12}:${String(min % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }
  // "15:30", 30 -> "3:30 – 4:00 PM"
  function slotLabel(hhmm, slotMinutes) {
    const a = clock(hhmm), b = clock(fromMin(toMin(hhmm) + slotMinutes));
    const [aT, aS] = a.split(" "), [bT, bS] = b.split(" ");
    return aS === bS ? `${aT} – ${bT} ${bS}` : `${a} – ${b}`;
  }
  // Jordanian mobile -> "0791234567"; null if invalid
  function normPhone(raw) {
    let d = String(raw || "").replace(/[^\d+]/g, "");
    d = d.replace(/^00962/, "0").replace(/^\+?962/, "0");
    if (/^7[789]\d{7}$/.test(d)) d = "0" + d;
    return /^07[789]\d{7}$/.test(d) ? d : null;
  }
  // "0791234567" -> "962791234567" for wa.me links
  function waNumber(phone) {
    const p = normPhone(phone);
    return p ? "962" + p.slice(1) : "";
  }
  function km(lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null;
    const r = (x) => (x * Math.PI) / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
      Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // Opens the pin in Google Maps (falls back to the family's own link).
  function mapsUrl(b) {
    if (b.lat != null && b.lng != null) return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
    return safeLink(b.maps_link);
  }
  // Starts Google Maps driving directions to the pin.
  function navUrl(b) {
    if (b.lat != null && b.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=driving`;
    return safeLink(b.maps_link);
  }
  // Only ever link to web addresses (never "javascript:" and the like).
  const safeLink = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");

  // ================= Map pin =================

  // Pull coordinates out of a Google Maps link (or plain "31.95, 35.86"). Short links can't be read.
  function parseMapsLink(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
    for (const re of pats) {
      const m = t.match(re);
      if (m) {
        const lat = Number(m[1]), lng = Number(m[2]);
        if (lat > 29 && lat < 33.5 && lng > 34.8 && lng < 39.5) return { lat, lng };
      }
    }
    return null;
  }
  const isShortMapsLink = (t) => /goo\.gl|maps\.app/i.test(String(t || ""));

  // A Leaflet map where you tap to drop (and drag to adjust) one pin.
  function pinPicker(el, opts = {}) {
    const map = L.map(el, { scrollWheelZoom: false }).setView(opts.center || [31.965, 35.88], opts.zoom || 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    let marker = null, pos = null;
    function set(lat, lng, pan) {
      pos = { lat: +Number(lat).toFixed(6), lng: +Number(lng).toFixed(6) };
      if (!marker) {
        marker = L.marker([pos.lat, pos.lng], { draggable: true }).addTo(map);
        marker.on("dragend", () => { const p = marker.getLatLng(); set(p.lat, p.lng); });
      } else marker.setLatLng([pos.lat, pos.lng]);
      if (pan) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 16));
      el.classList.remove("invalid");
      opts.onChange && opts.onChange(pos);
    }
    map.on("click", (e) => set(e.latlng.lat, e.latlng.lng));
    if (opts.lat != null && opts.lng != null) set(opts.lat, opts.lng, true);
    setTimeout(() => map.invalidateSize(), 80);
    return { map, set, get: () => pos, view: (lat, lng, z) => map.setView([lat, lng], z || 15) };
  }

  // ================= Public page footer =================

  const FLOURISH = `<svg viewBox="0 0 220 18" aria-hidden="true"><defs>
    <linearGradient id="fl-l" x1="0" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset="1" stop-color="currentColor"/></linearGradient>
    <linearGradient id="fl-r" x1="1" x2="0"><stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
    <rect x="0" y="8.5" width="86" height="1" fill="url(#fl-l)"/><rect x="134" y="8.5" width="86" height="1" fill="url(#fl-r)"/>
    <circle cx="93" cy="9" r="1.6" fill="currentColor"/><circle cx="127" cy="9" r="1.6" fill="currentColor"/>
    <path d="M101 9 L105 5 L109 9 L105 13Z M111 9 L115 5 L119 9 L115 13Z" fill="none" stroke="currentColor" stroke-width="1"/>
    <path d="M110 1.5 L112 7 L117.5 9 L112 11 L110 16.5 L108 11 L102.5 9 L108 7Z" fill="currentColor"/></svg>`;

  function footer() {
    return `<span class="flourish">${FLOURISH}</span>
      <span class="org">${esc(cfg.ORG_NAME_EN)}</span>
      <small>Spreading Christmas joy across Amman since 2008</small>
      <a class="team" href="admin.html">Team sign in</a>`;
  }

  // Fills the footer on a public page.
  function page() {
    const f = document.querySelector(".foot");
    if (f) f.innerHTML = footer();
  }

  // The public settings, fetched once per page and shared (home uses them in three places).
  let configReq = null;
  const publicConfig = () => configReq || (configReq = sb.rpc("public_config"));

  window.Santa = { cfg, sb, demo: !!demo, publicConfig, toMin, fromMin, clock, slotLabel, normPhone, waNumber, km, esc, mapsUrl, navUrl, page, parseMapsLink, isShortMapsLink, pinPicker };
})();
