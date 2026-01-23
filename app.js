// ============================
// app.js (PART 1 OF 2) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.0.8
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

"use strict";

/*
  Single-file vanilla JS app.

  Expects an index.html with ONE root:
    <main id="app"></main>
    <script src="app.js" defer></script>

  Notes:
  - Uses Open-Meteo for sunrise/sunset, wind, temps, and precip chance.
  - Uses Open-Meteo Geocoding for place search.
  - Uses browser geolocation for "Use my location".
  - Location is saved to localStorage and restored on next visit.
  - Home page merges Weather/Wind + Best Times with ONE shared date picker.
  - Home auto-displays weather and best times after location is acquired.
  - Wind chart is hourly (canvas) for selected date.
  - GO / CAUTION / NO-GO meter uses craft + water type + wind and cold.
  - Exposure tips adapt to conditions (cold vs hot) and always mention sunscreen.
  - GA4 loads ONLY after user accepts the consent banner.
*/

const APP_VERSION = "1.0.8";
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

  // ONE shared date picker (YYYY-MM-DD)
  dateIso: "",

  // Home safety inputs
  waterType: "Small / protected", // "Small / protected" | "Big water / offshore"
  craft: "Kayak (paddle)" // "Kayak (paddle)" | "Kayak (motorized)" | "Boat (small)"
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
    --card: rgba(0,0,0,0.03);
    --cardBorder: rgba(0,0,0,0.14);
  }

  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

  .wrap { max-width: 760px; margin: 0 auto; padding: 12px 12px 36px 12px; }

  .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:6px; }
  .logo { max-width: 60%; }
  .logo img { width: 100%; max-width: 240px; height: auto; display:block; }

  .title { text-align:right; font-weight:900; font-size:18px; line-height:20px; }
  .small { opacity:0.82; font-size: 13px; }
  .muted { opacity:0.72; }

  .nav { margin-top: 12px; margin-bottom: 10px; display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

  .navBtn {
    width:100%;
    padding:12px 12px;
    border-radius:12px;
    border:1px solid var(--greenBorder);
    background: var(--green);
    color: var(--text);
    font-weight:900;
    cursor:pointer;
  }
  .navBtn:hover { background: var(--green2); }
  .navBtn:active { background: #6bbb83; }

  .card {
    border-radius: 16px;
    padding: 14px;
    margin-top: 12px;
    border: 1px solid var(--cardBorder);
    background: var(--card);
  }
  .compact { margin-top: 10px; padding: 12px 14px; }

  h2 { margin: 0 0 6px 0; font-size: 20px; }
  h3 { margin: 0 0 8px 0; font-size: 16px; }

  input, select {
    width:100%;
    padding:12px 12px;
    border-radius:12px;
    border:1px solid rgba(0,0,0,0.14);
    font-size:16px;
    background: rgba(255,255,255,0.85);
  }

  button {
    width:100%;
    padding:12px 12px;
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
    border-top: 1px solid rgba(0,0,0,0.14);
    text-align:center;
    font-size: 13px;
    opacity:0.90;
  }

  .sectionTitle { margin-top: 12px; font-weight: 900; }
  .list { margin: 8px 0 0 18px; }
  .list li { margin-bottom: 6px; }

  /* Home controls grid (date + selects) */
  .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .fieldLabel { margin: 0 0 6px 0; font-weight: 900; font-size: 13px; opacity: 0.9; }

  /* Weather tiles grid */
  .tilesGrid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .tile {
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.75);
    padding: 12px;
  }
  .tileTop { font-size: 13px; opacity: 0.78; font-weight: 900; }
  .tileVal { font-size: 22px; font-weight: 900; margin-top: 6px; }
  .tileSub { font-size: 12px; opacity: 0.72; margin-top: 4px; }

  /* Wind chart */
  .chartWrap { margin-top: 10px; }
  canvas.windChart {
    width: 100%;
    height: 180px;
    display: block;
    border-radius: 12px;
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(0,0,0,0.12);
  }

  /* Go/Caution/No-Go meter */
  .statusRow { display:flex; align-items:center; justify-content:space-between; gap: 10px; margin-top: 10px; }
  .pill {
    padding: 8px 12px;
    border-radius: 999px;
    font-weight: 900;
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(255,255,255,0.75);
    min-width: 70px;
    text-align:center;
  }
  .meterBar {
    height: 14px;
    border-radius: 999px;
    border: 1px solid rgba(0,0,0,0.14);
    overflow:hidden;
    background: rgba(255,255,255,0.7);
    display:flex;
    margin-top: 10px;
  }
  .meterSeg { flex: 1; }
  .segG { background: rgba(143,209,158,0.95); }
  .segY { background: rgba(255,214,102,0.95); }
  .segR { background: rgba(244,163,163,0.95); }
  .meterNeedle {
    height: 18px;
    width: 3px;
    border-radius: 2px;
    background: rgba(0,0,0,0.75);
    position: relative;
    top: -16px;
  }

  /* Consent banner */
  .consentBar {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    padding: 12px;
    background: rgba(255,255,255,0.98);
    border-top: 1px solid rgba(0,0,0,0.14);
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
  .consentBtns {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
    min-width: 240px;
  }
  .consentBtn {
    width: auto;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--greenBorder);
    background: var(--green);
    color: var(--text);
    font-weight: 900;
    cursor: pointer;
  }
  .consentBtn:hover { background: var(--green2); }
  .consentBtn:active { background: #6bbb83; }
  .consentDecline {
    background: #f4a3a3 !important;
    border-color: #e48f8f !important;
    color: #3b0a0a !important;
  }
  .consentDecline:hover { background: #ee8f8f !important; }

  @media (max-width: 520px) {
    .wrap { padding: 10px 10px 30px 10px; }
    .header { flex-direction: column; align-items:center; justify-content:center; gap:8px; }
    .logo { max-width: 85%; }
    .logo img { max-width: 240px; margin: 0 auto; }
    .title { text-align:center; font-size: 18px; }
    .nav { grid-template-columns: repeat(2, 1fr); gap:10px; }
    .card { padding: 12px; border-radius: 14px; }
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

function appendHtml(el, html) {
  el.insertAdjacentHTML("beforeend", html);
}

function setResolvedLocation(lat, lon, label) {
  state.lat = Number(lat);
  state.lon = Number(lon);
  state.placeLabel = String(label || "");
  saveLastLocation(state.lat, state.lon, state.placeLabel);
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && Number.isFinite(state.lat) &&
         typeof state.lon === "number" && Number.isFinite(state.lon);
}

function clearResolvedLocationInState() {
  state.lat = null;
  state.lon = null;
  state.placeLabel = "";
  state.matches = [];
  state.selectedIndex = 0;
}

function normalizePlaceQuery(s) {
  const x = String(s || "").trim().split(/\s+/).join(" ");
  return x;
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

function clampDateToDailyList(requestedIso, dailyIsoList) {
  if (!dailyIsoList || !dailyIsoList.length) return requestedIso || isoTodayLocal();
  if (!requestedIso || !isIsoDate(requestedIso)) return dailyIsoList[0];
  const min = dailyIsoList[0];
  const max = dailyIsoList[dailyIsoList.length - 1];
  if (requestedIso < min) return min;
  if (requestedIso > max) return max;
  return requestedIso;
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
  return out.filter(function (x) { return Number.isFinite(x.v); });
}

function formatTime(d) {
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return String(d);
  }
}

function fToC(f) {
  return (Number(f) - 32) * (5 / 9);
}

function safeNum(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? x : (fallback === undefined ? 0 : fallback);
}

// ----------------------------
// API: Geocoding
// ----------------------------
async function geocodeSearch(query, count) {
  const q = normalizePlaceQuery(query);
  if (!q) return [];

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    "?name=" + encodeURIComponent(q) +
    "&count=" + encodeURIComponent(count || 10) +
    "&language=en&format=json";

  try {
    const r = await fetch(url);
    const data = await r.json();
    const results = data.results || [];

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
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&language=en&format=json";

  try {
    const r = await fetch(url);
    const data = await r.json();
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
// API: Best times (sunrise/sunset) - multi-day
// ----------------------------
async function fetchSunTimesMulti(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&daily=sunrise,sunset" +
    "&forecast_days=7" +
    "&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();

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

  const sr = sunData.sunrise && sunData.sunrise[idx] ? sunData.sunrise[idx] : null;
  const ss = sunData.sunset && sunData.sunset[idx] ? sunData.sunset[idx] : null;
  if (!sr || !ss) return null;

  return { sunrise: new Date(sr), sunset: new Date(ss) };
}

// ----------------------------
// API: Weather/Wind - daily overview + hourly chart (multi-day)
// ----------------------------
async function fetchWeatherWindMulti(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&hourly=wind_speed_10m,wind_gusts_10m,temperature_2m,precipitation_probability" +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&forecast_days=7" +
    "&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();

  const hourly = data && data.hourly ? data.hourly : null;
  const daily = data && data.daily ? data.daily : null;

  const out = {
    hourly: {
      time: hourly && hourly.time ? hourly.time : [],
      wind: hourly && hourly.wind_speed_10m ? hourly.wind_speed_10m : [],
      gust: hourly && hourly.wind_gusts_10m ? hourly.wind_gusts_10m : [],
      tempF: hourly && hourly.temperature_2m ? hourly.temperature_2m : [],
      pop: hourly && hourly.precipitation_probability ? hourly.precipitation_probability : []
    },
    daily: {
      time: daily && daily.time ? daily.time : [],
      tmin: daily && daily.temperature_2m_min ? daily.temperature_2m_min : [],
      tmax: daily && daily.temperature_2m_max ? daily.temperature_2m_max : [],
      popMax: daily && daily.precipitation_probability_max ? daily.precipitation_probability_max : [],
      windMax: daily && daily.wind_speed_10m_max ? daily.wind_speed_10m_max : [],
      gustMax: daily && daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max : []
    }
  };

  return out;
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
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
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

  // Grid lines
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 2; g++) {
    const yy = padT + (g / 2) * h;
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(padL + w, yy);
    ctx.stroke();
  }

  // Y labels
  ctx.fillStyle = "rgba(0,0,0,0.70)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  const yTop = maxV;
  const yMid = (minV + maxV) / 2;
  const yBot = minV;

  ctx.fillText(String(Math.round(yTop)) + " mph", 6, padT + 12);
  ctx.fillText(String(Math.round(yMid)) + " mph", 6, padT + h / 2 + 4);
  ctx.fillText(String(Math.round(yBot)) + " mph", 6, padT + h + 4);

  // Line
  ctx.strokeStyle = "rgba(7,27,31,0.75)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(points[0].mph));
  for (let i2 = 1; i2 < points.length; i2++) {
    ctx.lineTo(xFor(i2), yFor(points[i2].mph));
  }
  ctx.stroke();

  // Dots
  ctx.fillStyle = "rgba(7,27,31,0.70)";
  for (let d = 0; d < points.length; d++) {
    const xx = xFor(d);
    const yy2 = yFor(points[d].mph);
    ctx.beginPath();
    ctx.arc(xx, yy2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // X labels
  function hourLabel(dt) {
    try {
      return dt.toLocaleTimeString([], { hour: "numeric" });
    } catch (e) {
      return "";
    }
  }
  const iStart = 0;
  const iMid = Math.floor((points.length - 1) / 2);
  const iEnd = points.length - 1;

  ctx.fillStyle = "rgba(0,0,0,0.70)";
  ctx.textAlign = "left";
  ctx.fillText(hourLabel(points[iStart].dt), padL, padT + h + 18);

  ctx.textAlign = "center";
  ctx.fillText(hourLabel(points[iMid].dt), xFor(iMid), padT + h + 18);

  ctx.textAlign = "right";
  ctx.fillText(hourLabel(points[iEnd].dt), padL + w, padT + h + 18);

  ctx.textAlign = "left";
}

// ----------------------------
// UI: Header + Nav
// ----------------------------
const PAGE_TITLES = {
  Home: "Weather/Wind + Best Times",
  "Trolling depth calculator": "Trolling Depth Calculator",
  "Species tips": "Species Tips",
  Speedometer: "Speedometer"
};

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

function renderHeaderAndNav() {
  const title = PAGE_TITLES[state.tool] || "";

  app.innerHTML =
    '<div class="wrap">' +
    '  <div class="header">' +
    '    <div class="logo"><img src="' +
    escHtml(LOGO_URL) +
    '" alt="FishyNW"></div>' +
    '    <div class="title">' +
    escHtml(title) +
    '<div class="small">v ' +
    escHtml(APP_VERSION) +
    "</div></div>" +
    "  </div>" +
    '  <div class="nav" id="nav"></div>' +
    '  <div id="page"></div>' +
    '  <div class="footer"><strong>FishyNW.com</strong><br>Independent Northwest fishing tools</div>' +
    "</div>";

  const nav = document.getElementById("nav");

  // Home hides Home button. Other pages show Home.
  let items = [];
  if (state.tool === "Home") {
    items = [
      ["Depth", "Trolling depth calculator"],
      ["Tips", "Species tips"],
      ["Speed", "Speedometer"]
    ];
  } else {
    items = [
      ["Home", "Home"],
      ["Depth", "Trolling depth calculator"],
      ["Tips", "Species tips"],
      ["Speed", "Speedometer"]
    ];
  }

  for (let i = 0; i < items.length; i++) {
    const label = items[i][0];
    const toolName = items[i][1];

    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = "navBtn";

    // Disable the button if it would go to the current tool
    if (toolName === state.tool) {
      btn.disabled = true;
      btn.style.opacity = "0.7";
      btn.style.cursor = "default";
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
// - Clear button only when a location is resolved
// - AUTOCLEAR location when user types in the box
// ----------------------------
function renderLocationPicker(container, placeKey, onResolved) {
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
      <div id="${placeKey}_using" class="small" style="margin-top:10px;"></div>

      <div id="${placeKey}_clear_wrap" style="margin-top:10px; display:none;">
        <button id="${placeKey}_clear" type="button" class="consentDecline">Clear saved location</button>
      </div>
    </div>
  `
  );

  const usingEl = document.getElementById(placeKey + "_using");
  const matchesEl = document.getElementById(placeKey + "_matches");
  const placeInput = document.getElementById(placeKey + "_place");
  const clearWrap = document.getElementById(placeKey + "_clear_wrap");
  const clearBtn = document.getElementById(placeKey + "_clear");

  function setClearVisible(isVisible) {
    clearWrap.style.display = isVisible ? "block" : "none";
  }

  function hardClearLocationUi(keepText) {
    // Clear persisted + active location and any match UI.
    clearLastLocation();
    clearResolvedLocationInState();

    matchesEl.innerHTML = "";
    usingEl.textContent = "";
    setClearVisible(false);

    if (!keepText) placeInput.value = "";

    if (typeof onResolved === "function") onResolved("cleared");
  }

  // --- NEW: autoclear location when typing begins ---
  placeInput.addEventListener("input", function () {
    const t = normalizePlaceQuery(placeInput.value);

    // If the user is typing anything, kill the currently resolved location and match UI.
    if (t.length > 0) {
      // Only do it once per "typing session" if a location exists or matches are shown.
      if (hasResolvedLocation() || matchesEl.innerHTML) {
        hardClearLocationUi(true);
        usingEl.textContent = "Type a place, then tap Search place.";
      }
    } else {
      // If they cleared the box, keep the UI clean.
      if (!hasResolvedLocation()) {
        matchesEl.innerHTML = "";
        usingEl.textContent = "";
        setClearVisible(false);
      }
    }
  });

  clearBtn.addEventListener("click", function () {
    hardClearLocationUi(false);
    usingEl.textContent = "Saved location cleared. Search a place or use your location.";
  });

  if (hasResolvedLocation()) {
    const lbl = state.placeLabel
      ? state.placeLabel
      : "Lat " + state.lat.toFixed(4) + ", Lon " + state.lon.toFixed(4);

    placeInput.value = state.placeLabel ? state.placeLabel : "Current location";
    usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(lbl);
    setClearVisible(true);
    if (typeof onResolved === "function") onResolved("restored_or_existing");
  } else {
    setClearVisible(false);
    usingEl.textContent = "";
  }

  document.getElementById(placeKey + "_gps").addEventListener("click", function () {
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
        setClearVisible(true);

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
            usingEl.innerHTML =
              "<strong>Using:</strong> " +
              escHtml(label) +
              " (" +
              lat.toFixed(4) +
              ", " +
              lon.toFixed(4) +
              ")";
          } else {
            placeInput.value = "Current location";
          }

          if (typeof onResolved === "function") onResolved("gps_reverse");
        });
      },
      function (err) {
        usingEl.innerHTML = "<strong>Location error:</strong> " + escHtml(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 }
    );
  });

  document.getElementById(placeKey + "_search").addEventListener("click", async function () {
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
      '<label class="small"><strong>Choose the correct match</strong></label>' +
      '<select id="' + placeKey + '_select">' +
      optionsHtml +
      "</select>" +
      '<div style="margin-top:10px;">' +
      '<button id="' + placeKey + '_use" style="width:100%;">Use this place</button>' +
      "</div>";

    document.getElementById(placeKey + "_select").addEventListener("change", function (e) {
      state.selectedIndex = Number(e.target.value);
    });

    document.getElementById(placeKey + "_use").addEventListener("click", function () {
      const chosen = state.matches[state.selectedIndex];
      if (!chosen) return;

      setResolvedLocation(chosen.lat, chosen.lon, chosen.label);
      setClearVisible(true);

      placeInput.value = chosen.label;
      usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(chosen.label);

      if (typeof onResolved === "function") onResolved("search_pick");
    });

    usingEl.textContent = "Pick the correct match, then tap Use this place.";
  });
}

// ============================
// app.js (PART 2 OF 2) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.0.8
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Home: Weather/Wind + Best Times
// ----------------------------
function computeBestFishingWindows(sunrise, sunset) {
  // Simple, practical windows:
  // - Dawn: 90 min before sunrise to 60 min after
  // - Dusk: 60 min before sunset to 90 min after
  // - Midday minor: 12:00 to 13:00 local (optional)
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

function computeGoStatus(inputs) {
  // Inputs:
  // - craft: kayak paddle vs motorized vs small boat
  // - water: small/protected vs big/offshore
  // - windMax, gustMax
  // - tmin, tmax
  //
  // Return:
  //  { label:"GO|CAUTION|NO-GO", score:0..100, needlePct:0..100, message:"..." }
  //
  // This is not a safety guarantee. It is a quick decision helper.

  const craft = inputs.craft || "Kayak (paddle)";
  const water = inputs.waterType || "Small / protected";
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);

  const avgF = (tmin + tmax) / 2;

  // Baseline thresholds.
  // Stricter for paddle kayak + big water.
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

  // Cold penalty (air temp proxy). If air is cold, water is often cold too.
  // We push toward caution with low temps.
  let coldPenalty = 0;
  if (avgF <= 38) coldPenalty = 10;
  else if (avgF <= 45) coldPenalty = 6;
  else if (avgF <= 52) coldPenalty = 3;

  // Compute risk score from wind and gust.
  // 0 = best, 100 = worst.
  function scoreFromThresholds(value, g, c, n) {
    if (value <= g) return 0;
    if (value >= n) return 100;
    // scale between g..n with a soft knee at c
    if (value <= c) {
      return ((value - g) / Math.max(1, c - g)) * 45;
    }
    return 45 + ((value - c) / Math.max(1, n - c)) * 55;
  }

  const sWind = scoreFromThresholds(windMax, goWind, cautionWind, nogoWind);
  const sGust = scoreFromThresholds(gustMax, goGust, cautionGust, nogoGust);

  let score = Math.max(sWind, sGust) + coldPenalty;
  score = Math.max(0, Math.min(100, score));

  let label = "GO";
  if (score >= 70) label = "NO-GO";
  else if (score >= 35) label = "CAUTION";

  // Needle percent left->right across GO/Y/R
  const needlePct = Math.max(0, Math.min(100, score));

  let msg = "Generally favorable. Watch for local funnels, open water chop, and changing conditions.";
  if (label === "CAUTION") {
    msg =
      "Use caution. Expect wind shifts and chop. Stay close to shore and have a clear plan to get off the water quickly.";
  }
  if (label === "NO-GO") {
    msg =
      "Not recommended. Winds and/or gusts are high for the selected craft and water type. Consider rescheduling or fishing sheltered water.";
  }

  // Cold-specific add-on
  if (avgF <= 45 && label !== "NO-GO") {
    msg += " Cold conditions increase risk. Dress for immersion, not just air temp.";
  }

  return { label: label, score: score, needlePct: needlePct, message: msg };
}

function computeExposureTips(inputs) {
  // Uses day temps + wind. If cold -> dry suit / insulation. If hot -> sun protection.
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);

  const avgF = (tmin + tmax) / 2;

  const tips = [];

  // Always
  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  tips.push("Bring a dry bag with a spare top and gloves, plus a warm hat in cooler months.");

  // Cold leaning
  if (avgF <= 50) {
    tips.unshift("Cold air and likely cold water. Lean toward a dry suit or a proper wet suit setup.");
    tips.unshift("Avoid cotton layers. Use synthetics or wool to retain insulation when wet.");
    if (avgF <= 40) {
      tips.unshift("Cold risk is high. Consider neoprene gloves/boots and limit exposure time.");
    }
  }

  // Hot leaning
  if (tmax >= 78) {
    tips.unshift("Hot day. Wear light, sun-repellent clothing and a wide-brim hat.");
    tips.unshift("Hydrate early. Bring more water than you think you need.");
  }

  // Wind leaning
  if (windMax >= 12 || gustMax >= 20) {
    tips.push("Wind can spike suddenly. Keep a leash on key gear and plan a protected return route.");
  }

  return tips;
}

function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="muted">Pick a date once. Weather tiles + wind chart + best fishing windows auto-generate after location is set.</div>

      <div class="grid2" style="margin-top:12px;">
        <div>
          <div class="fieldLabel">Date</div>
          <input id="home_date" type="date" />
          <div class="small muted" id="home_date_note" style="margin-top:6px;"></div>
        </div>
        <div>
          <div class="fieldLabel">Water type</div>
          <select id="home_water">
            <option>Small / protected</option>
            <option>Big water / offshore</option>
          </select>
        </div>
        <div>
          <div class="fieldLabel">Craft</div>
          <select id="home_craft">
            <option>Kayak (paddle)</option>
            <option>Kayak (motorized)</option>
            <option>Boat (small)</option>
          </select>
        </div>
        <div style="display:none;"></div>
      </div>
    </div>
  `
  );

  // Single date picker setup
  const dateInput = document.getElementById("home_date");
  const noteEl = document.getElementById("home_date_note");
  const waterSel = document.getElementById("home_water");
  const craftSel = document.getElementById("home_craft");

  if (!state.dateIso || !isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  dateInput.value = state.dateIso;

  waterSel.value = state.waterType;
  craftSel.value = state.craft;

  // Location picker card
  renderLocationPicker(page, "home", function (why) {
    // After location changes, rerender details below with fresh pulls.
    // We only update the dynamic section.
    renderHomeDynamic();
  });

  // Dynamic section placeholder
  appendHtml(page, `<div id="home_dynamic"></div>`);

  function onAnyHomeControlChanged() {
    state.dateIso = dateInput.value;
    state.waterType = waterSel.value;
    state.craft = craftSel.value;
    renderHomeDynamic();
  }

  dateInput.addEventListener("change", onAnyHomeControlChanged);
  waterSel.addEventListener("change", onAnyHomeControlChanged);
  craftSel.addEventListener("change", onAnyHomeControlChanged);

  renderHomeDynamic();

  async function renderHomeDynamic() {
    const dyn = document.getElementById("home_dynamic");
    if (!dyn) return;

    dyn.innerHTML = "";

    // Hide ugly "pick a place first" message: show nothing until location is set.
    if (!hasResolvedLocation()) return;

    appendHtml(
      dyn,
      `
      <div class="card compact" id="home_loading">
        <div><strong>Loading forecast...</strong></div>
        <div class="small muted">Building tiles, wind chart, and best times for your date.</div>
      </div>
    `
    );

    let wx = null;
    let sun = null;

    try {
      wx = await fetchWeatherWindMulti(state.lat, state.lon);
      sun = await fetchSunTimesMulti(state.lat, state.lon);
    } catch (e) {
      dyn.innerHTML =
        '<div class="card"><strong>Could not load data.</strong><div class="small muted">Check your connection and try again.</div></div>';
      return;
    }

    const dailyDates = (wx && wx.daily && wx.daily.time) ? wx.daily.time : [];
    const clamped = clampDateToDailyList(state.dateIso, dailyDates);
    state.dateIso = clamped;
    dateInput.value = clamped;

    if (clamped !== dateInput.value) dateInput.value = clamped;

    // Date note
    if (isIsoDate(state.dateIso) && dailyDates.length) {
      if (state.dateIso !== dateInput.value) dateInput.value = state.dateIso;
      if (state.dateIso !== clampDateToDailyList(state.dateIso, dailyDates)) {
        noteEl.textContent = "If you choose a date outside the 7-day forecast window, it will clamp.";
      } else {
        noteEl.textContent = "Forecast range: " + dailyDates[0] + " to " + dailyDates[dailyDates.length - 1] + ".";
      }
    } else {
      noteEl.textContent = "If you choose a date outside the 7-day forecast window, it will clamp.";
    }

    // Pull daily overview for date
    const idx = dailyDates.indexOf(state.dateIso);
    if (idx < 0) {
      dyn.innerHTML =
        '<div class="card"><strong>No forecast for that date.</strong><div class="small muted">Pick another day.</div></div>';
      return;
    }

    const tmin = safeNum(wx.daily.tmin[idx], 0);
    const tmax = safeNum(wx.daily.tmax[idx], 0);
    const popMax = safeNum(wx.daily.popMax[idx], 0);
    const windMax = safeNum(wx.daily.windMax[idx], 0);
    const gustMax = safeNum(wx.daily.gustMax[idx], 0);

    // Best times from sunrise/sunset for that date
    const sunFor = sunForDate(sun, state.dateIso);
    const windows = sunFor ? computeBestFishingWindows(sunFor.sunrise, sunFor.sunset) : [];

    // Status
    const status = computeGoStatus({
      craft: state.craft,
      waterType: state.waterType,
      windMax: windMax,
      gustMax: gustMax,
      tmin: tmin,
      tmax: tmax
    });

    // Exposure tips
    const tips = computeExposureTips({
      tmin: tmin,
      tmax: tmax,
      windMax: windMax,
      gustMax: gustMax
    });

    // Hourly wind for date (chart)
    const hourlyTimes = wx.hourly.time || [];
    const hourlyWind = wx.hourly.wind || [];
    const pointsRaw = filterHourlyToDate(hourlyTimes, hourlyWind, state.dateIso);

    // Reduce points to every 1-2 hours for readability (mobile)
    const points = [];
    for (let i = 0; i < pointsRaw.length; i++) {
      if (i % 2 === 0) {
        points.push({ dt: pointsRaw[i].dt, mph: safeNum(pointsRaw[i].v, 0) });
      }
    }
    if (points.length < 2) {
      // fallback to every hour
      for (let j = 0; j < pointsRaw.length; j++) {
        points.push({ dt: pointsRaw[j].dt, mph: safeNum(pointsRaw[j].v, 0) });
      }
    }

    // Build UI
    dyn.innerHTML = "";

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Overview - ${escHtml(state.dateIso)}</h3>

        <div class="tilesGrid">
          <div class="tile">
            <div class="tileTop">Temperature</div>
            <div class="tileVal">${escHtml(Math.round(tmin))} to ${escHtml(Math.round(tmax))} F</div>
            <div class="tileSub">Daily min / max</div>
          </div>
          <div class="tile">
            <div class="tileTop">Rain chance (max)</div>
            <div class="tileVal">${escHtml(Math.round(popMax))} %</div>
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

        <div class="small" style="margin-top:8px;">${escHtml(status.message)}</div>
      </div>
    `
    );

    // Pill tint
    const pill = document.getElementById("status_pill");
    if (pill) {
      if (status.label === "GO") pill.style.background = "rgba(143,209,158,0.55)";
      if (status.label === "CAUTION") pill.style.background = "rgba(255,214,102,0.65)";
      if (status.label === "NO-GO") pill.style.background = "rgba(244,163,163,0.70)";
    }

    // Wind chart
    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Hourly wind (line chart)</h3>
        <div class="small muted">Selected date only. Values are wind speed at 10m in mph.</div>
        <div class="chartWrap">
          <canvas id="wind_canvas" class="windChart"></canvas>
        </div>
      </div>
    `
    );

    const canvas = document.getElementById("wind_canvas");
    drawWindLineChart(canvas, points);

    // Best Times
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

    // Exposure tips (dynamic)
    const tipsHtml = tips
      .map(function (t) {
        return "<li>" + escHtml(t) + "</li>";
      })
      .join("");

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Exposure tips</h3>
        <ul class="list">${tipsHtml}</ul>
      </div>
    `
    );

    // Redraw chart on resize (mobile rotate)
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

// ----------------------------
// Depth Calculator (simple)
// ----------------------------
function renderDepthCalculator() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>
      <div class="muted">Simple estimate using weight and line out. This is not a sonar replacement.</div>

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
      </div>

      <div style="margin-top:12px;">
        <button id="dc_calc">Calculate</button>
      </div>

      <div id="dc_out" class="card compact" style="margin-top:12px; display:none;"></div>
    </div>
  `
  );

  const out = document.getElementById("dc_out");

  document.getElementById("dc_calc").addEventListener("click", function () {
    const speed = safeNum(document.getElementById("dc_speed").value, 1.3);
    const weight = safeNum(document.getElementById("dc_weight").value, 2);
    const line = safeNum(document.getElementById("dc_line").value, 100);
    const test = safeNum(document.getElementById("dc_test").value, 12);

    // Very rough model:
    // depth ~= line * (0.18 + 0.02*weight) * (1.5/speed) * dragFactor
    // dragFactor increases with thicker line
    const dragFactor = test <= 10 ? 1.0 : test <= 12 ? 0.95 : test <= 20 ? 0.85 : 0.78;

    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);
    let depth = line * base * speedFactor * dragFactor;

    depth = Math.max(0, Math.min(depth, line * 0.95));

    out.style.display = "block";
    out.innerHTML =
      "<strong>Estimated depth:</strong> " +
      escHtml(depth.toFixed(1)) +
      " ft<br>" +
      '<div class="small muted" style="margin-top:6px;">Tip: Use this as a starting point. Sonar and lure action matter a lot.</div>';
  });
}

// ----------------------------
// Species Tips (placeholder simple set)
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
        "In cold water, slow-roll and stay close to bottom structure."
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
    }
  ];

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Species Tips</h2>
      <div class="muted">Quick, practical guidelines with temperature ranges.</div>
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
      "<strong>" + escHtml(t.name) + "</strong><br>" +
      '<span class="small muted">Active range: ' + escHtml(t.range) + "</span>" +
      "<ul class=\"list\">" + lis + "</ul>";
  }

  sel.addEventListener("change", function () {
    renderTip(Number(sel.value));
  });

  renderTip(0);
}

// ----------------------------
// Speedometer (GPS speed)
// ----------------------------
function renderSpeedometer() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Speedometer</h2>
      <div class="muted">GPS-based speed. Requires location permission. Best used outside with clear sky view.</div>

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
          const ms = safeNum(pos.coords.speed, 0); // meters/sec (can be null)
          let mph = ms * 2.236936;
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

  // Consent banner
  renderConsentBannerIfNeeded();

  // Restore last location once
  if (!hasResolvedLocation()) {
    const last = loadLastLocation();
    if (last) {
      setResolvedLocation(last.lat, last.lon, last.label || "");
    }
  }

  renderHeaderAndNav();

  const page = pageEl();
  page.innerHTML = "";

  if (state.tool === "Home") renderHome();
  else if (state.tool === "Trolling depth calculator") renderDepthCalculator();
  else if (state.tool === "Species tips") renderSpeciesTips();
  else if (state.tool === "Speedometer") renderSpeedometer();
  else {
    // fallback
    state.tool = "Home";
    renderHome();
  }
}

// ----------------------------
// Boot
// ----------------------------
document.addEventListener("DOMContentLoaded", function () {
  app = document.getElementById("app");

  // Default tool
  state.tool = "Home";

  // Default shared date
  state.dateIso = isoTodayLocal();

  // Make sure footer does not overlap content on very small screens
  try {
    window.scrollTo(0, 0);
  } catch (e) {
    // ignore
  }

  render();
});

// ============================
// app.js (PART 2 OF 2) END
// ============================