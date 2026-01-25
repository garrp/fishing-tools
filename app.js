// ============================
// app.js (PART 1 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.2.0
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

"use strict";

/*
  Single-file vanilla JS app.

  Expects an index.html with ONE root:
    <main id="app"></main>
    <script src="app.js" defer></script>

  Tools:
  - Home: Weather/Wind + Best Times + GO/CAUTION/NO-GO (date selectable)
  - Depth: Trolling depth calculator (adds line type selection)
  - Tips: Species tips
  - Speed: GPS speedometer

  Requirements satisfied:
  - Date picker actually changes the forecast day (within forecast range)
  - If precip chance missing/null: show "N/A"
  - Auto-load last location; can optionally auto-GPS on first open
  - GO/CAUTION/NO-GO includes temperature logic (cold/heat penalties)
  - Funny remark under the status bar (random from 5)
  - Robust fetch + readable errors (prevents silent JSON parse failures)
*/

const APP_VERSION = "1.2.0";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";

// ----------------------------
// Analytics consent (GA4)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const CONSENT_KEY = "fishynw_ga_consent_v1"; // "granted" | "denied"
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

  document.getElementById("consent_accept").addEventListener("click", function () {
    setConsent("granted");
    removeConsentBanner();
    loadGa4();
  });

  document.getElementById("consent_decline").addEventListener("click", function () {
    setConsent("denied");
    removeConsentBanner();
  });
}

// ----------------------------
// Persisted last location + user prefs
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v3"; // {lat:number, lon:number, label:string}
const PREFS_KEY = "fishynw_prefs_v1"; // {waterType, craft, autoGps}

// If true, app will try to auto-request GPS at startup only when there is no saved location.
// Default: false (avoid annoying permission prompts).
const DEFAULT_AUTO_GPS = false;

function saveLastLocation(lat, lon, label) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const payload = { lat: Number(lat), lon: Number(lon), label: String(label || "") };
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

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj) return null;
    return obj;
  } catch (e) {
    return null;
  }
}

function savePrefs(obj) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(obj || {}));
  } catch (e) {
    // ignore
  }
}

// ----------------------------
// Shared state
// ----------------------------
const state = {
  tool: "Home",

  // resolved location
  lat: null,
  lon: null,
  placeLabel: "",

  // picker state
  matches: [],
  selectedIndex: 0,

  // speedometer
  speedWatchId: null,

  // home inputs
  dateIso: "", // selected day YYYY-MM-DD
  waterType: "Small / protected",
  craft: "Kayak (paddle)",

  // prefs
  autoGps: DEFAULT_AUTO_GPS,

  // home cache
  homeCacheKey: "",
  homeWx: null,
  homeSun: null
};

// ----------------------------
// DOM handle
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

  /* Weather tiles */
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

  /* Toggle buttons */
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
  .toggleBtnOn {
    background: rgba(143,209,158,0.45);
    border-color: rgba(111,191,135,0.85);
    color: rgba(0,0,0,0.82);
  }

  /* Status meter */
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

  /* Wind chart */
  .chartWrap { margin-top: 10px; }
  canvas.windChart {
    width: 100%;
    height: 180px;
    display: block;
    border-radius: 12px;
    background: rgba(255,255,255,0.9);
    border: 1px solid rgba(0,0,0,0.12);
  }

  /* Consent banner */
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

function appendHtml(el, html) {
  el.insertAdjacentHTML("beforeend", html);
}

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function clampIsoToForecast(dateIso, dailyDates) {
  if (!dailyDates || !dailyDates.length) return isoTodayLocal();
  if (dailyDates.indexOf(dateIso) >= 0) return dateIso;

  const wanted = String(dateIso || "");
  let best = dailyDates[0];
  let bestDiff = Infinity;

  for (let i = 0; i < dailyDates.length; i++) {
    const d = dailyDates[i];
    const diff = Math.abs(Date.parse(d) - Date.parse(wanted));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
}

function setResolvedLocation(lat, lon, label) {
  state.lat = Number(lat);
  state.lon = Number(lon);
  state.placeLabel = String(label || "");
  saveLastLocation(state.lat, state.lon, state.placeLabel);

  // invalidate home cache
  state.homeCacheKey = "";
  state.homeWx = null;
  state.homeSun = null;
}

function clearResolvedLocation() {
  state.lat = null;
  state.lon = null;
  state.placeLabel = "";
  state.matches = [];
  state.selectedIndex = 0;
  clearLastLocation();

  state.homeCacheKey = "";
  state.homeWx = null;
  state.homeSun = null;
}

function formatTime(d) {
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return String(d);
  }
}

// Normalize query:
// - collapses whitespace
// - recognizes "City, st" and uppercases the state code
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

function niceErr(e) {
  const s = String(e && e.message ? e.message : e);
  return s.length > 180 ? s.slice(0, 180) + "..." : s;
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
// Robust fetch helper
// ----------------------------
async function fetchJson(url, timeoutMs) {
  const ms = Number(timeoutMs || 12000);
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;

  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);

    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const snippet = String(text || "").slice(0, 160).replace(/\s+/g, " ").trim();
      throw new Error("Bad JSON response (" + r.status + "). " + (snippet ? snippet : "No body."));
    }

    if (!r.ok) {
      const msg =
        (data && (data.reason || data.error || data.message)) ?
          String(data.reason || data.error || data.message) :
          ("HTTP " + r.status);
      throw new Error(msg);
    }

    return data;
  } catch (e2) {
    const msg = (e2 && e2.name === "AbortError") ? "Request timed out." : String(e2 && e2.message ? e2.message : e2);
    throw new Error(msg);
  } finally {
    if (t) clearTimeout(t);
  }
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
        return { label: parts.join(", "), lat: Number(x.latitude), lon: Number(x.longitude) };
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
// API: Sunrise/Sunset (forecast range)
// ----------------------------
async function fetchSunTimes(lat, lon, days) {
  const d = Math.max(1, Math.min(16, Number(days || 10))); // open-meteo typical max is 16
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&daily=sunrise,sunset" +
    "&forecast_days=" + encodeURIComponent(d) +
    "&timezone=auto";

  const data = await fetchJson(url, 12000);

  const daily = data && data.daily ? data.daily : null;
  const out = {
    time: (daily && daily.time) ? daily.time : [],
    sunrise: (daily && daily.sunrise) ? daily.sunrise : [],
    sunset: (daily && daily.sunset) ? daily.sunset : []
  };
  return out;
}

function sunForDate(sunData, dateIso) {
  if (!sunData || !sunData.time || !sunData.time.length) return null;
  const idx = sunData.time.indexOf(dateIso);
  if (idx < 0) return null;

  const sr = sunData.sunrise && sunData.sunrise[idx] ? sunData.sunrise[idx] : null;
  const ss = sunData.sunset && sunData.sunset[idx] ? sunData.sunset[idx] : null;
  if (!sr || !ss) return null;

  return { sunrise: new Date(sr), sunset: new Date(ss) };
}

// ----------------------------
// API: Weather/Wind (forecast range)
// - includes precip_probability (may be missing in some locations)
// ----------------------------
async function fetchWeatherWind(lat, lon, days) {
  const d = Math.max(1, Math.min(16, Number(days || 10)));

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
    "&hourly=wind_speed_10m" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&forecast_days=" + encodeURIComponent(d) +
    "&timezone=auto";

  const data = await fetchJson(url, 12000);

  const daily = data && data.daily ? data.daily : {};
  const hourly = data && data.hourly ? data.hourly : {};

  return {
    daily: {
      time: daily.time || [],
      tmin: daily.temperature_2m_min || [],
      tmax: daily.temperature_2m_max || [],
      // may contain nulls depending on station/data
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

// Filter hourly arrays down to a single date
function filterHourlyToDate(times, values, dateIso) {
  const out = [];
  if (!times || !times.length) return out;

  for (let i = 0; i < times.length; i++) {
    const t = String(times[i] || "");
    if (t.slice(0, 10) === dateIso) {
      out.push({ dt: new Date(t), v: Number(values[i]) });
    }
  }

  return out.filter(function (x) { return Number.isFinite(x.v); });
}

// ----------------------------
// Funny remarks (random from 5)
// - chosen deterministically per day so it does not change on every rerender
// ----------------------------
const FUNNY_REMARKS = [
  "Green light. Tell your wife this is basically a safety briefing, so you have to go kayak fishing now.",
  "Looks good. If anyone asks, you are doing important science on the water.",
  "GO status. Your kayak just texted me: it misses you and wants snacks.",
  "Conditions say yes. Your couch says no. Choose wisely.",
  "You have official permission to chase fish and ignore chores for a few hours."
];

function hashStrToInt(s) {
  const str = String(s || "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

function pickFunnyRemark(dateIso, label, lat, lon) {
  const key = String(dateIso || "") + "|" + String(label || "") + "|" + String(lat || "") + "|" + String(lon || "");
  const n = hashStrToInt(key);
  return FUNNY_REMARKS[n % FUNNY_REMARKS.length];
}

// ============================
// app.js (PART 1 OF 3) END
// ===========================
// ============================
// app.js (PART 2 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// ============================

// ----------------------------
// GO / CAUTION / NO-GO logic
// - uses wind + gust + water type + craft
// - adds temperature-based penalties (cold/heat)
// ----------------------------
function computeRisk(input) {
  const waterType = String(input.waterType || "Small / protected");
  const craft = String(input.craft || "Kayak (paddle)");

  const tmin = safeNum(input.tmin, 999);
  const tmax = safeNum(input.tmax, 999);
  const wind = safeNum(input.windMax, 0);
  const gust = safeNum(input.gustMax, wind);

  const avgT = (Number.isFinite(tmin) && Number.isFinite(tmax)) ? (tmin + tmax) / 2 : tmax;

  // Base thresholds
  // Small/protected is more forgiving than Big water/offshore.
  let windGo = 10, windCaution = 15;
  let gustGo = 15, gustCaution = 22;

  if (waterType === "Big water / offshore") {
    windGo = 8; windCaution = 12;
    gustGo = 12; gustCaution = 18;
  }

  // Craft sensitivity (paddle is stricter than pedal; small boat is a bit less strict)
  if (craft === "Kayak (paddle)") {
    // default
  } else if (craft === "Kayak (pedal)") {
    windGo += 2; windCaution += 2;
    gustGo += 3; gustCaution += 3;
  } else if (craft === "Small boat") {
    windGo += 3; windCaution += 3;
    gustGo += 4; gustCaution += 4;
  }

  // Score 0..100 where higher = worse
  let score = 0;
  const notes = [];

  // Wind scoring
  if (wind <= windGo) {
    score += 10;
  } else if (wind <= windCaution) {
    score += 35;
    notes.push("Moderate wind for the selected water/craft.");
  } else {
    score += 70;
    notes.push("High sustained wind risk for the selected water/craft.");
  }

  // Gust scoring
  if (gust <= gustGo) {
    score += 5;
  } else if (gust <= gustCaution) {
    score += 25;
    notes.push("Gusts may create sudden control issues.");
  } else {
    score += 55;
    notes.push("Strong gusts can flip the script quickly.");
  }

  // Temperature penalties (your request)
  // These adjust consequence even if wind is calm.
  if (Number.isFinite(avgT)) {
    // Cold: immersion consequence.
    if (avgT <= 15) {
      score += 45;
      notes.push("Extreme cold. A small mistake becomes a real emergency fast.");
    } else if (avgT <= 30) {
      score += 25;
      notes.push("Very cold day. Dress for immersion, not just air temp.");
    } else if (avgT <= 38) {
      score += 12;
      notes.push("Chilly day. Cold water risk still matters.");
    }

    // Heat: exposure / hydration risk.
    if (avgT >= 100) {
      score += 40;
      notes.push("Extreme heat risk. Sun protection and hydration are critical.");
    } else if (avgT >= 90) {
      score += 18;
      notes.push("Hot day. Plan shade, water, and electrolytes.");
    }
  }

  // Normalize
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let status = "GO";
  let statusNote = "Generally favorable. Keep your head on a swivel for local wind quirks.";

  if (score >= 70) {
    status = "NO-GO";
    statusNote = "Not recommended for the selected craft and water type.";
  } else if (score >= 40) {
    status = "CAUTION";
    statusNote = "Possible, but conditions add risk. Make conservative choices.";
  }

  return {
    score: score,
    status: status,
    statusNote: statusNote,
    bullets: notes
  };
}

function statusToPillBg(status) {
  if (status === "GO") return "rgba(143,209,158,0.55)";
  if (status === "CAUTION") return "rgba(255,214,102,0.65)";
  return "rgba(244,163,163,0.70)";
}

function scoreToNeedlePct(score) {
  // map 0..100 to 0..100
  const s = Math.max(0, Math.min(100, safeNum(score, 0)));
  return s;
}

// ----------------------------
// Best fishing windows
// - Simple, local-time heuristic using sunrise/sunset
// ----------------------------
function buildBestWindows(sun) {
  if (!sun || !sun.sunrise || !sun.sunset) return null;

  const sr = sun.sunrise;
  const ss = sun.sunset;

  const dawnStart = new Date(sr.getTime() - 30 * 60 * 1000);
  const dawnEnd = new Date(sr.getTime() + 120 * 60 * 1000);

  const duskStart = new Date(ss.getTime() - 120 * 60 * 1000);
  const duskEnd = new Date(ss.getTime() + 30 * 60 * 1000);

  return {
    dawn: { start: dawnStart, end: dawnEnd },
    dusk: { start: duskStart, end: duskEnd }
  };
}

// ----------------------------
// Wind chart renderer (canvas)
// ----------------------------
function drawWindChart(canvas, points) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  const padL = 44;
  const padR = 14;
  const padT = 12;
  const padB = 26;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  if (!points || points.length < 2) {
    ctx.font = "14px system-ui, Arial";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText("No hourly wind data for this date.", 14, 26);
    return;
  }

  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const v = points[i].v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return;

  // make it look nice
  const span = Math.max(1, maxV - minV);
  minV = Math.floor(minV - span * 0.15);
  maxV = Math.ceil(maxV + span * 0.15);
  if (minV < 0) minV = 0;

  function xFor(i) {
    return padL + (i / (points.length - 1)) * innerW;
  }
  function yFor(v) {
    const t = (v - minV) / (maxV - minV);
    return padT + (1 - t) * innerH;
  }

  // grid lines + y labels (3 lines)
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;

  const yTicks = 3;
  ctx.font = "12px system-ui, Arial";
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  for (let i = 0; i <= yTicks; i++) {
    const t = i / yTicks;
    const y = padT + t * innerH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();

    const val = Math.round(maxV - t * (maxV - minV));
    ctx.fillText(String(val) + " mph", 8, y + 4);
  }

  // x labels: first, mid, last
  const idxs = [0, Math.floor(points.length / 2), points.length - 1];
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  for (let j = 0; j < idxs.length; j++) {
    const idx = idxs[j];
    const x = xFor(idx);
    const d = points[idx].dt;
    const label = d.toLocaleTimeString([], { hour: "numeric" }).replace(":00", "");
    ctx.fillText(label, x - 10, h - 8);
  }

  // line
  ctx.strokeStyle = "rgba(0,0,0,0.70)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = xFor(i);
    const y = yFor(points[i].v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // points
  ctx.fillStyle = "rgba(0,0,0,0.70)";
  for (let i = 0; i < points.length; i += Math.max(1, Math.floor(points.length / 10))) {
    const x = xFor(i);
    const y = yFor(points[i].v);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----------------------------
// Render: app shell + navigation
// ----------------------------
function renderAppShell() {
  app.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  app.appendChild(wrap);

  appendHtml(
    wrap,
    '<div class="header">' +
      '<div class="logo"><img alt="FishyNW" src="' + escHtml(LOGO_URL) + '"></div>' +
      '<div class="title">Fishing Tools<br><span class="small muted">v ' + escHtml(APP_VERSION) + "</span></div>" +
    "</div>"
  );

  // nav
  const nav = document.createElement("div");
  nav.className = "nav";
  wrap.appendChild(nav);

  const tools = ["Home", "Depth", "Tips", "Speed"];
  for (let i = 0; i < tools.length; i++) {
    const t = tools[i];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "navBtn" + (state.tool === t ? " navBtnActive" : "");
    b.textContent = t;
    b.disabled = (state.tool === t);
    b.addEventListener("click", function () {
      state.tool = t;
      stopSpeedWatchIfRunning();
      render();
    });
    nav.appendChild(b);
  }

  // content mount
  const content = document.createElement("div");
  content.id = "content";
  wrap.appendChild(content);

  // footer
  appendHtml(
    wrap,
    '<div class="footer">' +
      '<div><strong>FishyNW.com</strong></div>' +
      "<div>Independent Northwest fishing tools</div>" +
    "</div>"
  );
}

// ----------------------------
// Render: Home tool
// ----------------------------
function renderHome(content) {
  const hasLoc = hasResolvedLocation();

  // ensure a default date
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();

  appendHtml(
    content,
    '<div class="card">' +
      "<h2>Weather/Wind + Best Times</h2>" +
      '<div class="muted">Select a date. Forecast data is loaded for the chosen day.</div>' +
      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Date</div>' +
        '<input id="home_date" type="date" value="' + escHtml(state.dateIso) + '">' +
      "</div>" +
      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Water type</div>' +
        '<div class="toggleRow">' +
          '<button id="wt_small" class="toggleBtn" type="button">Small / protected</button>' +
          '<button id="wt_big" class="toggleBtn" type="button">Big water / offshore</button>' +
        "</div>" +
        '<div class="muted" style="margin-top:6px;">Small water is default. Big water is stricter for wind and cold.</div>' +
      "</div>" +
      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Craft</div>' +
        '<select id="craft_sel">' +
          '<option value="Kayak (paddle)">Kayak (paddle)</option>' +
          '<option value="Kayak (pedal)">Kayak (pedal)</option>' +
          '<option value="Small boat">Small boat</option>' +
        "</select>" +
      "</div>" +
    "</div>"
  );

  // Location card
  appendHtml(
    content,
    '<div class="card">' +
      "<h2>Location</h2>" +
      '<div class="fieldLabel">Search or use GPS</div>' +
      '<input id="place_in" type="text" placeholder="City, ST or place name" value="' + escHtml(state.placeLabel || "") + '">' +
      '<div class="btnRow">' +
        '<button id="place_search" type="button">Search place</button>' +
        '<button id="gps_btn" type="button">Use my location</button>' +
      "</div>" +
      '<div class="muted" style="margin-top:8px;">Using: <span id="using_lbl">' +
        escHtml(hasLoc ? (state.placeLabel || "Selected location") : "No location selected") +
      "</span></div>" +
      '<div id="match_area" style="margin-top:10px;"></div>' +
    "</div>"
  );

  // Hook up toggles + craft
  const wtSmall = document.getElementById("wt_small");
  const wtBig = document.getElementById("wt_big");
  const craftSel = document.getElementById("craft_sel");

  function syncToggles() {
    const isSmall = (state.waterType === "Small / protected");
    wtSmall.className = "toggleBtn" + (isSmall ? " toggleBtnOn" : "");
    wtBig.className = "toggleBtn" + (!isSmall ? " toggleBtnOn" : "");
    craftSel.value = state.craft;
  }
  syncToggles();

  wtSmall.addEventListener("click", function () {
    state.waterType = "Small / protected";
    persistPrefsFromState();
    render();
  });
  wtBig.addEventListener("click", function () {
    state.waterType = "Big water / offshore";
    persistPrefsFromState();
    render();
  });
  craftSel.addEventListener("change", function () {
    state.craft = craftSel.value;
    persistPrefsFromState();
    render();
  });

  // date change
  document.getElementById("home_date").addEventListener("change", function (e) {
    const v = String(e.target.value || "");
    if (isIsoDate(v)) {
      state.dateIso = v;
      render();
    }
  });

  // Location search behavior:
  const placeInput = document.getElementById("place_in");
  placeInput.addEventListener("input", function () {
    // if user edits text, do not auto-clear resolved location (it might be a label)
    // but clear match list so they do not pick stale results
    state.matches = [];
    state.selectedIndex = 0;
    const matchArea = document.getElementById("match_area");
    if (matchArea) matchArea.innerHTML = "";
  });

  document.getElementById("place_search").addEventListener("click", async function () {
    const q = normalizePlaceQuery(placeInput.value);
    const matchArea = document.getElementById("match_area");
    matchArea.innerHTML = '<div class="muted">Searching...</div>';

    const res = await geocodeSearch(q, 10);
    state.matches = res;
    state.selectedIndex = 0;

    if (!res.length) {
      matchArea.innerHTML = '<div class="muted">No results found. Try "City, ST".</div>';
      return;
    }

    // show picker
    let html = "";
    html += '<div class="fieldLabel">Choose result</div>';
    html += '<select id="match_sel">';
    for (let i = 0; i < res.length; i++) {
      html += '<option value="' + i + '">' + escHtml(res[i].label) + "</option>";
    }
    html += "</select>";
    html += '<div class="btnRow" style="margin-top:10px;">' +
            '<button id="match_use" type="button">Use selected</button>' +
            '<button id="match_cancel" type="button">Cancel</button>' +
            "</div>";
    matchArea.innerHTML = html;

    document.getElementById("match_use").addEventListener("click", function () {
      const sel = document.getElementById("match_sel");
      const idx = safeNum(sel.value, 0);
      const m = state.matches[idx];
      if (!m) return;
      setResolvedLocation(m.lat, m.lon, m.label);
      placeInput.value = m.label;
      document.getElementById("using_lbl").textContent = m.label || "Selected location";
      matchArea.innerHTML = "";
      render();
    });

    document.getElementById("match_cancel").addEventListener("click", function () {
      state.matches = [];
      state.selectedIndex = 0;
      matchArea.innerHTML = "";
    });
  });

  document.getElementById("gps_btn").addEventListener("click", function () {
    requestGpsLocation();
  });

  // If we have a resolved location, fetch and render day summary
  if (hasLoc) {
    appendHtml(
      content,
      '<div class="card" id="home_results">' +
        "<h2>Overview - " + escHtml(state.dateIso) + "</h2>" +
        '<div class="muted" id="home_msg">Loading forecast...</div>' +
      "</div>"
    );
    loadAndRenderHomeForecast();
  } else {
    appendHtml(
      content,
      '<div class="card compact">' +
        '<div class="muted">Set a location to load the forecast for your selected date.</div>' +
      "</div>"
    );
  }
}

function persistPrefsFromState() {
  const obj = {
    waterType: state.waterType,
    craft: state.craft,
    autoGps: !!state.autoGps
  };
  savePrefs(obj);
}

function applyPrefsToState() {
  const p = loadPrefs();
  if (!p) return;

  if (p.waterType === "Small / protected" || p.waterType === "Big water / offshore") {
    state.waterType = p.waterType;
  }
  if (p.craft === "Kayak (paddle)" || p.craft === "Kayak (pedal)" || p.craft === "Small boat") {
    state.craft = p.craft;
  }
  if (typeof p.autoGps === "boolean") {
    state.autoGps = p.autoGps;
  }
}

// ----------------------------
// GPS: resolve location + label
// ----------------------------
function requestGpsLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not available on this device/browser.");
    return;
  }

  const usingLbl = document.getElementById("using_lbl");
  if (usingLbl) usingLbl.textContent = "Acquiring GPS...";

  navigator.geolocation.getCurrentPosition(
    async function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      let label = "Current location";
      const rev = await reverseGeocode(lat, lon);
      if (rev) label = rev;

      setResolvedLocation(lat, lon, label);

      const placeInput = document.getElementById("place_in");
      if (placeInput) placeInput.value = label;

      if (usingLbl) usingLbl.textContent = label;

      render();
    },
    function (err) {
      if (usingLbl) usingLbl.textContent = "No location selected";
      alert("Could not get GPS location: " + (err && err.message ? err.message : "Unknown error"));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

// ----------------------------
// Home forecast loader + renderer
// ----------------------------
async function loadAndRenderHomeForecast() {
  const host = document.getElementById("home_results");
  const msg = document.getElementById("home_msg");
  if (!host || !msg) return;

  // Cache key includes lat/lon and day bucket so we do not refetch constantly
  const key =
    String(state.lat) +
    "," +
    String(state.lon) +
    "|d=" +
    String(state.dateIso || "") +
    "|v=1";

  try {
    msg.textContent = "Loading forecast...";

    // Always fetch enough days to cover the chosen date, but cap at 16.
    // We'll request 16 days and clamp date to what API returns.
    const wx = await fetchWeatherWind(state.lat, state.lon, 16);
    const sun = await fetchSunTimes(state.lat, state.lon, 16);

    const dailyDates = (wx && wx.daily && wx.daily.time) ? wx.daily.time : [];
    const chosen = clampIsoToForecast(state.dateIso, dailyDates);
    state.dateIso = chosen; // IMPORTANT: update date picker selection if it was out of range

    // Update date picker value to the clamped date (so UI matches reality)
    const dateEl = document.getElementById("home_date");
    if (dateEl && dateEl.value !== chosen) dateEl.value = chosen;

    const idx = dailyDates.indexOf(chosen);
    if (idx < 0) {
      msg.textContent = "Forecast data not available for that date.";
      return;
    }

    const tmin = wx.daily.tmin[idx];
    const tmax = wx.daily.tmax[idx];
    const pop = wx.daily.popMax[idx];
    const windMax = wx.daily.windMax[idx];
    const gustMax = wx.daily.gustMax[idx];

    // hourly for chart
    const hourlyPoints = filterHourlyToDate(wx.hourly.time, wx.hourly.wind, chosen);

    // sunrise/sunset for best windows
    const sunDay = sunForDate(sun, chosen);
    const windows = buildBestWindows(sunDay);

    // Risk score
    const risk = computeRisk({
      waterType: state.waterType,
      craft: state.craft,
      tmin: tmin,
      tmax: tmax,
      windMax: windMax,
      gustMax: gustMax
    });

    // tiles
    const popStr = (pop === null || pop === undefined || !Number.isFinite(Number(pop))) ? "N/A" : String(Math.round(Number(pop))) + " %";

    const tStr =
      (Number.isFinite(Number(tmin)) && Number.isFinite(Number(tmax)))
        ? String(Math.round(Number(tmin))) + " to " + String(Math.round(Number(tmax))) + " F"
        : (Number.isFinite(Number(tmax)) ? String(Math.round(Number(tmax))) + " F" : "N/A");

    const windStr = Number.isFinite(Number(windMax)) ? String(Math.round(Number(windMax))) + " mph" : "N/A";
    const gustStr = Number.isFinite(Number(gustMax)) ? String(Math.round(Number(gustMax))) + " mph" : "N/A";

    const needlePct = scoreToNeedlePct(risk.score);
    const funny = pickFunnyRemark(chosen, state.placeLabel, state.lat, state.lon);

    // Replace the host inner HTML with full results (keep title)
    host.innerHTML =
      "<h2>Overview - " + escHtml(chosen) + "</h2>" +
      '<div class="tilesGrid">' +
        '<div class="tile">' +
          '<div class="tileTop">Temperature</div>' +
          '<div class="tileVal">' + escHtml(tStr) + "</div>" +
          '<div class="tileSub">Daily min / max</div>' +
        "</div>" +
        '<div class="tile">' +
          '<div class="tileTop">Rain chance (max)</div>' +
          '<div class="tileVal">' + escHtml(popStr) + "</div>" +
          '<div class="tileSub">Peak probability</div>' +
        "</div>" +
        '<div class="tile">' +
          '<div class="tileTop">Max sustained wind</div>' +
          '<div class="tileVal">' + escHtml(windStr) + "</div>" +
          '<div class="tileSub">Day max</div>' +
        "</div>" +
        '<div class="tile">' +
          '<div class="tileTop">Max gust</div>' +
          '<div class="tileVal">' + escHtml(gustStr) + "</div>" +
          '<div class="tileSub">Day max</div>' +
        "</div>" +
      "</div>" +

      '<div class="statusRow">' +
        "<h3>Boating / Kayak status</h3>" +
        '<div class="pill" style="background:' + escHtml(statusToPillBg(risk.status)) + ';">' + escHtml(risk.status) + "</div>" +
      "</div>" +

      '<div style="position:relative; margin-top:6px;">' +
        '<div class="meterBar">' +
          '<div class="meterSeg segG"></div>' +
          '<div class="meterSeg segY"></div>' +
          '<div class="meterSeg segR"></div>' +
        "</div>" +
        '<div class="meterNeedle" style="left:' + escHtml(String(needlePct)) + '%;"></div>' +
      "</div>" +

      '<div class="muted" style="margin-top:10px;">' +
        escHtml(risk.statusNote) +
      "</div>" +

      // funny remark under the CAC bar
      '<div style="margin-top:10px; font-weight:900;">' + escHtml(funny) + "</div>" +

      (risk.bullets && risk.bullets.length
        ? '<ul class="list">' + risk.bullets.map(function (x) { return "<li>" + escHtml(x) + "</li>"; }).join("") + "</ul>"
        : "") +

      '<div class="card" style="margin-top:12px;">' +
        "<h2>Hourly wind (line chart)</h2>" +
        '<div class="muted">Wind speed at 10m in mph for the selected date.</div>' +
        '<div class="chartWrap"><canvas class="windChart" id="wind_chart"></canvas></div>' +
      "</div>" +

      '<div class="card" style="margin-top:12px;">' +
        "<h2>Best fishing windows</h2>" +
        (windows
          ? '<ul class="list">' +
              "<li><strong>Dawn window</strong>: " + escHtml(formatTime(windows.dawn.start)) + " to " + escHtml(formatTime(windows.dawn.end)) + "</li>" +
              "<li><strong>Dusk window</strong>: " + escHtml(formatTime(windows.dusk.start)) + " to " + escHtml(formatTime(windows.dusk.end)) + "</li>" +
            "</ul>"
          : '<div class="muted">Sunrise/sunset not available for this date.</div>') +
      "</div>";

    // chart draw
    const canvas = document.getElementById("wind_chart");
    if (canvas) {
      drawWindChart(canvas, hourlyPoints);
    }
  } catch (e) {
    host.innerHTML =
      "<h2>Overview - " + escHtml(state.dateIso) + "</h2>" +
      '<div class="muted">Could not load forecast: ' + escHtml(niceErr(e)) + "</div>";
  }
}

// ----------------------------
// Render: Tips tool
// ----------------------------
function renderTips(content) {
  appendHtml(
    content,
    '<div class="card">' +
      "<h2>Tips</h2>" +
      '<div class="muted">A quick list of Pacific Northwest targets and practical notes.</div>' +
      '<div class="sectionTitle">Common PNW targets</div>' +
      '<ul class="list">' +
        "<li>Chinook salmon</li>" +
        "<li>Coho salmon</li>" +
        "<li>Kokanee</li>" +
        "<li>Rainbow trout</li>" +
        "<li>Lake trout</li>" +
        "<li>Walleye</li>" +
        "<li>Smallmouth bass</li>" +
        "<li>Largemouth bass</li>" +
        "<li>Channel catfish</li>" +
        "<li>Crappie / perch</li>" +
      "</ul>" +
      '<div class="sectionTitle">Quick reminders</div>' +
      '<ul class="list">' +
        "<li>Dress for immersion, not just air temperature.</li>" +
        "<li>Wind around points and canyon mouths can spike fast.</li>" +
        "<li>Big water demands conservative decisions even when it looks calm at the ramp.</li>" +
      "</ul>" +
    "</div>"
  );
}

// ----------------------------
// Render: Speed tool
// ----------------------------
function renderSpeed(content) {
  appendHtml(
    content,
    '<div class="card">' +
      "<h2>Speed</h2>" +
      '<div class="muted">GPS speedometer. Uses your device location permission.</div>' +
      '<div class="tile" style="margin-top:12px;">' +
        '<div class="tileTop">Speed (mph)</div>' +
        '<div class="tileVal" id="spd_val">0</div>' +
        '<div class="tileSub" id="spd_sub">Waiting for GPS...</div>' +
      "</div>" +
      '<div class="btnRow" style="margin-top:12px;">' +
        '<button id="spd_start" type="button">Start</button>' +
        '<button id="spd_stop" type="button">Stop</button>' +
      "</div>" +
    "</div>"
  );

  const vEl = document.getElementById("spd_val");
  const sEl = document.getElementById("spd_sub");

  function setText(v, s) {
    if (vEl) vEl.textContent = String(v);
    if (sEl) sEl.textContent = String(s);
  }

  document.getElementById("spd_start").addEventListener("click", function () {
    if (!navigator.geolocation) {
      alert("Geolocation is not available on this device/browser.");
      return;
    }

    stopSpeedWatchIfRunning();
    setText("0", "Acquiring GPS...");

    state.speedWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        const ms = safeNum(pos.coords.speed, 0); // meters/sec, may be null
        const mph = ms ? (ms * 2.236936) : 0;
        setText(mph.toFixed(1), "Updated");
      },
      function (err) {
        setText("0", "GPS error: " + (err && err.message ? err.message : "Unknown"));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  });

  document.getElementById("spd_stop").addEventListener("click", function () {
    stopSpeedWatchIfRunning();
    setText("0", "Stopped");
  });
}

// ----------------------------
// Main render dispatcher
// ----------------------------
function render() {
  renderConsentBannerIfNeeded();

  if (!app) {
    app = document.getElementById("app");
    if (!app) return;
  }

  renderAppShell();

  const content = document.getElementById("content");
  if (!content) return;

  if (state.tool === "Home") renderHome(content);
  else if (state.tool === "Depth") renderDepth(content); // part 3 provides renderDepth + calc
  else if (state.tool === "Tips") renderTips(content);
  else if (state.tool === "Speed") renderSpeed(content);
  else renderHome(content);
}

// ----------------------------
// Boot
// ----------------------------
function boot() {
  app = document.getElementById("app");
  if (!app) return;

  applyPrefsToState();

  // Restore last location if available
  const last = loadLastLocation();
  if (last) {
    state.lat = last.lat;
    state.lon = last.lon;
    state.placeLabel = last.label || "Saved location";
  } else if (state.autoGps) {
    // only attempt if user allowed auto GPS and there is no saved location
    // (will prompt permission)
    setTimeout(function () {
      if (state.tool === "Home" && !hasResolvedLocation()) requestGpsLocation();
    }, 300);
  }

  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();

  render();
}

document.addEventListener("DOMContentLoaded", boot);

// ============================
// app.js (PART 2 OF 3) END
// ============================
// ============================
// app.js (PART 3 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// ============================

// ----------------------------
// Funny remarks under CAC bar (5 total)
// Returns ONE at random, but stable-ish per day/location
// ----------------------------
const FUNNY_REMARKS = [
  "Scientific result: you are officially cleared to go kayak fishing. Please present this to your spouse as evidence.",
  "Forecast says its a GO. Translation: you are legally obligated to chase fish now.",
  "This app recommends kayaking. If anyone asks, blame the algorithm, not your life choices.",
  "Good news: conditions look decent. Bad news: now you have no excuse to skip leg day on the paddle back.",
  "Go status detected. Time to tell your wife you are doing something very responsible and safety-driven (kayak fishing)."
];

function pickFunnyRemark(dateIso, label, lat, lon) {
  // Deterministic-ish: hash date + coarse lat/lon + label
  const key =
    String(dateIso || "") +
    "|" +
    String(label || "") +
    "|" +
    String(Math.round(safeNum(lat, 0) * 100) / 100) +
    "," +
    String(Math.round(safeNum(lon, 0) * 100) / 100);

  const h = hashString(key);
  const idx = h % FUNNY_REMARKS.length;
  return FUNNY_REMARKS[idx];
}

function hashString(s) {
  // simple 32-bit hash
  s = String(s || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

// ----------------------------
// Open-Meteo API calls (forecast + sunrise/sunset)
// ----------------------------
async function fetchWeatherWind(lat, lon, days) {
  const d = safeNum(days, 7);
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(String(lat)) +
    "&longitude=" + encodeURIComponent(String(lon)) +
    "&timezone=auto" +
    "&forecast_days=" + encodeURIComponent(String(clamp(d, 1, 16))) +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,windspeed_10m_max,windgusts_10m_max" +
    "&hourly=windspeed_10m";

  const data = await fetchJson(url, 15000);

  const daily = data && data.daily ? data.daily : null;
  const hourly = data && data.hourly ? data.hourly : null;

  if (!daily || !daily.time) {
    throw new Error("Missing daily forecast data");
  }

  return {
    daily: {
      time: daily.time || [],
      tmin: daily.temperature_2m_min || [],
      tmax: daily.temperature_2m_max || [],
      popMax: daily.precipitation_probability_max || [],
      windMax: daily.windspeed_10m_max || [],
      gustMax: daily.windgusts_10m_max || []
    },
    hourly: {
      time: (hourly && hourly.time) ? hourly.time : [],
      wind: (hourly && hourly.windspeed_10m) ? hourly.windspeed_10m : []
    }
  };
}

async function fetchSunTimes(lat, lon, days) {
  const d = safeNum(days, 7);
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(String(lat)) +
    "&longitude=" + encodeURIComponent(String(lon)) +
    "&timezone=auto" +
    "&forecast_days=" + encodeURIComponent(String(clamp(d, 1, 16))) +
    "&daily=sunrise,sunset";

  const data = await fetchJson(url, 15000);
  const daily = data && data.daily ? data.daily : null;
  if (!daily || !daily.time) return null;

  return {
    time: daily.time || [],
    sunrise: daily.sunrise || [],
    sunset: daily.sunset || []
  };
}

function sunForDate(sun, dateIso) {
  if (!sun || !sun.time || !sun.time.length) return null;
  const idx = sun.time.indexOf(dateIso);
  if (idx < 0) return null;

  const sr = sun.sunrise && sun.sunrise[idx] ? new Date(sun.sunrise[idx]) : null;
  const ss = sun.sunset && sun.sunset[idx] ? new Date(sun.sunset[idx]) : null;

  if (!sr || !ss || isNaN(sr.getTime()) || isNaN(ss.getTime())) return null;
  return { sunrise: sr, sunset: ss };
}

function clampIsoToForecast(iso, dailyDates) {
  if (!dailyDates || !dailyDates.length) return isoTodayLocal();
  if (dailyDates.indexOf(iso) >= 0) return iso;

  // If user picked a date outside API range, pick closest available:
  // earlier than first -> first, later than last -> last
  const first = dailyDates[0];
  const last = dailyDates[dailyDates.length - 1];
  if (iso < first) return first;
  if (iso > last) return last;

  // Otherwise find nearest by absolute day difference
  let best = dailyDates[0];
  let bestDiff = Infinity;

  for (let i = 0; i < dailyDates.length; i++) {
    const diff = Math.abs(daysBetweenIso(dailyDates[i], iso));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = dailyDates[i];
    }
  }
  return best;
}

function daysBetweenIso(a, b) {
  // a,b: YYYY-MM-DD
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000));
}

function filterHourlyToDate(timeArr, windArr, dateIso) {
  const out = [];
  if (!timeArr || !windArr) return out;

  for (let i = 0; i < timeArr.length; i++) {
    const t = String(timeArr[i] || "");
    // timeArr values look like "2026-01-25T00:00"
    if (t.slice(0, 10) !== dateIso) continue;

    const dt = new Date(t);
    const v = safeNum(windArr[i], NaN);
    if (!isNaN(dt.getTime()) && Number.isFinite(v)) {
      out.push({ dt: dt, v: v });
    }
  }
  return out;
}

// ----------------------------
// Geocoding (search + reverse)
// ----------------------------
async function geocodeSearch(query, limit) {
  const q = String(query || "").trim();
  if (!q) return [];

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    "?name=" + encodeURIComponent(q) +
    "&count=" + encodeURIComponent(String(clamp(safeNum(limit, 5), 1, 20))) +
    "&language=en&format=json";

  const data = await fetchJson(url, 15000);
  const results = data && data.results ? data.results : [];
  const out = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i] || {};
    const lat = safeNum(r.latitude, null);
    const lon = safeNum(r.longitude, null);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const name = String(r.name || "").trim();
    const admin1 = String(r.admin1 || "").trim();
    const country = String(r.country || "").trim();

    let label = name;
    if (admin1) label += ", " + admin1;
    else if (country) label += ", " + country;

    out.push({ lat: lat, lon: lon, label: label });
  }

  return out;
}

async function reverseGeocode(lat, lon) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/reverse" +
    "?latitude=" + encodeURIComponent(String(lat)) +
    "&longitude=" + encodeURIComponent(String(lon)) +
    "&language=en&format=json";

  try {
    const data = await fetchJson(url, 15000);
    const r0 = data && data.results && data.results[0] ? data.results[0] : null;
    if (!r0) return null;

    const name = String(r0.name || "").trim();
    const admin1 = String(r0.admin1 || "").trim();
    const country = String(r0.country || "").trim();

    let label = name || "Current location";
    if (admin1) label += ", " + admin1;
    else if (country) label += ", " + country;
    return label;
  } catch (e) {
    return null;
  }
}

function normalizePlaceQuery(q) {
  // Accept "city, st" where st may be any case, normalize to "City, ST"
  q = String(q || "").trim();
  if (!q) return "";

  const m = q.match(/^(.+?),\s*([a-zA-Z]{2})$/);
  if (m) {
    const city = m[1].trim();
    const st = m[2].trim().toUpperCase();
    return city + ", " + st;
  }
  return q;
}

// ----------------------------
// Depth tool (trolling depth calculator)
// Includes line type selection (thinner = deeper)
// ----------------------------
function renderDepth(content) {
  appendHtml(
    content,
    '<div class="card">' +
      "<h2>Trolling Depth Calculator</h2>" +
      '<div class="muted">Simple estimate. Use as a starting point.</div>' +

      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Speed (mph)</div>' +
        '<input id="d_speed" type="number" step="0.1" min="0" value="' + escHtml(String(state.depth.speedMph)) + '">' +
      "</div>" +

      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Weight (oz)</div>' +
        '<input id="d_weight" type="number" step="0.5" min="0" value="' + escHtml(String(state.depth.weightOz)) + '">' +
      "</div>" +

      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Line out (ft)</div>' +
        '<input id="d_lineout" type="number" step="1" min="0" value="' + escHtml(String(state.depth.lineOutFt)) + '">' +
      "</div>" +

      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Line test (lb)</div>' +
        '<select id="d_test">' +
          buildLineTestOptions(state.depth.lineTestLb) +
        "</select>" +
      "</div>" +

      '<div style="margin-top:12px;">' +
        '<div class="fieldLabel">Line type</div>' +
        '<select id="d_linetype">' +
          '<option value="Braid (thin)">Braid (thin)</option>' +
          '<option value="Fluorocarbon (medium)">Fluorocarbon (medium)</option>' +
          '<option value="Mono (thick)">Mono (thick)</option>' +
        "</select>" +
        '<div class="muted" style="margin-top:6px;">Thinner lines typically run a little deeper for the same setup.</div>' +
      "</div>" +

      '<div class="btnRow" style="margin-top:14px;">' +
        '<button id="d_calc" type="button">Calculate</button>' +
      "</div>" +

      '<div id="d_out" class="card compact" style="margin-top:12px;"></div>' +
    "</div>"
  );

  // set line type select
  const lt = document.getElementById("d_linetype");
  if (lt) lt.value = state.depth.lineType;

  document.getElementById("d_calc").addEventListener("click", function () {
    state.depth.speedMph = safeNum(document.getElementById("d_speed").value, 1.5);
    state.depth.weightOz = safeNum(document.getElementById("d_weight").value, 2);
    state.depth.lineOutFt = safeNum(document.getElementById("d_lineout").value, 100);
    state.depth.lineTestLb = safeNum(document.getElementById("d_test").value, 12);
    state.depth.lineType = String(document.getElementById("d_linetype").value || "Braid (thin)");

    saveDepthPrefs(state.depth);

    const res = calcTrollingDepth(state.depth);
    const out = document.getElementById("d_out");

    out.innerHTML =
      "<div><strong>Estimated depth:</strong> " + escHtml(res.depthFt.toFixed(0)) + " ft</div>" +
      '<div class="muted" style="margin-top:6px;">' +
        "This is an estimate. Current, lure drag, dodger size, and turns can change depth a lot." +
      "</div>" +
      '<div class="muted" style="margin-top:6px;">' +
        "Line type factor used: " + escHtml(String(res.lineFactor.toFixed(2))) +
      "</div>";
  });

  // auto-calc once
  const out = document.getElementById("d_out");
  out.innerHTML = '<div class="muted">Tap Calculate to estimate depth.</div>';
}

function buildLineTestOptions(selected) {
  const opts = [6, 8, 10, 12, 15, 20, 30, 40, 50];
  let html = "";
  for (let i = 0; i < opts.length; i++) {
    const v = opts[i];
    const sel = (String(v) === String(selected)) ? ' selected="selected"' : "";
    html += '<option value="' + v + '"' + sel + ">" + v + "</option>";
  }
  return html;
}

function calcTrollingDepth(d) {
  const speed = Math.max(0.1, safeNum(d.speedMph, 1.5));
  const weight = Math.max(0, safeNum(d.weightOz, 2));
  const lineOut = Math.max(0, safeNum(d.lineOutFt, 100));
  const test = Math.max(1, safeNum(d.lineTestLb, 12));
  const lineType = String(d.lineType || "Braid (thin)");

  // Base model: depth proportional to (weight * lineOut) / (speed * drag)
  // drag grows with line test and line type thickness.
  const baseDrag = 1 + (test / 20); // heavier line = more drag
  const lineFactor = (lineType === "Braid (thin)") ? 0.92 : (lineType === "Fluorocarbon (medium)") ? 1.00 : 1.08;

  const drag = baseDrag * lineFactor;

  // scale constant tuned for "reasonable" outcomes for common trout/kokanee trolling
  const k = 0.17;

  let depth = (k * weight * lineOut) / (speed * drag);

  if (!Number.isFinite(depth) || depth < 0) depth = 0;

  // cap to line out (no deeper than line out)
  depth = Math.min(depth, lineOut);

  return { depthFt: depth, lineFactor: lineFactor };
}

function saveDepthPrefs(obj) {
  try {
    localStorage.setItem("fishynw_depth_prefs", JSON.stringify(obj));
  } catch (e) {}
}

function loadDepthPrefs() {
  try {
    const s = localStorage.getItem("fishynw_depth_prefs");
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

// ----------------------------
// Speed watch helpers
// ----------------------------
function stopSpeedWatchIfRunning() {
  if (state.speedWatchId != null && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(state.speedWatchId);
    } catch (e) {}
  }
  state.speedWatchId = null;
}

// ----------------------------
// LocalStorage: last location
// ----------------------------
function setResolvedLocation(lat, lon, label) {
  state.lat = safeNum(lat, null);
  state.lon = safeNum(lon, null);
  state.placeLabel = String(label || "Selected location");

  try {
    localStorage.setItem(
      PREFS_LAST_LOCATION_KEY,
      JSON.stringify({ lat: state.lat, lon: state.lon, label: state.placeLabel })
    );
  } catch (e) {}
}

function loadLastLocation() {
  try {
    const s = localStorage.getItem(PREFS_LAST_LOCATION_KEY);
    if (!s) return null;
    const o = JSON.parse(s);
    if (!o) return null;
    const lat = safeNum(o.lat, null);
    const lon = safeNum(o.lon, null);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat: lat, lon: lon, label: String(o.label || "") };
  } catch (e) {
    return null;
  }
}

function hasResolvedLocation() {
  return Number.isFinite(state.lat) && Number.isFinite(state.lon);
}

// ----------------------------
// Fetch helper (timeout + JSON)
// ----------------------------
async function fetchJson(url, timeoutMs) {
  const t = safeNum(timeoutMs, 15000);
  const ctrl = new AbortController();
  const to = setTimeout(function () { ctrl.abort(); }, t);

  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(to);
  }
}

function niceErr(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e.name === "AbortError") return "Request timed out";
  if (e.message) return e.message;
  return "Unknown error";
}

// ----------------------------
// Time + date formatting
// ----------------------------
function formatTime(d) {
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return String(y) + "-" + m + "-" + da;
}

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function clamp(v, a, b) {
  v = safeNum(v, a);
  if (v < a) return a;
  if (v > b) return b;
  return v;
}

// ----------------------------
// Consent banner / GA4 loading
// (kept minimal - GA4 loads only after accept)
// ----------------------------
function renderConsentBannerIfNeeded() {
  if (state.consentAccepted) return;

  // if already exists, do nothing
  if (document.getElementById("consent_banner")) return;

  const b = document.createElement("div");
  b.id = "consent_banner";
  b.style.position = "fixed";
  b.style.left = "12px";
  b.style.right = "12px";
  b.style.bottom = "12px";
  b.style.zIndex = "9999";
  b.style.background = "white";
  b.style.border = "1px solid rgba(0,0,0,0.15)";
  b.style.borderRadius = "14px";
  b.style.boxShadow = "0 12px 40px rgba(0,0,0,0.12)";
  b.style.padding = "12px";

  b.innerHTML =
    '<div style="font-weight:900; margin-bottom:6px;">Cookies and analytics</div>' +
    '<div class="muted" style="margin-bottom:10px;">We use analytics to understand usage. You can accept or decline.</div>' +
    '<div class="btnRow">' +
      '<button id="consent_accept" type="button">Accept</button>' +
      '<button id="consent_decline" type="button">Decline</button>' +
    "</div>";

  document.body.appendChild(b);

  document.getElementById("consent_accept").addEventListener("click", function () {
    state.consentAccepted = true;
    try { localStorage.setItem(PREFS_CONSENT_KEY, "yes"); } catch (e) {}
    b.remove();
    loadGA4IfEnabled();
  });

  document.getElementById("consent_decline").addEventListener("click", function () {
    state.consentAccepted = false;
    try { localStorage.setItem(PREFS_CONSENT_KEY, "no"); } catch (e) {}
    b.remove();
  });
}

function loadGA4IfEnabled() {
  if (!GA4_ID) return;
  if (!state.consentAccepted) return;
  if (document.getElementById("ga4_script")) return;

  const s = document.createElement("script");
  s.id = "ga4_script";
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA4_ID, { anonymize_ip: true });
}

// ----------------------------
// Restore consent on load
// ----------------------------
(function restoreConsent() {
  try {
    const v = localStorage.getItem(PREFS_CONSENT_KEY);
    if (v === "yes") state.consentAccepted = true;
    else if (v === "no") state.consentAccepted = false;
  } catch (e) {}
  if (state.consentAccepted) loadGA4IfEnabled();
})();

// ----------------------------
// Restore depth prefs on load
// ----------------------------
(function restoreDepthPrefs() {
  const d = loadDepthPrefs();
  if (!d) return;

  if (Number.isFinite(safeNum(d.speedMph, NaN))) state.depth.speedMph = safeNum(d.speedMph, 1.5);
  if (Number.isFinite(safeNum(d.weightOz, NaN))) state.depth.weightOz = safeNum(d.weightOz, 2);
  if (Number.isFinite(safeNum(d.lineOutFt, NaN))) state.depth.lineOutFt = safeNum(d.lineOutFt, 100);
  if (Number.isFinite(safeNum(d.lineTestLb, NaN))) state.depth.lineTestLb = safeNum(d.lineTestLb, 12);
  if (typeof d.lineType === "string") state.depth.lineType = d.lineType;
})();

// ============================
// app.js (PART 3 OF 3) END
// ============================