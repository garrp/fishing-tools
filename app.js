// ============================
// app.js (PART 1 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.3
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
//
// NOTES (v1.2.3):
// - Logo is now a hyperlink to https://fishynw.com (no UI redesign; same header layout).
// - GO/CAUTION/NO-GO logic: if rain is likely AND temps are cold (rain + under 50F), enforce at least CAUTION.
// - Species Tips expanded into "encyclopedia" style (kept same UI structure; dropdown + content).
// - NEW (no UI change): Species Tips supports optional photo per species (only shows if a URL is present).
// - UPDATE: Species tips now show extra info paragraphs (spawn/season notes) under bullet points.
// - UPDATE: Species photo is shown LAST (text above photo).
//
// UPDATE (v1.2.3 depth calc):
// - Depth table now calculates every 0.5 oz (0.5, 1.0, 1.5, ...) up to the chosen weight.
// ============================

"use strict";

const APP_VERSION = "1.2.3";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";
const LOGO_LINK = "https://fishynw.com";

// ----------------------------
// Analytics consent (GA4)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const CONSENT_KEY = "fishynw_ga_consent_v1_2_3"; // "granted" | "denied"
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
const DISCLAIMER_ACK_KEY = "fishynw_disclaimer_ack_v1_2_3"; // "ack"
const DISCLAIMER_SESSION_KEY = "fishynw_disclaimer_session_v1_2_3"; // "shown"

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
  craft: "Kayak (paddle)"
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

  /* Species photo (only shows when URL exists) */
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

  /* Disclaimer modal */
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

// Normalize query:
// - collapses whitespace
// - recognizes "City, st" and uppercases the state code
// - casing does not matter
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
  key: "", // "lat,lon"
  ts: 0, // ms epoch
  wx: null,
  sun: null
};

// 10 minutes is enough for "refresh on open" + not hammering API
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
// app.js (PART 1 OF 5) END
// ============================
// ============================
// app.js (PART 2 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.3
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

  // bust forecast cache for location change
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
// UI: Header + Nav
// - Home button hidden while on Home (only shown elsewhere)
// - Logo is hyperlinked to fishynw.com (no layout change)
// ----------------------------
const PAGE_TITLES = {
  Home: "Weather/Wind + Best Times",
  "Trolling depth calculator": "Trolling Depth Calculator",
  "Species tips": "Species Tips",
  Speedometer: "Speedometer"
};

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
    '      <button id="open_disclaimer" type="button" style="background:rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.16); color: rgba(0,0,0,0.78);">Disclaimer</button>' +
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
// UI: Location Picker (reusable)
// - auto-clears saved location if user edits the box
// - optional auto GPS on mount (only when no saved location)
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

  // Restore existing
  if (hasResolvedLocation()) {
    placeInput.value = state.placeLabel ? state.placeLabel : "";
    renderUsing();
  }

  // Auto-clear saved location as soon as user edits the input away from the saved label.
  placeInput.addEventListener("input", function () {
    const raw = String(placeInput.value || "");
    const val = raw.trim();

    if (hasResolvedLocation()) {
      const currentLabel = String(state.placeLabel || "").trim();

      if (val && val !== currentLabel) {
        clearResolvedLocation();
        matchesEl.innerHTML = "";
        usingEl.textContent = "";
        if (typeof onResolved === "function")
          onResolved("auto_cleared_by_typing");
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
    const matches = await geocodeSearch(q, 10);
    state.matches = matches;
    state.selectedIndex = 0;

    if (!matches.length) {
      matchesEl.innerHTML = "";
      usingEl.textContent = "No matches. Try City, State or ZIP.";
      return;
    }

    const optionsHtml = matches
      .map(function (m, i) {
        return '<option value="' + i + '">' + escHtml(m.label) + "</option>";
      })
      .join("");

    matchesEl.innerHTML =
      '<div class="small"><strong>Choose the correct match</strong></div>' +
      '<select id="' +
      placeKey +
      '_select" style="margin-top:8px;">' +
      optionsHtml +
      "</select>" +
      '<div style="margin-top:10px;">' +
      '<button id="' +
      placeKey +
      '_use" style="width:100%;">Use this place</button>' +
      "</div>" +
      '<div class="small muted" style="margin-top:8px;">Pick the correct match, then tap Use this place.</div>';

    document
      .getElementById(placeKey + "_select")
      .addEventListener("change", function (e) {
        state.selectedIndex = Number(e.target.value);
      });

    document
      .getElementById(placeKey + "_use")
      .addEventListener("click", function () {
        const chosen = state.matches[state.selectedIndex];
        if (!chosen) return;

        setResolvedLocation(chosen.lat, chosen.lon, chosen.label);
        placeInput.value = chosen.label;
        matchesEl.innerHTML = "";
        renderUsing();

        if (typeof onResolved === "function") onResolved("search_pick");
      });

    usingEl.textContent = "";
  });

  // AUTO GPS ON MOUNT:
  // Only if requested AND no resolved location already exists.
  if (autoGps && !hasResolvedLocation()) {
    setTimeout(function () {
      if (!hasResolvedLocation()) doGps();
    }, 450);
  }
}

// ============================
// app.js (PART 2 OF 5) END
// ============================
// ============================
// app.js (PART 3 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.3
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Home logic helpers
// ----------------------------
function computeBestFishingWindows(sunrise, sunset) {
  const out = [];

  const dawnStart = new Date(sunrise.getTime() - 90 * 60 * 1000);
  const dawnEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
  out.push({ name: "Dawn window", start: dawnStart, end: dawnEnd });

  const duskStart = new Date(sunset.getTime() - 60 * 60 * 1000);
  const duskEnd = new Date(sunset.getTime() + 90 * 60 * 1000);
  out.push({ name: "Dusk window", start: duskStart, end: duskEnd });

  const midStart = new Date(sunrise);
  midStart.setHours(12, 0, 0, 0);
  const midEnd = new Date(sunrise);
  midEnd.setHours(13, 0, 0, 0);
  out.push({ name: "Midday (minor)", start: midStart, end: midEnd });

  return out;
}

// ----------------------------
// Deterministic "random" (stable per date + location + settings)
// so messages do not flicker every render
// ----------------------------
function hash32(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFunnyReason(label, seedStr) {
  const goReasons = [
    "GO: The fish called. They said your schedule is now their schedule.",
    "GO: The wind is behaving. That alone feels suspicious. Take advantage.",
    "GO: Your lure box deserves sunlight and compliments today.",
    "GO: Science demands you test if snacks taste better on the water (they do).",
    "GO: Because staying home would allow your gear to win the staring contest."
  ];

  const cautionReasons = [
    "CAUTION: The wind looks friendly, but it has trust issues. Keep a backup plan.",
    "CAUTION: Mother Nature is in a mood. You can go, but do not argue with her.",
    "CAUTION: This is a 'stay close to shore' kind of day. The fish will understand.",
    "CAUTION: Conditions may try to humble you. Let them. Bring extra patience.",
    "CAUTION: If your hat blows off, that is the universe telling you to reel in and reassess."
  ];

  const nogoReasons = [
    "NO-GO: The forecast is basically yelling. Maybe listen this once.",
    "NO-GO: Today is a great day to reorganize tackle and pretend it counts as cardio.",
    