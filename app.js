// ============================
// app.js - FishyNW.com - Fishing Tools (Web)
// Version 1.0.8
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
//
// PART 1 OF 2 BEGIN
// ============================

"use strict";

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
  // Router
  tool: "Home",

  // Location
  lat: null,
  lon: null,
  placeLabel: "",
  matches: [],
  selectedIndex: 0,

  // Home date (single date picker for everything)
  homeDate: "",

  // Safety context (new)
  waterType: "small", // "small" | "big" (big water/offshore)
  craftType: "kayak", // "kayak" | "motor_kayak" | "boat"

  // Speedometer
  speedWatchId: null
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
  :root { --green:#8fd19e; --green2:#7cc78f; --greenBorder:#6fbf87; --text:#0b2e13; }

  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

  .wrap { max-width: 760px; margin: 0 auto; padding: 12px 12px 36px 12px; }

  .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:6px; }
  .logo { max-width: 60%; }
  .logo img { width: 100%; max-width: 240px; height: auto; display:block; }

  .title { text-align:right; font-weight:900; font-size:18px; line-height:20px; }
  .small { opacity:0.82; font-size: 13px; }

  .nav { margin-top: 12px; margin-bottom: 10px; display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

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

  /* New helpers */
  .hidden { display:none !important; }
  .emptyState {
    margin-top: 12px;
    padding: 14px;
    border-radius: 16px;
    border: 1px dashed rgba(0,0,0,0.22);
    background: rgba(0,0,0,0.02);
    font-weight: 900;
  }

  /* Weather tiles grid */
  .tileGrid {
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .statBox {
    border-radius: 14px;
    padding: 12px;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.55);
  }
  .statLabel { font-size: 13px; opacity: 0.85; font-weight: 900; }
  .statValue { margin-top: 6px; font-size: 22px; font-weight: 900; }

  /* Safety options */
  .optGrid {
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .optBox {
    border-radius: 14px;
    padding: 12px;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(255,255,255,0.55);
  }
  .optLabel { font-size: 13px; opacity: 0.85; font-weight: 900; margin-bottom: 6px; }

  /* GO/CAUTION/NO-GO meter */
  .meterBar { display:flex; height: 18px; border-radius: 999px; overflow:hidden; border: 1px solid rgba(0,0,0,0.14); }
  .meterSegGo { flex:1; background: rgba(143,209,158,0.85); }
  .meterSegCaution { flex:1; background: rgba(255,221,120,0.85); }
  .meterSegNoGo { flex:1; background: rgba(244,163,163,0.85); }

  .meterBadge {
    min-width: 84px;
    text-align:center;
    padding: 8px 10px;
    border-radius: 999px;
    font-weight: 900;
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(255,255,255,0.85);
  }
  .badgeGo { background: rgba(143,209,158,0.55); }
  .badgeCaution { background: rgba(255,221,120,0.55); }
  .badgeNoGo { background: rgba(244,163,163,0.60); }

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
// API: Best times (sunrise/sunset)
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
// API: Weather/Wind (hourly + daily temps)
// ----------------------------
async function fetchWeatherWindMulti(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&hourly=wind_speed_10m,wind_gusts_10m,precipitation_probability" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&forecast_days=7" +
    "&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();

  const hourly = data && data.hourly ? data.hourly : null;
  const times = hourly && hourly.time ? hourly.time : [];
  const wind = hourly && hourly.wind_speed_10m ? hourly.wind_speed_10m : [];
  const gust = hourly && hourly.wind_gusts_10m ? hourly.wind_gusts_10m : [];
  const pop =
    hourly && hourly.precipitation_probability
      ? hourly.precipitation_probability
      : [];

  const daily = data && data.daily ? data.daily : null;
  const days = daily && daily.time ? daily.time : [];
  const tmax = daily && daily.temperature_2m_max ? daily.temperature_2m_max : [];
  const tmin = daily && daily.temperature_2m_min ? daily.temperature_2m_min : [];

  return { times: times, wind: wind, gust: gust, pop: pop, days: days, tmax: tmax, tmin: tmin };
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

// ============================
// app.js - FishyNW.com - Fishing Tools (Web)
// Version 1.0.8
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
//
// PART 2 OF 2 BEGIN
// ============================

// ----------------------------
// GO / CAUTION / NO-GO logic
// Includes: big water/offshore + motorized kayak option
// ----------------------------
function goMeter(maxSustainedMph, maxGustMph, waterType, craftType) {
  const s = Number(maxSustainedMph);
  const g = Number(maxGustMph);

  // Baseline thresholds (small/protected water, paddle kayak)
  // GO: sustained < 10 AND gust < 18
  // CAUTION: sustained < 15 AND gust < 25
  // NO-GO: anything above those
  let goS = 10;
  let goG = 18;
  let cauS = 15;
  let cauG = 25;

  // Big water / offshore is more conservative
  if (waterType === "big") {
    goS = 8;
    goG = 15;
    cauS = 12;
    cauG = 20;
  }

  // Motorized kayak: slightly more tolerant than paddle kayak,
  // but NOT as tolerant as a true boat (still small craft).
  if (craftType === "motor_kayak") {
    goS += 1;
    goG += 2;
    cauS += 1;
    cauG += 2;

    // If offshore, keep it conservative anyway
    if (waterType === "big") {
      goS = Math.min(goS, 9);
      goG = Math.min(goG, 17);
      cauS = Math.min(cauS, 13);
      cauG = Math.min(cauG, 22);
    }
  }

  // Small boat: more tolerant (still not "safe", just guidance)
  if (craftType === "boat") {
    goS += 4;
    goG += 5;
    cauS += 5;
    cauG += 7;

    // Offshore still needs respect
    if (waterType === "big") {
      goS = Math.min(goS, 14);
      goG = Math.min(goG, 24);
      cauS = Math.min(cauS, 20);
      cauG = Math.min(cauG, 32);
    }
  }

  // If inputs missing, return a neutral caution
  if (!Number.isFinite(s) || !Number.isFinite(g)) {
    return {
      label: "CAUTION",
      cls: "badgeCaution",
      msg:
        "Not enough wind data to score conditions. Check forecast, watch the water, and use your judgment."
    };
  }

  if (s < goS && g < goG) {
    return {
      label: "GO",
      cls: "badgeGo",
      msg:
        "Generally favorable. Still watch for funnels, open water chop, and changing conditions."
    };
  }

  if (s < cauS && g < cauG) {
    return {
      label: "CAUTION",
      cls: "badgeCaution",
      msg:
        "Borderline for small craft. Stay closer to shore, avoid long crossings, and be ready to bail."
    };
  }

  return {
    label: "NO-GO",
    cls: "badgeNoGo",
    msg:
      "High risk for small craft. Wind and gusts can create dangerous chop and make self-rescue difficult."
  };
}

// ----------------------------
// Exposure tips based on day conditions (temp + rain chance)
// ----------------------------
function exposureTips(minF, maxF, rainMaxPct) {
  const tips = [];

  const minT = Number(minF);
  const maxT = Number(maxF);
  const rain = Number(rainMaxPct);

  // Always include sunscreen note (you asked)
  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  tips.push("Wear your PFD. Cold shock and fatigue happen fast if you end up in the water.");

  const cold = Number.isFinite(maxT) && maxT <= 45;
  const veryCold = Number.isFinite(maxT) && maxT <= 35;
  const hot = Number.isFinite(maxT) && maxT >= 78;
  const warm = Number.isFinite(maxT) && maxT >= 65;
  const wet = Number.isFinite(rain) && rain >= 35;

  if (veryCold || cold) {
    tips.push("Cold air/water risk. Consider a drysuit or a proper wetsuit setup.");
    tips.push("Avoid cotton. Use synthetic or wool layers. Bring spare gloves and a warm hat in a dry bag.");
    tips.push("Plan for self-rescue: keep it close to shore and avoid long open-water runs.");
  } else if (hot || warm) {
    tips.push("Heat and sun exposure: wear a sun shirt (UPF), brim hat, and sunglasses.");
    tips.push("Hydrate and bring electrolytes. Shade breaks help on long days.");
  } else {
    tips.push("Layering helps: light base layer + wind layer. Avoid cotton if conditions might turn cold.");
    tips.push("Bring a dry bag with a spare top and a small towel.");
  }

  if (wet) {
    tips.push("Rain chance is up. Pack a light waterproof shell and keep electronics in a dry bag.");
  }

  return tips;
}

// ----------------------------
// UI helpers
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

  // Home button only when not on Home
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
// HOME page: Weather/Wind + Best Times
// - single date picker
// - hides duplicate "pick a place..." spam (one empty state only)
// - adds water type + craft type toggles (big water/offshore, motorized kayak)
// ----------------------------
function renderHomePage() {
  const page = pageEl();

  page.innerHTML =
    '<div class="card">' +
    "  <h2>Weather/Wind + Best Times</h2>" +
    '  <div class="small">Pick a date once. Weather tiles + wind chart + best fishing windows auto-generate after location is set.</div>' +
    "</div>" +
    '<div class="card" id="home_controls"></div>' +
    '<div id="home_empty" class="emptyState hidden">Pick a place or use your location first.</div>' +
    '<div class="card hidden" id="home_weather"></div>' +
    '<div class="card hidden" id="home_meter"></div>' +
    '<div class="card hidden" id="home_exposure"></div>' +
    '<div class="card hidden" id="home_times"></div>';

  const controls = document.getElementById("home_controls");
  const empty = document.getElementById("home_empty");
  const weatherCard = document.getElementById("home_weather");
  const meterCard = document.getElementById("home_meter");
  const exposureCard = document.getElementById("home_exposure");
  const timesCard = document.getElementById("home_times");

  if (!isIsoDate(state.homeDate)) state.homeDate = isoTodayLocal();

  // Date picker + safety toggles
  appendHtml(
    controls,
    `
    <div class="small"><strong>Date</strong></div>
    <input id="home_date" type="date" value="${escHtml(state.homeDate)}" />
    <div class="small" style="margin-top:8px;">If you choose a date outside the 7-day forecast window, it will clamp.</div>

    <div class="optGrid">
      <div class="optBox">
        <div class="optLabel">Water type</div>
        <select id="water_type">
          <option value="small">Small / protected water</option>
          <option value="big">Big water / open / offshore</option>
        </select>
      </div>
      <div class="optBox">
        <div class="optLabel">Craft</div>
        <select id="craft_type">
          <option value="kayak">Kayak (paddle)</option>
          <option value="motor_kayak">Motorized kayak</option>
          <option value="boat">Small boat</option>
        </select>
      </div>
    </div>
  `
  );

  const dateInput = document.getElementById("home_date");
  const waterSel = document.getElementById("water_type");
  const craftSel = document.getElementById("craft_type");

  waterSel.value = state.waterType;
  craftSel.value = state.craftType;

  dateInput.addEventListener("change", function (e) {
    state.homeDate = String(e.target.value || "").slice(0, 10);
    autoRun();
  });

  waterSel.addEventListener("change", function () {
    state.waterType = waterSel.value;
    autoRun();
  });

  craftSel.addEventListener("change", function () {
    state.craftType = craftSel.value;
    autoRun();
  });

  function showOnlyEmpty() {
    empty.classList.remove("hidden");
    weatherCard.classList.add("hidden");
    meterCard.classList.add("hidden");
    exposureCard.classList.add("hidden");
    timesCard.classList.add("hidden");
  }

  function showResults() {
    empty.classList.add("hidden");
    weatherCard.classList.remove("hidden");
    meterCard.classList.remove("hidden");
    exposureCard.classList.remove("hidden");
    timesCard.classList.remove("hidden");
  }

  function onResolved() {
    autoRun();
  }

  renderLocationPicker(controls, "home", onResolved);

  async function autoRun() {
    if (!hasResolvedLocation()) {
      showOnlyEmpty();
      return;
    }

    showResults();

    // Clear cards before loading
    weatherCard.innerHTML =
      '<h3>Overview</h3><div class="small">Loading...</div>';
    meterCard.innerHTML = '<h3>Boating / Kayak status</h3><div class="small">Loading...</div>';
    exposureCard.innerHTML = '<h3>Exposure tips</h3><div class="small">Loading...</div>';
    timesCard.innerHTML = '<h3>Best fishing windows</h3><div class="small">Loading...</div>';

    // Weather/Wind
    let wx = null;
    let chosen = state.homeDate;

    try {
      wx = await fetchWeatherWindMulti(state.lat, state.lon);
      chosen = clampDateToDailyList(state.homeDate, wx.days && wx.days.length ? wx.days : [isoTodayLocal()]);
      state.homeDate = chosen;
      if (dateInput && dateInput.value !== chosen) dateInput.value = chosen;
    } catch (e) {
      weatherCard.innerHTML = "<h3>Overview</h3><div class='small'>Could not load weather.</div>";
      meterCard.innerHTML = "<h3>Boating / Kayak status</h3><div class='small'>No data.</div>";
      exposureCard.innerHTML = "<h3>Exposure tips</h3><div class='small'>No data.</div>";
      // Still try times below
    }

    // Best times
    try {
      const sunMulti = await fetchSunTimesMulti(state.lat, state.lon);
      const chosen2 = clampDateToDailyList(state.homeDate, sunMulti.days);
      state.homeDate = chosen2;
      if (dateInput && dateInput.value !== chosen2) dateInput.value = chosen2;

      const sun = sunForDate(sunMulti, chosen2);
      if (!sun) {
        timesCard.innerHTML =
          "<h3>Best fishing windows</h3><div class='small'>Could not load sunrise/sunset for that date.</div>";
      } else {
        const sunrise = sun.sunrise;
        const sunset = sun.sunset;

        const morningStart = new Date(sunrise.getTime() - 60 * 60 * 1000);
        const morningEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
        const eveningStart = new Date(sunset.getTime() - 60 * 60 * 1000);
        const eveningEnd = new Date(sunset.getTime() + 60 * 60 * 1000);

        timesCard.innerHTML =
          "<h3>Best fishing windows</h3>" +
          '<div class="card compact">' +
          '  <div class="small"><strong>Morning</strong></div>' +
          '  <div style="font-size:20px;font-weight:900;">' +
          escHtml(formatTime(morningStart)) +
          " - " +
          escHtml(formatTime(morningEnd)) +
          "</div>" +
          '  <div class="small" style="margin-top:6px;opacity:0.85;">' +
          escHtml(state.homeDate) +
          "</div>" +
          "</div>" +
          '<div class="card compact">' +
          '  <div class="small"><strong>Evening</strong></div>' +
          '  <div style="font-size:20px;font-weight:900;">' +
          escHtml(formatTime(eveningStart)) +
          " - " +
          escHtml(formatTime(eveningEnd)) +
          "</div>" +
          '  <div class="small" style="margin-top:6px;opacity:0.85;">' +
          escHtml(state.homeDate) +
          "</div>" +
          "</div>";
      }
    } catch (e) {
      timesCard.innerHTML =
        "<h3>Best fishing windows</h3><div class='small'>Could not load sunrise/sunset.</div>";
    }

    // Render weather tiles + meter + exposure + wind chart
    if (wx && wx.times && wx.times.length) {
      const ptsWind = filterHourlyToDate(wx.times, wx.wind, chosen);
      const ptsGust = filterHourlyToDate(wx.times, wx.gust, chosen);
      const ptsPop = filterHourlyToDate(wx.times, wx.pop, chosen);

      // Daily temps from daily list
      let minF = null;
      let maxF = null;
      const dIdx = wx.days.indexOf(chosen);
      if (dIdx >= 0) {
        minF = Number(wx.tmin[dIdx]);
        maxF = Number(wx.tmax[dIdx]);
      }

      function maxOf(list) {
        let m = -Infinity;
        for (let i = 0; i < list.length; i++) {
          const v = Number(list[i].v);
          if (Number.isFinite(v) && v > m) m = v;
        }
        return Number.isFinite(m) ? m : null;
      }

      function maxOfPct(list) {
        let m = -Infinity;
        for (let i = 0; i < list.length; i++) {
          const v = Number(list[i].v);
          if (Number.isFinite(v) && v > m) m = v;
        }
        return Number.isFinite(m) ? m : null;
      }

      const maxS = maxOf(ptsWind);
      const maxG = maxOf(ptsGust);
      const maxRain = maxOfPct(ptsPop);

      // Weather tiles (grid) - temp and rain side-by-side, sustained and gust side-by-side
      weatherCard.innerHTML =
        "<h3>Overview - " +
        escHtml(chosen) +
        "</h3>" +
        '<div class="tileGrid">' +
        '  <div class="statBox">' +
        '    <div class="statLabel">Temperature</div>' +
        '    <div class="statValue">' +
        escHtml(
          Number.isFinite(minF) && Number.isFinite(maxF)
            ? String(Math.round(minF)) + " to " + String(Math.round(maxF)) + " F"
            : "--"
        ) +
        "</div>" +
        "  </div>" +
        '  <div class="statBox">' +
        '    <div class="statLabel">Rain chance (max)</div>' +
        '    <div class="statValue">' +
        escHtml(Number.isFinite(maxRain) ? String(Math.round(maxRain)) + " %" : "--") +
        "</div>" +
        "  </div>" +
        '  <div class="statBox">' +
        '    <div class="statLabel">Max sustained wind</div>' +
        '    <div class="statValue">' +
        escHtml(Number.isFinite(maxS) ? String(Math.round(maxS)) + " mph" : "--") +
        "</div>" +
        "  </div>" +
        '  <div class="statBox">' +
        '    <div class="statLabel">Max gust</div>' +
        '    <div class="statValue">' +
        escHtml(Number.isFinite(maxG) ? String(Math.round(maxG)) + " mph" : "--") +
        "</div>" +
        "  </div>" +
        "</div>" +
        '<div class="chartWrap">' +
        '<canvas id="wind_chart" class="windChart"></canvas>' +
        "</div>" +
        '<div class="small" style="margin-top:8px;">Times are local. If chart is blank, try another date.</div>';

      // Wind chart uses sustained wind points
      const series = ptsWind.map(function (p) {
        return { dt: p.dt, mph: p.v };
      });
      const c = document.getElementById("wind_chart");
      if (c && series.length >= 2) {
        drawWindLineChart(c, series);

        let resizeTimer = null;
        window.addEventListener("resize", function () {
          if (!document.getElementById("wind_chart")) return;
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            const c2 = document.getElementById("wind_chart");
            if (c2) drawWindLineChart(c2, series);
          }, 120);
        });
      }

      // Meter + status message
      const gm = goMeter(maxS, maxG, state.waterType, state.craftType);
      meterCard.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
        "<h3 style='margin:0;'>Boating / Kayak status</h3>" +
        '<div class="meterBadge ' + escHtml(gm.cls) + '">' +
        escHtml(gm.label) +
        "</div>" +
        "</div>" +
        '<div class="meterBar" style="margin-top:10px;">' +
        '<div class="meterSegGo"></div>' +
        '<div class="meterSegCaution"></div>' +
        '<div class="meterSegNoGo"></div>' +
        "</div>" +
        '<div class="small" style="margin-top:10px;">' +
        escHtml(gm.msg) +
        "</div>";

      // Exposure tips (weather-dependent)
      const tips = exposureTips(minF, maxF, maxRain);
      exposureCard.innerHTML =
        "<h3>Exposure tips</h3>" +
        '<ul class="list">' +
        tips
          .map(function (t) {
            return "<li>" + escHtml(t) + "</li>";
          })
          .join("") +
        "</ul>";
    } else {
      weatherCard.innerHTML =
        "<h3>Overview</h3><div class='small'>No hourly weather returned for this date.</div>";
      meterCard.innerHTML =
        "<h3>Boating / Kayak status</h3><div class='small'>No data.</div>";
      exposureCard.innerHTML =
        "<h3>Exposure tips</h3><div class='small'>No data.</div>";
    }
  }

  autoRun();
}

// ----------------------------
// Other pages (Depth, Tips, Speed)
// ----------------------------
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
      baits: ["Small hoochies", "Small spinners (wedding ring)", "Corn with scent (where used)"],
      rigs: ["Dodger + leader + hoochie/spinner", "Weights or downrigger to match marks"],
      Mid: ["Troll dodger plus small hoochie or spinner behind it.", "Run scent and tune speed until you get a steady rod thump."]
    },
    "Rainbow trout": {
      temp: "45 to 65 F",
      baits: ["Small spoons", "Inline spinners", "Floating minnows", "Worms (where legal)", "PowerBait (where legal)"],
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
      baits: ["Walking baits", "Poppers", "Jerkbaits", "Swimbaits", "Ned rigs", "Tubes", "Drop shot plastics"],
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
      baits: ["Crankbaits (trolling)", "Jigs with soft plastics", "Jigs with crawler (where used)", "Blade baits"],
      rigs: ["Jig and soft plastic", "Bottom bouncer + harness (where used)", "Trolling crankbaits on breaks"],
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
      Bottom: ["Soak bait on scent trails. Target holes, outside bends, slow water near current."]
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
        info.baits.map(function (x) { return "<li>" + escHtml(x) + "</li>"; }).join("") +
        "</ul></div>";
    }

    if (info.rigs && info.rigs.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Common rigs</strong></div><ul class="list">' +
        info.rigs.map(function (x) { return "<li>" + escHtml(x) + "</li>"; }).join("") +
        "</ul></div>";
    }

    if (info.Top && info.Top.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Topwater</strong></div><ul class="list">' +
        info.Top.map(function (x) { return "<li>" + escHtml(x) + "</li>"; }).join("") +
        "</ul></div>";
    }
    if (info.Mid && info.Mid.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Mid water</strong></div><ul class="list">' +
        info.Mid.map(function (x) { return "<li>" + escHtml(x) + "</li>"; }).join("") +
        "</ul></div>";
    }
    if (info.Bottom && info.Bottom.length) {
      html +=
        '<div class="card compact"><div class="small"><strong>Bottom</strong></div><ul class="list">' +
        info.Bottom.map(function (x) { return "<li>" + escHtml(x) + "</li>"; }).join("") +
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
// Boot
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

  if (!isIsoDate(state.homeDate)) state.homeDate = isoTodayLocal();

  renderConsentBannerIfNeeded();
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// ============================
