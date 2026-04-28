// ============================
// app.js (PART 1 OF 4) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Streamlined build
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

"use strict";

/*
  Single-file vanilla JS app.

  Expects an index.html with ONE root:
    <main id="app"></main>
    <script src="app.js" defer></script>

  Changes in this build:
  - Removed water type logic.
  - Removed craft logic.
  - Kept the same look and layout style.
  - Restored original-style wind chart.
  - Restored dropdown species tips.
*/

const APP_VERSION = "Beta 1.0";

const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";

// ----------------------------
// Analytics consent (GA4)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const CONSENT_KEY = "fishynw_ga_consent_v1";
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
  dateIso: ""
};

// ----------------------------
// DOM
// ----------------------------
let app = null;

// ----------------------------
// Styles
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

  .meterBar {
    margin-top:10px;
    height: 16px;
    border-radius: 999px;
    overflow:hidden;
    border: 1px solid rgba(0,0,0,0.12);
    display:flex;
  }

  .meterSeg { height:100%; }
  .segG { width:34%; background: rgba(143,209,158,0.8); }
  .segY { width:33%; background: rgba(255,214,102,0.85); }
  .segR { width:33%; background: rgba(244,163,163,0.88); }

  .meterNeedle {
    position:absolute;
    top:-7px;
    width: 0;
    height: 0;
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
    left: 0;
    right: 0;
    bottom: 0;
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

  .grid2 {
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

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
// ============================

// ----------------------------
// NOAA Alerts (NWS)
// ----------------------------
async function fetchNOAAAlerts(lat, lon) {
  try {
    // Get grid endpoint first
    const pointUrl =
      "https://api.weather.gov/points/" +
      encodeURIComponent(lat) +
      "," +
      encodeURIComponent(lon);

    const pointData = await fetchJson(pointUrl, 12000);

    const alertsUrl =
      pointData &&
      pointData.properties &&
      pointData.properties.forecastZone
        ? pointData.properties.forecastZone.replace(
            "/zones/",
            "/alerts/active?zone="
          )
        : null;

    if (!alertsUrl) return [];

    const alertsData = await fetchJson(alertsUrl, 12000);

    const features = alertsData && alertsData.features ? alertsData.features : [];

    return features.map(function (f) {
      const p = f.properties || {};
      return {
        event: p.event || "Weather Alert",
        headline: p.headline || "",
        severity: p.severity || "",
        url: p.uri || ""
      };
    });
  } catch (e) {
    return [];
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

  return {
    days: daily && daily.time ? daily.time : [],
    sunrise: daily && daily.sunrise ? daily.sunrise : [],
    sunset: daily && daily.sunset ? daily.sunset : []
  };
}

function sunForDate(sunData, dateIso) {
  if (!sunData || !sunData.days || !sunData.days.length) return null;

  const idx = sunData.days.indexOf(dateIso);
  if (idx < 0) return null;

  const sr = sunData.sunrise && sunData.sunrise[idx] ? sunData.sunrise[idx] : null;
  const ss = sunData.sunset && sunData.sunset[idx] ? sunData.sunset[idx] : null;

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

// ----------------------------
// Forecast cache
// ----------------------------
const forecastCache = {
  key: "",
  ts: 0,
  wx: null,
  sun: null
};

const FORECAST_TTL_MS = 10 * 60 * 1000;

function cacheKey(lat, lon) {
  return (
    String(Number(lat).toFixed(4)) +
    "," +
    String(Number(lon).toFixed(4))
  );
}

async function getForecastBundle(lat, lon) {
  const k = cacheKey(lat, lon);
  const now = Date.now();
  const alerts = await fetchNOAAAlerts(lat, lon);
  
  if (
    forecastCache.key === k &&
    forecastCache.wx &&
    forecastCache.sun &&
    now - forecastCache.ts < FORECAST_TTL_MS
  ) {
    return {
      wx: forecastCache.wx,
      sun: forecastCache.sun,
      fromCache: true
    };
    return {
  wx: wx,
  sun: sun,
  alerts: alerts, // <-- ADD
  fromCache: false
};
  }

  const wx = await fetchWeatherWindMulti(lat, lon);
  const sun = await fetchSunTimesMulti(lat, lon);

  forecastCache.key = k;
  forecastCache.ts = now;
  forecastCache.wx = wx;
  forecastCache.sun = sun;

  return {
    wx: wx,
    sun: sun,
    fromCache: false
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
    '    <a class="logo" href="https://fishynw.com" target="_blank" rel="noopener">' +
    '      <img src="' +
    escHtml(LOGO_URL) +
    '" alt="FishyNW">' +
    "    </a>" +
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

  if (state.tool !== "Home") {
    items.push(["Home", "Home"]);
  }

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
// UI: Location Picker
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
        placeholder="Example: Spokane, WA or 99201 or Hauser Lake" />

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

        if (typeof onResolved === "function") {
          onResolved("auto_cleared_by_typing");
        }
      }

      if (!val) {
        clearResolvedLocation();
        matchesEl.innerHTML = "";
        usingEl.textContent = "";

        if (typeof onResolved === "function") {
          onResolved("auto_cleared_empty");
        }
      }
    }
  });

  function doGps() {
    if (!navigator.geolocation) {
      usingEl.textContent = "Geolocation not supported.";
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

        if (typeof onResolved === "function") {
          onResolved("gps");
        }

        reverseGeocode(lat, lon).then(function (label) {
          if (label) {
            setResolvedLocation(lat, lon, label);
            placeInput.value = label;
          } else {
            placeInput.value = "Current location";
          }

          renderUsing();

          if (typeof onResolved === "function") {
            onResolved("gps_reverse");
          }
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

        if (typeof onResolved === "function") {
          onResolved("search_pick");
        }
      });

    usingEl.textContent = "";
  });

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
// ============================

// ----------------------------
// Home logic helpers
// ----------------------------
function computeBestFishingWindows(sunrise, sunset) {
  const out = [];

  const dawnStart = new Date(sunrise.getTime() - 90 * 60 * 1000);
  const dawnEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);

  out.push({
    name: "Dawn window",
    start: dawnStart,
    end: dawnEnd
  });

  const duskStart = new Date(sunset.getTime() - 60 * 60 * 1000);
  const duskEnd = new Date(sunset.getTime() + 90 * 60 * 1000);

  out.push({
    name: "Dusk window",
    start: duskStart,
    end: duskEnd
  });

  const midStart = new Date(sunrise);
  midStart.setHours(12, 0, 0, 0);

  const midEnd = new Date(sunrise);
  midEnd.setHours(13, 0, 0, 0);

  out.push({
    name: "Midday (minor)",
    start: midStart,
    end: midEnd
  });

  return out;
}

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
    "GO: Science demands you test if snacks taste better on the water. They do.",
    "GO: Staying home would allow your gear to win the staring contest."
  ];

  const cautionReasons = [
    "CAUTION: The wind looks friendly, but it has trust issues. Keep a backup plan.",
    "CAUTION: Mother Nature is in a mood. You can go, but do not argue with her.",
    "CAUTION: This is a stay close to shore kind of day. The fish will understand.",
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

function computeGoStatus(inputs) {
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const avgF = (tmin + tmax) / 2;

  const goWind = 10;
  const cautionWind = 14;
  const nogoWind = 18;

  const goGust = 18;
  const cautionGust = 22;
  const nogoGust = 28;

  function scoreFromThresholds(value, g, c, n) {
    if (value <= g) return 0;
    if (value >= n) return 100;
    if (value <= c) return ((value - g) / Math.max(1, c - g)) * 45;

    return 45 + ((value - c) / Math.max(1, n - c)) * 55;
  }

  const sWind = scoreFromThresholds(windMax, goWind, cautionWind, nogoWind);
  const sGust = scoreFromThresholds(gustMax, goGust, cautionGust, nogoGust);

  let score = Math.max(sWind, sGust);

  let coldFloor = 0;

  if (avgF < 55) {
    const windAmp = Math.max(0, windMax - 5) * 0.8;

    if (avgF >= 50) coldFloor = 18 + windAmp;
    else if (avgF >= 45) coldFloor = 35 + windAmp;
    else if (avgF >= 40) coldFloor = 45 + windAmp;
    else coldFloor = 65 + windAmp;

    coldFloor = Math.max(0, Math.min(100, coldFloor));
  }

  score = Math.max(score, coldFloor);

  let forceAtLeastCaution = false;
  let forceNoGo = false;

  if (avgF <= 49) forceAtLeastCaution = true;
  if (tmin <= 28 || avgF <= 35) forceNoGo = true;

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

  const seedStr =
    String(inputs.seed || "") +
    "|" +
    String(label) +
    "|" +
    String(Math.round(windMax)) +
    "|" +
    String(Math.round(gustMax)) +
    "|" +
    String(Math.round(tmin)) +
    "|" +
    String(Math.round(tmax));

  let msg = pickFunnyReason(label, seedStr);

  if (avgF <= 49 && label !== "NO-GO") {
    msg += " Cold air and cold water increase risk. Dress for immersion and stay conservative.";
  }

  if (forceNoGo) {
    msg += " Extreme cold can turn a minor problem into an emergency quickly.";
  }

  return {
    label: label,
    score: score,
    needlePct: needlePct,
    message: msg
  };
}

function computeExposureTips(inputs) {
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const avgF = (tmin + tmax) / 2;

  const tips = [];

  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  tips.push("Bring a dry bag with a spare layer and gloves. Keep keys and phone in a waterproof pouch.");

  if (avgF <= 50) {
    tips.unshift("Avoid cotton layers. Use synthetics or wool that insulate when wet.");
    tips.unshift("Cold air and likely cold water: lean toward a dry suit or proper wet suit setup.");

    if (avgF <= 40) {
      tips.unshift("Neoprene gloves and boots help. Limit exposure time and keep shore close.");
    }
  }

  if (tmax >= 78) {
    tips.unshift("Hot day: wear sun shirts and light sun protective clothing. Use a wide brim hat.");
    tips.unshift("Hydrate early. Bring more water than you think you need.");
  }

  if (windMax >= 12 || gustMax >= 20) {
    tips.push("Wind can spike fast. Leash key gear and plan a protected return route.");
  }

  return tips;
}

// ----------------------------
// Home
// ----------------------------
function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="small muted">Pick a date up to 7 days out. Set location and the app builds tiles, wind chart, and fishing windows.</div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Date</div>
        <input id="home_date" type="date" />
        <div class="small muted" style="margin-top:8px;">Forecast is typically available for the next 7 days.</div>
      </div>
    </div>
  `
  );

  const dateInput = document.getElementById("home_date");

  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  dateInput.value = state.dateIso;

  dateInput.addEventListener("change", function () {
    const v = String(dateInput.value || "").trim();

    if (isIsoDate(v)) {
      state.dateIso = v;
    }

    renderHomeDynamic("date_change");
  });

  renderLocationPicker(
    page,
    "home",
    function () {
      renderHomeDynamic("location_resolved");
    },
    { autoGps: true }
  );

  appendHtml(page, '<div id="home_dynamic"></div>');

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
        '<div class="card"><strong>Could not load data.</strong>' +
        '<div class="small muted">Make sure the page is HTTPS. If this persists, the request may be blocked or the network is unstable.</div>' +
        '<div class="small muted" style="margin-top:6px;">' +
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
        '<div style="margin-top:10px;"><button id="jump_first_available">Jump to first available</button></div>' +
        "</div>";

      const jumpBtn = document.getElementById("jump_first_available");

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

    const windows = sunFor
      ? computeBestFishingWindows(sunFor.sunrise, sunFor.sunset)
      : [];

    const seed =
      String(useIso) +
      "|" +
      String(Number(state.lat).toFixed(3)) +
      "," +
      String(Number(state.lon).toFixed(3));

    const status = computeGoStatus({
      seed: seed,
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

    const pointsRaw = filterHourlyToDate(
      wx.hourly.time || [],
      wx.hourly.wind || [],
      useIso
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

    dyn.innerHTML = "";

    const precipDisplay = popIsFinite
      ? String(Math.round(popMax)) + " %"
      : "None";

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
            <div class="tileTop">Rain chance</div>
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
          <div class="sectionTitle">Fishing status</div>
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
      if (status.label === "GO") {
        pill.style.background = "rgba(143,209,158,0.55)";
      }

      if (status.label === "CAUTION") {
        pill.style.background = "rgba(255,214,102,0.65)";
      }

      if (status.label === "NO-GO") {
        pill.style.background = "rgba(244,163,163,0.70)";
      }
    }

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Hourly wind</h3>
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
            <option>15</option>
            <option>20</option>
            <option>25</option>
            <option>30</option>
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
            Line type affects drag and sink behavior. Lead core is still only an estimate.
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
          : t <= 15
            ? 0.90
            : t <= 20
              ? 0.85
              : t <= 25
                ? 0.80
                : 0.76;

    const lt = String(lineType || "").toLowerCase();

    if (lt.indexOf("braid") >= 0) {
      if (t >= 50) f = Math.max(f, 0.86);
      else if (t >= 40) f = Math.max(f, 0.88);
      else if (t >= 30) f = Math.max(f, 0.90);
      else if (t >= 25) f = Math.max(f, 0.92);
      else if (t >= 20) f = Math.max(f, 0.94);
      else if (t >= 15) f = Math.max(f, 0.96);
    }

    if (lt.indexOf("fluoro") >= 0) {
      f = f * 0.99;
    }

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
// Species Tips
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();

const tips = [
  {
    name: "Largemouth Bass",
    range: "55 to 75 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Largemouth_bass_01.jpg",
    credit: "Largemouth bass 01 - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Largemouth_bass_01.jpg",
    text: "Largemouth bass are cover-oriented fish that use weeds, docks, wood, shade, shallow flats, and warm protected pockets. In early spring, around 45 to 55 F, they often stage outside spawning areas near breaks or deeper cover. From about 55 to 65 F, they push shallow for pre-spawn feeding. Spawning often happens around 60 to 70 F. In summer, they commonly hold in shade, weeds, docks, or deeper edges during the day and feed shallower early and late. In fall, they chase bait more aggressively as water cools back through the 60s.",
    tips: "In spring, find the warmest protected water first. Fish slowly around cover until the bite improves. In summer, fish early, late, or around shade. Skip empty-looking banks and focus on docks, weed edges, laydowns, pads, and points with quick access to deeper water.",
    baits: "Wacky rigs, Texas rigs, jigs, frogs, chatterbaits, spinnerbaits, crankbaits, and topwater."
  },
  {
    name: "Smallmouth Bass",
    range: "50 to 70 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Smallmouth_bass.jpg",
    credit: "Smallmouth bass - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Smallmouth_bass.jpg",
    text: "Smallmouth bass prefer rock, gravel, points, humps, ledges, and clear water structure. In early spring, around 40 to 50 F, they hold deeper near staging areas. From about 50 to 60 F, they move toward rocky flats and gravel banks. Spawning often happens around 55 to 65 F. In summer, they may hold deeper on humps, ledges, and points but will still move shallow to feed, especially with wind or low light. In fall, they follow baitfish and can become very aggressive.",
    tips: "Wind is your friend for smallmouth. Fish windblown rock, points, and gravel transitions. Use long casts in clear water. If fish follow but do not commit, downsize or switch to finesse. If you catch one, work the area carefully because smallmouth often group up.",
    baits: "Tubes, drop shots, Ned rigs, jerkbaits, crankbaits, small swimbaits, finesse jigs, and grubs."
  },
  {
    name: "Kokanee",
    range: "45 to 60 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Sammamish_kokanee_(51666400632).jpg",
    credit: "Sammamish kokanee - Roger Tabor/USFWS, Wikimedia Commons, CC BY 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Sammamish_kokanee_(51666400632).jpg",
    text: "Kokanee are landlocked sockeye salmon that usually suspend over open water rather than holding to structure. They often prefer water around 48 to 54 F, but their actual depth changes by lake, season, light, and plankton movement. In spring, they may be high in the water column. As lakes warm and stratify, they usually move deeper and may hold anywhere from 20 to 80 feet or more. Late in the season, mature fish begin changing color and behavior as they prepare to spawn.",
    tips: "Depth control matters more than almost anything. Use electronics to find schools, then keep your gear slightly above the fish because kokanee often feed upward. Troll around 1.0 to 1.5 mph and make gradual turns, because the inside and outside rods change speed and often trigger strikes. If you get short bites, change scent, leader length, hook size, or dodger action before leaving the school.",
    baits: "Dodgers, hoochies, wedding rings, small spinners, corn, scent, small spoons, and light leaders."
  },
  {
    name: "Rainbow Trout",
    range: "45 to 65 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Rainbow_Trout.jpg",
    credit: "Rainbow trout - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Rainbow_Trout.jpg",
    text: "Rainbow trout are mobile feeders that move with temperature, oxygen, and food. In cooler water, especially spring and fall, they may cruise near the surface or along shorelines. As surface temps climb into the upper 60s and beyond, they often slide deeper or move near cooler inflows. Wind can push food toward banks and make trout more willing to feed shallow.",
    tips: "Cover water until you find active fish. In spring, start shallow with long lines or light trolling weights. In summer, work deeper or fish early and late. Look for inlets, points, windblown banks, shade lines, and areas where insects or baitfish are concentrated.",
    baits: "Spoons, spinners, wedding rings, trolling flies, worms, PowerBait, small plugs, and flies."
  },
  {
    name: "Lake Trout",
    range: "38 to 52 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Lake_trout.jpg",
    credit: "Lake trout - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Lake_trout.jpg",
    text: "Lake trout are cold-water predators that often live deep, especially once surface water warms. In spring, they may be shallower while the whole lake is still cold. Later, they usually move to deep points, shelves, humps, steep breaks, and areas with bait. They can be very depth-specific, and a difference of only a few feet can matter.",
    tips: "Use electronics heavily. Do not just troll empty water. Find bait, marks, bottom transitions, or suspended fish. For jigging, drop directly on fish and vary cadence from subtle shakes to aggressive rips. For trolling, keep gear close to the marked depth and stay near structure.",
    baits: "Heavy jigs, tube jigs, spoons, plugs, deep trolling rigs, swimbaits, and baitfish imitations."
  },
  {
    name: "Chinook Salmon",
    range: "42 to 55 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Chinook_salmon.jpg",
    credit: "Chinook salmon - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Chinook_salmon.jpg",
    text: "Chinook salmon are bait and temperature driven. In lakes and reservoirs, they often hold deeper than trout and kokanee and may travel along breaks, channels, and bait corridors. Low light is important, especially early morning. As sun and boat pressure increase, Chinook often drop deeper or become less aggressive.",
    tips: "Fish early and stay disciplined with depth. Mark bait first, then work slightly above or through the feeding zone. Speed can vary, but consistency matters. If fish are present but not biting, change dodger/flasher size, leader length, lure color, scent, or trolling direction.",
    baits: "Flashers, dodgers, hoochies, spoons, plugs, scent, and cut bait where legal."
  },
  {
    name: "Northern Pike",
    range: "50 to 70 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Northern_pike.jpg",
    credit: "Northern pike - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Northern_pike.jpg",
    text: "Northern pike are ambush predators that use weeds, shallow bays, backwaters, channels, and edges. After ice-out and in early spring, they move very shallow to spawn. As water warms, they spread to weed beds and ambush points. In summer, bigger fish may hold near deeper weed edges or cooler water while smaller fish stay shallow.",
    tips: "Cover water until you find active fish. Focus on weed edges, pockets, points, and baitfish. Use pauses in the retrieve because pike often follow before striking. Always use a wire or heavy fluorocarbon leader to prevent bite-offs.",
    baits: "Spinnerbaits, spoons, jerkbaits, swimbaits, chatterbaits, glide baits, and large soft plastics."
  },
  {
    name: "Walleye",
    range: "45 to 70 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Walleye.jpg",
    credit: "Walleye - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Walleye.jpg",
    text: "Walleye are low-light predators that often hold near bottom and relate to structure, current, and bait. In spring, they spawn around rocky or current-influenced areas and then recover nearby. In summer, they may hold on flats, points, humps, drop-offs, or deeper edges during the day and move shallower in low light. Wind can improve the bite by reducing light penetration and moving bait.",
    tips: "Fish early, late, cloudy days, wind, or night when possible. Stay close to bottom unless electronics show suspended fish. Move slowly when jigging. When trolling, use depth control to keep crankbaits or crawler rigs near the strike zone.",
    baits: "Jigs, plastics, crawlers, crankbaits, bottom bouncers, blade baits, and trolling plugs."
  },
  {
    name: "Yellow Perch",
    range: "50 to 70 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Yellow_perch.jpg",
    credit: "Yellow perch - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Yellow_perch.jpg",
    text: "Yellow perch are schooling fish that often relate to weeds, flats, soft bottom transitions, and deeper basins. In spring, they may move shallow to spawn. In summer, schools can spread along weed edges or suspend near food. In fall, they often group tighter and feed heavily before winter.",
    tips: "Once you catch one, slow down and work the area because perch schools can be tight. Use small hooks and light line. If you get small fish constantly, move slightly deeper or to the edge of the school for better fish.",
    baits: "Small jigs, worms, maggots, tiny spoons, perch meat where legal, and small plastics."
  },
  {
    name: "Crappie",
    range: "55 to 70 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Crappie.jpg",
    credit: "Crappie - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Crappie.jpg",
    text: "Crappie relate to brush, docks, weeds, timber, and suspended cover. In spring, they move shallow to spawn when water warms into the upper 50s and 60s. After spawning, they often suspend near deeper cover. Summer crappie may be in shade, under docks, near brush piles, or suspended over deeper water.",
    tips: "Fish slow and stay vertical when possible. Crappie often want a bait held above them, not below them. If the bite is light, use a slip bobber or tiny jig and reduce movement. Electronics help a lot for suspended schools.",
    baits: "Small jigs, tubes, minnows, slip bobbers, tiny swimbaits, hair jigs, and small plastics."
  },
  {
    name: "Bluegill",
    range: "65 to 80 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Bluegill.jpg",
    credit: "Bluegill - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Bluegill.jpg",
    text: "Bluegill are warm-water panfish that use weeds, docks, shallow cover, and protected banks. They often spawn in colonies when water warms into the upper 60s and 70s. Small bluegill may be very shallow, while larger fish often hold slightly deeper or on the outside edge of cover.",
    tips: "Use small hooks because bluegill have small mouths. For better fish, move away from the obvious shallow schools and fish slightly deeper weed edges or shade. Light line makes a big difference.",
    baits: "Worms, tiny jigs, small flies, micro plastics, wax worms, and bobber rigs."
  },
  {
    name: "Channel Catfish",
    range: "65 to 85 F",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Channel_catfish.jpg",
    credit: "Channel catfish - Wikimedia Commons",
    source: "https://commons.wikimedia.org/wiki/File:Channel_catfish.jpg",
    text: "Channel catfish are scent-driven predators and scavengers that feed best in warmer water. They often become more active as water climbs through the 60s and 70s. Evening, night, stained water, current, and scent movement can all improve the bite. They use channels, holes, flats, current seams, and feeding lanes.",
    tips: "Fish where scent can travel naturally, such as current seams, points, channels, and wind-blown areas. Let the fish load the rod before setting, especially with circle hooks. If you get taps but no hookup, wait longer or downsize bait.",
    baits: "Cut bait, worms, stink bait, shrimp, chicken liver, punch bait, prepared bait, and legal baitfish."
  }
];

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Species Tips</h2>
      <div class="small muted">Select a species for details.</div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Species</div>
        <select id="species_select"></select>
      </div>

      <div id="species_card"></div>
    </div>
  `
  );

  const select = document.getElementById("species_select");
  const card = document.getElementById("species_card");

  tips.forEach((t, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = t.name;
    select.appendChild(opt);
  });

  function renderSelected() {
    const t = tips[select.value] || tips[0];

    card.innerHTML =
      '<div class="card compact">' +
      '<h3>' + escHtml(t.name) + '</h3>' +

      '<img src="' + escHtml(t.image) + '" style="width:100%;border-radius:12px;margin-top:10px;">' +

      '<div class="small muted" style="margin-top:6px;">' +
      'Image: <a href="' + escHtml(t.source) + '" target="_blank">View source</a><br>' +
      escHtml(t.credit) +
      '</div>' +

      '<div class="small muted" style="margin-top:6px;"><strong>Temp range:</strong> ' + escHtml(t.range) + '</div>' +

      '<div class="sectionTitle">Behavior</div>' +
      '<p>' + escHtml(t.text) + '</p>' +

      '<div class="sectionTitle">Tips</div>' +
      '<p>' + escHtml(t.tips) + '</p>' +

      '<div class="sectionTitle">Baits</div>' +
      '<p>' + escHtml(t.baits) + '</p>' +

      '</div>';
  }

  select.addEventListener("change", renderSelected);
  renderSelected();
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
      <div class="small muted">Uses GPS when available. Best outdoors with a clear sky view.</div>

      <div class="tilesGrid">
        <div class="tile">
          <div class="tileTop">Speed</div>
          <div class="tileVal" id="speed_mph">--</div>
          <div class="tileSub">mph</div>
        </div>

        <div class="tile">
          <div class="tileTop">Accuracy</div>
          <div class="tileVal" id="speed_acc">--</div>
          <div class="tileSub">feet</div>
        </div>
      </div>

      <div class="btnRow">
        <button id="speed_start">Start</button>
        <button id="speed_stop">Stop</button>
      </div>

      <div id="speed_msg" class="small muted" style="margin-top:10px;"></div>
    </div>
  `
  );

  const speedEl = document.getElementById("speed_mph");
  const accEl = document.getElementById("speed_acc");
  const msgEl = document.getElementById("speed_msg");

  document.getElementById("speed_start").addEventListener("click", function () {
    if (!navigator.geolocation) {
      msgEl.textContent = "Geolocation is not supported.";
      return;
    }

    stopSpeedWatchIfRunning();

    msgEl.textContent = "Starting GPS...";

    state.speedWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        const coords = pos.coords || {};
        const speedMeters = Number(coords.speed);
        const accuracyMeters = Number(coords.accuracy);

        let mph = 0;

        if (Number.isFinite(speedMeters) && speedMeters >= 0) {
          mph = speedMeters * 2.236936;
        }

        speedEl.textContent = mph.toFixed(1);

        if (Number.isFinite(accuracyMeters)) {
          accEl.textContent = Math.round(accuracyMeters * 3.28084);
        } else {
          accEl.textContent = "--";
        }

        msgEl.textContent = "GPS active.";
      },
      function (err) {
        msgEl.textContent = "GPS error: " + String(err.message || err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 500
      }
    );
  });

  document.getElementById("speed_stop").addEventListener("click", function () {
    stopSpeedWatchIfRunning();
    msgEl.textContent = "GPS stopped.";
  });
}

// ----------------------------
// Main render
// ----------------------------
function render() {
  renderHeaderAndNav();

  if (state.tool === "Home") {
    renderHome();
    return;
  }

  if (state.tool === "Trolling depth calculator") {
    renderDepthCalculator();
    return;
  }

  if (state.tool === "Species tips") {
    renderSpeciesTips();
    return;
  }

  if (state.tool === "Speedometer") {
    renderSpeedometer();
    return;
  }

  renderHome();
}

// ----------------------------
// Boot
// ----------------------------
function boot() {
  app = document.getElementById("app");

  if (!app) {
    throw new Error('Missing <main id="app"></main>');
  }

  const last = loadLastLocation();

  if (last) {
    state.lat = last.lat;
    state.lon = last.lon;
    state.placeLabel = last.label;
  }

  if (!isIsoDate(state.dateIso)) {
    state.dateIso = isoTodayLocal();
  }

  render();
  renderConsentBannerIfNeeded();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// ============================
// app.js (PART 4 OF 4) END
// ============================
