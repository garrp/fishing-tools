// ============================
// app.js
// FishyNW.com - Fishing Tools (Web)
// Version 1.0.7
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

"use strict";

/*
  Single-file vanilla JS app.

  Expects an index.html with ONE root:
    <main id="app"></main>
    <script src="app.js" defer></script>

  Notes:
  - Uses Open-Meteo for sunrise/sunset and weather (wind, gust, temp, rain chance).
  - Uses Open-Meteo Geocoding for place search.
  - Uses browser geolocation for "Use my location".
  - Reverse geocodes GPS lat/lon to a nearest city label when possible.
  - Location is saved to localStorage and restored on next visit.
  - GA4 loads ONLY after user accepts the consent banner.
  - Landing page is HOME: Best Times + Weather/Wind merged.
  - Home button is hidden on Home, shown on other pages.
*/

const APP_VERSION = "1.0.7";
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
const LAST_LOC_KEY = "fishynw_last_location_v1"; // {lat:number, lon:number, label:string}

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

  // Date state per section (YYYY-MM-DD)
  timesDate: "",
  windDate: ""
};

// ----------------------------
// DOM
// ----------------------------
let app = null;

// ----------------------------
// Styles (mobile-first cleanup)
// ----------------------------
(function injectStyles() {
  const css = `
  :root { --green:#8fd19e; --green2:#7cc78f; --greenBorder:#6fbf87; --text:#0b2e13; }

  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

  .wrap { max-width: 760px; margin: 0 auto; padding: 12px 12px 36px 12px; }

  .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:6px; }
  .logo { max-width: 60%; }
  .logo img { width: 100%; max-width: 240px; height: auto; display:block; }

  .title { text-align:right; font-weight:900; font-size:18px; line-height:20px; }
  .small { opacity:0.82; font-size: 13px; }

  .nav { margin-top: 12px; margin-bottom: 10px; display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }

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
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(0,0,0,0.03);
  }
  .compact { margin-top: 10px; padding: 12px 14px; }

  h2 { margin: 0 0 6px 0; font-size: 18px; }
  h3 { margin: 0 0 8px 0; font-size: 16px; }

  input, select {
    width:100%;
    padding:10px;
    border-radius:10px;
    border:1px solid rgba(0,0,0,0.14);
    font-size:16px;
  }

  button {
    width:100%;
    padding:10px 12px;
    border-radius:10px;
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

  /* Two-column rows (used for date pickers and weather stats) */
  .row2 { display:flex; gap:10px; margin-top:10px; }
  .row2 > * { flex: 1; }
  .statBox {
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.6);
    border-radius: 12px;
    padding: 10px;
  }
  .statLabel { font-size: 12px; opacity: 0.85; font-weight: 900; margin-bottom: 6px; }
  .statValue { font-size: 18px; font-weight: 900; }

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
  .meterWrap { margin-top: 12px; }
  .meterBadge {
    padding: 6px 10px;
    border-radius: 999px;
    font-weight: 900;
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(255,255,255,0.65);
    font-size: 12px;
    letter-spacing: 0.3px;
  }
  .badgeGo { background: rgba(143,209,158,0.45); }
  .badgeCaution { background: rgba(255,214,102,0.45); }
  .badgeNoGo { background: rgba(244,163,163,0.55); }

  .meterBar {
    display:flex;
    height: 14px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.7);
  }
  .meterSegGo { flex: 1; background: rgba(143,209,158,0.9); }
  .meterSegCaution { flex: 1; background: rgba(255,214,102,0.9); }
  .meterSegNoGo { flex: 1; background: rgba(244,163,163,0.95); }

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
  .consentText {
    font-size: 13px;
    line-height: 16px;
    opacity: 0.92;
  }
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

    .row2 { flex-direction: column; }
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

function setResolvedLocation(lat, lon, label) {
  state.lat = lat;
  state.lon = lon;
  state.placeLabel = label || "";
  saveLastLocation(state.lat, state.lon, state.placeLabel);
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
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

// ============================
// PART 1 END
// (Next part starts with: API: Geocoding, Forecast, and Chart helpers)
// ============================
// ============================
// PART 2 BEGIN
// API: Geocoding, Forecast, and Chart helpers
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
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
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
// API: Best times (sunrise/sunset) - fetch multiple days
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
// API: Weather/Wind (hourly wind + gust + temp + rain chance, plus daily list)
// ----------------------------
async function fetchWeatherMulti(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&hourly=wind_speed_10m,wind_gusts_10m,temperature_2m,precipitation_probability" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&forecast_days=7" +
    "&timezone=auto" +
    "&daily=temperature_2m_max,temperature_2m_min";

  const r = await fetch(url);
  const data = await r.json();

  const hourly = data && data.hourly ? data.hourly : null;
  const times = hourly && hourly.time ? hourly.time : [];
  const wind = hourly && hourly.wind_speed_10m ? hourly.wind_speed_10m : [];
  const gust = hourly && hourly.wind_gusts_10m ? hourly.wind_gusts_10m : [];
  const temp = hourly && hourly.temperature_2m ? hourly.temperature_2m : [];
  const rain = hourly && hourly.precipitation_probability ? hourly.precipitation_probability : [];

  const daily = data && data.daily ? data.daily : null;
  const dayList = daily && daily.time ? daily.time : [];

  return {
    times: times,
    wind: wind,
    gust: gust,
    temp: temp,
    rain: rain,
    days: dayList
  };
}

function filterHourlyMultiToDate(w, dateIso) {
  const out = [];
  const times = w && w.times ? w.times : [];
  for (let i = 0; i < times.length; i++) {
    const t = String(times[i] || "");
    if (t.slice(0, 10) !== dateIso) continue;

    out.push({
      dt: new Date(t),
      wind: Number(w.wind && w.wind[i]),
      gust: Number(w.gust && w.gust[i]),
      temp: Number(w.temp && w.temp[i]),
      rain: Number(w.rain && w.rain[i])
    });
  }
  return out;
}

function summarizeDay(points) {
  const s = {
    maxWind: NaN,
    maxGust: NaN,
    minTemp: NaN,
    maxTemp: NaN,
    maxRain: NaN
  };

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    if (Number.isFinite(p.wind)) {
      if (!Number.isFinite(s.maxWind) || p.wind > s.maxWind) s.maxWind = p.wind;
    }
    if (Number.isFinite(p.gust)) {
      if (!Number.isFinite(s.maxGust) || p.gust > s.maxGust) s.maxGust = p.gust;
    }
    if (Number.isFinite(p.temp)) {
      if (!Number.isFinite(s.minTemp) || p.temp < s.minTemp) s.minTemp = p.temp;
      if (!Number.isFinite(s.maxTemp) || p.temp > s.maxTemp) s.maxTemp = p.temp;
    }
    if (Number.isFinite(p.rain)) {
      if (!Number.isFinite(s.maxRain) || p.rain > s.maxRain) s.maxRain = p.rain;
    }
  }

  return s;
}

// ----------------------------
// Go/Caution/No-Go logic
// (Simple, conservative thresholds meant for small boats and kayaks)
// ----------------------------
function classifyGoCautionNoGo(maxSustMph, maxGustMph) {
  const sust = Number.isFinite(maxSustMph) ? maxSustMph : 0;
  const gust = Number.isFinite(maxGustMph) ? maxGustMph : 0;

  // Thresholds (mph):
  // GO: sustained <= 10 and gust <= 18
  // CAUTION: sustained <= 15 and gust <= 25
  // NO-GO: above caution
  if (sust <= 10 && gust <= 18) {
    return {
      level: "GO",
      color: "go",
      reason:
        "Generally favorable. Watch for local funnels, open water chop, and changing conditions."
    };
  }
  if (sust <= 15 && gust <= 25) {
    return {
      level: "CAUTION",
      color: "caution",
      reason:
        "Marginal for exposed water. Consider shorter crossings, staying near shore, and having a solid plan."
    };
  }
  return {
    level: "NO-GO",
    color: "nog",
    reason:
      "High wind or gusts. Dangerous for many kayaks and small boats, especially on open water."
  };
}

// ----------------------------
// Exposure tips
// ----------------------------
function exposureTips(minF, maxF, rainMaxPct) {
  const tips = [];

  // Always mention sunscreen (your request)
  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");

  if (Number.isFinite(minF) && minF <= 45) {
    tips.push("Cold water/air risk. Consider a drysuit or a proper wetsuit setup.");
    tips.push("Bring warm layers and a dry bag with a spare top and gloves.");
  } else if (Number.isFinite(minF) && minF <= 55) {
    tips.push("Cool conditions. A waterproof jacket and insulating layer help a lot.");
  }

  if (Number.isFinite(maxF) && maxF >= 75) {
    tips.push("Hot sun. Use sun shirts, a brim hat, sunglasses, and hydrate.");
  } else {
    tips.push("Layering is key. Stay comfortable so you can stay focused on safety.");
  }

  if (Number.isFinite(rainMaxPct) && rainMaxPct >= 40) {
    tips.push("Rain possible. Pack a rain jacket and keep electronics in a dry bag.");
  }

  tips.push("If you might capsize, dress for the water, not the air.");
  return tips;
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

// ============================
// PART 2 END
// (Next part starts with: UI: Header/Nav, Location Picker, Pages, Router, Boot)
// ============================
// ============================
// PART 3 BEGIN
// UI: Header/Nav, Location Picker, Pages, Router, Boot
// ============================

// ----------------------------
// UI: Header + Nav
// ----------------------------
const PAGE_TITLES = {
  Home: "Fishing Tools",
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
  const title = PAGE_TITLES[state.tool] || "Fishing Tools";

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

  clearBtn.addEventListener("click", function () {
    clearLastLocation();

    state.lat = null;
    state.lon = null;
    state.placeLabel = "";
    state.matches = [];
    state.selectedIndex = 0;

    matchesEl.innerHTML = "";
    placeInput.value = "";
    usingEl.textContent = "Saved location cleared. Search a place or use your location.";
    setClearVisible(false);

    if (typeof onResolved === "function") onResolved("cleared");
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

    document
      .getElementById(placeKey + "_select")
      .addEventListener("change", function (e) {
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

// ----------------------------
// Pages
// ----------------------------
function renderHomePage() {
  const page = pageEl();

  page.innerHTML =
    '<div class="card">' +
    "  <h2>Best Times and Weather/Wind</h2>" +
    '  <div class="small">Pick a location once. Both sections auto-update. Use the menu buttons for Depth, Tips, and Speed.</div>' +
    "</div>";

  appendHtml(
    page,
    `
    <div class="card" id="home_controls"></div>

    <div class="card" id="home_times">
      <h3>Best Fishing Times</h3>
      <div class="small">Sunrise and sunset windows (1 hour before/after).</div>
      <div id="home_times_out" style="margin-top:10px;"></div>
    </div>

    <div class="card" id="home_wind">
      <h3>Weather and Wind</h3>
      <div class="small">GO/CAUTION/NO-GO, exposure tips, and hourly wind chart.</div>
      <div id="home_wind_out" style="margin-top:10px;"></div>
    </div>
  `
  );

  const controls = document.getElementById("home_controls");
  const timesOut = document.getElementById("home_times_out");
  const windOut = document.getElementById("home_wind_out");

  if (!isIsoDate(state.timesDate)) state.timesDate = isoTodayLocal();
  if (!isIsoDate(state.windDate)) state.windDate = isoTodayLocal();

  appendHtml(
    controls,
    `
    <div class="row2">
      <div class="statBox">
        <div class="statLabel">Times date</div>
        <input id="home_times_date" type="date" value="${escHtml(state.timesDate)}" />
      </div>
      <div class="statBox">
        <div class="statLabel">Weather date</div>
        <input id="home_wind_date" type="date" value="${escHtml(state.windDate)}" />
      </div>
    </div>

    <div class="small" style="margin-top:8px;">
      Dates clamp to the 7-day forecast window.
    </div>
  `
  );

  document.getElementById("home_times_date").addEventListener("change", function (e) {
    state.timesDate = String(e.target.value || "").slice(0, 10);
    autoDisplayTimes();
  });

  document.getElementById("home_wind_date").addEventListener("change", function (e) {
    state.windDate = String(e.target.value || "").slice(0, 10);
    autoDisplayWeatherWind();
  });

  function onResolved() {
    autoDisplayTimes();
    autoDisplayWeatherWind();
  }
  renderLocationPicker(controls, "home", onResolved);

  async function autoDisplayTimes() {
    timesOut.innerHTML = "";

    if (!hasResolvedLocation()) {
      timesOut.textContent = "Pick a place or use your location first.";
      return;
    }

    timesOut.textContent = "Loading...";
    try {
      const sunMulti = await fetchSunTimesMulti(state.lat, state.lon);
      const chosenDate = clampDateToDailyList(state.timesDate, sunMulti.days);
      state.timesDate = chosenDate;

      const inp = document.getElementById("home_times_date");
      if (inp && inp.value !== chosenDate) inp.value = chosenDate;

      const sun = sunForDate(sunMulti, chosenDate);
      if (!sun) {
        timesOut.textContent = "Could not load sunrise/sunset for that date. Try another date.";
        return;
      }

      const sunrise = sun.sunrise;
      const sunset = sun.sunset;

      const morningStart = new Date(sunrise.getTime() - 60 * 60 * 1000);
      const morningEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
      const eveningStart = new Date(sunset.getTime() - 60 * 60 * 1000);
      const eveningEnd = new Date(sunset.getTime() + 60 * 60 * 1000);

      timesOut.innerHTML =
        '<div class="card compact">' +
        '  <div class="small"><strong>Morning Window</strong></div>' +
        '  <div style="font-size:20px;font-weight:900;">' +
        escHtml(formatTime(morningStart)) +
        " - " +
        escHtml(formatTime(morningEnd)) +
        '</div><div class="small" style="margin-top:6px;opacity:0.85;">' +
        escHtml(chosenDate) +
        "</div></div>" +
        '<div class="card compact">' +
        '  <div class="small"><strong>Evening Window</strong></div>' +
        '  <div style="font-size:20px;font-weight:900;">' +
        escHtml(formatTime(eveningStart)) +
        " - " +
        escHtml(formatTime(eveningEnd)) +
        '</div><div class="small" style="margin-top:6px;opacity:0.85;">' +
        escHtml(chosenDate) +
        "</div></div>";
    } catch (e) {
      timesOut.textContent = "Could not load sunrise/sunset. Try again.";
    }
  }

  function fmtTempRange(minF, maxF) {
    if (!Number.isFinite(minF) && !Number.isFinite(maxF)) return "--";
    if (Number.isFinite(minF) && Number.isFinite(maxF)) {
      return Math.round(minF) + " to " + Math.round(maxF) + " F";
    }
    if (Number.isFinite(maxF)) return "Up to " + Math.round(maxF) + " F";
    return "Down to " + Math.round(minF) + " F";
  }

  function fmtMph(x) {
    if (!Number.isFinite(x)) return "--";
    return x.toFixed(0) + " mph";
  }

  function fmtPct(x) {
    if (!Number.isFinite(x)) return "--";
    const v = Math.max(0, Math.min(100, Math.round(x)));
    return v + " %";
  }

  async function autoDisplayWeatherWind() {
    windOut.innerHTML = "";

    if (!hasResolvedLocation()) {
      windOut.textContent = "Pick a place or use your location first.";
      return;
    }

    windOut.textContent = "Loading...";
    try {
      const w = await fetchWeatherMulti(state.lat, state.lon);
      const chosenDate = clampDateToDailyList(
        state.windDate,
        w.days && w.days.length ? w.days : [isoTodayLocal()]
      );
      state.windDate = chosenDate;

      const inp = document.getElementById("home_wind_date");
      if (inp && inp.value !== chosenDate) inp.value = chosenDate;

      const pts = filterHourlyMultiToDate(w, chosenDate);
      const summary = summarizeDay(pts);

      const maxSust = summary.maxWind;
      const maxGust = summary.maxGust;
      const tMin = summary.minTemp;
      const tMax = summary.maxTemp;
      const rainMax = summary.maxRain;

      const rating = classifyGoCautionNoGo(maxSust, maxGust);
      const tips = exposureTips(tMin, tMax, rainMax);

      const series = pts
        .map(function (p) { return { dt: p.dt, mph: Number(p.wind) }; })
        .filter(function (p) { return Number.isFinite(p.mph); });

      const list = pts.slice(0, 24).map(function (p) {
        const label = p.dt.toLocaleTimeString([], { hour: "numeric" });
        const sust = Number.isFinite(p.wind) ? p.wind.toFixed(1) : "--";
        const gust = Number.isFinite(p.gust) ? p.gust.toFixed(1) : "--";
        return label + ": <strong>" + sust + " mph</strong> sustained, <strong>" + gust + " mph</strong> gust";
      });

      const badgeClass =
        rating.color === "go"
          ? "badgeGo"
          : rating.color === "nog"
          ? "badgeNoGo"
          : "badgeCaution";

      let html = "";

      html +=
        '<div class="card compact">' +
        '<div class="small"><strong>Overview - ' + escHtml(chosenDate) + "</strong></div>" +

        '<div class="row2">' +
        '  <div class="statBox">' +
        '    <div class="statLabel">Temperature</div>' +
        '    <div class="statValue">' + escHtml(fmtTempRange(tMin, tMax)) + "</div>" +
        "  </div>" +
        '  <div class="statBox">' +
        '    <div class="statLabel">Rain chance (max)</div>' +
        '    <div class="statValue">' + escHtml(fmtPct(rainMax)) + "</div>" +
        "  </div>" +
        "</div>" +

        '<div class="row2">' +
        '  <div class="statBox">' +
        '    <div class="statLabel">Max sustained wind</div>' +
        '    <div class="statValue">' + escHtml(fmtMph(maxSust)) + "</div>" +
        "  </div>" +
        '  <div class="statBox">' +
        '    <div class="statLabel">Max gust</div>' +
        '    <div class="statValue">' + escHtml(fmtMph(maxGust)) + "</div>" +
        "  </div>" +
        "</div>" +

        '<div class="meterWrap">' +
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '    <div class="small"><strong>Boating / Kayak status</strong></div>' +
        '    <div class="meterBadge ' + escHtml(badgeClass) + '">' + escHtml(rating.level) + "</div>" +
        "  </div>" +
        '  <div class="meterBar" style="margin-top:8px;">' +
        '    <div class="meterSegGo"></div>' +
        '    <div class="meterSegCaution"></div>' +
        '    <div class="meterSegNoGo"></div>' +
        "  </div>" +
        '  <div class="small" style="margin-top:8px;">' + escHtml(rating.reason) + "</div>" +
        "</div>" +
        "</div>";

      html +=
        '<div class="card compact">' +
        '<div class="small"><strong>Exposure tips</strong></div>' +
        '<ul class="list" style="margin-top:8px;">' +
        (tips && tips.length
          ? tips.map(function (t) { return "<li>" + escHtml(t) + "</li>"; }).join("")
          : "<li>Use layers, keep dry gear in a dry bag, and watch conditions.</li>") +
        "</ul></div>";

      html +=
        '<div class="card compact">' +
        '<div class="small"><strong>Sustained wind (mph) - hourly chart</strong></div>' +
        '<div class="chartWrap" style="margin-top:8px;">' +
        '<canvas id="home_wind_chart" class="windChart"></canvas>' +
        "</div>" +
        '<div class="small" style="margin-top:8px;">Times are local. Chart is sustained wind.</div>' +
        "</div>";

      html +=
        '<div class="card compact">' +
        '<div class="small"><strong>First 24 hours listed (sustained + gust)</strong></div>' +
        '<div style="margin-top:8px;">' +
        (list.length ? list.join("<br>") : "No hourly data returned for this date.") +
        "</div></div>";

      windOut.innerHTML = html;

      const c = document.getElementById("home_wind_chart");
      if (c && series && series.length >= 2) {
        drawWindLineChart(c, series);
      } else {
        const wrap = document.querySelector("#home_wind .chartWrap");
        if (wrap) {
          wrap.insertAdjacentHTML(
            "beforeend",
            '<div class="small" style="margin-top:8px;">Not enough hourly points for a chart on this date.</div>'
          );
        }
      }
    } catch (e) {
      windOut.textContent = "Could not load weather/wind. Try again.";
    }
  }

  autoDisplayTimes();
  autoDisplayWeatherWind();
}

function renderTrollingDepthPage() {
  const page = pageEl();
  page.innerHTML = `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>
      <div class="small">Simple estimate. Current and lure drag affect results.</div>
    </div>

    <div class="card">
      <div class="sectionTitle">Inputs</div>

      <div class="btnRow" style="margin-top:10px;">
        <div style="flex:1;">
          <div class="small"><strong>Speed (mph)</strong></div>
          <input id="spd" type="number" step="0.1" value="1.3">
        </div>
        <div style="flex:1;">
          <div class="small"><strong>Weight (oz)</strong></div>
          <input id="wgt" type="number" step="0.5" value="2">
        </div>
      </div>

      <div style="margin-top:10px;">
        <div class="small"><strong>Line out (feet)</strong></div>
        <input id="outft" type="number" step="5" value="100">
      </div>

      <div class="btnRow" style="margin-top:10px;">
        <div style="flex:1;">
          <div class="small"><strong>Line type</strong></div>
          <select id="lt">
            <option>Braid</option>
            <option>Fluorocarbon</option>
            <option>Monofilament</option>
          </select>
        </div>
        <div style="flex:1;">
          <div class="small"><strong>Line test (lb)</strong></div>
          <select id="lb">
            <option>6</option>
            <option>8</option>
            <option>10</option>
            <option selected>12</option>
            <option>15</option>
            <option>20</option>
            <option>25</option>
            <option>30</option>
            <option>40</option>
            <option>50</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;">
        <button id="calc">Calculate depth</button>
      </div>

      <div id="depth_out" style="margin-top:12px;"></div>
    </div>
  `;

  function trollingDepth(speedMph, weightOz, lineOutFt, lineType, lineTestLb) {
    if (speedMph <= 0 || weightOz <= 0 || lineOutFt <= 0 || lineTestLb <= 0)
      return null;

    const typeDrag =
      { Braid: 1.0, Fluorocarbon: 1.12, Monofilament: 1.2 }[lineType] || 1.0;
    const testRatio = lineTestLb / 20.0;
    const testDrag = Math.pow(testRatio, 0.35);
    const totalDrag = typeDrag * testDrag;

    const depth =
      0.135 *
      (weightOz / (totalDrag * Math.pow(speedMph, 1.35))) *
      lineOutFt;
    return Math.round(depth * 10) / 10;
  }

  document.getElementById("calc").addEventListener("click", function () {
    const out = document.getElementById("depth_out");

    const spd = Number(document.getElementById("spd").value);
    const wgt = Number(document.getElementById("wgt").value);
    const outft = Number(document.getElementById("outft").value);
    const lt = document.getElementById("lt").value;
    const lb = Number(document.getElementById("lb").value);

    const d = trollingDepth(spd, wgt, outft, lt, lb);

    out.innerHTML =
      '<div class="card compact">' +
      '  <div class="small"><strong>Estimated depth</strong></div>' +
      '  <div style="font-size:24px;font-weight:900;">' +
      (d === null ? "--" : escHtml(String(d))) +
      " ft</div>" +
      '  <div class="small" style="margin-top:8px;">Heavier line runs shallower. Current and lure drag affect results.</div>' +
      "</div>";
  });
}

function speciesDb() {
  return {
    Kokanee: {
      temp: "42 to 55 F",
      baits: [
        "Small hoochies",
        "Small spinners (wedding ring)",
        "Corn with scent (where used)"
      ],
      rigs: ["Dodger + leader + hoochie/spinner", "Weights or downrigger to match marks"],
      Mid: [
        "Troll dodger plus small hoochie or spinner behind it.",
        "Run scent and tune speed until you get a steady rod thump."
      ]
    },
    "Rainbow trout": {
      temp: "45 to 65 F",
      baits: [
        "Small spoons",
        "Inline spinners",
        "Floating minnows",
        "Worms (where legal)",
        "PowerBait (where legal)"
      ],
      rigs: ["Cast and retrieve", "Trolling with long leads", "Slip sinker bait rig (near bottom)"],
      Top: ["When they are up, cast small spinners, spoons, or floating minnows."],
      Mid: ["Troll small spoons or spinners at 1.2 to 1.8 mph."],
      Bottom: ["Still fish bait just off bottom near structure or drop-offs."]
    },
    "Lake trout": {
      temp: "42 to 55 F",
      baits: ["Tube jigs", "Large spoons", "Blade baits", "Swimbaits (deep)"],
      rigs: ["Vertical jigging (heavy jig head + tube)", "Deep trolling with weights or downrigger"],
      Mid: ["If bait is suspended, troll big spoons or tubes through the marks."],
      Bottom: ["Work structure: humps, points, deep breaks. Jig heavy tubes on bottom."]
    },
    "Chinook salmon": {
      temp: "44 to 58 F",
      baits: ["Hoochies", "Spoons", "Spinners", "Cut plug / herring style (where used)"],
      rigs: ["Flasher + leader + hoochie/spoon", "Weights or downrigger for depth control"],
      Mid: ["Troll flasher plus hoochie or spoon. Repeat productive speed and depth."],
      Bottom: ["If they hug bottom, run just above them to avoid snagging."]
    },
    "Smallmouth bass": {
      temp: "60 to 75 F",
      baits: [
        "Walking baits",
        "Poppers",
        "Jerkbaits",
        "Swimbaits",
        "Ned rigs",
        "Tubes",
        "Drop shot plastics"
      ],
      rigs: ["Ned rig", "Drop shot", "Tube jig"],
      Top: ["Walking baits and poppers early and late."],
      Mid: ["Jerkbaits and swimbaits around rocks and shade."],
      Bottom: ["Ned rig, tube, drop shot on rock and breaks."]
    },
    "Largemouth bass": {
      temp: "65 to 80 F",
      baits: ["Frogs", "Buzzbaits", "Swim jigs", "Texas rig plastics", "Jigs"],
      rigs: ["Texas rig", "Swim jig", "Pitching jig"],
      Top: ["Frog and buzzbait around weeds and shade lines."],
      Mid: ["Swim jig or paddletail along weed edges."],
      Bottom: ["Texas rig and jig in thick cover and along drop-offs."]
    },
    Walleye: {
      temp: "55 to 70 F",
      baits: [
        "Crankbaits (trolling)",
        "Jigs with soft plastics",
        "Jigs with crawler (where used)",
        "Blade baits"
      ],
      rigs: [
        "Jig and soft plastic",
        "Bottom bouncer + harness (where used)",
        "Trolling crankbaits on breaks"
      ],
      Mid: ["Troll crankbaits along breaks at dusk and dawn."],
      Bottom: ["Jig near bottom on transitions and edges."]
    },
    Perch: {
      temp: "55 to 75 F",
      baits: ["Small jigs", "Worm pieces", "Minnow (where allowed)", "Tiny grubs"],
      rigs: ["Small jighead + bait", "Dropper loop with small hook (where used)"],
      Mid: ["Small jigs tipped with bait, slowly swum through schools."],
      Bottom: ["Vertical jig small baits on bottom."]
    },
    Bluegill: {
      temp: "65 to 80 F",
      baits: ["Tiny poppers", "Small jigs", "Worm pieces", "Micro plastics"],
      rigs: ["Float + small jig/hook", "Ultralight jighead"],
      Top: ["Tiny poppers can work in summer near shade and cover."],
      Mid: ["Small jigs under a float with slow retrieves and pauses."]
    },
    "Channel catfish": {
      temp: "65 to 85 F",
      baits: ["Cut bait", "Worms", "Stink bait", "Chicken liver (where used)"],
      rigs: ["Slip sinker / Carolina rig", "Santee Cooper style (float bait slightly)"],
      Bottom: [
        "Soak bait on scent trails. Target holes, outside bends, slow water near current."
      ]
    }
  };
}

function renderSpeciesTipsPage() {
  const page = pageEl();
  const db = speciesDb();
  const speciesList = Object.keys(db).sort();

  let defaultSpecies = "Largemouth bass";
  if (!db[defaultSpecies]) defaultSpecies = speciesList[0];

  page.innerHTML = `
    <div class="card">
      <h2>Species Tips</h2>
      <div class="small">Shows only the depths that make sense for that species, plus popular baits and common rigs.</div>
    </div>

    <div class="card">
      <div class="small"><strong>Species</strong></div>
      <select id="sp_sel"></select>
      <div id="sp_out" style="margin-top:12px;"></div>
    </div>
  `;

  const sel = document.getElementById("sp_sel");
  sel.innerHTML = speciesList
    .map(function (s) {
      return (
        "<option" +
        (s === defaultSpecies ? " selected" : "") +
        ">" +
        escHtml(s) +
        "</option>"
      );
    })
    .join("");

  function renderOne(name) {
    const info = db[name];
    if (!info) return;

    const out = document.getElementById("sp_out");

    let html = "";
    html +=
      '<div class="card compact"><div class="small"><strong>Most active water temperature range</strong></div><div style="font-size:20px;font-weight:900;">' +
      escHtml(info.temp) +
      "</div></div>";

    if (info.baits && info.baits.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Popular baits</strong></div><ul class="list">' +
        info.baits
          .map(function (x) {
            return "<li>" + escHtml(x) + "</li>";
          })
          .join("") +
        "</ul></div>";
    }

    if (info.rigs && info.rigs.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Common rigs</strong></div><ul class="list">' +
        info.rigs
          .map(function (x) {
            return "<li>" + escHtml(x) + "</li>";
          })
          .join("") +
        "</ul></div>";
    }

    if (info.Top && info.Top.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Topwater</strong></div><ul class="list">' +
        info.Top
          .map(function (x) {
            return "<li>" + escHtml(x) + "</li>";
          })
          .join("") +
        "</ul></div>";
    }
    if (info.Mid && info.Mid.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Mid water</strong></div><ul class="list">' +
        info.Mid
          .map(function (x) {
            return "<li>" + escHtml(x) + "</li>";
          })
          .join("") +
        "</ul></div>";
    }
    if (info.Bottom && info.Bottom.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Bottom</strong></div><ul class="list">' +
        info.Bottom
          .map(function (x) {
            return "<li>" + escHtml(x) + "</li>";
          })
          .join("") +
        "</ul></div>";
    }

    out.innerHTML = html;
  }

  renderOne(defaultSpecies);

  sel.addEventListener("change", function () {
    renderOne(sel.value);
  });
}

function renderSpeedometerPage() {
  const page = pageEl();
  page.innerHTML = `
    <div class="card">
      <h2>Speedometer</h2>
      <div class="small">Uses your phone GPS in the browser. Works best once you are moving.</div>
    </div>

    <div class="card" id="spd_wrap">
      <div style="font-weight:900;font-size:18px;margin-bottom:6px;">GPS Speed</div>
      <div id="spd_status" class="small">Allow location permission...</div>

      <div style="margin-top:12px; display:flex; align-items:center; gap:14px;">
        <div style="width:120px;height:120px;border-radius:999px;border:2px solid rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;">
            <div id="spd_mph" style="font-size:34px;font-weight:900;line-height:1;">--</div>
            <div class="small">mph</div>
          </div>
        </div>

        <div style="flex:1;">
          <div id="spd_acc" class="small">Accuracy: --</div>
          <div class="small" style="margin-top:8px;">If mph is --, start moving and wait a few seconds.</div>
        </div>
      </div>
    </div>
  `;

  const statusEl = document.getElementById("spd_status");
  const mphEl = document.getElementById("spd_mph");
  const accEl = document.getElementById("spd_acc");

  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not supported on this device/browser.";
    return;
  }

  state.speedWatchId = navigator.geolocation.watchPosition(
    function (pos) {
      const spd = pos.coords.speed;
      const acc = pos.coords.accuracy;

      accEl.textContent = "Accuracy: " + Math.round(acc) + " m";

      if (spd === null || spd === undefined) {
        mphEl.textContent = "--";
        statusEl.textContent = "GPS lock... keep moving.";
        return;
      }

      const mph = spd * 2.236936;
      mphEl.textContent = mph.toFixed(1);
      statusEl.textContent = "GPS speed (live)";
    },
    function (err) {
      statusEl.textContent = "Location error: " + err.message;
    },
    { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 }
  );
}

// ----------------------------
// Render router
// ----------------------------
function render() {
  renderHeaderAndNav();

  if (state.tool === "Home") renderHomePage();
  else if (state.tool === "Trolling depth calculator") renderTrollingDepthPage();
  else if (state.tool === "Species tips") renderSpeciesTipsPage();
  else renderSpeedometerPage();
}

// ----------------------------
// Boot (safe if script is not deferred)
// ----------------------------
function boot() {
  app = document.getElementById("app");
  if (!app) return;

  // Restore last location BEFORE first render so Home auto-runs immediately
  const last = loadLastLocation();
  if (last) {
    state.lat = last.lat;
    state.lon = last.lon;
    state.placeLabel = last.label || "";
  }

  // Default dates on first load (avoid empty date inputs)
  if (!isIsoDate(state.timesDate)) state.timesDate = isoTodayLocal();
  if (!isIsoDate(state.windDate)) state.windDate = isoTodayLocal();

  renderConsentBannerIfNeeded();
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// ============================
// PART 3 END
// ============================