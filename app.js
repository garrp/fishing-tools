// ============================
// app.js (PART 1 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
//
// NOTES (v1.2.4):
// - Consolidated app into 3 parts.
// - Added optional trolling lure support for depth calculator.
// - If a lure is selected, estimated depth is adjusted by the lure profile.
// - Lure selection remains optional and defaults to no lure adjustment.
// - Depth table logic can also use lure adjustment.
//
// IMPORTANT:
// - This is Part 1 of a rebuilt 3-part app.js based on the code you shared.
// - Continue with Part 2 and Part 3 in order.
// ============================

"use strict";

const APP_VERSION = "1.2.4";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";
const LOGO_LINK = "https://fishynw.com";

// ----------------------------
// Analytics consent (GA4)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const CONSENT_KEY = "fishynw_ga_consent_v1_2_4"; // "granted" | "denied"
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
const DISCLAIMER_ACK_KEY = "fishynw_disclaimer_ack_v1_2_4";
const DISCLAIMER_SESSION_KEY = "fishynw_disclaimer_session_v1_2_4";

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
    '  </div>' +
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
// - depthBiasFt is added after the base sinker estimate
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

  * { box-sizing: border-box; }
  body {
    margin:0;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
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

  .sectionTitle { margin-top:12px; font-weight:900; }
  .list { margin:8px 0 0 18px; }
  .list li { margin-bottom:6px; }

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

  .toggleRow { display:flex; gap:10px; }

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
  .consentDecline:hover { background:#ee8f8f !important; }

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

  @media (max-width: 520px) {
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
// app.js (PART 1 OF 3) END
// ============================
// ============================
// app.js (PART 2 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Location resolve helpers
// ----------------------------
function setResolvedLocation(lat, lon, label) {
  state.lat = Number(lat);
  state.lon = Number(lon);
  state.placeLabel = String(label || "");
  saveLastLocation(state.lat, state.lon, state.placeLabel);

  forecastCache.key = "";
  forecastCache.ts = 0;
  forecastCache.wx = null;
  forecastCache.sun = null;
}

function clearResolvedLocation() {
  state.lat = null;
  state.lon = null;
  state.placeLabel = "";
  state.matches = [];
  state.selectedIndex = 0;
  clearLastLocation();

  forecastCache.key = "";
  forecastCache.ts = 0;
  forecastCache.wx = null;
  forecastCache.sun = null;
}

// ----------------------------
// API: Geocoding
// ----------------------------
async function geocodeSearch(query, count) {
  const q = normalizePlaceQuery(query);
  if (!q) return [];

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    "?name=" +
    encodeURIComponent(q) +
    "&count=" +
    encodeURIComponent(count || 10) +
    "&language=en&format=json";

  try {
    const data = await fetchJson(url, 12000);
    const results = data && data.results ? data.results : [];

    return results
      .map(function (x) {
        const name = x.name || q;
        const admin1 = x.admin1 || "";
        const country = x.country || "";
        const parts = [name, admin1, country].filter(Boolean);

        return {
          label: parts.join(", "),
          lat: Number(x.latitude),
          lon: Number(x.longitude)
        };
      })
      .filter(function (x) {
        return Number.isFinite(x.lat) && Number.isFinite(x.lon);
      });
  } catch (e) {
    return [];
  }
}

async function reverseGeocode(lat, lon) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/reverse" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&language=en&format=json";

  try {
    const data = await fetchJson(url, 12000);
    const results = data && data.results ? data.results : [];
    if (!results.length) return null;

    const x = results[0];
    const name = x.name || "";
    const admin1 = x.admin1 || "";
    const country = x.country || "";
    const parts = [name, admin1, country].filter(Boolean);
    const label = parts.join(", ");

    return label || null;
  } catch (e) {
    return null;
  }
}

// ----------------------------
// API: Sunrise / Sunset
// ----------------------------
async function fetchSunTimesMulti(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&daily=sunrise,sunset" +
    "&forecast_days=7" +
    "&timezone=auto";

  const data = await fetchJson(url, 12000);

  const daily = data && data.daily ? data.daily : null;
  const days = daily && daily.time ? daily.time : [];
  const sr = daily && daily.sunrise ? daily.sunrise : [];
  const ss = daily && daily.sunset ? daily.sunset : [];

  return { days: days, sunrise: sr, sunset: ss };
}

function sunForDate(sunData, dateIso) {
  if (!sunData || !sunData.days || !sunData.days.length) return null;

  const idx = sunData.days.indexOf(dateIso);
  if (idx < 0) return null;

  const sr =
    sunData.sunrise && sunData.sunrise[idx] ? sunData.sunrise[idx] : null;
  const ss =
    sunData.sunset && sunData.sunset[idx] ? sunData.sunset[idx] : null;

  if (!sr || !ss) return null;

  return {
    sunrise: new Date(sr),
    sunset: new Date(ss)
  };
}

// ----------------------------
// API: Weather / Wind
// ----------------------------
async function fetchWeatherWindMulti(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
    "&hourly=wind_speed_10m" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&forecast_days=7" +
    "&timezone=auto";

  const data = await fetchJson(url, 12000);
  const daily = data && data.daily ? data.daily : {};
  const hourly = data && data.hourly ? data.hourly : {};

  return {
    daily: {
      time: daily.time || [],
      tmin: daily.temperature_2m_min || [],
      tmax: daily.temperature_2m_max || [],
      popMax: daily.precipitation_probability_max || [],
      windMax: daily.wind_speed_10m_max || [],
      gustMax: daily.wind_gusts_10m_max || []
    },
    hourly: {
      time: hourly.time || [],
      wind: hourly.wind_speed_10m || []
    }
  };
}

async function getForecastBundle(lat, lon) {
  const k = cacheKey(lat, lon);
  const now = Date.now();

  if (
    forecastCache.key === k &&
    forecastCache.wx &&
    forecastCache.sun &&
    now - forecastCache.ts < FORECAST_TTL_MS
  ) {
    return { wx: forecastCache.wx, sun: forecastCache.sun, fromCache: true };
  }

  const wx = await fetchWeatherWindMulti(lat, lon);
  const sun = await fetchSunTimesMulti(lat, lon);

  forecastCache.key = k;
  forecastCache.ts = now;
  forecastCache.wx = wx;
  forecastCache.sun = sun;

  return { wx: wx, sun: sun, fromCache: false };
}

// ----------------------------
// Canvas line chart
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

  const yTop = maxV;
  const yMid = (minV + maxV) / 2;
  const yBot = minV;

  ctx.fillText(String(Math.round(yTop)) + " mph", 6, padT + 12);
  ctx.fillText(String(Math.round(yMid)) + " mph", 6, padT + h / 2 + 4);
  ctx.fillText(String(Math.round(yBot)) + " mph", 6, padT + h + 4);

  ctx.strokeStyle = "rgba(7,27,31,0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(points[0].mph));

  for (let i2 = 1; i2 < points.length; i2++) {
    ctx.lineTo(xFor(i2), yFor(points[i2].mph));
  }

  ctx.stroke();

  ctx.fillStyle = "rgba(7,27,31,0.70)";
  for (let d = 0; d < points.length; d++) {
    const xx = xFor(d);
    const yy2 = yFor(points[d].mph);
    ctx.beginPath();
    ctx.arc(xx, yy2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function hourLabel(dt) {
    try {
      return dt.toLocaleTimeString([], { hour: "numeric" });
    } catch (e) {
      return "";
    }
  }

  const iStart = 0;
  const iMid2 = Math.floor((points.length - 1) / 2);
  const iEnd = points.length - 1;

  ctx.fillStyle = "rgba(0,0,0,0.70)";
  ctx.textAlign = "left";
  ctx.fillText(hourLabel(points[iStart].dt), padL, padT + h + 18);

  ctx.textAlign = "center";
  ctx.fillText(hourLabel(points[iMid2].dt), xFor(iMid2), padT + h + 18);

  ctx.textAlign = "right";
  ctx.fillText(hourLabel(points[iEnd].dt), padL + w, padT + h + 18);

  ctx.textAlign = "left";
}

// ----------------------------
// Page titles
// ----------------------------
const PAGE_TITLES = {
  Home: "Weather/Wind + Best Times",
  "Trolling depth calculator": "Trolling Depth Calculator",
  "Species tips": "Species Tips",
  Speedometer: "Speedometer"
};

// ----------------------------
// Header + nav
// ----------------------------
function renderHeaderAndNav() {
  const title = PAGE_TITLES[state.tool] || "FishyNW Tools";

  app.innerHTML =
    '<div class="wrap">' +
    '  <div class="header">' +
    '    <div class="logo"><a href="' +
    escHtml(LOGO_LINK) +
    '" target="_blank" rel="noopener noreferrer"><img src="' +
    escHtml(LOGO_URL) +
    '" alt="FishyNW"></a></div>' +
    '    <div class="title">' +
    escHtml(title) +
    '<div class="small muted">v ' +
    escHtml(APP_VERSION) +
    "</div></div>" +
    "  </div>" +
    '  <div class="nav" id="nav"></div>' +
    '  <div id="page"></div>' +
    '  <div class="footer">' +
    '    <strong>FishyNW.com</strong><br>' +
    "    Independent Northwest fishing tools" +
    '    <div style="margin-top:8px;">' +
    '      <button id="open_disclaimer" type="button" style="background:rgba(0,0,0,0.06); border-color:rgba(0,0,0,0.16); color:rgba(0,0,0,0.78);">Disclaimer</button>' +
    "    </div>" +
    "  </div>" +
    "</div>";

  const nav = document.getElementById("nav");
  const items = [];

  if (state.tool !== "Home") items.push(["Home", "Home"]);
  items.push(["Depth", "Trolling depth calculator"]);
  items.push(["Tips", "Species tips"]);
  items.push(["Speed", "Speedometer"]);

  for (let i = 0; i < items.length; i++) {
    const label = items[i][0];
    const toolName = items[i][1];

    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = "navBtn";

    if (toolName === state.tool) {
      btn.classList.add("navBtnActive");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", function () {
        stopSpeedWatchIfRunning();
        state.tool = toolName;
        render();
      });
    }

    nav.appendChild(btn);
  }

  const discBtn = document.getElementById("open_disclaimer");
  if (discBtn) {
    discBtn.addEventListener("click", function () {
      openDisclaimerModal(true);
    });
  }
}

function pageEl() {
  return document.getElementById("page");
}

// ----------------------------
// Reusable location picker
// ----------------------------
function renderLocationPicker(container, placeKey, onResolved, opts) {
  const options = opts || {};
  const autoGps = !!options.autoGps;

  appendHtml(
    container,
    `
    <div class="card">
      <h3>Location</h3>
      <input id="${placeKey}_place" type="text"
        placeholder="Example: Spokane, WA or 99201 or Hauser Lake"
        style="width:100%;" />

      <div class="btnRow">
        <button id="${placeKey}_search">Search place</button>
        <button id="${placeKey}_gps">Use my location</button>
      </div>

      <div id="${placeKey}_matches" style="margin-top:10px;"></div>
      <div id="${placeKey}_using" class="small muted" style="margin-top:10px;"></div>
    </div>
    `
  );

  const usingEl = document.getElementById(placeKey + "_using");
  const matchesEl = document.getElementById(placeKey + "_matches");
  const placeInput = document.getElementById(placeKey + "_place");
  const gpsBtn = document.getElementById(placeKey + "_gps");
  const searchBtn = document.getElementById(placeKey + "_search");

  function renderUsing() {
    if (hasResolvedLocation()) {
      const lbl = state.placeLabel
        ? state.placeLabel
        : "Lat " + state.lat.toFixed(4) + ", Lon " + state.lon.toFixed(4);
      usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(lbl);
    } else {
      usingEl.textContent = "";
    }
  }

  if (hasResolvedLocation()) {
    placeInput.value = state.placeLabel ? state.placeLabel : "";
    renderUsing();
  }

  placeInput.addEventListener("input", function () {
    const raw = String(placeInput.value || "");
    const val = raw.trim();

    if (hasResolvedLocation()) {
      const currentLabel = String(state.placeLabel || "").trim();

      if (val && val !== currentLabel) {
        clearResolvedLocation();
        matchesEl.innerHTML = "";
        usingEl.textContent = "";
        if (typeof onResolved === "function") onResolved("auto_cleared_by_typing");
      }

      if (!val) {
        clearResolvedLocation();
        matchesEl.innerHTML = "";
        usingEl.textContent = "";
        if (typeof onResolved === "function") onResolved("auto_cleared_empty");
      }
    }
  });

  function doGps() {
    if (!navigator.geolocation) {
      usingEl.textContent = "Geolocation not supported on this device/browser.";
      return;
    }

    usingEl.textContent = "Requesting location permission...";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setResolvedLocation(lat, lon, "Current location");
        state.matches = [];
        state.selectedIndex = 0;
        matchesEl.innerHTML = "";

        placeInput.value = "Locating nearest city...";
        usingEl.innerHTML =
          "<strong>Using:</strong> Current location (" +
          lat.toFixed(4) +
          ", " +
          lon.toFixed(4) +
          ")";

        if (typeof onResolved === "function") onResolved("gps");

        reverseGeocode(lat, lon).then(function (label) {
          if (label) {
            setResolvedLocation(lat, lon, label);
            placeInput.value = label;
          } else {
            placeInput.value = "Current location";
          }

          renderUsing();
          if (typeof onResolved === "function") onResolved("gps_reverse");
        });
      },
      function (err) {
        usingEl.innerHTML =
          "<strong>Location error:</strong> " + escHtml(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 }
    );
  }

  gpsBtn.addEventListener("click", function () {
    doGps();
  });

  searchBtn.addEventListener("click", async function () {
    const q = normalizePlaceQuery(placeInput.value);
    if (!q) {
      usingEl.textContent = "Type a place name or ZIP, or use your location.";
      return;
    }

    usingEl.textContent = "Searching...";
    const matches = await geocodeSearch(q, 8);
    state.matches = matches;
    state.selectedIndex = 0;

    if (!matches.length) {
      matchesEl.innerHTML = "";
      usingEl.textContent = "No matches found.";
      return;
    }

    let html = '<div class="fieldLabel">Choose a result</div>';
    html += '<div style="display:grid; gap:8px;">';

    for (let i = 0; i < matches.length; i++) {
      html +=
        '<button type="button" id="' +
        placeKey +
        "_pick_" +
        i +
        '" style="background:#fff; color:rgba(0,0,0,0.82); border-color:rgba(0,0,0,0.14);">' +
        escHtml(matches[i].label) +
        "</button>";
    }

    html += "</div>";
    matchesEl.innerHTML = html;
    usingEl.textContent = "Select the best match.";

    for (let j = 0; j < matches.length; j++) {
      const btn = document.getElementById(placeKey + "_pick_" + j);
      if (!btn) continue;

      btn.addEventListener("click", function () {
        const m = matches[j];
        setResolvedLocation(m.lat, m.lon, m.label);
        placeInput.value = m.label;
        matchesEl.innerHTML = "";
        renderUsing();
        if (typeof onResolved === "function") onResolved("search_pick");
      });
    }
  });

  if (autoGps && !hasResolvedLocation()) {
    const last = loadLastLocation();
    if (last && Number.isFinite(last.lat) && Number.isFinite(last.lon)) {
      setResolvedLocation(last.lat, last.lon, last.label || "");
      placeInput.value = state.placeLabel || "";
      renderUsing();
      if (typeof onResolved === "function") onResolved("restored_last_location");
    }
  }
}

// ----------------------------
// Heuristic scoring for Home
// ----------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeTripRiskScore(day) {
  const wind = safeNum(day.windMax, 0);
  const gust = safeNum(day.gustMax, 0);
  const pop = safeNum(day.popMax, 0);
  const tmin = safeNum(day.tmin, 50);
  const tmax = safeNum(day.tmax, 65);

  let score = 0;

  score += clamp((wind - 5) * 3.2, 0, 45);
  score += clamp((gust - 10) * 1.6, 0, 25);
  score += clamp(pop * 0.22, 0, 22);

  if (tmin < 50 && pop >= 25) score += 10;
  if (tmax < 45) score += 8;

  if (state.craft === "Kayak (paddle)") score += 8;
  if (state.craft === "Kayak (motor)") score += 4;
  if (state.waterType === "Open / exposed") score += 10;
  if (state.waterType === "Big water / reservoir") score += 6;

  return clamp(Math.round(score), 0, 100);
}

function riskLabelFromScore(score, day) {
  const pop = safeNum(day.popMax, 0);
  const tmin = safeNum(day.tmin, 50);

  if (pop >= 35 && tmin < 50 && score < 45) return "CAUTION";
  if (score < 34) return "GO";
  if (score < 67) return "CAUTION";
  return "NO-GO";
}

function bestHoursFromSun(sunObj) {
  if (!sunObj) return null;

  const sunrise = new Date(sunObj.sunrise.getTime());
  const sunset = new Date(sunObj.sunset.getTime());

  const amStart = new Date(sunrise.getTime() - 45 * 60000);
  const amEnd = new Date(sunrise.getTime() + 90 * 60000);
  const pmStart = new Date(sunset.getTime() - 120 * 60000);
  const pmEnd = new Date(sunset.getTime() + 30 * 60000);

  return {
    amStart: amStart,
    amEnd: amEnd,
    pmStart: pmStart,
    pmEnd: pmEnd
  };
}

// ----------------------------
// Species tips
// ----------------------------
const SPECIES_DATA = [
  {
    key: "kokanee",
    label: "Kokanee",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/kokanee-salmon-fishynw.jpg",
    bullets: [
      "Troll light gear and keep speed consistent.",
      "Wedding rings, small hoochies, and small spoons are common producers.",
      "Early and late light windows are often best."
    ],
    extra: [
      "Kokanee often suspend, so depth control matters more than covering random water.",
      "If marks are stacked at one band, stay disciplined and keep gear in that zone."
    ]
  },
  {
    key: "rainbow",
    label: "Rainbow trout",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/rainbow-trout-fishynw.jpg",
    bullets: [
      "Cover water with spoons, spinners, and small plugs.",
      "Windblown banks and points can be productive.",
      "Morning can be excellent, but active fish can feed all day."
    ],
    extra: [
      "Rainbows often respond well to speed changes and slight turns.",
      "If trolling, inside and outside rod speeds can help trigger bites."
    ]
  },
  {
    key: "chinook",
    label: "Chinook salmon",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/chinook-salmon-fishynw.jpg",
    bullets: [
      "Keep presentation in the target depth band as long as possible.",
      "Hoochies, plugs, and flash-driven trolling presentations are common.",
      "Watch speed and turns carefully."
    ],
    extra: [
      "Deep presentations usually benefit from consistent boat control.",
      "Current, turns, and lure drag can all change effective running depth."
    ]
  },
  {
    key: "smallmouth",
    label: "Smallmouth bass",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/smallmouth-bass-fishynw.jpg",
    bullets: [
      "Jigs, drop shots, and moving baits can all produce.",
      "Rock, points, and transition banks are strong starting areas.",
      "Wind can position fish and improve the bite."
    ],
    extra: [
      "Smallmouth often group by depth and structure type.",
      "Once you find the right rock size, depth, and slope, duplicate it."
    ]
  },
  {
    key: "walleye",
    label: "Walleye",
    photo:
      "https://fishynw.com/wp-content/uploads/2025/08/walleye-fishynw.jpg",
    bullets: [
      "Slow trolling and controlled depth are usually important.",
      "Crawler harnesses, spinners, crankbaits, and jigs are common.",
      "Low light periods are often productive."
    ],
    extra: [
      "Walleye frequently hold near edges, breaks, and subtle structure.",
      "Precise speed control can matter as much as lure choice."
    ]
  }
];

function renderSpeciesTipsPage() {
  const page = pageEl();

  page.innerHTML =
    '<div class="card">' +
    "  <h2>Species tips</h2>" +
    '  <div class="small muted">Simple quick-reference notes. Match your local conditions and regulations.</div>' +
    '  <div class="fieldLabel" style="margin-top:12px;">Species</div>' +
    '  <select id="species_select"></select>' +
    '  <div id="species_content" style="margin-top:12px;"></div>' +
    "</div>";

  const sel = document.getElementById("species_select");
  const content = document.getElementById("species_content");

  for (let i = 0; i < SPECIES_DATA.length; i++) {
    const opt = document.createElement("option");
    opt.value = SPECIES_DATA[i].key;
    opt.textContent = SPECIES_DATA[i].label;
    sel.appendChild(opt);
  }

  function drawSpecies() {
    const val = String(sel.value || SPECIES_DATA[0].key);
    let item = SPECIES_DATA[0];

    for (let i = 0; i < SPECIES_DATA.length; i++) {
      if (SPECIES_DATA[i].key === val) {
        item = SPECIES_DATA[i];
        break;
      }
    }

    let html = '<div class="tile">';
    html += "<h3>" + escHtml(item.label) + "</h3>";
    html += '<ul class="list">';

    for (let j = 0; j < item.bullets.length; j++) {
      html += "<li>" + escHtml(item.bullets[j]) + "</li>";
    }

    html += "</ul>";

    if (item.extra && item.extra.length) {
      for (let k = 0; k < item.extra.length; k++) {
        html +=
          '<p class="small" style="margin-top:10px; color:rgba(0,0,0,0.78);">' +
          escHtml(item.extra[k]) +
          "</p>";
      }
    }

    if (item.photo) {
      html +=
        '<div class="speciesPhotoWrap">' +
        '  <img class="speciesPhoto" src="' +
        escHtml(item.photo) +
        '" alt="' +
        escHtml(item.label) +
        '">' +
        "</div>";
    }

    html += "</div>";
    content.innerHTML = html;
  }

  sel.addEventListener("change", drawSpecies);
  drawSpecies();
}

// ----------------------------
// Speedometer page
// ----------------------------
function renderSpeedometerPage() {
  const page = pageEl();

  page.innerHTML =
    '<div class="card">' +
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
    '  <div id="speed_msg" class="small muted" style="margin-top:10px;"></div>' +
    "</div>";

  const speedNow = document.getElementById("speed_now");
  const speedAcc = document.getElementById("speed_acc");
  const speedStatus = document.getElementById("speed_status");
  const speedMsg = document.getElementById("speed_msg");
  const startBtn = document.getElementById("speed_start");
  const stopBtn = document.getElementById("speed_stop");

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
}

// ============================
// app.js (PART 2 OF 3) END
// ============================
// ============================
// app.js (PART 3 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Home page
// ----------------------------
function renderHomePage() {
  const page = pageEl();

  page.innerHTML =
    '<div id="home_location_mount"></div>' +
    '<div class="card">' +
    "  <h2>Trip outlook</h2>" +
    '  <div class="small muted">Weather, wind, and best-time estimate for the selected day.</div>' +
    '  <div class="fieldLabel" style="margin-top:12px;">Date</div>' +
    '  <input id="home_date" type="date" />' +
    '  <div class="fieldLabel" style="margin-top:12px;">Water type</div>' +
    '  <select id="home_water">' +
    '    <option>Small / protected</option>' +
    '    <option>Big water / reservoir</option>' +
    '    <option>Open / exposed</option>' +
    "  </select>" +
    '  <div class="fieldLabel" style="margin-top:12px;">Craft</div>' +
    '  <select id="home_craft">' +
    '    <option>Kayak (paddle)</option>' +
    '    <option>Kayak (motor)</option>' +
    '    <option>Boat</option>' +
    "  </select>" +
    '  <div class="btnRow">' +
    '    <button id="home_load">Load outlook</button>' +
    "  </div>" +
    '  <div id="home_status" class="small muted" style="margin-top:10px;"></div>' +
    "</div>" +
    '<div id="home_results"></div>';

  const locMount = document.getElementById("home_location_mount");
  const dateEl = document.getElementById("home_date");
  const waterEl = document.getElementById("home_water");
  const craftEl = document.getElementById("home_craft");
  const loadBtn = document.getElementById("home_load");
  const statusEl = document.getElementById("home_status");
  const resultsEl = document.getElementById("home_results");

  renderLocationPicker(
    locMount,
    "home",
    function () {
      // no-op
    },
    { autoGps: true }
  );

  dateEl.value = isIsoDate(state.dateIso) ? state.dateIso : isoTodayLocal();
  waterEl.value = state.waterType;
  craftEl.value = state.craft;

  async function loadHome() {
    state.dateIso = isIsoDate(dateEl.value) ? dateEl.value : isoTodayLocal();
    state.waterType = String(waterEl.value || "Small / protected");
    state.craft = String(craftEl.value || "Kayak (paddle)");

    resultsEl.innerHTML = "";

    if (!hasResolvedLocation()) {
      statusEl.textContent = "Choose a location first.";
      return;
    }

    statusEl.textContent = "Loading forecast...";

    try {
      const bundle = await getForecastBundle(state.lat, state.lon);
      const wx = bundle.wx;
      const sun = bundle.sun;

      const daily = wx && wx.daily ? wx.daily : null;
      if (!daily || !daily.time || !daily.time.length) {
        statusEl.textContent = "Forecast data unavailable.";
        return;
      }

      const idx = daily.time.indexOf(state.dateIso);
      if (idx < 0) {
        statusEl.textContent = "That date is outside the current forecast window.";
        return;
      }

      const day = {
        dateIso: daily.time[idx],
        tmin: safeNum(daily.tmin[idx], 0),
        tmax: safeNum(daily.tmax[idx], 0),
        popMax: safeNum(daily.popMax[idx], 0),
        windMax: safeNum(daily.windMax[idx], 0),
        gustMax: safeNum(daily.gustMax[idx], 0)
      };

      const riskScore = computeTripRiskScore(day);
      const riskLabel = riskLabelFromScore(riskScore, day);
      const sunObj = sunForDate(sun, state.dateIso);
      const bite = bestHoursFromSun(sunObj);

      const hourlyPtsRaw = filterHourlyToDate(
        wx.hourly.time,
        wx.hourly.wind,
        state.dateIso
      );

      const hourlyPts = hourlyPtsRaw.map(function (x) {
        return { dt: x.dt, mph: safeNum(x.v, 0) };
      });

      let html = "";

      html += '<div class="card">';
      html += "  <h2>Forecast summary</h2>";
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
        escHtml(String(Math.round(day.tmax))) +
        " / " +
        escHtml(String(Math.round(day.tmin))) +
        " F</div>";
      html += '      <div class="tileSub">Daily air temperature</div>';
      html += "    </div>";

      html += '    <div class="tile">';
      html += '      <div class="tileTop">Wind / gust</div>';
      html +=
        '      <div class="tileVal">' +
        escHtml(String(Math.round(day.windMax))) +
        " / " +
        escHtml(String(Math.round(day.gustMax))) +
        " mph</div>";
      html += '      <div class="tileSub">Max forecast wind</div>';
      html += "    </div>";

      html += '    <div class="tile">';
      html += '      <div class="tileTop">Rain chance</div>';
      html +=
        '      <div class="tileVal">' +
        escHtml(String(Math.round(day.popMax))) +
        "%</div>";
      html += '      <div class="tileSub">Daily max precipitation probability</div>';
      html += "    </div>";

      html += '    <div class="tile">';
      html += '      <div class="tileTop">Trip call</div>';
      html +=
        '      <div class="tileVal">' + escHtml(riskLabel) + "</div>";
      html +=
        '      <div class="tileSub">Score: ' +
        escHtml(String(riskScore)) +
        " / 100</div>";
      html += "    </div>";
      html += "  </div>";

      html += '  <div class="statusRow">';
      html += '    <div class="small muted">Risk meter</div>';
      html += '    <div class="pill">' + escHtml(riskLabel) + "</div>";
      html += "  </div>";

      html +=
        '<div style="position:relative; margin-top:8px;">' +
        '  <div class="meterBar">' +
        '    <div class="meterSeg segG"></div>' +
        '    <div class="meterSeg segY"></div>' +
        '    <div class="meterSeg segR"></div>' +
        "  </div>" +
        '  <div class="meterNeedle" style="left:' +
        escHtml(String(riskScore)) +
        '%;"></div>' +
        "</div>";

      if (sunObj && bite) {
        html += '<div class="card compact">';
        html += "  <h3>Best times</h3>";
        html +=
          '  <div class="small"><strong>Sunrise:</strong> ' +
          escHtml(formatTime(sunObj.sunrise)) +
          " | <strong>Sunset:</strong> " +
          escHtml(formatTime(sunObj.sunset)) +
          "</div>";
        html +=
          '  <div class="small" style="margin-top:8px;"><strong>Morning window:</strong> ' +
          escHtml(formatTime(bite.amStart)) +
          " to " +
          escHtml(formatTime(bite.amEnd)) +
          "</div>";
        html +=
          '  <div class="small" style="margin-top:6px;"><strong>Evening window:</strong> ' +
          escHtml(formatTime(bite.pmStart)) +
          " to " +
          escHtml(formatTime(bite.pmEnd)) +
          "</div>";
        html += "</div>";
      }

      html +=
        '<div class="card">' +
        "  <h3>Hourly wind trend</h3>" +
        '  <div class="chartWrap"><canvas id="wind_chart" class="windChart"></canvas></div>' +
        "</div>";

      html += "</div>";

      resultsEl.innerHTML = html;

      const canvas = document.getElementById("wind_chart");
      drawWindLineChart(canvas, hourlyPts);

      statusEl.textContent = bundle.fromCache
        ? "Loaded from recent forecast cache."
        : "Forecast loaded.";
    } catch (e) {
      statusEl.textContent = "Error loading forecast: " + niceErr(e);
    }
  }

  loadBtn.addEventListener("click", loadHome);
}

// ----------------------------
// Depth calculator math
// ----------------------------
function getLineTypeFactor(lineType) {
  const x = String(lineType || "").toLowerCase();

  if (x.indexOf("braid") >= 0) return 1.08;
  if (x.indexOf("mono") >= 0) return 0.94;
  if (x.indexOf("fluoro") >= 0) return 1.00;
  if (x.indexOf("lead") >= 0) return 1.25;

  return 1.0;
}

function getLineTestFactor(lineTestLb) {
  const lb = safeNum(lineTestLb, 20);

  if (lb <= 6) return 1.08;
  if (lb <= 8) return 1.06;
  if (lb <= 10) return 1.04;
  if (lb <= 12) return 1.03;
  if (lb <= 15) return 1.01;
  if (lb <= 20) return 1.00;
  if (lb <= 30) return 0.95;
  if (lb <= 40) return 0.90;

  return 0.86;
}

function getSpeedFactor(speedMph) {
  const s = safeNum(speedMph, 1.5);

  if (s <= 0.8) return 1.18;
  if (s <= 1.0) return 1.12;
  if (s <= 1.2) return 1.06;
  if (s <= 1.4) return 1.02;
  if (s <= 1.6) return 1.00;
  if (s <= 1.8) return 0.95;
  if (s <= 2.0) return 0.91;
  if (s <= 2.3) return 0.86;
  if (s <= 2.6) return 0.80;
  if (s <= 3.0) return 0.72;

  return 0.64;
}

function calculateTrollingDepth(
  speedMph,
  weightOz,
  lineOutFt,
  lineTestLb,
  lineType
) {
  const speed = Math.max(0.1, safeNum(speedMph, 1.5));
  const weight = Math.max(0.1, safeNum(weightOz, 2));
  const lineOut = Math.max(1, safeNum(lineOutFt, 100));
  const lineFactor = getLineTypeFactor(lineType);
  const testFactor = getLineTestFactor(lineTestLb);
  const speedFactor = getSpeedFactor(speed);

  // Simple estimate, tuned for a practical mobile tool.
  const base = lineOut * (0.075 + weight * 0.0155);
  const depth = base * lineFactor * testFactor * speedFactor;

  return Math.max(0, depth);
}

// ----------------------------
// Depth calculator page
// ----------------------------
function renderDepthCalculatorPage() {
  const page = pageEl();

  let lureOptions = "";
  for (let i = 0; i < TROLLING_LURES.length; i++) {
    lureOptions +=
      '<option value="' +
      escHtml(TROLLING_LURES[i].value) +
      '">' +
      escHtml(TROLLING_LURES[i].label) +
      "</option>";
  }

  page.innerHTML =
    '<div class="card">' +
    "  <h2>Trolling Depth Calculator</h2>" +
    '  <div class="small muted">Simple estimate. Use as a starting point.</div>' +

    '  <div class="fieldLabel" style="margin-top:12px;">Speed (mph)</div>' +
    '  <input id="depth_speed" type="number" step="0.1" value="1.3">' +

    '  <div class="fieldLabel" style="margin-top:10px;">Weight (oz)</div>' +
    '  <input id="depth_weight" type="number" step="0.5" value="2">' +

    '  <div class="fieldLabel" style="margin-top:10px;">Line out (ft)</div>' +
    '  <input id="depth_lineout" type="number" step="1" value="100">' +

    '  <div class="fieldLabel" style="margin-top:10px;">Line test (lb)</div>' +
    '  <select id="depth_linetest">' +
    '    <option>4</option>' +
    '    <option>6</option>' +
    '    <option>8</option>' +
    '    <option>10</option>' +
    '    <option>12</option>' +
    '    <option>15</option>' +
    '    <option selected>20</option>' +
    '    <option>30</option>' +
    '    <option>40</option>' +
    "  </select>" +

    '  <div class="fieldLabel" style="margin-top:10px;">Line type</div>' +
    '  <select id="depth_linetype">' +
    '    <option selected>Braid</option>' +
    '    <option>Fluorocarbon</option>' +
    '    <option>Mono</option>' +
    '    <option>Lead core</option>' +
    "  </select>" +

    '  <div class="small muted" style="margin-top:8px;">Line type affects drag and sink behavior. Lead core is a different animal; this is still an estimate.</div>' +

    '  <div class="fieldLabel" style="margin-top:10px;">Lure (optional)</div>' +
    '  <select id="depth_lure">' +
    lureOptions +
    "  </select>" +

    '  <div class="small muted" id="depth_lure_note" style="margin-top:8px;">Depth is based on weight, line, and speed only.</div>' +

    '  <div class="btnRow">' +
    '    <button id="depth_calc_btn">Calculate</button>' +
    "  </div>" +

    '  <div id="depth_result"></div>' +
    '  <div id="depth_table_wrap"></div>' +
    "</div>";

  const speedEl = document.getElementById("depth_speed");
  const weightEl = document.getElementById("depth_weight");
  const lineOutEl = document.getElementById("depth_lineout");
  const lineTestEl = document.getElementById("depth_linetest");
  const lineTypeEl = document.getElementById("depth_linetype");
  const lureEl = document.getElementById("depth_lure");
  const lureNoteEl = document.getElementById("depth_lure_note");
  const calcBtn = document.getElementById("depth_calc_btn");
  const resultEl = document.getElementById("depth_result");
  const tableWrapEl = document.getElementById("depth_table_wrap");

  function updateLureNote() {
    const lure = getLureByValue(lureEl.value);
    lureNoteEl.textContent = lure.note || "";
  }

  function calculateAndRender() {
    const speed = safeNum(speedEl.value, 1.3);
    const weightOz = safeNum(weightEl.value, 2);
    const lineOutFt = safeNum(lineOutEl.value, 100);
    const lineTestLb = safeNum(lineTestEl.value, 20);
    const lineType = String(lineTypeEl.value || "Braid");
    const lureValue = String(lureEl.value || "");
    const lure = getLureByValue(lureValue);

    const baseDepth = calculateTrollingDepth(
      speed,
      weightOz,
      lineOutFt,
      lineTestLb,
      lineType
    );

    const finalDepth = applyLureDepthAdjustment(baseDepth, lureValue);

    let resultHtml = "";
    resultHtml += '<div class="card compact">';
    resultHtml +=
      '  <div style="font-size:18px; font-weight:900;">Estimated depth: ' +
      escHtml(finalDepth.toFixed(1)) +
      " ft</div>";
    resultHtml +=
      '  <div class="small muted" style="margin-top:8px;">' +
      "Line: " +
      escHtml(lineType) +
      " (" +
      escHtml(String(lineTestLb)) +
      " lb). ";

    if (lureValue) {
      resultHtml +=
        "Lure: " +
        escHtml(lure.label) +
        " (" +
        escHtml(
          (lure.depthBiasFt >= 0 ? "+" : "") + lure.depthBiasFt.toFixed(1)
        ) +
        " ft adjustment). ";
    } else {
      resultHtml += "No lure adjustment applied. ";
    }

    resultHtml +=
      "Current, rod angle, leader, dodgers, and lure drag can change results a lot." +
      "</div>";
    resultHtml += "</div>";
    resultEl.innerHTML = resultHtml;

    // build 0.5 oz table up to selected weight
    let tableHtml = "";
    tableHtml += '<div class="card">';
    tableHtml += "  <h3>Depth table</h3>";
    tableHtml +=
      '  <div class="small muted">Calculated every 0.5 oz up to your selected weight.</div>';
    tableHtml +=
      '  <div style="margin-top:12px; display:grid; gap:8px;">';

    const maxWeight = Math.max(0.5, weightOz);
    for (let w = 0.5; w <= maxWeight + 0.001; w += 0.5) {
      const roundedW = Math.round(w * 10) / 10;
      const baseRowDepth = calculateTrollingDepth(
        speed,
        roundedW,
        lineOutFt,
        lineTestLb,
        lineType
      );
      const rowDepth = applyLureDepthAdjustment(baseRowDepth, lureValue);

      tableHtml +=
        '<div class="tile" style="padding:10px 12px;">' +
        '  <div class="tileTop">' +
        escHtml(roundedW.toFixed(1)) +
        " oz</div>" +
        '  <div class="tileVal" style="font-size:20px;">' +
        escHtml(rowDepth.toFixed(1)) +
        " ft</div>" +
        "</div>";
    }

    tableHtml += "  </div>";
    tableHtml += "</div>";
    tableWrapEl.innerHTML = tableHtml;
  }

  lureEl.addEventListener("change", updateLureNote);
  calcBtn.addEventListener("click", calculateAndRender);

  updateLureNote();
  calculateAndRender();
}

// ----------------------------
// Main render
// ----------------------------
function render() {
  renderHeaderAndNav();

  if (state.tool === "Home") {
    renderHomePage();
    return;
  }

  if (state.tool === "Trolling depth calculator") {
    renderDepthCalculatorPage();
    return;
  }

  if (state.tool === "Species tips") {
    renderSpeciesTipsPage();
    return;
  }

  if (state.tool === "Speedometer") {
    renderSpeedometerPage();
    return;
  }

  const page = pageEl();
  page.innerHTML =
    '<div class="card"><h2>Tool not found</h2><div class="small muted">Choose a tool from the navigation.</div></div>';
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

  state.dateIso = isoTodayLocal();

  const last = loadLastLocation();
  if (last && Number.isFinite(last.lat) && Number.isFinite(last.lon)) {
    state.lat = Number(last.lat);
    state.lon = Number(last.lon);
    state.placeLabel = String(last.label || "");
  }

  render();
  renderConsentBannerIfNeeded();
  openDisclaimerModal(false);
})();

// ============================
// app.js (PART 3 OF 3) END
// ============================
