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
        usingEl.innerHTML = "<strong>Location error:</strong> " + escHtml(err.message);
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

    document.getElementById(placeKey + "_use").addEventListener("click", function () {
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
    "NO-GO: The wind wants your kayak. Do not donate it.",
    "NO-GO: Even the seagulls are filing a complaint. Reschedule.",
    "NO-GO: Conditions are spicy. You are not a burrito."
  ];

  const seed = hash32(seedStr);
  const idx = seed % 5;

  if (label === "GO") return goReasons[idx];
  if (label === "CAUTION") return cautionReasons[idx];
  return nogoReasons[idx];
}

// ----------------------------
// 120 RULE (heat + wind) + cold penalties
// ----------------------------
function compute120RuleLabel(inputs) {
  const craft = inputs.craft || "Kayak (paddle)";
  const water = inputs.waterType || "Small / protected";

  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);

  // Rain+Cold rule input
  const popRaw = inputs.popMax;
  const popIsFinite = Number.isFinite(Number(popRaw));
  const popMax = popIsFinite ? safeNum(popRaw, 0) : null;

  const heatIndex = tmax + windMax;
  const gustIndex = tmax + gustMax;

  let goLimit = 105;
  let noGoLimit = 125;

  if (water === "Big water / offshore") {
    goLimit -= 5;
    noGoLimit -= 5;
  }

  if (craft === "Kayak (motorized)") {
    goLimit += 2;
    noGoLimit += 2;
  } else if (craft === "Boat (small)") {
    goLimit += 5;
    noGoLimit += 5;
  }

  const effIndex = Math.max(heatIndex, gustIndex);

  let label = "GO";
  if (effIndex >= noGoLimit) label = "NO-GO";
  else if (effIndex >= goLimit) label = "CAUTION";

  const avgF = (tmin + tmax) / 2;

  // Cold-risk floors
  let forceAtLeastCaution = false;
  let forceNoGo = false;

  if (tmax <= 43) forceAtLeastCaution = true;
  if (tmin <= 35 && windMax >= 8) forceAtLeastCaution = true;
  if (tmin <= 20 || avgF <= 25) forceNoGo = true;

  // NEW: Rain + cold -> at least CAUTION (judgment rule)
  // If meaningful rain chance AND temps are cold, consequences jump.
  if (popIsFinite && popMax >= 30 && tmax < 50) {
    forceAtLeastCaution = true;
  }
  // If it is very likely raining and very cold, push harder.
  if (popIsFinite && popMax >= 60 && avgF <= 40) {
    forceAtLeastCaution = true;
  }

  if (forceNoGo) label = "NO-GO";
  else if (forceAtLeastCaution && label === "GO") label = "CAUTION";

  return {
    label: label,
    effIndex: effIndex,
    heatIndex: heatIndex,
    gustIndex: gustIndex,
    goLimit: goLimit,
    noGoLimit: noGoLimit
  };
}

// ----------------------------
// GO/CAUTION/NO-GO meter score
// ----------------------------
function computeGoStatus(inputs) {
  const craft = inputs.craft || "Kayak (paddle)";
  const water = inputs.waterType || "Small / protected";
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const avgF = (tmin + tmax) / 2;

  // Rain input
  const popRaw = inputs.popMax;
  const popIsFinite = Number.isFinite(Number(popRaw));
  const popMax = popIsFinite ? safeNum(popRaw, 0) : null;

  let goWind = 10;
  let cautionWind = 14;
  let nogoWind = 18;

  let goGust = 18;
  let cautionGust = 22;
  let nogoGust = 28;

  if (craft === "Kayak (motorized)") {
    goWind += 2;
    cautionWind += 2;
    nogoWind += 2;
    goGust += 2;
    cautionGust += 2;
    nogoGust += 2;
  } else if (craft === "Boat (small)") {
    goWind += 4;
    cautionWind += 4;
    nogoWind += 4;
    goGust += 4;
    cautionGust += 4;
    nogoGust += 4;
  }

  if (water === "Big water / offshore") {
    goWind -= 3;
    cautionWind -= 3;
    nogoWind -= 3;
    goGust -= 3;
    cautionGust -= 3;
    nogoGust -= 3;
  }

  function scoreFromThresholds(value, g, c, n) {
    if (value <= g) return 0;
    if (value >= n) return 100;
    if (value <= c) return ((value - g) / Math.max(1, c - g)) * 45;
    return 45 + ((value - c) / Math.max(1, n - c)) * 55;
  }

  const sWind = scoreFromThresholds(windMax, goWind, cautionWind, nogoWind);
  const sGust = scoreFromThresholds(gustMax, goGust, cautionGust, nogoGust);

  const r120 = compute120RuleLabel({
    craft: craft,
    waterType: water,
    tmin: tmin,
    tmax: tmax,
    windMax: windMax,
    gustMax: gustMax,
    popMax: popMax
  });

  function scoreFrom120(idx, goLimit, noGoLimit) {
    const g = Number(goLimit);
    const n = Number(noGoLimit);
    const x = Number(idx);

    if (x <= g) {
      const t = x / Math.max(1, g);
      return Math.max(0, Math.min(34, t * 34));
    }
    if (x >= n) {
      const over = x - n;
      return Math.max(75, Math.min(100, 75 + over * 1.4));
    }
    const t2 = (x - g) / Math.max(1, n - g);
    return 35 + t2 * 39;
  }

  const s120 = scoreFrom120(r120.effIndex, r120.goLimit, r120.noGoLimit);

  let score = Math.max(sWind, sGust, s120);

  // Cold penalty
  const chillPenalty =
    Math.max(0, 35 - avgF) * 0.6 + Math.max(0, windMax - 5) * 0.4;
  if (avgF < 45) score += Math.min(18, chillPenalty);

  // NEW: Rain + cold penalty (judgment)
  // Rain makes "cold" feel colder and reduces margin for error (wet + wind).
  if (popIsFinite && popMax !== null) {
    if (popMax >= 60 && avgF <= 45) score += 10;
    else if (popMax >= 30 && avgF <= 45) score += 6;
    else if (popMax >= 30 && tmax < 50) score += 4;
  }

  score = Math.max(0, Math.min(100, score));

  let label = "GO";
  if (score >= 70) label = "NO-GO";
  else if (score >= 35) label = "CAUTION";

  // Respect 120-rule floor
  if (r120.label === "NO-GO") label = "NO-GO";
  else if (r120.label === "CAUTION" && label === "GO") label = "CAUTION";

  // Additional cold floors
  let forceAtLeastCaution = false;
  let forceNoGo = false;

  if (tmax <= 30) forceAtLeastCaution = true;
  if (tmin <= 20 || avgF <= 22) forceNoGo = true;

  // NEW: Explicit rule requested
  // If it rains while under 50 degrees, at least CAUTION.
  if (popIsFinite && popMax !== null && popMax >= 30 && tmax < 50) {
    forceAtLeastCaution = true;
  }

  if (forceNoGo) label = "NO-GO";
  else if (forceAtLeastCaution && label === "GO") label = "CAUTION";

  if (label === "NO-GO") score = Math.max(score, 75);
  else if (label === "CAUTION") score = Math.max(score, 45);
  else score = Math.min(score, 34);

  const needlePct = Math.max(0, Math.min(100, score));

  const seedStr =
    String(inputs.seed || "") +
    "|" +
    String(label) +
    "|" +
    String(craft) +
    "|" +
    String(water) +
    "|" +
    String(Math.round(windMax)) +
    "|" +
    String(Math.round(gustMax)) +
    "|" +
    String(Math.round(tmin)) +
    "|" +
    String(Math.round(tmax)) +
    "|" +
    "idx" +
    String(Math.round(r120.effIndex)) +
    "|" +
    "pop" +
    String(popIsFinite && popMax !== null ? Math.round(popMax) : "na");

  let msg = pickFunnyReason(label, seedStr);

  if (label !== "GO") {
    msg +=
      " (120 rule: " +
      String(Math.round(r120.effIndex)) +
      " = temp " +
      String(Math.round(tmax)) +
      " + wind " +
      String(Math.round(windMax)) +
      ".)";
  }

  if (popIsFinite && popMax !== null && popMax >= 30 && tmax < 50) {
    msg += " Wet + cold reduces margin for error. Plan for being soaked and chilled.";
  }

  if (tmax <= 43 && label !== "NO-GO") {
    msg += " Cold air increases consequence. Dress for immersion, not just air temp.";
  }
  if (tmin <= 20 || avgF <= 22) {
    msg += " Extreme cold can turn a minor issue into an emergency quickly.";
  }

  return { label: label, score: score, needlePct: needlePct, message: msg };
}

// ----------------------------
// Exposure tips: match the selected day's weather
// (Driven by tmin/tmax, wind/gust, precip probability)
// ----------------------------
function computeExposureTips(inputs) {
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);

  const popRaw = inputs.popMax;
  const popIsFinite = Number.isFinite(Number(popRaw));
  const popMax = popIsFinite ? safeNum(popRaw, 0) : null;

  const avgF = (tmin + tmax) / 2;
  const tips = [];

  // Precip specific
  if (popIsFinite && popMax >= 80) {
    tips.push("Very high rain chance. Expect to get wet. Bring a real rain shell and waterproof gloves.");
    tips.push("Dry bag spare socks and a warm hat. Wet feet ruin everything fast.");
  } else if (popIsFinite && popMax >= 60) {
    tips.push("High rain chance. Bring a real rain shell and keep spare clothes in a dry bag.");
    tips.push("Waterproof phone case and towel in the hatch can save the day.");
  } else if (popIsFinite && popMax >= 30) {
    tips.push("Spotty showers possible. Pack a light rain layer and keep gear covered.");
  } else if (popIsFinite && popMax <= 10) {
    tips.push("Low rain chance. Still plan for spray and surprise weather.");
  } else {
    tips.push("Precip data may be unavailable. Assume conditions can change and pack a light shell.");
  }

  // Rain + cold
  if (popIsFinite && popMax >= 30 && tmax < 50) {
    tips.unshift("Rain + under 50 F: treat this as at least CAUTION. Wet clothing drains heat fast.");
    tips.push("Choose insulation that still works damp (wool/synthetics). Avoid cotton.");
  }

  // Wind specific
  if (windMax >= 18 || gustMax >= 28) {
    tips.push("Strong wind/gusts: stay close to shore and avoid long open-water crossings.");
    tips.push("Leash the paddle, net, and rods. A gust can yeet gear instantly.");
  } else if (windMax >= 12 || gustMax >= 20) {
    tips.push("Breezy day: plan a protected return route and expect wind shifts.");
    tips.push("Keep your bow into waves when possible. Avoid getting broadside in gusts.");
  } else {
    tips.push("Wind looks manageable. Still check conditions at the launch before committing.");
  }

  // Cold/immersion focused
  if (avgF <= 45) {
    tips.push("Cold day: dress for immersion, not just air temp. Avoid cotton; use wool/synthetics.");
    tips.push("Neoprene gloves/boots help. Keep a dry spare layer sealed in a dry bag.");
    if (tmax <= 43) tips.push("Extra caution: even a short swim can get serious fast in cold water season.");
  }

  // Hot/heat management
  if (tmax >= 80) {
    tips.push("Hot day: hydrate early and bring more water than you think you need.");
    tips.push("UPF shirt, hat, sunglasses. Reapply sunscreen. Heat reflects off the water.");
  } else {
    tips.push("Layer up: mornings can be colder than the afternoon. Bring a removable mid-layer.");
  }

  // Always useful
  tips.push("Tell someone your plan and return time. Carry a whistle and a light even if it is daylight.");
  tips.push("If you are solo, consider a conservative route and a quick exit plan.");

  // If the 120-rule is pushing caution/no-go, add targeted reminder
  const r120 = compute120RuleLabel({
    craft: inputs.craft || "Kayak (paddle)",
    waterType: inputs.waterType || "Small / protected",
    tmin: tmin,
    tmax: tmax,
    windMax: windMax,
    gustMax: gustMax,
    popMax: popMax
  });
  if (r120.label !== "GO") {
    tips.unshift(
      "Today is a " +
        r120.label +
        " kind of day in the 120-rule model. Consider shortening the trip and staying protected."
    );
  }

  return tips;
}

// ============================
// app.js (PART 3 OF 5) END
// ============================
// ============================
// app.js (PART 4 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.3
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Home: Date-driven forecast + water toggle + auto refresh
// ----------------------------
function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="small muted">Pick a date (up to 7 days). Set location and the app builds tiles, wind chart, and fishing windows.</div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Date</div>
        <input id="home_date" type="date" />
        <div class="small muted" style="margin-top:8px;">Forecast is typically available for the next 7 days.</div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Water type</div>
        <div class="toggleRow" id="water_toggle_row">
          <button type="button" id="water_small" class="toggleBtn">Small / protected</button>
          <button type="button" id="water_big" class="toggleBtn">Big water / offshore</button>
        </div>
        <div class="small muted" style="margin-top:8px;">Small water is default. Big water is stricter for wind and cold.</div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Craft</div>
        <select id="home_craft">
          <option>Kayak (paddle)</option>
          <option>Kayak (motorized)</option>
          <option>Boat (small)</option>
        </select>
      </div>
    </div>
  `
  );

  const dateInput = document.getElementById("home_date");
  const craftSel = document.getElementById("home_craft");
  const btnSmall = document.getElementById("water_small");
  const btnBig = document.getElementById("water_big");

  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  dateInput.value = state.dateIso;

  dateInput.addEventListener("change", function () {
    const v = String(dateInput.value || "").trim();
    if (isIsoDate(v)) state.dateIso = v;
    renderHomeDynamic("date_change");
  });

  craftSel.value = state.craft || "Kayak (paddle)";

  function paintWaterToggle() {
    const isBig = state.waterType === "Big water / offshore";
    if (isBig) {
      btnBig.classList.add("toggleActive");
      btnSmall.classList.remove("toggleActive");
    } else {
      btnSmall.classList.add("toggleActive");
      btnBig.classList.remove("toggleActive");
    }
  }

  btnSmall.addEventListener("click", function () {
    state.waterType = "Small / protected";
    paintWaterToggle();
    renderHomeDynamic("water_change");
  });

  btnBig.addEventListener("click", function () {
    state.waterType = "Big water / offshore";
    paintWaterToggle();
    renderHomeDynamic("water_change");
  });

  craftSel.addEventListener("change", function () {
    state.craft = craftSel.value;
    renderHomeDynamic("craft_change");
  });

  if (state.waterType !== "Big water / offshore") state.waterType = "Small / protected";
  paintWaterToggle();

  renderLocationPicker(
    page,
    "home",
    function () {
      renderHomeDynamic("location_resolved");
    },
    { autoGps: true }
  );

  appendHtml(page, `<div id="home_dynamic"></div>`);

  renderHomeDynamic("init");

  document.addEventListener("visibilitychange", function () {
    if (
      document.visibilityState === "visible" &&
      state.tool === "Home" &&
      hasResolvedLocation()
    ) {
      renderHomeDynamic("resume_visible");
    }
  });

  async function renderHomeDynamic(reason) {
    const dyn = document.getElementById("home_dynamic");
    if (!dyn) return;

    dyn.innerHTML = "";

    if (!hasResolvedLocation()) return;

    appendHtml(
      dyn,
      `
      <div class="card compact">
        <div><strong>Loading forecast...</strong></div>
        <div class="small muted">Building tiles, wind chart, and best times for the selected date.</div>
      </div>
    `
    );

    let wx = null;
    let sun = null;

    try {
      const bundle = await getForecastBundle(state.lat, state.lon);
      wx = bundle.wx;
      sun = bundle.sun;
    } catch (e) {
      dyn.innerHTML =
        '<div class="card"><strong>Could not load data.</strong><div class="small muted">Make sure the page is HTTPS. If this persists, the request may be blocked or the network is unstable.</div><div class="small muted" style="margin-top:6px;">' +
        escHtml(niceErr(e)) +
        "</div></div>";
      return;
    }

    const chosenIso = isIsoDate(state.dateIso) ? state.dateIso : isoTodayLocal();
    state.dateIso = chosenIso;
    dateInput.value = chosenIso;

    const dailyDates = wx && wx.daily && wx.daily.time ? wx.daily.time : [];
    if (!dailyDates.length) {
      dyn.innerHTML =
        '<div class="card"><strong>No forecast returned.</strong><div class="small muted">Try again in a moment.</div></div>';
      return;
    }

    const idx = dailyDates.indexOf(chosenIso);
    if (idx < 0) {
      const first = dailyDates[0];
      const last = dailyDates[dailyDates.length - 1];
      dyn.innerHTML =
        '<div class="card"><strong>Date not available.</strong>' +
        '<div class="small muted" style="margin-top:6px;">The forecast returned by the provider does not include ' +
        escHtml(chosenIso) +
        ".</div>" +
        '<div class="small muted" style="margin-top:6px;">Available range: ' +
        escHtml(first) +
        " to " +
        escHtml(last) +
        ".</div>" +
        '<div style="margin-top:10px;"><button id="jump_today">Jump to first available</button></div>' +
        "</div>";

      const jumpBtn = document.getElementById("jump_today");
      if (jumpBtn) {
        jumpBtn.addEventListener("click", function () {
          state.dateIso = dailyDates[0];
          dateInput.value = state.dateIso;
          renderHomeDynamic("jump_first_available");
        });
      }
      return;
    }

    const useIso = dailyDates[idx];

    const tmin = safeNum(wx.daily.tmin[idx], 0);
    const tmax = safeNum(wx.daily.tmax[idx], 0);

    const popRaw =
      wx.daily.popMax && wx.daily.popMax.length ? wx.daily.popMax[idx] : null;
    const popIsFinite = Number.isFinite(Number(popRaw));
    const popMax = popIsFinite ? safeNum(popRaw, 0) : null;

    const windMax = safeNum(wx.daily.windMax[idx], 0);
    const gustMax = safeNum(wx.daily.gustMax[idx], 0);

    const sunFor = sunForDate(sun, useIso);
    const windows = sunFor ? computeBestFishingWindows(sunFor.sunrise, sunFor.sunset) : [];

    const seed =
      String(useIso) +
      "|" +
      String(Number(state.lat).toFixed(3)) +
      "," +
      String(Number(state.lon).toFixed(3)) +
      "|" +
      String(state.craft) +
      "|" +
      String(state.waterType);

    const status = computeGoStatus({
      seed: seed,
      craft: state.craft,
      waterType: state.waterType,
      windMax: windMax,
      gustMax: gustMax,
      tmin: tmin,
      tmax: tmax,
      popMax: popMax
    });

    const tips = computeExposureTips({
      craft: state.craft,
      waterType: state.waterType,
      tmin: tmin,
      tmax: tmax,
      windMax: windMax,
      gustMax: gustMax,
      popMax: popMax
    });

    const pointsRaw = filterHourlyToDate(wx.hourly.time || [], wx.hourly.wind || [], useIso);
    const points = [];
    for (let i = 0; i < pointsRaw.length; i++) {
      if (i % 2 === 0) points.push({ dt: pointsRaw[i].dt, mph: safeNum(pointsRaw[i].v, 0) });
    }
    if (points.length < 2) {
      for (let j = 0; j < pointsRaw.length; j++) {
        points.push({ dt: pointsRaw[j].dt, mph: safeNum(pointsRaw[j].v, 0) });
      }
    }

    dyn.innerHTML = "";

    const precipDisplay = popIsFinite ? String(Math.round(popMax)) + " %" : "None";

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Overview - ${escHtml(useIso)}</h3>

        <div class="tilesGrid">
          <div class="tile">
            <div class="tileTop">Temperature</div>
            <div class="tileVal">${escHtml(Math.round(tmin))} to ${escHtml(Math.round(tmax))} F</div>
            <div class="tileSub">Daily min / max</div>
          </div>

          <div class="tile">
            <div class="tileTop">Rain chance (max)</div>
            <div class="tileVal">${escHtml(precipDisplay)}</div>
            <div class="tileSub">Peak probability</div>
          </div>

          <div class="tile">
            <div class="tileTop">Max sustained wind</div>
            <div class="tileVal">${escHtml(Math.round(windMax))} mph</div>
            <div class="tileSub">Day max</div>
          </div>

          <div class="tile">
            <div class="tileTop">Max gust</div>
            <div class="tileVal">${escHtml(Math.round(gustMax))} mph</div>
            <div class="tileSub">Day max</div>
          </div>
        </div>

        <div class="statusRow">
          <div class="sectionTitle">Boating / Kayak status</div>
          <div class="pill" id="status_pill">${escHtml(status.label)}</div>
        </div>

        <div class="meterBar">
          <div class="meterSeg segG"></div>
          <div class="meterSeg segY"></div>
          <div class="meterSeg segR"></div>
        </div>
        <div style="position: relative;">
          <div class="meterNeedle" id="meter_needle" style="left:${escHtml(String(status.needlePct))}%;"></div>
        </div>

        <div class="small muted" style="margin-top:8px;">${escHtml(status.message)}</div>
      </div>
    `
    );

    const pill = document.getElementById("status_pill");
    if (pill) {
      if (status.label === "GO") pill.style.background = "rgba(143,209,158,0.55)";
      if (status.label === "CAUTION") pill.style.background = "rgba(255,214,102,0.65)";
      if (status.label === "NO-GO") pill.style.background = "rgba(244,163,163,0.70)";
    }

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Hourly wind (line chart)</h3>
        <div class="small muted">Wind speed at 10m in mph for the selected date.</div>
        <div class="chartWrap">
          <canvas id="wind_canvas" class="windChart"></canvas>
        </div>
      </div>
    `
    );
    const canvas = document.getElementById("wind_canvas");
    drawWindLineChart(canvas, points);

    const bestHtml = windows.length
      ? windows
          .map(function (w) {
            return (
              "<li><strong>" +
              escHtml(w.name) +
              ":</strong> " +
              escHtml(formatTime(w.start)) +
              " to " +
              escHtml(formatTime(w.end)) +
              "</li>"
            );
          })
          .join("")
      : "<li>No sunrise/sunset data for this date.</li>";

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Best fishing windows</h3>
        <ul class="list">${bestHtml}</ul>
      </div>
    `
    );

    const tipsHtml = tips.map(function (t) { return "<li>" + escHtml(t) + "</li>"; }).join("");
    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Exposure tips</h3>
        <ul class="list">${tipsHtml}</ul>
      </div>
    `
    );

    let resizeTimer = null;
    window.addEventListener("resize", function () {
      if (!document.getElementById("wind_canvas")) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        const c = document.getElementById("wind_canvas");
        if (c) drawWindLineChart(c, points);
      }, 150);
    });
  }
}

// ============================
// app.js (PART 4 OF 5) END
// ============================
// ============================
// app.js (PART 5 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.3
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Depth Calculator
// ----------------------------
function renderDepthCalculator() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>
      <div class="small muted">Simple estimate. Use as a starting point.</div>

      <div class="grid2" style="margin-top:12px;">
        <div>
          <div class="fieldLabel">Speed (mph)</div>
          <input id="dc_speed" type="number" step="0.1" value="1.3">
        </div>
        <div>
          <div class="fieldLabel">Weight (oz)</div>
          <input id="dc_weight" type="number" step="0.5" value="2">
        </div>
        <div>
          <div class="fieldLabel">Line out (ft)</div>
          <input id="dc_line" type="number" step="5" value="100">
        </div>
        <div>
          <div class="fieldLabel">Line test (lb)</div>
          <select id="dc_test">
            <option>10</option>
            <option selected>12</option>
            <option>20</option>
            <option>25</option>
            <option>30</option>
            <option>40</option>
          </select>
        </div>

        <div style="grid-column: 1 / -1;">
          <div class="fieldLabel">Line type</div>
          <select id="dc_linetype">
            <option selected>Monofilament</option>
            <option>Fluorocarbon</option>
            <option>Braid</option>
            <option>Lead core</option>
          </select>
          <div class="small muted" style="margin-top:6px;">
            Line type affects drag and sink behavior. Lead core is a different animal; this is still an estimate.
          </div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <button id="dc_calc">Calculate</button>
      </div>

      <div id="dc_out" class="card compact" style="margin-top:12px; display:none;"></div>
    </div>
  `
  );

  const out = document.getElementById("dc_out");

  function lineTypeFactor(type) {
    const t = String(type || "").toLowerCase();
    if (t.indexOf("braid") >= 0) return 0.88;
    if (t.indexOf("fluoro") >= 0) return 0.96;
    if (t.indexOf("lead") >= 0) return 0.72;
    return 1.0;
  }

  function lineTestFactor(testLb, lineType) {
    const t = safeNum(testLb, 12);
    let f =
      t <= 10
        ? 1.0
        : t <= 12
        ? 0.95
        : t <= 20
        ? 0.85
        : t <= 25
        ? 0.8
        : t <= 30
        ? 0.76
        : 0.72;

    const lt = String(lineType || "").toLowerCase();
    if (lt.indexOf("braid") >= 0) {
      if (t >= 40) f = Math.max(f, 0.86);
      else if (t >= 30) f = Math.max(f, 0.88);
      else if (t >= 25) f = Math.max(f, 0.9);
      else if (t >= 20) f = Math.max(f, 0.92);
      else if (t >= 15) f = Math.max(f, 0.95);
    }

    if (lt.indexOf("fluoro") >= 0) {
      f = f * 0.99;
    }

    if (lt.indexOf("lead") >= 0) {
      f = 0.9;
    }

    return f;
  }

  document.getElementById("dc_calc").addEventListener("click", function () {
    const speed = safeNum(document.getElementById("dc_speed").value, 1.3);
    const weight = safeNum(document.getElementById("dc_weight").value, 2);
    const line = safeNum(document.getElementById("dc_line").value, 100);
    const test = safeNum(document.getElementById("dc_test").value, 12);
    const lineType = String(
      document.getElementById("dc_linetype").value || "Monofilament"
    );

    const dragFactor = lineTestFactor(test, lineType) * lineTypeFactor(lineType);

    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);

    let depth = line * base * speedFactor * dragFactor;

    depth = Math.max(0, Math.min(depth, line * 0.95));

    out.style.display = "block";
    out.innerHTML =
      "<strong>Estimated depth:</strong> " +
      escHtml(depth.toFixed(1)) +
      " ft<br>" +
      "<div class='small muted' style='margin-top:6px;'>" +
      "Line: " +
      escHtml(lineType) +
      " (" +
      escHtml(String(test)) +
      " lb). Current and lure drag can change results a lot." +
      "</div>";
  });
}

// ----------------------------
// Species Tips (PNW expanded, encyclopedia style)
// - Optional photo per species: add `photo:` URL. If blank/missing, no image is shown.
// - New: optional `p1` and `p2` paragraphs shown after bullets, before photo.
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();

  const tips = [
    {
      name: "Largemouth Bass",
      range: "55 to 75 F (most active)",
      photo: "https://fishynw.com/wp-content/uploads/2024/12/largemouth-dink-e1753942608642.jpg",
      bullets: [
        "Where: weeds, docks, wood, shade lines, pockets in grass. They love cover.",
        "When: low light (dawn/dusk) and overcast can extend shallow feeding.",
        "How: flip jigs/creature baits to cover; swim jigs along weed edges; topwater when water is warm enough.",
        "Cold fronts: slow down with finesse (wacky, dropshot) and target deeper transitions.",
        "Season notes: prespawn = staging points/first breaks; spawn = protect beds (be gentle); postspawn = bluegill beds and shade."
      ],
      p1: "Spawn: usually when water warms into the low 60s. Males fan beds in protected coves and pockets, often near hard bottom and cover. They will guard the bed and fry, which can make them easier to locate but also more sensitive to repeated pressure.",
      p2: "Pattern tip: find one quality fish, then look for that same combo of cover + depth + sunlight angle. If you see bluegill activity, work nearby shade and edges with a compact jig or wacky rig."
    },
    {
      name: "Smallmouth Bass",
      range: "50 to 70 F (most active)",
      // photo: "PASTE_IMAGE_URL_HERE",
      bullets: [
        "Where: rock, gravel, points, current seams, shoals, riprap, deep boulders.",
        "Wind: often improves the bite on rocky points and flats (pushes bait).",
        "How: tubes, ned rigs, finesse jigs, jerkbaits, small swimbaits, crankbaits on rock.",
        "Clear water: natural colors and long casts. Stained water: add vibration/contrast.",
        "Cold water: stay near bottom and slow down; soak the bait and pause longer."
      ],
      p1: "Spawn: commonly mid to upper 50s into low 60s. They prefer gravel or firm sand near rock, often on points, shelves, and protected sides of structure. Males guard nests and can sit shallow even when most of the fish are still staging deeper.",
      p2: "Pattern tip: if you are getting short strikes, downsize and slow your retrieve. On windy days, target the windward side and use baits that stay in contact with bottom (ned, tube, finesse jig)."
    },
    {
      name: "Trout (Rainbow)",
      range: "45 to 65 F (most active)",
      photo: "https://fishynw.com/wp-content/uploads/2025/03/20250322_114536-scaled-e1753944691694.jpg",
      bullets: [
        "Where: inlets, drop-offs, wind-blown banks, edges of thermal layers in summer.",
        "Morning: troll early for consistent action, then cast near current or structure once sun rises.",
        "Presentations: spinners, spoons, small plugs; trolling with small dodgers and spinners works too.",
        "Speed: adjust until you get consistent bites; if you mark fish but no bites, change speed first.",
        "Hot weather: target deeper water and consider trolling along the thermocline if you have sonar."
      ],
      p1: "Spawn: most rainbows spawn in spring, often using tributaries or shallow gravel areas depending on the system. Post-spawn fish can feed aggressively and often hold near current, oxygen, and consistent temperature.",
      p2: "Pattern tip: watch surface clues and wind. Wind can push food to a shoreline and turn a slow day into a steady bite. If you see insects or small bait, match size first, then adjust color."
    },
    {
      name: "Kokanee",
      range: "45 to 60 F (best comfort)",
      photo: "https://fishynw.com/wp-content/uploads/2025/08/kokanee-8-27-25-scaled.jpg",
      bullets: [
        "Where: open water schools; often relate to depth bands and plankton layers.",
        "When: first light is prime. Bite windows can be short; be ready at dawn.",
        "How: small dodger + spinner/hoochie; short leaders common (tune until bites).",
        "Speed: slow and steady; small speed changes or S-turns can trigger strikes.",
        "Depth control: heavier weights or downrigger helps keep you on the school; watch for consistent marks."
      ],
      p1: "Spawn: late summer into fall as they stage and run into tributaries (or shoreline areas in some lakes). As they transition, feeding can drop and color changes ramp up. In the main summer bite, depth and pace are everything.",
      p2: "Pattern tip: if you are seeing marks but getting no bites, change one thing at a time: depth first, then speed, then leader length. Once you get two bites, lock that exact setup and repeat the pass."
    },
    {
      name: "Chinook Salmon",
      range: "42 to 58 F (typical target water)",
      // photo: "PASTE_IMAGE_URL_HERE",
      bullets: [
        "Where: follow bait and temperature; edges of current, points, drop-offs, travel lanes.",
        "How: troll bait or flasher + hoochie; keep speed steady and turns wide (avoid blowing out gear).",
        "Depth: adjust until you see action; if you have marks and no bites, change depth before changing lure.",
        "Light: early and late can shine, but Chinook will bite midday if you are in the zone.",
        "Safety: wind + cold water can be unforgiving. Stay conservative and keep a safe return route."
      ],
      p1: "Spawn: typically late summer through fall depending on the system. As fish stage, location becomes more important than lure variety. Travel lanes and temperature edges matter more than constantly swapping gear.",
      p2: "Pattern tip: run clean, consistent gear. Avoid sharp turns that tangle or lift your presentation. If you get one bite, repeat that exact depth and track line before experimenting."
    },
    {
      name: "Coho Salmon",
      range: "45 to 60 F",
      // photo: "PASTE_IMAGE_URL_HERE",
      bullets: [
        "Behavior: generally more aggressive than Chinook and often respond to faster presentations.",
        "Where: travel lanes, rips, current seams, near bait schools, river mouths (in season).",
        "How: troll faster than Chinook; also cast spinners/spoons when fish are near surface.",
        "Colors: bright/flashy can excel in stained water; scale back to natural in clear water.",
        "Tip: when you get a bite, repeat that line, speed, and turn angle."
      ],
      p1: "Spawn: fall-focused, with fish moving from open water travel to staging and river entry. As they shift, they can show up shallow and fast-moving, and they will often slash at aggressive presentations.",
      p2: "Pattern tip: if you are not getting bit, try a small speed increase and a color change before changing your whole program. Coho often react to pace and flash."
    },
    {
      name: "Sockeye",
      range: "45 to 60 F",
      // photo: "PASTE_IMAGE_URL_HERE",
      bullets: [
        "Regulations: methods can be highly specific by water. Always check local regs.",
        "Where: travel corridors and staging areas; often more about location than lure variety.",
        "How: keep presentation consistent; depth and speed adjustments matter more than constant lure swaps.",
        "When: morning and evening can be best, but schooling fish can pop any time.",
        "Tip: if you see rolling fish, tune depth and speed first."
      ],
      p1: "Spawn: typically late summer and fall. Some fisheries are unique and highly regulated, so the legal presentation matters as much as the fish behavior. When they are traveling, staying on the correct track is the whole game.",
      p2: "Pattern tip: if fish are rolling but not biting, do not panic-swap lures. Make controlled depth changes and repeat passes through the same corridor."
    },
    {
      name: "Walleye",
      range: "50 to 70 F",
      photo: "https://fishynw.com/wp-content/uploads/2024/12/walleye-5945560_1280.jpg",
      bullets: [
        "Where: edges and transitions, humps, points, flats near deep water, current breaks.",
        "Low light: crankbaits and spinners shine; fish may slide shallow to feed.",
        "Daytime: jig transitions and humps; slow down when bite is light.",
        "Wind: can help you position and activate fish, but drifting too fast kills bite.",
        "Tip: keep contact with bottom when jigging. If you are not ticking, you are too high."
      ],
      p1: "Spawn: usually early spring in many systems, often in rivers or rocky shoals. After spawn they spread onto nearby flats and edges and can feed hard, especially during low light and wind.",
      p2: "Pattern tip: your speed is everything. If your drift is too fast, add weight or use a controlled troll. Most walleye bites happen when your bait is near bottom and moving steadily."
    },
    {
      name: "Yellow Perch",
      range: "45 to 70 F",
      photo: "https://fishynw.com/wp-content/uploads/2024/12/river-fish-1164953_1280.jpg",
      bullets: [
        "Where: weeds, flats, inside turns, near structure. They school tight.",
        "How: small jigs and bait; keep it near bottom. Subtle motion often wins.",
        "Finding them: once you catch one, stay put and work the school.",
        "Gear: light line and small hooks improve bites; keep your jig in the zone.",
        "Tip: if bites stop, move 20 to 50 feet and re-check depth/structure."
      ],
      p1: "Spawn: spring time, often in shallow vegetation. After spawn they can group up tight and roam edges and flats. When you find perch, it can be fast until the school slides.",
      p2: "Pattern tip: use a slow lift and tiny shakes rather than big hops. If you are catching small fish, move slightly deeper or to a thicker weed edge to find better size."
    },
    {
      name: "Crappie",
      range: "55 to 75 F",
      photo: "https://fishynw.com/wp-content/uploads/2024/12/crappie-5110219_1280.jpg",
      bullets: [
        "Where: brush, docks, submerged trees, protected bays; often suspend.",
        "How: slow vertical presentations; small jigs, tiny plastics, light bobber rigs.",
        "Cold fronts: go deeper and slow down. They can get neutral fast.",
        "Timing: pre-spawn and spawn periods can create fast action in shallow cover.",
        "Tip: if you see them on sonar but no bites, reduce jig size and slow the cadence."
      ],
      p1: "Spawn: typically spring when water moves through the upper 50s to 60s. They use protected pockets and cover, and they can stack tightly. Post-spawn they often suspend around brush and edges.",
      p2: "Pattern tip: if they are suspended, stop fishing the bottom. Count down your jig or set a bobber stop so your bait stays at their level."
    },
    {
      name: "Northern Pike",
      range: "45 to 70 F",
      photo: "https://fishynw.com/wp-content/uploads/2024/12/pike-4573367_1280.jpg",
      bullets: [
        "Where: weed edges, points, shallow bays, and ambush lanes.",
        "How: cover water with larger baits (spoons, swimbaits, jerkbaits).",
        "Leaders: use steel or heavy fluoro to prevent bite-offs.",
        "Handling: keep fingers away from gills/teeth; long pliers help.",
        "Tip: pauses often trigger strikes; give them a moment to commit."
      ],
      p1: "Spawn: very early spring right after ice-out in many lakes, often in shallow flooded vegetation. Early season can be excellent because fish are shallow and recovering, then they shift to weed edges as the water warms.",
      p2: "Pattern tip: if you are getting follows, add pauses. Many pike eat at the boat. Figure-8 style turns can convert followers when safe to do so."
    },
    {
      name: "Lake Trout (Mackinaw)",
      range: "40 to 55 F (cold water)",
      photo: "https://fishynw.com/wp-content/uploads/2025/03/20250222_131558-scaled-e1753950889298.jpg",
      bullets: [
        "Where: deep structure, humps, drop-offs, basin edges; often deep and roaming.",
        "How: troll or jig where you see marks; speed changes can trigger bites.",
        "Depth: spend more time in the zone rather than racing around.",
        "Gear: heavier weights or downriggers help hold depth; watch turns to avoid rising.",
        "Tip: when you mark fish tight to bottom, a slow lift-drop jigging cadence can outproduce trolling."
      ],
      p1: "Spawn: typically fall, often on rocky shoals or rubble. Outside of spawn periods, they are temperature-driven and will roam deep basins or edges searching for baitfish.",
      p2: "Pattern tip: if you keep marking fish but not biting, slow down and stay on them. A controlled pass and repeated depth in the same area usually beats running all over the lake."
    },
    {
      name: "Catfish (Channel/Bullhead)",
      range: "55 to 75 F",
      photo: "https://fishynw.com/wp-content/uploads/2024/12/channel-catfish-86584_1280.jpg",
      bullets: [
        "Where: edges, flats, holes, current seams, warm shallows at night.",
        "When: evening and night can be best; they roam to feed.",
        "Baits: stink baits, cut bait, worms; match to what is common locally.",
        "Bite: give fish time to load up; keep hooks sharp.",
        "Tip: if action is slow, move to the next piece of structure rather than waiting all night."
      ],
      p1: "Spawn: late spring into summer as water warms, often in cavities (banks, logs, riprap holes). During peak warm season they can feed heavily at night and after storms when scent spreads.",
      p2: "Pattern tip: scent + patience wins, but do not camp a dead spot forever. If you do not get action in 30 to 60 minutes, slide to the next edge or hole."
    },
    {
      name: "Bluegill / Sunfish",
      range: "60 to 80 F",
      // photo: "PASTE_IMAGE_URL_HERE",
      bullets: [
        "Where: shallow weeds, docks, lily pads, and spawning beds in colonies.",
        "How: tiny jigs, worms, small spinners; steady and simple catches fish.",
        "Tactic: if you find beds, work edges first (bigger fish) before the middle.",
        "Gear: ultralight makes it fun; small hooks and light line increase bites.",
        "Tip: these fish are great 'pattern finders' for bass (bass often hang nearby)."
      ],
      p1: "Spawn: summer colonies in shallow water, often multiple waves. Bedding areas are easy to spot and can pull in predators. The biggest fish are commonly on the outside edge, not the center.",
      p2: "Pattern tip: if you want bigger bites, upsize slightly (small plastics instead of tiny hooks) and fish deeper weed edges adjacent to the beds."
    },
    {
      name: "Carp",
      range: "55 to 80 F",
      // photo: "PASTE_IMAGE_URL_HERE",
      bullets: [
        "Where: flats, warm shallow bays, mud bottoms, slow current areas.",
        "How: corn, dough baits, boilies; keep your rig subtle and let them take.",
        "Sight fishing: in clear shallows, lead the fish and keep noise low.",
        "Fight: long runs are common; set drag and be patient.",
        "Tip: pre-baiting an area (small amounts) can stack fish if rules allow."
      ],
      p1: "Spawn: late spring into summer in shallow vegetation, and activity can get loud. Outside spawn, carp are cautious and react to noise and shadows, especially in clear water.",
      p2: "Pattern tip: keep your setup quiet and consistent. A small handful of bait on a schedule often works better than dumping a lot at once."
    }
  ];

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Species Tips</h2>
      <div class="small muted">PNW-focused quick guidelines with temperature ranges.</div>
      <div style="margin-top:12px;">
        <select id="tips_sel"></select>
      </div>
      <div id="tips_box" class="card compact" style="margin-top:12px;"></div>
    </div>
  `
  );

  const sel = document.getElementById("tips_sel");
  const box = document.getElementById("tips_box");

  for (let i = 0; i < tips.length; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = tips[i].name;
    sel.appendChild(o);
  }

  function renderTip(i) {
    const t = tips[i];

    const lis = t.bullets
      .map(function (b) {
        return "<li>" + escHtml(b) + "</li>";
      })
      .join("");

    const p1 = t && t.p1 ? String(t.p1 || "").trim() : "";
    const p2 = t && t.p2 ? String(t.p2 || "").trim() : "";

    let parasHtml = "";
    if (p1) {
      parasHtml += '<div class="small muted" style="margin-top:10px; line-height:17px;">' + escHtml(p1) + "</div>";
    }
    if (p2) {
      parasHtml += '<div class="small muted" style="margin-top:10px; line-height:17px;">' + escHtml(p2) + "</div>";
    }

    const photoUrl = t && t.photo ? String(t.photo || "").trim() : "";
    const photoHtml = photoUrl
      ? '<div class="speciesPhotoWrap"><img class="speciesPhoto" src="' +
        escHtml(photoUrl) +
        '" alt="' +
        escHtml(t.name) +
        '"></div>'
      : "";

    // ORDER:
    // name + range
    // bullets
    // paragraphs (spawn habits, extra notes)
    // photo LAST
    box.innerHTML =
      "<strong>" +
      escHtml(t.name) +
      "</strong><br>" +
      '<span class="small muted">Active range: ' +
      escHtml(t.range) +
      "</span>" +
      '<ul class="list">' +
      lis +
      "</ul>" +
      parasHtml +
      photoHtml;
  }

  sel.addEventListener("change", function () {
    renderTip(Number(sel.value));
  });

  renderTip(0);
}

// ----------------------------
// Speedometer
// ----------------------------
function renderSpeedometer() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Speedometer</h2>
      <div class="small muted">GPS-based speed. Requires location permission. Best used outside.</div>

      <div class="btnRow" style="margin-top:12px;">
        <button id="spd_start">Start</button>
        <button id="spd_stop" disabled>Stop</button>
      </div>

      <div class="card compact" style="margin-top:12px;">
        <div class="sectionTitle">Current speed</div>
        <div id="spd_val" style="font-size:34px; font-weight:900; margin-top:6px;">0.0 mph</div>
        <div class="small muted" id="spd_note" style="margin-top:6px;"></div>
      </div>
    </div>
  `
  );

  const startBtn = document.getElementById("spd_start");
  const stopBtn = document.getElementById("spd_stop");
  const valEl = document.getElementById("spd_val");
  const noteEl = document.getElementById("spd_note");

  function setRunning(r) {
    startBtn.disabled = r;
    stopBtn.disabled = !r;
  }

  startBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      noteEl.textContent = "Geolocation not supported.";
      return;
    }

    noteEl.textContent = "Starting GPS...";
    setRunning(true);

    try {
      state.speedWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          const ms = pos.coords.speed;
          let mph = Number.isFinite(ms) ? ms * 2.236936 : NaN;
          if (!Number.isFinite(mph)) mph = 0;

          valEl.textContent = mph.toFixed(1) + " mph";
          noteEl.textContent =
            "Accuracy: " + safeNum(pos.coords.accuracy, 0).toFixed(0) + " m";
        },
        function (err) {
          noteEl.textContent = "Speed error: " + escHtml(err.message);
          setRunning(false);
        },
        { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 }
      );
    } catch (e) {
      noteEl.textContent = "Could not start GPS watch.";
      setRunning(false);
    }
  });

  stopBtn.addEventListener("click", function () {
    stopSpeedWatchIfRunning();
    setRunning(false);
    noteEl.textContent = "Stopped.";
  });
}

// ----------------------------
// Render router
// ----------------------------
function render() {
  if (!app) app = document.getElementById("app");
  if (!app) return;

  renderConsentBannerIfNeeded();

  // Show disclaimer popup once per browser session (and also if user opens it)
  openDisclaimerModal(false);

  if (!hasResolvedLocation()) {
    const last = loadLastLocation();
    if (last) setResolvedLocation(last.lat, last.lon, last.label || "");
  }

  renderHeaderAndNav();

  const page = pageEl();
  page.innerHTML = "";

  if (state.tool === "Home") renderHome();
  else if (state.tool === "Trolling depth calculator") renderDepthCalculator();
  else if (state.tool === "Species tips") renderSpeciesTips();
  else if (state.tool === "Speedometer") renderSpeedometer();
  else {
    state.tool = "Home";
    renderHome();
  }
}

// ----------------------------
// Boot
// ----------------------------
document.addEventListener("DOMContentLoaded", function () {
  app = document.getElementById("app");

  state.tool = "Home";
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();

  try {
    window.scrollTo(0, 0);
  } catch (e) {
    // ignore
  }

  render();
});

// ============================
// app.js (PART 5 OF 5) END
// ============================
