// ============================
// app.js (PART 1 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.1.2
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

"use strict";

/*
  Single-file vanilla JS app.

  Expects an index.html with ONE root:
    <main id="app"></main>
    <script src="app.js" defer></script>

  Changes in this build:
  - Depth calculator: adds Line type (Mono / Fluoro / Braid) and factors it into depth estimate.
  - Home status message: replaces the plain message with 5 funny reasons per GO/CAUTION/NO-GO.
    Deterministic pick (stable per date + location + craft + water) so it does not flicker.
    Still appends cold warnings when needed.
  - Fixes water toggle highlight bug (JS now uses the CSS class: toggleActive).
*/

const APP_VERSION = "1.1.2";
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
// Persisted last location
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v2"; // {lat:number, lon:number, label:string}

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
// Version 1.1.2
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

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
  return (
    String(Number(lat).toFixed(4)) + "," + String(Number(lon).toFixed(4))
  );
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
  ctx.fillText(
    String(Math.round(yMid)) + " mph",
    6,
    padT + h / 2 + 4
  );
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
    '    <div class="logo"><img src="' +
    escHtml(LOGO_URL) +
    '" alt="FishyNW"></div>' +
    '    <div class="title">' +
    escHtml(title) +
    '<div class="small muted">v ' +
    escHtml(APP_VERSION) +
    "</div></div>" +
    "  </div>" +
    '  <div class="nav" id="nav"></div>' +
    '  <div id="page"></div>' +
    '  <div class="footer"><strong>FishyNW.com</strong><br>Independent Northwest fishing tools</div>' +
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
}

function pageEl() {
  return document.getElementById("page");
}

// ----------------------------
// UI: Location Picker (reusable)
// - NO clear saved location button
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
  // This keeps your saved location behavior intact and avoids surprise prompting every load when saved location exists.
  if (autoGps && !hasResolvedLocation()) {
    setTimeout(function () {
      if (!hasResolvedLocation()) doGps();
    }, 450);
  }
}

// ============================
// app.js (PART 2 OF 4) END
// ============================
// ============================
// app.js (PART 3 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.1.2
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
  // FNV-1a-ish small hash
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
// GO/CAUTION/NO-GO
// - now uses funny reason picker (5 each)
// - still appends cold warnings when needed
// ----------------------------
function computeGoStatus(inputs) {
  const craft = inputs.craft || "Kayak (paddle)";
  const water = inputs.waterType || "Small / protected";
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const avgF = (tmin + tmax) / 2;

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

  let score = Math.max(sWind, sGust);

  const highF = tmax;
  const lowF = tmin;

  const chillPenalty =
    Math.max(0, 35 - avgF) * 0.6 + Math.max(0, windMax - 5) * 0.4;
  if (avgF < 45) score += Math.min(18, chillPenalty);

  let forceAtLeastCaution = false;
  let forceNoGo = false;

  if (highF <= 30) forceAtLeastCaution = true;
  if (lowF <= 20 || avgF <= 22) forceNoGo = true;

  score = Math.max(0, Math.min(100, score));

  let label = "GO";
  if (score >= 70) label = "NO-GO";
  else if (score >= 35) label = "CAUTION";

  if (forceNoGo) label = "NO-GO";
  else if (forceAtLeastCaution && label === "GO") label = "CAUTION";

  if (label === "NO-GO") score = Math.max(score, 75);
  else if (label === "CAUTION") score = Math.max(score, 45);
  else score = Math.min(score, 34);

  const needlePct = Math.max(0, Math.min(100, score));

  // Deterministic seed so it stays the same for a given situation/date
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
    String(Math.round(tmax));

  let msg = pickFunnyReason(label, seedStr);

  // Still append serious cold warnings as needed (short, but clear)
  if (highF <= 30 && label !== "NO-GO") {
    msg += " Very cold air increases consequence. Dress for immersion, not just air temp.";
  }
  if (forceNoGo) {
    msg += " Extreme cold can turn a minor issue into an emergency quickly.";
  }

  return { label: label, score: score, needlePct: needlePct, message: msg };
}

function computeExposureTips(inputs) {
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);

  const avgF = (tmin + tmax) / 2;
  const tips = [];

  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  tips.push("Bring a dry bag with a spare layer and gloves. Keep keys/phone in a waterproof pouch.");

  if (avgF <= 50) {
    tips.unshift("Avoid cotton layers. Use synthetics or wool that insulate when wet.");
    tips.unshift("Cold air and likely cold water: lean toward a dry suit or a proper wet suit setup.");
    if (avgF <= 40) tips.unshift("Neoprene gloves/boots help. Limit exposure time and keep shore close.");
  }

  if (tmax >= 78) {
    tips.unshift("Hot day: wear sun shirts and light, sun-repellent clothing. Use a wide-brim hat.");
    tips.unshift("Hydrate early. Bring more water than you think you need.");
  }

  if (windMax >= 12 || gustMax >= 20) {
    tips.push("Wind can spike fast. Leash key gear and plan a protected return route.");
  }

  return tips;
}

// ----------------------------
// Home: Date-driven forecast + water toggle + auto refresh
// - Uses getForecastBundle (cache + TTL) so it does not hammer the API
// - Fixes water toggle highlight (toggleActive class)
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

  // Date init: default to today, but allow user to change it
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

  // Default small/protected
  if (state.waterType !== "Big water / offshore") state.waterType = "Small / protected";
  paintWaterToggle();

  // Location picker (auto GPS only when no saved location exists)
  renderLocationPicker(
    page,
    "home",
    function () {
      renderHomeDynamic("location_resolved");
    },
    { autoGps: true }
  );

  appendHtml(page, `<div id="home_dynamic"></div>`);

  // initial draw
  renderHomeDynamic("init");

  // Auto refresh when returning to tab (handy on mobile)
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.tool === "Home" && hasResolvedLocation()) {
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

    // Precip can be null/undefined depending on data source/season.
    // We treat non-finite as "None" for display.
    const popRaw = wx.daily.popMax && wx.daily.popMax.length ? wx.daily.popMax[idx] : null;
    const popIsFinite = Number.isFinite(Number(popRaw));
    const popMax = popIsFinite ? safeNum(popRaw, 0) : null;

    const windMax = safeNum(wx.daily.windMax[idx], 0);
    const gustMax = safeNum(wx.daily.gustMax[idx], 0);

    const sunFor = sunForDate(sun, useIso);
    const windows = sunFor ? computeBestFishingWindows(sunFor.sunrise, sunFor.sunset) : [];

    // seed uses date + rounded location so message stays stable for that setup
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
      tmax: tmax
    });

    const tips = computeExposureTips({
      tmin: tmin,
      tmax: tmax,
      windMax: windMax,
      gustMax: gustMax
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

    // Redraw chart on resize
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
// app.js (PART 3 OF 4) END
// ============================
// ============================
// app.js (PART 4 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.1.2
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Depth Calculator
// - now considers LINE TYPE + line test
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

    // Higher factor => more drag => less depth
    // Lower factor => less drag => more depth
    if (t.indexOf("braid") >= 0) return 0.88;        // thin diameter, lower drag
    if (t.indexOf("fluoro") >= 0) return 0.96;       // slightly less drag than mono
    if (t.indexOf("lead") >= 0) return 0.72;         // tends to sink; treated as more depth for same inputs
    return 1.00;                                     // monofilament baseline
  }

  function lineTestFactor(testLb, lineType) {
    const t = safeNum(testLb, 12);

    // Base diameter/drag factor by test
    let f = t <= 10 ? 1.0 : t <= 12 ? 0.95 : t <= 20 ? 0.85 : 0.78;

    // Braid diameter is lower for the same "lb test"
    const lt = String(lineType || "").toLowerCase();
    if (lt.indexOf("braid") >= 0) {
      // soften the penalty of heavier tests
      if (t >= 30) f = Math.max(f, 0.84);
      else if (t >= 25) f = Math.max(f, 0.86);
      else if (t >= 20) f = Math.max(f, 0.88);
      else if (t >= 15) f = Math.max(f, 0.92);
    }

    // Fluoro often a bit stiffer / slightly more drag than braid, but close to mono in practice
    if (lt.indexOf("fluoro") >= 0) {
      f = f * 0.99;
    }

    // Lead core: test number is not comparable to mono/braid test for drag, so reduce impact
    if (lt.indexOf("lead") >= 0) {
      f = 0.90;
    }

    return f;
  }

  document.getElementById("dc_calc").addEventListener("click", function () {
    const speed = safeNum(document.getElementById("dc_speed").value, 1.3);
    const weight = safeNum(document.getElementById("dc_weight").value, 2);
    const line = safeNum(document.getElementById("dc_line").value, 100);
    const test = safeNum(document.getElementById("dc_test").value, 12);
    const lineType = String(document.getElementById("dc_linetype").value || "Monofilament");

    const dragFactor = lineTestFactor(test, lineType) * lineTypeFactor(lineType);

    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);

    let depth = line * base * speedFactor * dragFactor;

    // cap at 95% of line-out to avoid silly outputs
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
// Species Tips (PNW expanded)
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();

  const tips = [
    {
      name: "Largemouth Bass",
      range: "55 to 75 F (most active)",
      bullets: [
        "Topwater early and late when water is warm enough.",
        "Midday: work edges, docks, and weed lines with jigs and plastics.",
        "Cold fronts: slow down with finesse and target deeper transitions."
      ]
    },
    {
      name: "Smallmouth Bass",
      range: "50 to 70 F (most active)",
      bullets: [
        "Wind can improve the bite on rocky points and flats.",
        "Use jigs, tubes, jerkbaits, and small swimbaits.",
        "In cold water, slow down and stay close to bottom structure."
      ]
    },
    {
      name: "Trout (rainbow)",
      range: "45 to 65 F (most active)",
      bullets: [
        "Troll early for consistent action, then switch to casting near inlets.",
        "If sun is high, target deeper water or shaded banks.",
        "Match speed and lure size to water clarity and forage."
      ]
    },
    {
      name: "Kokanee",
      range: "45 to 60 F (best comfort)",
      bullets: [
        "Early light is prime. Troll slow with small dodger + spinner or hoochie.",
        "Use scent and tune speed until you see consistent strikes.",
        "If marks are deep, use heavier weight or downrigger to stay on the school."
      ]
    },
    {
      name: "Chinook Salmon",
      range: "42 to 58 F (typical target water)",
      bullets: [
        "Troll bait or flasher + hoochie; keep speed steady and turns wide.",
        "Fish the temperature band and the bait: adjust depth until you see action.",
        "In wind, stay conservative and prioritize a safe return route."
      ]
    },
    {
      name: "Coho Salmon",
      range: "45 to 60 F",
      bullets: [
        "Coho often respond to faster presentations than Chinook.",
        "Cover water: troll or cast in travel lanes and near current seams.",
        "Bright/flashy presentations can shine in stained water."
      ]
    },
    {
      name: "Sockeye",
      range: "45 to 60 F",
      bullets: [
        "Use legal methods for your water (often specialized; check regs).",
        "Target travel corridors and keep presentation consistent.",
        "If you see fish rolling, adjust depth and speed rather than lure size."
      ]
    },
    {
      name: "Walleye",
      range: "50 to 70 F",
      bullets: [
        "Low light: troll crankbaits or run spinners on edges and flats.",
        "Daytime: jig transitions and humps; slow down when bite is light.",
        "Wind can help: position so you can work structure without drifting too fast."
      ]
    },
    {
      name: "Yellow Perch",
      range: "45 to 70 F",
      bullets: [
        "Small jigs and bait shine. Keep it near bottom.",
        "If you catch one, stay put; perch school up tight.",
        "Light line and subtle motion usually outperforms aggressive jigging."
      ]
    },
    {
      name: "Crappie",
      range: "55 to 75 F",
      bullets: [
        "Look for brush, docks, and protected bays.",
        "Slow vertical presentations and small plastics work well.",
        "On cold fronts, go deeper and slow way down."
      ]
    },
    {
      name: "Northern Pike",
      range: "45 to 70 F",
      bullets: [
        "Edges of weeds and points are key. Cover water with larger baits.",
        "Steel/fluoro leader helps prevent bite-offs.",
        "Handle carefully and keep fingers away from gills/teeth."
      ]
    },
    {
      name: "Lake Trout (Mackinaw)",
      range: "40 to 55 F (cold water)",
      bullets: [
        "Focus deep structure: humps, drop-offs, and basin edges.",
        "Troll or jig where you see marks; speed changes can trigger bites.",
        "Keep your offering in the zone longer rather than racing around."
      ]
    },
    {
      name: "Catfish (Channel/Bullhead)",
      range: "55 to 75 F",
      bullets: [
        "Evening/night can be best. Anchor or drift edges and flats.",
        "Stink baits, cut bait, and worms are consistent producers.",
        "On light bites, keep hooks sharp and give fish time to load up."
      ]
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
    const lis = t.bullets.map(function (b) { return "<li>" + escHtml(b) + "</li>"; }).join("");
    box.innerHTML =
      "<strong>" +
      escHtml(t.name) +
      "</strong><br>" +
      '<span class="small muted">Active range: ' +
      escHtml(t.range) +
      "</span>" +
      '<ul class="list">' +
      lis +
      "</ul>";
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
// app.js (PART 4 OF 4) END
// ============================
