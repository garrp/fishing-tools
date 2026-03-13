// ============================
// app.js (PART 1 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
//
// NOTES (v1.2.4):
// - Added missing .grid2 layout class for the depth calculator.
// - Preparing shared Home refresh/resize state to avoid stacked listeners.
// - Trolling Depth Calculator will support optional common lure selection.
// - Rain + cold CAUTION logic retained.
// - Logo remains linked to https://fishynw.com.
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
// Safety disclaimer modal (single system)
// - Shows once per browser session unless "Do not show again" is checked.
// - Also can be opened from footer link (wired later).
// ----------------------------
const DISCLAIMER_ACK_KEY = "fishynw_disclaimer_ack_v1_2_4"; // "ack"
const DISCLAIMER_SESSION_KEY = "fishynw_disclaimer_session_v1_2_4"; // "shown"

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
  // Force = show even if "do not show again" is set.
  if (!force && getLocal(DISCLAIMER_ACK_KEY) === "ack") return;

  // Do not show repeatedly in the same tab session unless forced.
  if (!force && getSession(DISCLAIMER_SESSION_KEY) === "shown") return;

  // Already open?
  if (document.getElementById("disclaimer_overlay")) return;

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
    setSession(DISCLAIMER_SESSION_KEY, "shown");
    removeDisclaimerModal();
  });
}

// ----------------------------
// Persisted last location
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v2"; // {lat:number, lon:number, label:string}

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

  // Home uses this date (YYYY-MM-DD). Default set at boot to today, but USER can change it.
  dateIso: "",

  waterType: "Small / protected",
  craft: "Kayak (paddle)",

  // shared Home helpers
  homeRefreshFn: null,
  homeWindPoints: [],
  homeResizeTimer: null
};

// ----------------------------
// DOM
// ----------------------------
let app = null;

// ----------------------------
// Styles (mobile-first)
// ----------------------------
(function injectStyles() {
  const css = `
  :root {
    --green:#8fd19e; --green2:#7cc78f; --greenBorder:#6fbf87; --text:#0b2e13;
    --card:#f2f3f4; --stroke:rgba(0,0,0,0.14);
    --muted:rgba(0,0,0,0.62);
  }

  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#fff; }

  .wrap { max-width: 760px; margin: 0 auto; padding: 12px 12px 36px 12px; }

  .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:6px; }
  .logo { max-width: 60%; }
  .logo a { display:inline-block; }
  .logo img { width: 100%; max-width: 260px; height: auto; display:block; }

  .title { text-align:right; font-weight:900; font-size:18px; line-height:20px; }
  .small { font-size: 13px; opacity:0.92; }
  .muted { color: var(--muted); }

  .nav { margin-top: 12px; margin-bottom: 10px; display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

  .navBtn {
    width:100%;
    padding:10px 12px;
    border-radius:10px;
    border:1px solid var(--greenBorder);
    background: var(--green);
    color: var(--text);
    font-weight:900;
    cursor:pointer;
  }
  .navBtn:hover { background: var(--green2); }
  .navBtn:active { background: #6bbb83; }
  .navBtnActive {
    background: #e9f6ee;
    border-color: rgba(0,0,0,0.18);
    color: rgba(0,0,0,0.78);
    cursor: default;
  }

  .card {
    border-radius: 16px;
    padding: 14px;
    margin-top: 12px;
    border: 1px solid var(--stroke);
    background: var(--card);
  }
  .compact { margin-top: 10px; padding: 12px 14px; background: rgba(0,0,0,0.03); }

  h2 { margin: 0 0 6px 0; font-size: 18px; }
  h3 { margin: 0 0 8px 0; font-size: 16px; }

  input, select {
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
    background: var(--green);
    color: var(--text);
    font-weight:900;
    cursor:pointer;
  }
  button:hover { background: var(--green2); }
  button:active { background:#6bbb83; }
  button:disabled { background:#cfe8d6; color:#6b6b6b; border-color:#b6d6c1; cursor:not-allowed; }

  .btnRow { display:flex; gap:10px; margin-top:10px; }
  .btnRow > button { flex: 1; }

  .footer {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid var(--stroke);
    text-align:center;
    font-size: 13px;
    opacity:0.90;
  }

  .sectionTitle { margin-top: 12px; font-weight: 900; }
  .list { margin: 8px 0 0 18px; }
  .list li { margin-bottom: 6px; }

  .fieldLabel { font-size: 13px; font-weight: 900; opacity:0.86; margin-bottom:6px; }

  .grid2 {
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .tilesGrid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .tile {
    background:#fff;
    border:1px solid var(--stroke);
    border-radius:14px;
    padding: 12px;
  }
  .tileTop { font-size: 13px; font-weight: 900; opacity:0.8; }
  .tileVal { margin-top:8px; font-size: 24px; font-weight: 900; }
  .tileSub { margin-top:6px; font-size: 12px; opacity:0.75; }

  .toggleRow { display:flex; gap:10px; }
  .toggleBtn {
    flex:1;
    padding: 12px 12px;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(255,255,255,0.80);
    color: rgba(0,0,0,0.78);
    font-weight: 900;
  }
  .toggleBtn.toggleActive {
    background: rgba(143,209,158,0.45);
    border-color: rgba(111,191,135,0.85);
    color: rgba(0,0,0,0.82);
  }

  .statusRow { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; }
  .pill {
    padding: 8px 12px;
    border-radius: 999px;
    font-weight: 900;
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(0,0,0,0.04);
    min-width: 88px;
    text-align:center;
  }

  .meterBar { margin-top:10px; height: 16px; border-radius: 999px; overflow:hidden; border: 1px solid rgba(0,0,0,0.12); display:flex; }
  .meterSeg { height:100%; }
  .segG { width:34%; background: rgba(143,209,158,0.8); }
  .segY { width:33%; background: rgba(255,214,102,0.85); }
  .segR { width:33%; background: rgba(244,163,163,0.88); }

  .meterNeedle {
    position:absolute;
    top:-7px;
    width: 0; height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 12px solid rgba(0,0,0,0.72);
    transform: translateX(-8px);
  }

  .chartWrap { margin-top: 10px; }
  canvas.windChart {
    width: 100%;
    height: 180px;
    display: block;
    border-radius: 12px;
    background: rgba(255,255,255,0.9);
    border: 1px solid rgba(0,0,0,0.12);
  }

  .speciesPhotoWrap { margin-top: 10px; margin-bottom: 0; }
  .speciesPhoto {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 12px;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.9);
  }

  .consentBar {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    padding: 12px;
    background: rgba(255,255,255,0.98);
    border-top: 1px solid var(--stroke);
    z-index: 9999;
  }
  .consentInner {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .consentText { font-size: 13px; line-height: 16px; opacity: 0.92; }
  .consentBtns { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; min-width:240px; }
  .consentBtn { width:auto; padding:10px 12px; border-radius:12px; }
  .consentDecline {
    background: #f4a3a3 !important;
    border-color: #e48f8f !important;
    color: #3b0a0a !important;
  }
  .consentDecline:hover { background: #ee8f8f !important; }

  .modalOverlay {
    position: fixed;
    left: 0; right: 0; top: 0; bottom: 0;
    background: rgba(0,0,0,0.55);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modalCard {
    width: 100%;
    max-width: 560px;
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.18);
    box-shadow: 0 10px 28px rgba(0,0,0,0.25);
    overflow: hidden;
  }
  .modalHead {
    padding: 14px 14px 10px 14px;
    background: rgba(0,0,0,0.03);
    border-bottom: 1px solid rgba(0,0,0,0.10);
    font-weight: 900;
  }
  .modalBody {
    padding: 14px;
    font-size: 14px;
    line-height: 18px;
    color: rgba(0,0,0,0.82);
  }
  .modalBody p { margin: 0 0 10px 0; }
  .modalFoot {
    padding: 12px 14px 14px 14px;
    border-top: 1px solid rgba(0,0,0,0.10);
  }
  .modalRow {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .modalCheck {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: rgba(0,0,0,0.75);
  }
  .modalBtnRow { display:flex; gap:10px; margin-top: 10px; }
  .modalBtnRow > button { flex: 1; }

  @media (max-width: 520px) {
    .wrap { padding: 10px 10px 30px 10px; }
    .header { flex-direction: column; align-items:center; justify-content:center; gap:8px; }
    .logo { max-width: 88%; }
    .logo img { max-width: 280px; margin: 0 auto; }
    .title { text-align:center; font-size: 18px; }

    .nav { grid-template-columns: repeat(2, 1fr); gap:10px; }
    .grid2 { grid-template-columns: 1fr; }

    canvas.windChart { height: 160px; }

    .consentInner { flex-direction: column; align-items: stretch; }
    .consentBtns { justify-content: stretch; min-width: 0; }
    .consentBtn { width: 100%; }
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
// Forecast bundle cache (7-day pack)
// - prevents refetching on every small UI change
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
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Location resolve helpers (and cache busting)
// ----------------------------
function setResolvedLocation(lat, lon, label) {
  state.lat = Number(lat);
  state.lon = Number(lon);
  state.placeLabel = String(label || "");
  saveLastLocation(state.lat, state.lon, state.placeLabel);

  // bust forecast cache
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
// API: Sunrise/Sunset (7 days)
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

  return { sunrise: new Date(sr), sunset: new Date(ss) };
}

// ----------------------------
// API: Weather/Wind multi (7 days)
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
// Simple canvas line chart (wind)
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

  ctx.strokeStyle = "rgba(7,27,31,0.75)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(points[0].mph));

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(xFor(i), yFor(points[i].mph));
  }

  ctx.stroke();

  ctx.fillStyle = "rgba(7,27,31,0.7)";
  for (let d = 0; d < points.length; d++) {
    const xx = xFor(d);
    const yy = yFor(points[d].mph);
    ctx.beginPath();
    ctx.arc(xx, yy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================
// app.js (PART 2 OF 4) END
// ============================
// ============================
// app.js (PART 3 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Exposure + GO logic
// ----------------------------
function compute120RuleLabel(tempF, windMph) {
  const t = Number(tempF);
  const w = Number(windMph);

  if (!Number.isFinite(t) || !Number.isFinite(w)) return "UNKNOWN";

  const wc = t - w * 0.7;

  if (wc >= 60) return "GREEN";
  if (wc >= 40) return "CAUTION";
  return "RED";
}

function computeGoStatus(windMph, gustMph, pop, tempMin) {
  const w = Number(windMph);
  const g = Number(gustMph);
  const p = Number(pop);
  const t = Number(tempMin);

  let status = "GO";

  if (w >= 18 || g >= 25) status = "NO-GO";
  else if (w >= 12 || g >= 18) status = "CAUTION";

  // rain + cold rule
  if (p >= 40 && t < 50 && status === "GO") status = "CAUTION";

  return status;
}

function computeExposureTips(status) {
  if (status === "NO-GO") {
    return [
      "Consider postponing.",
      "High wind or gust risk.",
      "Small craft can become unstable quickly."
    ];
  }

  if (status === "CAUTION") {
    return [
      "Stay near shore.",
      "Monitor wind direction shifts.",
      "Have a safe return route."
    ];
  }

  return [
    "Conditions generally favorable.",
    "Continue monitoring weather.",
    "Wear safety gear and stay aware."
  ];
}

// ----------------------------
// Trolling depth calculator
// ----------------------------

// baseline depth model for bare weight
function calcDepth(weightOz, lineFt, speedMph) {
  const w = Number(weightOz);
  const l = Number(lineFt);
  const s = Number(speedMph);

  if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(s))
    return 0;

  const drag = 1 + s * 0.7;
  const depth = (w * l) / (12 * drag);

  return Math.max(0, depth);
}

// common trolling lure offsets (feet)
const lureProfiles = {
  none: { label: "None / weight only", offset: 0 },
  weddingRing: { label: "Wedding Ring spinner", offset: -3 },
  hoochie: { label: "Hoochie squid", offset: -4 },
  apex: { label: "Apex trolling lure", offset: +5 },
  rapala: { label: "Rapala / minnow plug", offset: +3 },
  spoon: { label: "Trolling spoon", offset: +2 }
};

function renderDepthTool() {
  stopSpeedWatchIfRunning();

  app.innerHTML =
    '<div class="card">' +
    "<h2>Trolling Depth Calculator</h2>" +
    '<div class="grid2" style="margin-top:12px;">' +
    '<div><div class="fieldLabel">Weight (oz)</div><input id="depth_weight" type="number" value="4"></div>' +
    '<div><div class="fieldLabel">Line out (ft)</div><input id="depth_line" type="number" value="100"></div>' +
    '<div><div class="fieldLabel">Speed (mph)</div><input id="depth_speed" type="number" value="1.5" step="0.1"></div>' +
    '<div><div class="fieldLabel">Lure (optional)</div>' +
    '<select id="depth_lure">' +
    '<option value="none">None / weight only</option>' +
    '<option value="weddingRing">Wedding Ring spinner</option>' +
    '<option value="hoochie">Hoochie squid</option>' +
    '<option value="apex">Apex trolling lure</option>' +
    '<option value="rapala">Rapala / minnow plug</option>' +
    '<option value="spoon">Trolling spoon</option>' +
    "</select></div>" +
    "</div>" +
    '<div class="btnRow" style="margin-top:12px;">' +
    '<button id="depth_calc">Calculate</button>' +
    "</div>" +
    '<div id="depth_result" class="sectionTitle"></div>' +
    "</div>";

  document
    .getElementById("depth_calc")
    .addEventListener("click", function () {
      const w = Number(document.getElementById("depth_weight").value);
      const l = Number(document.getElementById("depth_line").value);
      const s = Number(document.getElementById("depth_speed").value);
      const lure = document.getElementById("depth_lure").value;

      let depth = calcDepth(w, l, s);

      if (lureProfiles[lure]) depth += lureProfiles[lure].offset;

      depth = Math.max(0, depth);

      document.getElementById("depth_result").innerHTML =
        "Estimated depth: <strong>" +
        depth.toFixed(1) +
        " ft</strong>";
    });
}

// ----------------------------
// Species tips
// ----------------------------
const speciesTips = {
  bass: {
    name: "Bass",
    tips: [
      "Target structure like rocks, docks, and weed edges.",
      "Early morning and evening are prime feeding windows.",
      "Use slower presentations when water is cold."
    ]
  },
  trout: {
    name: "Trout",
    tips: [
      "Look for cooler oxygen rich water.",
      "Trolling spoons and small plugs are effective.",
      "Watch depth changes and thermoclines."
    ]
  },
  kokanee: {
    name: "Kokanee",
    tips: [
      "Troll slowly around 1.0 to 1.5 mph.",
      "Use bright dodgers and small hoochies.",
      "Depth changes through the season."
    ]
  }
};

function renderSpeciesTips() {
  stopSpeedWatchIfRunning();

  let html =
    '<div class="card"><h2>Species Tips</h2>' +
    '<div class="grid2" style="margin-top:12px;">';

  Object.keys(speciesTips).forEach(function (k) {
    html +=
      '<button class="speciesBtn" data-k="' +
      k +
      '">' +
      escHtml(speciesTips[k].name) +
      "</button>";
  });

  html += "</div><div id=\"species_content\" style=\"margin-top:12px;\"></div></div>";

  app.innerHTML = html;

  const btns = document.querySelectorAll(".speciesBtn");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      const k = b.getAttribute("data-k");
      const s = speciesTips[k];
      if (!s) return;

      let out = "<h3>" + escHtml(s.name) + "</h3><ul class=\"list\">";
      s.tips.forEach(function (t) {
        out += "<li>" + escHtml(t) + "</li>";
      });
      out += "</ul>";

      document.getElementById("species_content").innerHTML = out;
    });
  });
}

// ----------------------------
// Speed tool (GPS)
// ----------------------------
function renderSpeedTool() {
  app.innerHTML =
    '<div class="card">' +
    "<h2>Speed</h2>" +
    '<div class="sectionTitle">Current speed</div>' +
    '<div id="speed_val" class="tileVal">--</div>' +
    '<div class="btnRow" style="margin-top:12px;">' +
    '<button id="speed_start">Start</button>' +
    '<button id="speed_stop">Stop</button>' +
    "</div>" +
    "</div>";

  document
    .getElementById("speed_start")
    .addEventListener("click", function () {
      if (!navigator.geolocation) return;

      stopSpeedWatchIfRunning();

      state.speedWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          const sp = Number(pos.coords.speed || 0) * 2.23694;
          document.getElementById("speed_val").innerHTML =
            sp.toFixed(1) + " mph";
        },
        function () {},
        { enableHighAccuracy: true }
      );
    });

  document
    .getElementById("speed_stop")
    .addEventListener("click", function () {
      stopSpeedWatchIfRunning();
    });
}

// ============================
// app.js (PART 3 OF 4) END
// ============================
// ============================
// app.js (PART 4 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.4
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Home / weather tool
// ----------------------------
function renderHome() {
  stopSpeedWatchIfRunning();

  app.innerHTML =
    '<div class="wrap">' +
    '  <div class="header">' +
    '    <div class="logo"><a href="' +
    escHtml(LOGO_LINK) +
    '" target="_blank" rel="noopener noreferrer"><img src="' +
    escHtml(LOGO_URL) +
    '" alt="FishyNW"></a></div>' +
    '    <div class="title">Weather/Wind + Best Times<div class="small muted">v ' +
    escHtml(APP_VERSION) +
    "</div></div>" +
    "  </div>" +
    '  <div class="nav">' +
    '    <button class="navBtn navBtnActive" disabled>Home</button>' +
    '    <button class="navBtn" id="nav_depth">Depth</button>' +
    '    <button class="navBtn" id="nav_tips">Tips</button>' +
    '    <button class="navBtn" id="nav_speed">Speed</button>' +
    "  </div>" +
    '  <div class="card">' +
    "    <h2>Weather/Wind + Best Times</h2>" +
    '    <div class="small muted">Pick a date, choose location, and check a simple small-craft planning view.</div>' +
    '    <div style="margin-top:12px;">' +
    '      <div class="fieldLabel">Date</div>' +
    '      <input id="home_date" type="date">' +
    "    </div>" +
    '    <div style="margin-top:12px;">' +
    '      <div class="fieldLabel">Place</div>' +
    '      <input id="home_place" type="text" placeholder="Example: Spokane, WA">' +
    "    </div>" +
    '    <div class="btnRow">' +
    '      <button id="home_search">Search place</button>' +
    '      <button id="home_gps">Use my location</button>' +
    "    </div>" +
    '    <div id="home_matches" style="margin-top:10px;"></div>' +
    '    <div id="home_using" class="small muted" style="margin-top:10px;"></div>' +
    "  </div>" +
    '  <div id="home_dynamic"></div>' +
    '  <div class="footer">' +
    '    <strong>FishyNW.com</strong><br>' +
    "    Independent Northwest fishing tools" +
    '    <div style="margin-top:8px;">' +
    '      <button id="open_disclaimer" type="button" style="background:rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.16); color: rgba(0,0,0,0.78);">Disclaimer</button>' +
    "    </div>" +
    "  </div>" +
    "</div>";

  document.getElementById("nav_depth").addEventListener("click", function () {
    state.tool = "Depth";
    renderRouter();
  });

  document.getElementById("nav_tips").addEventListener("click", function () {
    state.tool = "Tips";
    renderRouter();
  });

  document.getElementById("nav_speed").addEventListener("click", function () {
    state.tool = "Speed";
    renderRouter();
  });

  document
    .getElementById("open_disclaimer")
    .addEventListener("click", function () {
      openDisclaimerModal(true);
    });

  const dateEl = document.getElementById("home_date");
  const placeEl = document.getElementById("home_place");
  const usingEl = document.getElementById("home_using");
  const matchesEl = document.getElementById("home_matches");

  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  dateEl.value = state.dateIso;

  if (hasResolvedLocation()) {
    placeEl.value = state.placeLabel || "";
    usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(state.placeLabel);
  }

  dateEl.addEventListener("change", function () {
    const v = String(dateEl.value || "").trim();
    if (isIsoDate(v)) state.dateIso = v;
    if (state.homeRefreshFn) state.homeRefreshFn("date_change");
  });

  placeEl.addEventListener("input", function () {
    const raw = String(placeEl.value || "").trim();
    if (!raw && hasResolvedLocation()) {
      clearResolvedLocation();
      matchesEl.innerHTML = "";
      usingEl.textContent = "";
      const dyn = document.getElementById("home_dynamic");
      if (dyn) dyn.innerHTML = "";
    }
  });

  async function refreshHome(reason) {
    state.homeRefreshFn = refreshHome;

    const dyn = document.getElementById("home_dynamic");
    if (!dyn) return;
    dyn.innerHTML = "";

    if (!hasResolvedLocation()) return;

    dyn.innerHTML =
      '<div class="card compact">' +
      "  <div><strong>Loading forecast...</strong></div>" +
      '  <div class="small muted">Building tiles, wind chart, and best times for the selected date.</div>' +
      "</div>";

    let wx = null;
    let sun = null;

    try {
      const bundle = await getForecastBundle(state.lat, state.lon);
      wx = bundle.wx;
      sun = bundle.sun;
    } catch (e) {
      dyn.innerHTML =
        '<div class="card"><strong>Could not load data.</strong><div class="small muted" style="margin-top:6px;">' +
        escHtml(niceErr(e)) +
        "</div></div>";
      return;
    }

    const chosenIso = isIsoDate(state.dateIso) ? state.dateIso : isoTodayLocal();
    const dailyDates = wx && wx.daily && wx.daily.time ? wx.daily.time : [];
    const idx = dailyDates.indexOf(chosenIso);

    if (idx < 0) {
      dyn.innerHTML =
        '<div class="card"><strong>Date not available.</strong><div class="small muted" style="margin-top:6px;">Forecast data was not returned for ' +
        escHtml(chosenIso) +
        ".</div></div>";
      return;
    }

    const tmin = safeNum(wx.daily.tmin[idx], 0);
    const tmax = safeNum(wx.daily.tmax[idx], 0);
    const pop = safeNum(wx.daily.popMax[idx], 0);
    const windMax = safeNum(wx.daily.windMax[idx], 0);
    const gustMax = safeNum(wx.daily.gustMax[idx], 0);

    const status = computeGoStatus(windMax, gustMax, pop, tmin);
    const exposureTips = computeExposureTips(status);

    const sunInfo = sunForDate(sun, chosenIso);
    let windowsHtml = "<li>No sunrise/sunset data.</li>";
    if (sunInfo) {
      const sunrise = sunInfo.sunrise;
      const sunset = sunInfo.sunset;

      const dawnStart = new Date(sunrise.getTime() - 90 * 60 * 1000);
      const dawnEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
      const duskStart = new Date(sunset.getTime() - 60 * 60 * 1000);
      const duskEnd = new Date(sunset.getTime() + 90 * 60 * 1000);

      windowsHtml =
        "<li><strong>Dawn window:</strong> " +
        escHtml(formatTime(dawnStart)) +
        " to " +
        escHtml(formatTime(dawnEnd)) +
        "</li>" +
        "<li><strong>Dusk window:</strong> " +
        escHtml(formatTime(duskStart)) +
        " to " +
        escHtml(formatTime(duskEnd)) +
        "</li>";
    }

    const pointsRaw = filterHourlyToDate(
      wx.hourly.time || [],
      wx.hourly.wind || [],
      chosenIso
    );

    const points = [];
    for (let i = 0; i < pointsRaw.length; i++) {
      if (i % 2 === 0) {
        points.push({
          dt: pointsRaw[i].dt,
          mph: safeNum(pointsRaw[i].v, 0)
        });
      }
    }

    if (points.length < 2) {
      for (let j = 0; j < pointsRaw.length; j++) {
        points.push({
          dt: pointsRaw[j].dt,
          mph: safeNum(pointsRaw[j].v, 0)
        });
      }
    }

    state.homeWindPoints = points.slice();

    dyn.innerHTML =
      '<div class="card">' +
      "  <h3>Overview - " +
      escHtml(chosenIso) +
      "</h3>" +
      '  <div class="tilesGrid">' +
      '    <div class="tile"><div class="tileTop">Temperature</div><div class="tileVal">' +
      escHtml(String(Math.round(tmin))) +
      " to " +
      escHtml(String(Math.round(tmax))) +
      ' F</div><div class="tileSub">Daily min / max</div></div>' +
      '    <div class="tile"><div class="tileTop">Rain chance (max)</div><div class="tileVal">' +
      escHtml(String(Math.round(pop))) +
      ' %</div><div class="tileSub">Peak probability</div></div>' +
      '    <div class="tile"><div class="tileTop">Max sustained wind</div><div class="tileVal">' +
      escHtml(String(Math.round(windMax))) +
      ' mph</div><div class="tileSub">Day max</div></div>' +
      '    <div class="tile"><div class="tileTop">Max gust</div><div class="tileVal">' +
      escHtml(String(Math.round(gustMax))) +
      ' mph</div><div class="tileSub">Day max</div></div>' +
      "  </div>" +
      '  <div class="statusRow">' +
      '    <div class="sectionTitle">Boating / Kayak status</div>' +
      '    <div class="pill" id="status_pill">' +
      escHtml(status) +
      "</div>" +
      "  </div>" +
      "</div>" +
      '<div class="card">' +
      "  <h3>Hourly wind (line chart)</h3>" +
      '  <div class="small muted">Wind speed at 10m in mph for the selected date.</div>' +
      '  <div class="chartWrap"><canvas id="wind_canvas" class="windChart"></canvas></div>' +
      "</div>" +
      '<div class="card">' +
      "  <h3>Best fishing windows</h3>" +
      '  <ul class="list">' +
      windowsHtml +
      "  </ul>" +
      "</div>" +
      '<div class="card">' +
      "  <h3>Exposure tips</h3>" +
      '  <ul class="list">' +
      exposureTips
        .map(function (t) {
          return "<li>" + escHtml(t) + "</li>";
        })
        .join("") +
      "  </ul>" +
      "</div>";

    const pill = document.getElementById("status_pill");
    if (pill) {
      if (status === "GO") pill.style.background = "rgba(143,209,158,0.55)";
      if (status === "CAUTION") pill.style.background = "rgba(255,214,102,0.65)";
      if (status === "NO-GO") pill.style.background = "rgba(244,163,163,0.70)";
    }

    const canvas = document.getElementById("wind_canvas");
    drawWindLineChart(canvas, points);
  }

  document
    .getElementById("home_search")
    .addEventListener("click", async function () {
      const q = normalizePlaceQuery(placeEl.value);
      if (!q) {
        usingEl.textContent = "Type a place name or ZIP, or use your location.";
        return;
      }

      usingEl.textContent = "Searching...";
      const matches = await geocodeSearch(q, 10);
      state.matches = matches;
      state.selectedIndex = 0;

      if (!matches.length) {
        matchesEl.innerHTML = "";
        usingEl.textContent = "No matches. Try City, State or ZIP.";
        return;
      }

      matchesEl.innerHTML =
        '<div class="small"><strong>Choose the correct match</strong></div>' +
        '<select id="home_select" style="margin-top:8px;">' +
        matches
          .map(function (m, i) {
            return '<option value="' + i + '">' + escHtml(m.label) + "</option>";
          })
          .join("") +
        "</select>" +
        '<div style="margin-top:10px;"><button id="home_use">Use this place</button></div>';

      document
        .getElementById("home_select")
        .addEventListener("change", function (e) {
          state.selectedIndex = Number(e.target.value);
        });

      document
        .getElementById("home_use")
        .addEventListener("click", function () {
          const chosen = state.matches[state.selectedIndex];
          if (!chosen) return;

          setResolvedLocation(chosen.lat, chosen.lon, chosen.label);
          placeEl.value = chosen.label;
          matchesEl.innerHTML = "";
          usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(chosen.label);
          refreshHome("search_pick");
        });

      usingEl.textContent = "";
    });

  document
    .getElementById("home_gps")
    .addEventListener("click", function () {
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
          usingEl.innerHTML =
            "<strong>Using:</strong> Current location (" +
            lat.toFixed(4) +
            ", " +
            lon.toFixed(4) +
            ")";

          refreshHome("gps");

          reverseGeocode(lat, lon).then(function (label) {
            if (label) {
              setResolvedLocation(lat, lon, label);
              placeEl.value = label;
              usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(label);
              refreshHome("gps_reverse");
            }
          });
        },
        function (err) {
          usingEl.innerHTML =
            "<strong>Location error:</strong> " + escHtml(err.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 }
      );
    });

  if (!hasResolvedLocation()) {
    setTimeout(function () {
      if (!navigator.geolocation || hasResolvedLocation()) return;
      document.getElementById("home_gps").click();
    }, 450);
  } else {
    refreshHome("init_existing_location");
  }
}

// ----------------------------
// Router shell for non-home views
// ----------------------------
function renderShell(title) {
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
    '  <div class="nav">' +
    '    <button class="navBtn" id="nav_home">Home</button>' +
    '    <button class="navBtn" id="nav_depth">Depth</button>' +
    '    <button class="navBtn" id="nav_tips">Tips</button>' +
    '    <button class="navBtn" id="nav_speed">Speed</button>' +
    "  </div>" +
    '  <div id="tool_mount"></div>' +
    '  <div class="footer">' +
    '    <strong>FishyNW.com</strong><br>' +
    "    Independent Northwest fishing tools" +
    '    <div style="margin-top:8px;">' +
    '      <button id="open_disclaimer" type="button" style="background:rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.16); color: rgba(0,0,0,0.78);">Disclaimer</button>' +
    "    </div>" +
    "  </div>" +
    "</div>";

  document.getElementById("nav_home").addEventListener("click", function () {
    state.tool = "Home";
    renderRouter();
  });

  document.getElementById("nav_depth").addEventListener("click", function () {
    state.tool = "Depth";
    renderRouter();
  });

  document.getElementById("nav_tips").addEventListener("click", function () {
    state.tool = "Tips";
    renderRouter();
  });

  document.getElementById("nav_speed").addEventListener("click", function () {
    state.tool = "Speed";
    renderRouter();
  });

  document
    .getElementById("open_disclaimer")
    .addEventListener("click", function () {
      openDisclaimerModal(true);
    });

  const activeMap = {
    Home: "nav_home",
    Depth: "nav_depth",
    Tips: "nav_tips",
    Speed: "nav_speed"
  };

  const activeId = activeMap[state.tool];
  if (activeId) {
    const btn = document.getElementById(activeId);
    if (btn) {
      btn.classList.add("navBtnActive");
      btn.disabled = true;
    }
  }
}

function mountToolHtml(html) {
  const mount = document.getElementById("tool_mount");
  if (mount) mount.innerHTML = html;
}

// ----------------------------
// Router
// ----------------------------
function renderRouter() {
  renderConsentBannerIfNeeded();
  openDisclaimerModal(false);

  if (!hasResolvedLocation()) {
    const last = loadLastLocation();
    if (last) setResolvedLocation(last.lat, last.lon, last.label || "");
  }

  if (state.tool === "Home") {
    renderHome();
    return;
  }

  if (state.tool === "Depth") {
    renderShell("Trolling Depth Calculator");
    const mount = document.getElementById("tool_mount");
    if (mount) {
      mount.innerHTML = "";
      const oldApp = app;
      app = mount;
      renderDepthTool();
      app = oldApp;
    }
    return;
  }

  if (state.tool === "Tips") {
    renderShell("Species Tips");
    const mount = document.getElementById("tool_mount");
    if (mount) {
      mount.innerHTML = "";
      const oldApp = app;
      app = mount;
      renderSpeciesTips();
      app = oldApp;
    }
    return;
  }

  if (state.tool === "Speed") {
    renderShell("Speed");
    const mount = document.getElementById("tool_mount");
    if (mount) {
      mount.innerHTML = "";
      const oldApp = app;
      app = mount;
      renderSpeedTool();
      app = oldApp;
    }
    return;
  }

  state.tool = "Home";
  renderHome();
}

// ----------------------------
// Shared listeners
// ----------------------------
window.addEventListener("resize", function () {
  if (!state.homeWindPoints || state.homeWindPoints.length < 2) return;
  if (!document.getElementById("wind_canvas")) return;

  clearTimeout(state.homeResizeTimer);
  state.homeResizeTimer = setTimeout(function () {
    const c = document.getElementById("wind_canvas");
    if (c) drawWindLineChart(c, state.homeWindPoints);
  }, 150);
});

document.addEventListener("visibilitychange", function () {
  if (
    document.visibilityState === "visible" &&
    state.tool === "Home" &&
    hasResolvedLocation() &&
    typeof state.homeRefreshFn === "function"
  ) {
    state.homeRefreshFn("resume_visible");
  }
});

// ----------------------------
// Boot
// ----------------------------
document.addEventListener("DOMContentLoaded", function () {
  app = document.getElementById("app");
  if (!app) return;

  state.tool = "Home";
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();

  try {
    window.scrollTo(0, 0);
  } catch (e) {
    // ignore
  }

  renderRouter();
});

// ============================
// app.js (PART 4 OF 4) END
// ============================
