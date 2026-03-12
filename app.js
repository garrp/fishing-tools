// ============================
// app.js (PART 1 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.5
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
//
// NOTES (v1.2.5):
// - Consolidated full app into 4 parts.
// - Keeps Home, Trolling Depth Calculator, Species Tips, and Speedometer.
// - Depth calculator keeps optional lure adjustment.
// - Species Tips upgraded to the expanded encyclopedia-style version.
// - Photo remains optional and displays last.
// ============================

"use strict";

const APP_VERSION = "1.2.5";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";
const LOGO_LINK = "https://fishynw.com";

// ----------------------------
// Analytics consent (GA4)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const CONSENT_KEY = "fishynw_ga_consent_v1_2_5"; // "granted" | "denied"
let gaLoaded = false;

function getConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) || "";
  } catch (e) {
    return "";
  }
}

function setConsent(val) {
  try {
    localStorage.setItem(CONSENT_KEY, val);
  } catch (e) {
    // ignore
  }
}

function loadGa4() {
  if (gaLoaded) return;
  gaLoaded = true;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  const s = document.createElement("script");
  s.async = true;
  s.src =
    "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
  document.head.appendChild(s);

  gtag("js", new Date());
  gtag("config", GA4_ID);
}

function removeConsentBanner() {
  const el = document.getElementById("consent_bar");
  if (el && el.parentNode) el.parentNode.removeChild(el);
  try {
    document.body.style.paddingBottom = "";
  } catch (e) {
    // ignore
  }
}

function renderConsentBannerIfNeeded() {
  const consent = getConsent();

  if (consent === "granted") {
    loadGa4();
    return;
  }
  if (consent === "denied") return;

  if (document.getElementById("consent_bar")) return;

  try {
    document.body.style.paddingBottom = "120px";
  } catch (e) {
    // ignore
  }

  const bar = document.createElement("div");
  bar.id = "consent_bar";
  bar.className = "consentBar";
  bar.innerHTML =
    '<div class="consentInner">' +
    '  <div class="consentText">' +
    "    <strong>Cookies / analytics</strong><br>" +
    "    FishyNW uses analytics to understand app usage and improve features. You can accept or decline." +
    "  </div>" +
    '  <div class="consentBtns">' +
    '    <button id="consent_decline" class="consentBtn consentDecline" type="button">Decline</button>' +
    '    <button id="consent_accept" class="consentBtn" type="button">Accept</button>' +
    "  </div>" +
    "</div>";

  document.body.appendChild(bar);

  document
    .getElementById("consent_accept")
    .addEventListener("click", function () {
      setConsent("granted");
      removeConsentBanner();
      loadGa4();
    });

  document
    .getElementById("consent_decline")
    .addEventListener("click", function () {
      setConsent("denied");
      removeConsentBanner();
    });
}

// ----------------------------
// Safety disclaimer modal
// ----------------------------
const DISCLAIMER_ACK_KEY = "fishynw_disclaimer_ack_v1_2_5";
const DISCLAIMER_SESSION_KEY = "fishynw_disclaimer_session_v1_2_5";

function getLocal(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (e) {
    return "";
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch (e) {
    // ignore
  }
}

function getSession(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch (e) {
    return "";
  }
}

function setSession(key, val) {
  try {
    sessionStorage.setItem(key, val);
  } catch (e) {
    // ignore
  }
}

function removeDisclaimerModal() {
  const el = document.getElementById("disclaimer_overlay");
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function openDisclaimerModal(force) {
  if (!force && getLocal(DISCLAIMER_ACK_KEY) === "ack") return;
  if (!force && getSession(DISCLAIMER_SESSION_KEY) === "shown") return;
  if (document.getElementById("disclaimer_overlay")) return;

  if (!force) setSession(DISCLAIMER_SESSION_KEY, "shown");

  const overlay = document.createElement("div");
  overlay.id = "disclaimer_overlay";
  overlay.className = "modalOverlay";

  overlay.innerHTML =
    '<div class="modalCard" role="dialog" aria-modal="true" aria-label="Safety disclaimer">' +
    '  <div class="modalHead">Safety disclaimer</div>' +
    '  <div class="modalBody">' +
    "    <p>This tool is for general planning only. Forecasts can be wrong and conditions can change fast.</p>" +
    "    <p>You are responsible for your own decisions. Use your own judgment before going out, and prioritize safety.</p>" +
    "    <p>If conditions feel off, do not go. If you go, stay conservative and keep a safe return route.</p>" +
    "  </div>" +
    '  <div class="modalFoot">' +
    '    <div class="modalRow">' +
    '      <label class="modalCheck"><input id="disc_never" type="checkbox"> Do not show this again</label>' +
    "    </div>" +
    '    <div class="modalBtnRow">' +
    '      <button id="disc_ok" type="button">I understand</button>' +
    "    </div>" +
    '    <div class="small muted" style="margin-top:8px;">Not medical, legal, or safety advice. Always follow local regulations and wear appropriate safety gear.</div>' +
    "  </div>" +
    "</div>";

  document.body.appendChild(overlay);

  document.getElementById("disc_ok").addEventListener("click", function () {
    const never = document.getElementById("disc_never");
    if (never && never.checked) setLocal(DISCLAIMER_ACK_KEY, "ack");
    removeDisclaimerModal();
  });

  overlay.addEventListener("click", function (e) {
    if (e && e.target === overlay) removeDisclaimerModal();
  });
}

// ----------------------------
// Persisted last location
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v2";

function saveLastLocation(lat, lon, label) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const payload = {
      lat: Number(lat),
      lon: Number(lon),
      label: String(label || "")
    };
    localStorage.setItem(LAST_LOC_KEY, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
}

function loadLastLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOC_KEY);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    if (!obj) return null;

    const lat = Number(obj.lat);
    const lon = Number(obj.lon);
    const label = String(obj.label || "");

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat: lat, lon: lon, label: label };
  } catch (e) {
    return null;
  }
}

function clearLastLocation() {
  try {
    localStorage.removeItem(LAST_LOC_KEY);
  } catch (e) {
    // ignore
  }
}

// ----------------------------
// Shared state
// ----------------------------
const state = {
  tool: "Home",
  lat: null,
  lon: null,
  placeLabel: "",
  matches: [],
  selectedIndex: 0,
  speedWatchId: null,
  dateIso: "",
  waterType: "Small / protected",
  craft: "Kayak (paddle)"
};

// ----------------------------
// DOM
// ----------------------------
let app = null;

// ----------------------------
// Optional trolling lure profiles
// - depthBiasFt is added after the base estimate
// - positive means deeper
// - negative means shallower
// ----------------------------
const TROLLING_LURES = [
  {
    value: "",
    label: "No lure selected",
    depthBiasFt: 0,
    note: "Depth is based on weight, line, and speed only."
  },
  {
    value: "wedding_ring",
    label: "Wedding Ring spinner",
    depthBiasFt: -1.0,
    note: "Light drag. Often runs a little shallower."
  },
  {
    value: "hoochie_small",
    label: "Small hoochie / squid",
    depthBiasFt: -1.5,
    note: "Soft plastic drag can reduce depth a bit."
  },
  {
    value: "spinner_small",
    label: "Small spinner",
    depthBiasFt: -1.0,
    note: "Moderate drag. Usually a little shallower."
  },
  {
    value: "spoon_small",
    label: "Small spoon",
    depthBiasFt: 0.5,
    note: "Usually close to the base estimate."
  },
  {
    value: "spoon_medium",
    label: "Medium spoon",
    depthBiasFt: 1.0,
    note: "Can add a little extra depth depending on speed."
  },
  {
    value: "apex_small",
    label: "Apex / trolling plug",
    depthBiasFt: 1.5,
    note: "Usually close to neutral or slightly deeper."
  },
  {
    value: "flatfish_small",
    label: "FlatFish / Kwikfish style plug",
    depthBiasFt: -2.0,
    note: "Wide wobble can create lift and drag."
  },
  {
    value: "crank_shallow",
    label: "Shallow diving crankbait",
    depthBiasFt: 3.0,
    note: "Adds some dive on its own."
  },
  {
    value: "crank_medium",
    label: "Medium diving crankbait",
    depthBiasFt: 6.0,
    note: "Can noticeably increase running depth."
  },
  {
    value: "crank_deep",
    label: "Deep diving crankbait",
    depthBiasFt: 10.0,
    note: "Can add substantial depth."
  }
];

function getLureByValue(val) {
  for (let i = 0; i < TROLLING_LURES.length; i++) {
    if (TROLLING_LURES[i].value === val) return TROLLING_LURES[i];
  }
  return TROLLING_LURES[0];
}

function applyLureDepthAdjustment(baseDepthFt, lureValue) {
  const lure = getLureByValue(lureValue);
  const adjusted = Number(baseDepthFt) + Number(lure.depthBiasFt || 0);
  return Math.max(0, adjusted);
}

// ----------------------------
// Styles (mobile first)
// ----------------------------
(function injectStyles() {
  const css = `
  :root {
    --green:#8fd19e;
    --green2:#7cc78f;
    --greenBorder:#6fbf87;
    --text:#0b2e13;
    --card:#f2f3f4;
    --stroke:rgba(0,0,0,0.14);
    --muted:rgba(0,0,0,0.62);
  }

  * { box-sizing:border-box; }

  body {
    margin:0;
    font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background:#fff;
  }

  .wrap {
    max-width:760px;
    margin:0 auto;
    padding:12px 12px 36px 12px;
  }

  .header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-top:6px;
  }

  .logo { max-width:60%; }
  .logo a { display:inline-block; }

  .logo img {
    width:100%;
    max-width:260px;
    height:auto;
    display:block;
  }

  .title {
    text-align:right;
    font-weight:900;
    font-size:18px;
    line-height:20px;
  }

  .small { font-size:13px; opacity:0.92; }
  .muted { color:var(--muted); }

  .nav {
    margin-top:12px;
    margin-bottom:10px;
    display:grid;
    grid-template-columns:repeat(4, 1fr);
    gap:10px;
  }

  .navBtn {
    width:100%;
    padding:10px 12px;
    border-radius:10px;
    border:1px solid var(--greenBorder);
    background:var(--green);
    color:var(--text);
    font-weight:900;
    cursor:pointer;
  }

  .navBtn:hover { background:var(--green2); }
  .navBtn:active { background:#6bbb83; }

  .navBtnActive {
    background:#e9f6ee;
    border-color:rgba(0,0,0,0.18);
    color:rgba(0,0,0,0.78);
    cursor:default;
  }

  .card {
    border-radius:16px;
    padding:14px;
    margin-top:12px;
    border:1px solid var(--stroke);
    background:var(--card);
  }

  .compact {
    margin-top:10px;
    padding:12px 14px;
    background:rgba(0,0,0,0.03);
  }

  h2 { margin:0 0 6px 0; font-size:18px; }
  h3 { margin:0 0 8px 0; font-size:16px; }

  input,
  select {
    width:100%;
    padding:10px;
    border-radius:12px;
    border:1px solid var(--stroke);
    font-size:16px;
    background:#fff;
  }

  button {
    width:100%;
    padding:10px 12px;
    border-radius:12px;
    border:1px solid var(--greenBorder);
    background:var(--green);
    color:var(--text);
    font-weight:900;
    cursor:pointer;
  }

  button:hover { background:var(--green2); }
  button:active { background:#6bbb83; }

  button:disabled {
    background:#cfe8d6;
    color:#6b6b6b;
    border-color:#b6d6c1;
    cursor:not-allowed;
  }

  .btnRow {
    display:flex;
    gap:10px;
    margin-top:10px;
  }

  .btnRow > button { flex:1; }

  .footer {
    margin-top:22px;
    padding-top:14px;
    border-top:1px solid var(--stroke);
    text-align:center;
    font-size:13px;
    opacity:0.90;
  }

  .sectionTitle {
    margin-top:12px;
    font-weight:900;
  }

  .list {
    margin:8px 0 0 18px;
  }

  .list li {
    margin-bottom:6px;
  }

  .fieldLabel {
    font-size:13px;
    font-weight:900;
    opacity:0.86;
    margin-bottom:6px;
  }

  .tilesGrid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
    margin-top:12px;
  }

  .tile {
    background:#fff;
    border:1px solid var(--stroke);
    border-radius:14px;
    padding:12px;
  }

  .tileTop {
    font-size:13px;
    font-weight:900;
    opacity:0.8;
  }

  .tileVal {
    margin-top:8px;
    font-size:24px;
    font-weight:900;
  }

  .tileSub {
    margin-top:6px;
    font-size:12px;
    opacity:0.75;
  }

  .toggleRow {
    display:flex;
    gap:10px;
  }

  .toggleBtn {
    flex:1;
    padding:12px 12px;
    border-radius:14px;
    border:1px solid rgba(0,0,0,0.14);
    background:rgba(255,255,255,0.80);
    color:rgba(0,0,0,0.78);
    font-weight:900;
  }

  .toggleBtn.toggleActive {
    background:rgba(143,209,158,0.45);
    border-color:rgba(111,191,135,0.85);
    color:rgba(0,0,0,0.82);
  }

  .statusRow {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-top:12px;
  }

  .pill {
    padding:8px 12px;
    border-radius:999px;
    font-weight:900;
    border:1px solid rgba(0,0,0,0.14);
    background:rgba(0,0,0,0.04);
    min-width:88px;
    text-align:center;
  }

  .meterBar {
    margin-top:10px;
    height:16px;
    border-radius:999px;
    overflow:hidden;
    border:1px solid rgba(0,0,0,0.12);
    display:flex;
  }

  .meterSeg { height:100%; }
  .segG { width:34%; background:rgba(143,209,158,0.8); }
  .segY { width:33%; background:rgba(255,214,102,0.85); }
  .segR { width:33%; background:rgba(244,163,163,0.88); }

  .meterNeedle {
    position:absolute;
    top:-7px;
    width:0;
    height:0;
    border-left:8px solid transparent;
    border-right:8px solid transparent;
    border-top:12px solid rgba(0,0,0,0.72);
    transform:translateX(-8px);
  }

  .chartWrap { margin-top:10px; }

  canvas.windChart {
    width:100%;
    height:180px;
    display:block;
    border-radius:12px;
    background:rgba(255,255,255,0.9);
    border:1px solid rgba(0,0,0,0.12);
  }

  .speciesPhotoWrap {
    margin-top:10px;
    margin-bottom:0;
  }

  .speciesPhoto {
    width:100%;
    height:auto;
    display:block;
    border-radius:12px;
    border:1px solid rgba(0,0,0,0.12);
    background:rgba(255,255,255,0.9);
  }

  .consentBar {
    position:fixed;
    left:0;
    right:0;
    bottom:0;
    padding:12px;
    background:rgba(255,255,255,0.98);
    border-top:1px solid var(--stroke);
    z-index:9999;
  }

  .consentInner {
    max-width:760px;
    margin:0 auto;
    display:flex;
    gap:12px;
    align-items:center;
    justify-content:space-between;
  }

  .consentText {
    font-size:13px;
    line-height:16px;
    opacity:0.92;
  }

  .consentBtns {
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    justify-content:flex-end;
    min-width:240px;
  }

  .consentBtn {
    width:auto;
    padding:10px 12px;
    border-radius:12px;
  }

  .consentDecline {
    background:#f4a3a3 !important;
    border-color:#e48f8f !important;
    color:#3b0a0a !important;
  }

  .consentDecline:hover {
    background:#ee8f8f !important;
  }

  .modalOverlay {
    position:fixed;
    left:0;
    right:0;
    top:0;
    bottom:0;
    background:rgba(0,0,0,0.55);
    z-index:10000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:16px;
  }

  .modalCard {
    width:100%;
    max-width:560px;
    border-radius:16px;
    background:#fff;
    border:1px solid rgba(0,0,0,0.18);
    box-shadow:0 10px 28px rgba(0,0,0,0.25);
    overflow:hidden;
  }

  .modalHead {
    padding:14px 14px 10px 14px;
    background:rgba(0,0,0,0.03);
    border-bottom:1px solid rgba(0,0,0,0.10);
    font-weight:900;
  }

  .modalBody {
    padding:14px;
    font-size:14px;
    line-height:18px;
    color:rgba(0,0,0,0.82);
  }

  .modalBody p { margin:0 0 10px 0; }

  .modalFoot {
    padding:12px 14px 14px 14px;
    border-top:1px solid rgba(0,0,0,0.10);
  }

  .modalRow {
    display:flex;
    gap:10px;
    align-items:center;
    justify-content:space-between;
    flex-wrap:wrap;
  }

  .modalCheck {
    display:flex;
    gap:8px;
    align-items:center;
    font-size:13px;
    color:rgba(0,0,0,0.75);
  }

  .modalBtnRow {
    display:flex;
    gap:10px;
    margin-top:10px;
  }

  .modalBtnRow > button { flex:1; }

  @media (max-width:520px) {
    .wrap { padding:10px 10px 30px 10px; }

    .header {
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:8px;
    }

    .logo { max-width:88%; }

    .logo img {
      max-width:280px;
      margin:0 auto;
    }

    .title {
      text-align:center;
      font-size:18px;
    }

    .nav {
      grid-template-columns:repeat(2, 1fr);
      gap:10px;
    }

    canvas.windChart { height:160px; }

    .consentInner {
      flex-direction:column;
      align-items:stretch;
    }

    .consentBtns {
      justify-content:stretch;
      min-width:0;
    }

    .consentBtn { width:100%; }
  }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

// ----------------------------
// Utilities
// ----------------------------
function escHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number(fallback || 0);
}

function formatTime(d) {
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return String(d);
  }
}

function appendHtml(el, html) {
  el.insertAdjacentHTML("beforeend", html);
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
}

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function filterHourlyToDate(times, values, dateIso) {
  const out = [];
  if (!times || !times.length) return out;

  for (let i = 0; i < times.length; i++) {
    const t = String(times[i] || "");
    if (t.slice(0, 10) === dateIso) {
      out.push({ dt: new Date(t), v: Number(values[i]) });
    }
  }

  return out.filter(function (x) {
    return Number.isFinite(x.v);
  });
}

function normalizePlaceQuery(s) {
  const x0 = String(s || "").trim().replace(/\s+/g, " ");
  if (!x0) return "";

  const m = x0.match(/^(.+?),\s*([a-zA-Z]{2})$/);
  if (m) {
    const city = String(m[1] || "").trim();
    const st = String(m[2] || "").trim().toUpperCase();
    if (city && st) return city + ", " + st;
  }

  return x0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ----------------------------
// Stop GPS speed watch if running
// ----------------------------
function stopSpeedWatchIfRunning() {
  try {
    if (state.speedWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.speedWatchId);
    }
  } catch (e) {
    // ignore
  }
  state.speedWatchId = null;
}

// ----------------------------
// Forecast bundle cache
// ----------------------------
const forecastCache = {
  key: "",
  ts: 0,
  wx: null,
  sun: null
};

const FORECAST_TTL_MS = 10 * 60 * 1000;

function cacheKey(lat, lon) {
  return String(Number(lat).toFixed(4)) + "," + String(Number(lon).toFixed(4));
}

// ----------------------------
// Robust fetch helpers
// ----------------------------
async function fetchJson(url, timeoutMs) {
  const ms = Number(timeoutMs || 12000);
  const ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;

  const t = ctrl
    ? setTimeout(function () {
        ctrl.abort();
      }, ms)
    : null;

  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    const text = await r.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const snippet = String(text || "")
        .slice(0, 160)
        .replace(/\s+/g, " ")
        .trim();

      throw new Error(
        "Bad JSON response (" +
          r.status +
          "). " +
          (snippet ? snippet : "No body.")
      );
    }

    if (!r.ok) {
      const msg =
        data && (data.reason || data.error || data.message)
          ? String(data.reason || data.error || data.message)
          : "HTTP " + r.status;
      throw new Error(msg);
    }

    return data;
  } catch (e2) {
    const msg =
      e2 && e2.name === "AbortError"
        ? "Request timed out."
        : String(e2 && e2.message ? e2.message : e2);

    throw new Error(msg);
  } finally {
    if (t) clearTimeout(t);
  }
}

function niceErr(e) {
  const s = String(e && e.message ? e.message : e);
  return s.length > 180 ? s.slice(0, 180) + "..." : s;
}

// ============================
// app.js (PART 1 OF 4) END
// ============================
// ============================
// app.js (PART 2 OF 4) BEGIN
// Location search, forecast loading, and navigation
// ============================

// ----------------------------
// Location search
// ----------------------------
async function searchPlace(q) {
  const query = normalizePlaceQuery(q);
  if (!query) return [];

  const url =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(query) +
    "&count=8&language=en&format=json";

  const data = await fetchJson(url, 12000);

  if (!data || !data.results) return [];

  const res = [];

  for (let i = 0; i < data.results.length; i++) {
    const r = data.results[i];

    const label =
      r.name +
      (r.admin1 ? ", " + r.admin1 : "") +
      (r.country ? ", " + r.country : "");

    res.push({
      label: label,
      lat: Number(r.latitude),
      lon: Number(r.longitude)
    });
  }

  return res;
}

function renderLocationSearch() {
  const c = document.createElement("div");
  c.className = "card";

  c.innerHTML =
    "<h3>Choose location</h3>" +
    '<input id="place_input" placeholder="Search city, lake, or place">' +
    '<div class="btnRow">' +
    '<button id="place_search">Search</button>' +
    '<button id="place_gps">Use GPS</button>' +
    "</div>" +
    '<div id="place_results" class="card compact"></div>';

  const input = c.querySelector("#place_input");
  const results = c.querySelector("#place_results");

  c.querySelector("#place_search").addEventListener("click", async function () {
    const q = input.value.trim();
    if (!q) return;

    results.innerHTML = "Searching...";

    try {
      const list = await searchPlace(q);

      if (!list.length) {
        results.innerHTML = "No results found.";
        return;
      }

      let html = "";

      for (let i = 0; i < list.length; i++) {
        html +=
          '<div class="card compact">' +
          '<div><strong>' +
          escHtml(list[i].label) +
          "</strong></div>" +
          '<div class="btnRow">' +
          '<button data-i="' +
          i +
          '">Use</button>' +
          "</div>" +
          "</div>";
      }

      results.innerHTML = html;

      const btns = results.querySelectorAll("button");

      for (let b = 0; b < btns.length; b++) {
        btns[b].addEventListener("click", function () {
          const idx = Number(this.getAttribute("data-i"));
          const r = list[idx];

          state.lat = r.lat;
          state.lon = r.lon;
          state.placeLabel = r.label;

          saveLastLocation(r.lat, r.lon, r.label);

          renderApp();
        });
      }
    } catch (e) {
      results.innerHTML = "Error: " + escHtml(niceErr(e));
    }
  });

  c.querySelector("#place_gps").addEventListener("click", function () {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        state.placeLabel = "GPS location";

        saveLastLocation(state.lat, state.lon, state.placeLabel);

        renderApp();
      },
      function () {
        alert("Could not get location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  return c;
}

// ----------------------------
// Forecast loader
// ----------------------------
async function loadForecast(lat, lon) {
  const key = cacheKey(lat, lon);
  const now = Date.now();

  if (
    forecastCache.key === key &&
    now - forecastCache.ts < FORECAST_TTL_MS &&
    forecastCache.wx &&
    forecastCache.sun
  ) {
    return {
      wx: forecastCache.wx,
      sun: forecastCache.sun
    };
  }

  const wxUrl =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&hourly=temperature_2m,precipitation_probability,windspeed_10m" +
    "&daily=sunrise,sunset" +
    "&timezone=auto";

  const data = await fetchJson(wxUrl, 15000);

  if (!data) throw new Error("Forecast request failed.");

  const wx = {
    times: data.hourly.time,
    temp: data.hourly.temperature_2m,
    wind: data.hourly.windspeed_10m,
    rain: data.hourly.precipitation_probability
  };

  const sun = {
    sunrise: data.daily.sunrise[0],
    sunset: data.daily.sunset[0]
  };

  forecastCache.key = key;
  forecastCache.ts = now;
  forecastCache.wx = wx;
  forecastCache.sun = sun;

  return { wx: wx, sun: sun };
}

// ----------------------------
// Navigation
// ----------------------------
function renderNav() {
  const nav = document.createElement("div");
  nav.className = "nav";

  const tools = [
    "Home",
    "Trolling Depth",
    "Species Tips",
    "Speedometer"
  ];

  for (let i = 0; i < tools.length; i++) {
    const b = document.createElement("button");
    b.className = "navBtn";

    if (state.tool === tools[i]) {
      b.className += " navBtnActive";
      b.disabled = true;
    }

    b.textContent = tools[i];

    b.addEventListener("click", function () {
      state.tool = tools[i];
      stopSpeedWatchIfRunning();
      renderApp();
    });

    nav.appendChild(b);
  }

  return nav;
}

// ----------------------------
// Header
// ----------------------------
function renderHeader() {
  const h = document.createElement("div");
  h.className = "header";

  const logo =
    '<div class="logo">' +
    '<a href="' +
    LOGO_LINK +
    '" target="_blank">' +
    '<img src="' +
    LOGO_URL +
    '" alt="FishyNW">' +
    "</a>" +
    "</div>";

  const title =
    '<div class="title">Fishing Tools<br><span class="small">v' +
    APP_VERSION +
    "</span></div>";

  h.innerHTML = logo + title;

  return h;
}

// ----------------------------
// Footer
// ----------------------------
function renderFooter() {
  const f = document.createElement("div");
  f.className = "footer";

  f.innerHTML =
    "FishyNW.com fishing tools. Always verify conditions before going out.";

  return f;
}

// ============================
// app.js (PART 2 OF 4) END
// ============================
// ============================
// app.js (PART 3 OF 4) BEGIN
// Trolling Depth Calculator + Species Tips
// ============================

// ----------------------------
// Base depth model
// Simple estimate for trolling with inline weight
// ----------------------------
function estimateTrollingDepthFt(weightOz, speedMph, lineFt) {
  const w = safeNum(weightOz, 0);
  const s = safeNum(speedMph, 1.5);
  const l = safeNum(lineFt, 0);

  if (w <= 0 || l <= 0) return 0;

  // Base ratio model tuned for kayak trolling with braid
  const baseRatio = 0.60; // approx percent of line depth at 1.5 mph

  // Speed penalty (faster = shallower)
  const speedPenalty = clamp((s - 1.5) * 0.08, -0.2, 0.25);

  const ratio = clamp(baseRatio - speedPenalty, 0.20, 0.85);

  return l * ratio * (w / 8); // scaled by weight vs 8 oz reference
}

// ----------------------------
// Trolling Depth Tool
// ----------------------------
function renderTrollingDepthTool() {
  const c = document.createElement("div");
  c.className = "card";

  c.innerHTML =
    "<h3>Trolling Depth Calculator</h3>" +
    '<div class="fieldLabel">Weight (oz)</div>' +
    '<input id="td_weight" type="number" step="0.5" value="8">' +
    '<div class="fieldLabel">Speed (mph)</div>' +
    '<input id="td_speed" type="number" step="0.1" value="1.5">' +
    '<div class="fieldLabel">Line out (feet)</div>' +
    '<input id="td_line" type="number" step="5" value="100">' +
    '<div class="fieldLabel">Optional lure</div>' +
    '<select id="td_lure"></select>' +
    '<div class="btnRow">' +
    '<button id="td_calc">Calculate</button>' +
    "</div>" +
    '<div id="td_result" class="card compact"></div>';

  const lureSel = c.querySelector("#td_lure");

  // Populate lure options
  let optHtml = "";
  for (let i = 0; i < TROLLING_LURES.length; i++) {
    const l = TROLLING_LURES[i];
    optHtml +=
      '<option value="' +
      escHtml(l.value) +
      '">' +
      escHtml(l.label) +
      "</option>";
  }
  lureSel.innerHTML = optHtml;

  const result = c.querySelector("#td_result");

  c.querySelector("#td_calc").addEventListener("click", function () {
    const w = safeNum(c.querySelector("#td_weight").value, 0);
    const s = safeNum(c.querySelector("#td_speed").value, 1.5);
    const l = safeNum(c.querySelector("#td_line").value, 0);
    const lure = lureSel.value;

    const base = estimateTrollingDepthFt(w, s, l);
    const adj = applyLureDepthAdjustment(base, lure);

    const lureInfo = getLureByValue(lure);

    result.innerHTML =
      "<strong>Estimated depth:</strong> " +
      adj.toFixed(1) +
      " ft<br>" +
      '<span class="small muted">Base estimate: ' +
      base.toFixed(1) +
      " ft</span>" +
      "<br><br>" +
      '<span class="small">' +
      escHtml(lureInfo.note || "") +
      "</span>";
  });

  return c;
}

// ----------------------------
// Species tips encyclopedia
// ----------------------------
const SPECIES_DATA = [
  {
    key: "largemouth",
    label: "Largemouth Bass",
    range: "55 to 75 F",
    photo:
      "https://fishynw.com/wp-content/uploads/2024/12/largemouth-dink-e1753942608642.jpg",
    bullets: [
      "Target weeds, docks, wood cover, and shade pockets.",
      "Best feeding windows are dawn, dusk, and cloudy days.",
      "Flip jigs and creature baits into cover.",
      "Topwater works well in warm water mornings.",
      "Slow down with finesse rigs after cold fronts."
    ],
    extra: [
      "Spawn typically begins when water temperatures reach the low 60s.",
      "Post spawn fish often move to nearby cover or bluegill beds."
    ]
  },
  {
    key: "smallmouth",
    label: "Smallmouth Bass",
    range: "50 to 70 F",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/smallmouth-bass-fishynw.jpg",
    bullets: [
      "Look for rock, gravel, and current seams.",
      "Wind blowing onto points often improves the bite.",
      "Use tubes, ned rigs, finesse jigs, and jerkbaits.",
      "Natural colors work best in clear water.",
      "Stay near bottom in colder water."
    ],
    extra: [
      "Smallmouth spawn around mid to upper 50 degree water.",
      "Wind driven banks often hold feeding fish."
    ]
  },
  {
    key: "rainbow",
    label: "Rainbow Trout",
    range: "45 to 65 F",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/03/20250322_114536-scaled-e1753944691694.jpg",
    bullets: [
      "Wind blown shorelines can concentrate feeding fish.",
      "Trolling small spoons and spinners is very effective.",
      "Morning hours are often most productive.",
      "Look for cooler water layers in summer.",
      "Match insect hatches when visible."
    ],
    extra: [
      "Spring spawning fish often move into tributaries.",
      "Surface feeding often occurs during insect activity."
    ]
  },
  {
    key: "kokanee",
    label: "Kokanee Salmon",
    range: "45 to 60 F",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/kokanee-fishynw.jpg",
    bullets: [
      "Typically suspended in schools over deep water.",
      "Use dodgers with spinners or hoochies.",
      "Speed control is critical for bites.",
      "Downriggers help keep gear in the strike zone.",
      "Early morning bite is often strongest."
    ],
    extra: [
      "Kokanee feed heavily on plankton and small zooplankton.",
      "Color preferences can change daily so experiment."
    ]
  }
];

// ----------------------------
// Species Tips UI
// ----------------------------
function renderSpeciesTips() {
  const c = document.createElement("div");
  c.className = "card";

  let selHtml = '<select id="species_select">';
  for (let i = 0; i < SPECIES_DATA.length; i++) {
    selHtml +=
      '<option value="' +
      SPECIES_DATA[i].key +
      '">' +
      escHtml(SPECIES_DATA[i].label) +
      "</option>";
  }
  selHtml += "</select>";

  c.innerHTML =
    "<h3>Species Tips</h3>" +
    selHtml +
    '<div id="species_body" class="card compact"></div>';

  const body = c.querySelector("#species_body");
  const sel = c.querySelector("#species_select");

  function renderSpecies(key) {
    let sp = null;

    for (let i = 0; i < SPECIES_DATA.length; i++) {
      if (SPECIES_DATA[i].key === key) {
        sp = SPECIES_DATA[i];
        break;
      }
    }

    if (!sp) return;

    let html =
      "<strong>Active range:</strong> " +
      escHtml(sp.range) +
      "<br><ul class='list'>";

    for (let i = 0; i < sp.bullets.length; i++) {
      html += "<li>" + escHtml(sp.bullets[i]) + "</li>";
    }

    html += "</ul>";

    for (let i = 0; i < sp.extra.length; i++) {
      html +=
        '<div class="small muted" style="margin-top:6px;">' +
        escHtml(sp.extra[i]) +
        "</div>";
    }

    if (sp.photo) {
      html +=
        '<div class="speciesPhotoWrap">' +
        '<img class="speciesPhoto" src="' +
        escHtml(sp.photo) +
        '">' +
        "</div>";
    }

    body.innerHTML = html;
  }

  sel.addEventListener("change", function () {
    renderSpecies(sel.value);
  });

  renderSpecies(SPECIES_DATA[0].key);

  return c;
}

// ============================
// app.js (PART 3 OF 4) END
// ============================
// ============================
// app.js (PART 4 OF 4) BEGIN
// Home, Speedometer, main render, and boot
// ============================

// ----------------------------
// Best times helper
// ----------------------------
function getBestTimes(sun) {
  if (!sun || !sun.sunrise || !sun.sunset) return null;

  const sunrise = new Date(sun.sunrise);
  const sunset = new Date(sun.sunset);

  const morningStart = new Date(sunrise.getTime() - 45 * 60 * 1000);
  const morningEnd = new Date(sunrise.getTime() + 90 * 60 * 1000);

  const eveningStart = new Date(sunset.getTime() - 120 * 60 * 1000);
  const eveningEnd = new Date(sunset.getTime() + 30 * 60 * 1000);

  return {
    sunrise: sunrise,
    sunset: sunset,
    morningStart: morningStart,
    morningEnd: morningEnd,
    eveningStart: eveningStart,
    eveningEnd: eveningEnd
  };
}

// ----------------------------
// Risk scoring
// ----------------------------
function computeRiskScore(hourly) {
  if (!hourly || !hourly.wind || !hourly.rain || !hourly.temp) {
    return { score: 0, label: "GO" };
  }

  let maxWind = 0;
  let maxRain = 0;
  let minTemp = Infinity;

  for (let i = 0; i < hourly.wind.length; i++) {
    maxWind = Math.max(maxWind, safeNum(hourly.wind[i], 0));
  }

  for (let j = 0; j < hourly.rain.length; j++) {
    maxRain = Math.max(maxRain, safeNum(hourly.rain[j], 0));
  }

  for (let k = 0; k < hourly.temp.length; k++) {
    minTemp = Math.min(minTemp, safeNum(hourly.temp[k], 999));
  }

  let score = 0;

  score += clamp(maxWind * 3, 0, 60);
  score += clamp(maxRain * 0.35, 0, 25);

  if (minTemp < 50 && maxRain >= 30) score += 12;
  if (minTemp < 40) score += 10;

  if (state.craft === "Kayak (paddle)") score += 8;
  if (state.craft === "Big water / offshore") score += 10;

  score = clamp(Math.round(score), 0, 100);

  let label = "GO";
  if (score >= 67) label = "NO-GO";
  else if (score >= 34) label = "CAUTION";

  if (minTemp < 50 && maxRain >= 30 && label === "GO") {
    label = "CAUTION";
  }

  return {
    score: score,
    label: label,
    maxWind: maxWind,
    maxRain: maxRain,
    minTemp: minTemp
  };
}

// ----------------------------
// Wind chart
// ----------------------------
function drawWindLineChart(canvas, points) {
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 180;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);

  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;

  if (!points || points.length < 2 || w <= 10 || h <= 10) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.font =
      "13px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    ctx.fillText("Not enough data for chart.", 12, 22);
    return;
  }

  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const v = Number(points[i].mph);
    if (!Number.isFinite(v)) continue;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return;

  const range = Math.max(1, maxV - minV);
  const extra = range * 0.15;
  minV = Math.max(0, minV - extra);
  maxV = maxV + extra;

  function xFor(i) {
    return padL + (i / (points.length - 1)) * w;
  }

  function yFor(v) {
    const t = (v - minV) / (maxV - minV);
    return padT + (1 - t) * h;
  }

  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;

  for (let g = 0; g <= 2; g++) {
    const yy = padT + (g / 2) * h;
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(padL + w, yy);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.70)";
  ctx.font =
    "12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

  ctx.fillText(String(Math.round(maxV)) + " mph", 6, padT + 12);
  ctx.fillText(
    String(Math.round((minV + maxV) / 2)) + " mph",
    6,
    padT + h / 2 + 4
  );
  ctx.fillText(String(Math.round(minV)) + " mph", 6, padT + h + 4);

  ctx.strokeStyle = "rgba(7,27,31,0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(points[0].mph));

  for (let j = 1; j < points.length; j++) {
    ctx.lineTo(xFor(j), yFor(points[j].mph));
  }

  ctx.stroke();

  ctx.fillStyle = "rgba(7,27,31,0.70)";
  for (let k = 0; k < points.length; k++) {
    ctx.beginPath();
    ctx.arc(xFor(k), yFor(points[k].mph), 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----------------------------
// Home page
// ----------------------------
function renderHomePage() {
  const c = document.createElement("div");

  c.innerHTML =
    '<div class="card">' +
    "  <h2>Weather/Wind + Best Times</h2>" +
    '  <div class="small muted">Pick a date, set your craft, and load the latest outlook for your location.</div>' +
    '  <div class="fieldLabel" style="margin-top:12px;">Date</div>' +
    '  <input id="home_date" type="date">' +
    '  <div class="fieldLabel" style="margin-top:12px;">Water type</div>' +
    '  <select id="home_water">' +
    '    <option>Small / protected</option>' +
    '    <option>Big water / offshore</option>' +
    "  </select>" +
    '  <div class="fieldLabel" style="margin-top:12px;">Craft</div>' +
    '  <select id="home_craft">' +
    '    <option>Kayak (paddle)</option>' +
    '    <option>Kayak (motorized)</option>' +
    '    <option>Boat (small)</option>' +
    "  </select>" +
    '  <div class="btnRow">' +
    '    <button id="home_load">Load outlook</button>' +
    "  </div>" +
    '  <div id="home_status" class="small muted" style="margin-top:10px;"></div>' +
    "</div>";

  c.appendChild(renderLocationSearch());

  const results = document.createElement("div");
  results.id = "home_results";
  c.appendChild(results);

  setTimeout(function () {
    const dateEl = c.querySelector("#home_date");
    const waterEl = c.querySelector("#home_water");
    const craftEl = c.querySelector("#home_craft");
    const statusEl = c.querySelector("#home_status");
    const loadBtn = c.querySelector("#home_load");

    dateEl.value = isIsoDate(state.dateIso) ? state.dateIso : isoTodayLocal();
    waterEl.value = state.waterType || "Small / protected";
    craftEl.value = state.craft || "Kayak (paddle)";

    loadBtn.addEventListener("click", async function () {
      state.dateIso = isIsoDate(dateEl.value) ? dateEl.value : isoTodayLocal();
      state.waterType = String(waterEl.value || "Small / protected");
      state.craft = String(craftEl.value || "Kayak (paddle)");

      if (!hasResolvedLocation()) {
        statusEl.textContent = "Choose a location first.";
        results.innerHTML = "";
        return;
      }

      statusEl.textContent = "Loading forecast...";
      results.innerHTML = "";

      try {
        const bundle = await loadForecast(state.lat, state.lon);
        const wx = bundle.wx;
        const sun = bundle.sun;

        const dayTimes = filterHourlyToDate(wx.times, wx.wind, state.dateIso);
        const windPts = [];

        for (let i = 0; i < dayTimes.length; i++) {
          windPts.push({
            dt: dayTimes[i].dt,
            mph: safeNum(dayTimes[i].v, 0)
          });
        }

        const tempPts = filterHourlyToDate(wx.times, wx.temp, state.dateIso);
        const rainPts = filterHourlyToDate(wx.times, wx.rain, state.dateIso);

        const hourly = {
          wind: windPts.map(function (x) { return x.mph; }),
          temp: tempPts.map(function (x) { return x.v; }),
          rain: rainPts.map(function (x) { return x.v; })
        };

        const risk = computeRiskScore(hourly);
        const best = getBestTimes(sun);

        let hi = -Infinity;
        let lo = Infinity;

        for (let j = 0; j < hourly.temp.length; j++) {
          hi = Math.max(hi, safeNum(hourly.temp[j], 0));
          lo = Math.min(lo, safeNum(hourly.temp[j], 999));
        }

        if (!Number.isFinite(hi)) hi = 0;
        if (!Number.isFinite(lo)) lo = 0;

        let html = "";
        html += '<div class="card">';
        html += "  <h3>Forecast summary</h3>";
        html +=
          '  <div class="small muted">' +
          escHtml(
            state.placeLabel ||
              ("Lat " + state.lat.toFixed(4) + ", Lon " + state.lon.toFixed(4))
          ) +
          " for " +
          escHtml(state.dateIso) +
          "</div>";

        html += '  <div class="tilesGrid">';
        html += '    <div class="tile">';
        html += '      <div class="tileTop">High / low</div>';
        html +=
          '      <div class="tileVal">' +
          escHtml(String(Math.round(hi))) +
          " / " +
          escHtml(String(Math.round(lo))) +
          " F</div>";
        html += '      <div class="tileSub">Air temperature</div>';
        html += "    </div>";

        html += '    <div class="tile">';
        html += '      <div class="tileTop">Max wind</div>';
        html +=
          '      <div class="tileVal">' +
          escHtml(String(Math.round(risk.maxWind))) +
          " mph</div>";
        html += '      <div class="tileSub">Hourly forecast max</div>';
        html += "    </div>";

        html += '    <div class="tile">';
        html += '      <div class="tileTop">Rain chance</div>';
        html +=
          '      <div class="tileVal">' +
          escHtml(String(Math.round(risk.maxRain))) +
          "%</div>";
        html += '      <div class="tileSub">Max hourly chance</div>';
        html += "    </div>";

        html += '    <div class="tile">';
        html += '      <div class="tileTop">Trip call</div>';
        html +=
          '      <div class="tileVal">' +
          escHtml(risk.label) +
          "</div>";
        html +=
          '      <div class="tileSub">Score: ' +
          escHtml(String(risk.score)) +
          " / 100</div>";
        html += "    </div>";
        html += "  </div>";

        html += '  <div class="statusRow">';
        html += '    <div class="small muted">Risk meter</div>';
        html += '    <div class="pill">' + escHtml(risk.label) + "</div>";
        html += "  </div>";

        html +=
          '<div style="position:relative; margin-top:8px;">' +
          '  <div class="meterBar">' +
          '    <div class="meterSeg segG"></div>' +
          '    <div class="meterSeg segY"></div>' +
          '    <div class="meterSeg segR"></div>' +
          "  </div>" +
          '  <div class="meterNeedle" style="left:' +
          escHtml(String(risk.score)) +
          '%;"></div>' +
          "</div>";

        if (best) {
          html += '<div class="card compact">';
          html += "  <h3>Best fishing times</h3>";
          html +=
            '  <div class="small"><strong>Sunrise:</strong> ' +
            escHtml(formatTime(best.sunrise)) +
            " | <strong>Sunset:</strong> " +
            escHtml(formatTime(best.sunset)) +
            "</div>";
          html +=
            '  <div class="small" style="margin-top:8px;"><strong>Morning window:</strong> ' +
            escHtml(formatTime(best.morningStart)) +
            " to " +
            escHtml(formatTime(best.morningEnd)) +
            "</div>";
          html +=
            '  <div class="small" style="margin-top:6px;"><strong>Evening window:</strong> ' +
            escHtml(formatTime(best.eveningStart)) +
            " to " +
            escHtml(formatTime(best.eveningEnd)) +
            "</div>";
          html += "</div>";
        }

        html +=
          '<div class="card">' +
          "  <h3>Hourly wind trend</h3>" +
          '  <div class="chartWrap"><canvas id="wind_chart" class="windChart"></canvas></div>' +
          "</div>";

        html += "</div>";

        results.innerHTML = html;

        const canvas = document.getElementById("wind_chart");
        drawWindLineChart(canvas, windPts);

        statusEl.textContent = "Forecast loaded.";
      } catch (e) {
        statusEl.textContent = "Error loading forecast: " + escHtml(niceErr(e));
      }
    });
  }, 0);

  return c;
}

// ----------------------------
// Speedometer page
// ----------------------------
function renderSpeedometerPage() {
  const c = document.createElement("div");
  c.className = "card";

  c.innerHTML =
    "  <h2>Speedometer</h2>" +
    '  <div class="small muted">Uses GPS speed from your device. Works best outside with a clear sky view.</div>' +
    '  <div class="tilesGrid">' +
    '    <div class="tile">' +
    '      <div class="tileTop">Current speed</div>' +
    '      <div class="tileVal" id="speed_now">0.0 mph</div>' +
    '      <div class="tileSub" id="speed_acc">Waiting for signal...</div>' +
    "    </div>" +
    '    <div class="tile">' +
    '      <div class="tileTop">Status</div>' +
    '      <div class="tileVal" id="speed_status">Idle</div>' +
    '      <div class="tileSub">Tap start to begin watching speed.</div>' +
    "    </div>" +
    "  </div>" +
    '  <div class="btnRow">' +
    '    <button id="speed_start">Start speed</button>' +
    '    <button id="speed_stop">Stop</button>' +
    "  </div>" +
    '  <div id="speed_msg" class="small muted" style="margin-top:10px;"></div>';

  const speedNow = c.querySelector("#speed_now");
  const speedAcc = c.querySelector("#speed_acc");
  const speedStatus = c.querySelector("#speed_status");
  const speedMsg = c.querySelector("#speed_msg");
  const startBtn = c.querySelector("#speed_start");
  const stopBtn = c.querySelector("#speed_stop");

  function setIdle() {
    speedStatus.textContent = "Idle";
    speedMsg.textContent = "GPS not active.";
  }

  function startWatch() {
    if (!navigator.geolocation) {
      speedMsg.textContent = "Geolocation is not supported on this device/browser.";
      return;
    }

    if (state.speedWatchId !== null) {
      speedMsg.textContent = "Already watching speed.";
      return;
    }

    speedStatus.textContent = "Starting";
    speedMsg.textContent = "Waiting for GPS signal...";

    state.speedWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        let mph = null;

        if (Number.isFinite(pos.coords.speed)) {
          mph = Number(pos.coords.speed) * 2.236936;
        }

        if (!Number.isFinite(mph)) {
          mph = 0;
        }

        speedNow.textContent = mph.toFixed(1) + " mph";
        speedStatus.textContent = "Live";

        const acc = Number(pos.coords.accuracy);
        speedAcc.textContent = Number.isFinite(acc)
          ? "Accuracy: " + Math.round(acc) + " m"
          : "Accuracy unavailable";

        speedMsg.textContent = "GPS speed active.";
      },
      function (err) {
        speedStatus.textContent = "Error";
        speedMsg.textContent = "Location error: " + err.message;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
    );
  }

  startBtn.addEventListener("click", startWatch);

  stopBtn.addEventListener("click", function () {
    stopSpeedWatchIfRunning();
    setIdle();
  });

  setIdle();
  return c;
}

// ----------------------------
// Main app render
// ----------------------------
function renderApp() {
  if (!app) {
    app = document.getElementById("app");
  }

  if (!app) return;

  app.innerHTML = "";
  app.appendChild(renderHeader());
  app.appendChild(renderNav());

  const pageWrap = document.createElement("div");

  if (state.tool === "Home") {
    pageWrap.appendChild(renderHomePage());
  } else if (state.tool === "Trolling Depth") {
    pageWrap.appendChild(renderTrollingDepthTool());
  } else if (state.tool === "Species Tips") {
    pageWrap.appendChild(renderSpeciesTips());
  } else if (state.tool === "Speedometer") {
    pageWrap.appendChild(renderSpeedometerPage());
  } else {
    state.tool = "Home";
    pageWrap.appendChild(renderHomePage());
  }

  app.appendChild(pageWrap);
  app.appendChild(renderFooter());

  renderConsentBannerIfNeeded();
  openDisclaimerModal(false);
}

// ----------------------------
// Boot
// ----------------------------
(function boot() {
  app = document.getElementById("app");

  if (!app) {
    app = document.createElement("div");
    app.id = "app";
    document.body.appendChild(app);
  }

  state.tool = "Home";
  state.dateIso = isoTodayLocal();

  const last = loadLastLocation();
  if (last && Number.isFinite(last.lat) && Number.isFinite(last.lon)) {
    state.lat = Number(last.lat);
    state.lon = Number(last.lon);
    state.placeLabel = String(last.label || "");
  }

  try {
    window.scrollTo(0, 0);
  } catch (e) {
    // ignore
  }

  renderApp();
})();

// ============================
// app.js (PART 4 OF 4) END
// ============================
