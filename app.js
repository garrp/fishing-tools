// app.js
// FishyNW.com - Fishing Tools (Web)
// Version 1.0.2
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.

"use strict";

/*
  Single-file vanilla JS app.

  Expects an index.html with ONE root:
    <main id="app"></main>
    <script src="app.js"></script>

  Notes:
  - Uses Open-Meteo for sunrise/sunset and wind.
  - Uses Open-Meteo Geocoding for place search.
  - Uses browser geolocation for "Use my location".
  - Reverse geocodes GPS lat/lon to a nearest city label when possible.
  - On mobile: header stacks, nav is a clean 2-column grid.
  - Best times auto-displays as soon as location is acquired (no extra button).
  - GA4 loads ONLY after user accepts the consent banner.
*/

const APP_VERSION = "1.0.2";
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

  // Add bottom padding so the banner does not cover content
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
// Shared state
// ----------------------------
const state = {
  tool: "Best fishing times",
  lat: null,
  lon: null,
  placeLabel: "",
  matches: [],
  selectedIndex: 0,
  speedWatchId: null,
  bigWater: false
};

// ----------------------------
// DOM
// ----------------------------
const app = document.getElementById("app");

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

  .nav { margin-top: 12px; margin-bottom: 10px; display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }

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

  .dangerBtn { background:#f4a3a3 !important; border-color:#e48f8f !important; color:#3b0a0a !important; }
  .dangerBtn:hover { background:#ee8f8f !important; }

  .goBtn { background:#8fd19e !important; border-color:#6fbf87 !important; color:#0b2e13 !important; }
  .cautionBtn { background:#f1c40f !important; border-color:#d4ab0d !important; color:#3b2a00 !important; }
  .noGoBtn { background:#e74c3c !important; border-color:#cf3f31 !important; color:#2b0704 !important; }

  /* 2x2 summary blocks */
  .grid2 {
    display:grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-top: 10px;
  }
  .miniBox {
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(0,0,0,0.03);
    border-radius: 14px;
    padding: 12px;
    text-align: center;
  }
  .miniLbl { font-size: 13px; opacity: 0.80; }
  .miniVal { font-size: 28px; font-weight: 900; line-height: 1.0; margin-top: 6px; }

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

    .consentInner { flex-direction: column; align-items: stretch; }
    .consentBtns { justify-content: stretch; min-width: 0; }
    .consentBtn { width: 100%; }

    .grid2 { grid-template-columns: 1fr; }
    .miniVal { font-size: 26px; }
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
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
}

function normalizePlaceQuery(s) {
  const x = String(s || "").trim().split(/\s+/).join(" ");
  return x;
}

function formatMDTime(dt) {
  // 1/23 2 AM
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  let h = dt.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return m + "/" + d + " " + h + " " + ampm;
}

function degToCompass(deg) {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW"
  ];
  if (!Number.isFinite(Number(deg))) return "";
  const i = Math.floor((Number(deg) / 22.5) + 0.5) % 16;
  return dirs[i];
}

// Wind rating (same thresholds as your Streamlit tool)
function computeWindRating(speedMph, gustMph, bigWater) {
  const s = Number(speedMph);
  const g = Number(gustMph);

  if (!bigWater) {
    if (s >= 16 || g >= 23) return "NO GO";
    if (s > 10 || g > 15) return "CAUTION";
    return "GO";
  }

  if (s >= 13 || g >= 19) return "NO GO";
  if (s > 8 || g > 12) return "CAUTION";
  return "GO";
}

function ratingBtnClass(r) {
  if (r === "GO") return "goBtn";
  if (r === "CAUTION") return "cautionBtn";
  return "noGoBtn";
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
// API: Best times
// ----------------------------
async function fetchSunTimes(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&daily=sunrise,sunset&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();
  const sr =
    data && data.daily && data.daily.sunrise ? data.daily.sunrise[0] : null;
  const ss =
    data && data.daily && data.daily.sunset ? data.daily.sunset[0] : null;
  if (!sr || !ss) return null;

  return {
    sunrise: new Date(sr),
    sunset: new Date(ss)
  };
}

// ----------------------------
// API: Wind (hourly + daily summary)
// ----------------------------
async function fetchWind(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();

  const h = (data && data.hourly) || {};
  const d = (data && data.daily) || {};

  return {
    hourly: {
      times: h.time || [],
      speeds: h.wind_speed_10m || [],
      gusts: h.wind_gusts_10m || [],
      dirs: h.wind_direction_10m || []
    },
    daily: {
      time: d.time || [],
      tmax: d.temperature_2m_max || [],
      tmin: d.temperature_2m_min || [],
      rain: d.precipitation_probability_max || [],
      maxWind: d.wind_speed_10m_max || [],
      maxGust: d.wind_gusts_10m_max || []
    }
  };
}

function splitCurrentFutureWind(times, speeds, gusts, dirs) {
  const now = new Date();
  const current = [];
  const future = [];

  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i]);

    const mph = Number(speeds[i]);
    const gst = Number(gusts[i]);
    const dirDeg = Number(dirs[i]);

    if (!Number.isFinite(mph)) continue;
    if (!Number.isFinite(gst)) continue;

    const label = formatMDTime(dt);

    const item = {
      label: label,
      mph: mph.toFixed(1),
      gust: gst.toFixed(1),
      dir: degToCompass(dirDeg),
      rating: computeWindRating(mph, gst, state.bigWater),
      score: mph + gst,
      dt: dt
    };

    if (dt <= now) current.push(item);
    else future.push(item);
  }

  return {
    current: current.slice(-6),
    future: future.slice(0, 12)
  };
}

function pickTodayDailySummary(daily) {
  // Use local date of the browser. Open-Meteo "timezone=auto" should align times,
  // but daily time is in YYYY-MM-DD, so this is a solid default.
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const key = y + "-" + m + "-" + d;

  const idx = (daily.time || []).indexOf(key);
  if (idx < 0) return null;

  function safeNum(arr) {
    const v = arr && arr.length > idx ? Number(arr[idx]) : NaN;
    return Number.isFinite(v) ? v : NaN;
  }

  const maxWind = safeNum(daily.maxWind);
  const maxGust = safeNum(daily.maxGust);
  const tmax = safeNum(daily.tmax);
  const tmin = safeNum(daily.tmin);
  const rain = safeNum(daily.rain);

  if (
    !Number.isFinite(maxWind) &&
    !Number.isFinite(maxGust) &&
    !Number.isFinite(tmax) &&
    !Number.isFinite(tmin) &&
    !Number.isFinite(rain)
  ) {
    return null;
  }

  return {
    maxWind: maxWind,
    maxGust: maxGust,
    tmax: tmax,
    tmin: tmin,
    rain: rain
  };
}

// ----------------------------
// UI: Header + Nav
// ----------------------------
const PAGE_TITLES = {
  "Best fishing times": "Best Fishing Times",
  "Wind forecast": "Wind Forecast",
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
  const items = [
    ["Times", "Best fishing times"],
    ["Wind", "Wind forecast"],
    ["Depth", "Trolling depth calculator"],
    ["Tips", "Species tips"],
    ["Speed", "Speedometer"]
  ];

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
// onResolved is optional callback fired when we have lat/lon
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
    </div>
  `
  );

  const usingEl = document.getElementById(placeKey + "_using");
  const matchesEl = document.getElementById(placeKey + "_matches");
  const placeInput = document.getElementById(placeKey + "_place");

  // Autofill input if we already have a location
  if (hasResolvedLocation()) {
    const lbl = state.placeLabel
      ? state.placeLabel
      : "Lat " + state.lat.toFixed(4) + ", Lon " + state.lon.toFixed(4);

    placeInput.value = state.placeLabel ? state.placeLabel : "Current location";
    usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(lbl);
    if (typeof onResolved === "function") onResolved();
  }

  document
    .getElementById(placeKey + "_gps")
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

          // Immediate feedback + autofill input
          placeInput.value = "Locating nearest city...";
          usingEl.innerHTML =
            "<strong>Using:</strong> Current location (" +
            lat.toFixed(4) +
            ", " +
            lon.toFixed(4) +
            ")";

          if (typeof onResolved === "function") onResolved();

          // Try to resolve nearest city/town name
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

            if (typeof onResolved === "function") onResolved();
          });
        },
        function (err) {
          usingEl.innerHTML =
            "<strong>Location error:</strong> " + escHtml(err.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 }
      );
    });

  document
    .getElementById(placeKey + "_search")
    .addEventListener("click", async function () {
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
        '<select id="' +
        placeKey +
        '_select">' +
        optionsHtml +
        "</select>" +
        '<div style="margin-top:10px;">' +
        '<button id="' +
        placeKey +
        '_use" style="width:100%;">Use this place</button>' +
        "</div>";

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

          // Autofill input with chosen place label
          placeInput.value = chosen.label;

          usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(chosen.label);

          if (typeof onResolved === "function") onResolved();
        });

      usingEl.textContent = "Pick the correct match, then tap Use this place.";
    });
}

// ----------------------------
// Pages
// ----------------------------
function renderBestTimesPage() {
  const page = pageEl();
  page.innerHTML =
    '<div class="card">' +
    "  <h2>Best Fishing Times</h2>" +
    '  <div class="small">Pick a location and times will display automatically.</div>' +
    "</div>";

  renderLocationPicker(page, "times", autoLoadTimes);

  appendHtml(
    page,
    `
    <div class="card">
      <div id="times_out" style="margin-top:0;"></div>
    </div>
  `
  );

  async function autoLoadTimes() {
    const out = document.getElementById("times_out");
    if (!out) return;

    if (!hasResolvedLocation()) {
      out.innerHTML =
        '<div class="small">Pick a place or use your location to see times.</div>';
      return;
    }

    out.textContent = "Loading...";
    try {
      const sun = await fetchSunTimes(state.lat, state.lon);
      if (!sun) {
        out.textContent = "Could not load sunrise/sunset. Try again.";
        return;
      }

      const sunrise = sun.sunrise;
      const sunset = sun.sunset;

      const morningStart = new Date(sunrise.getTime() - 60 * 60 * 1000);
      const morningEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
      const eveningStart = new Date(sunset.getTime() - 60 * 60 * 1000);
      const eveningEnd = new Date(sunset.getTime() + 60 * 60 * 1000);

      out.innerHTML =
        '<div class="card compact">' +
        '  <div class="small"><strong>Morning Window</strong></div>' +
        '  <div style="font-size:20px;font-weight:900;">' +
        escHtml(formatTime(morningStart)) +
        " - " +
        escHtml(formatTime(morningEnd)) +
        "</div>" +
        "</div>" +
        '<div class="card compact">' +
        '  <div class="small"><strong>Evening Window</strong></div>' +
        '  <div style="font-size:20px;font-weight:900;">' +
        escHtml(formatTime(eveningStart)) +
        " - " +
        escHtml(formatTime(eveningEnd)) +
        "</div>" +
        "</div>";
    } catch (e) {
      out.textContent = "Could not load sunrise/sunset. Try again.";
    }
  }

  // If we already have a location, show immediately
  autoLoadTimes();
}

function renderWindPage() {
  const page = pageEl();
  page.innerHTML =
    '<div class="card">' +
    "  <h2>Wind Forecast</h2>" +
    '  <div class="small">Current and future wind speeds with gusts. Plus a simple go/no-go style rating.</div>' +
    "</div>";

  // Location picker + big water toggle + display button
  appendHtml(
    page,
    `
    <div class="card">
      <label style="display:flex; align-items:center; gap:10px; font-weight:900;">
        <input id="big_water" type="checkbox" style="width:auto; transform: scale(1.2);">
        Big water (more conservative)
      </label>
      <div class="small" style="margin-top:8px;">Use this for large lakes or open windy stretches.</div>
    </div>
  `
  );

  renderLocationPicker(page, "wind");

  appendHtml(
    page,
    `
    <div class="card">
      <button id="wind_go" class="dangerBtn">Display Winds</button>
      <div id="wind_out" style="margin-top:10px;"></div>
    </div>
  `
  );

  const bigWaterEl = document.getElementById("big_water");
  bigWaterEl.checked = !!state.bigWater;
  bigWaterEl.addEventListener("change", function () {
    state.bigWater = !!bigWaterEl.checked;
  });

  document.getElementById("wind_go").addEventListener("click", async function () {
    const out = document.getElementById("wind_out");
    out.innerHTML = "";

    if (!hasResolvedLocation()) {
      out.textContent = "Pick a place or use your location first.";
      return;
    }

    out.textContent = "Loading...";
    try {
      const w = await fetchWind(state.lat, state.lon);

      const parts = splitCurrentFutureWind(
        w.hourly.times,
        w.hourly.speeds,
        w.hourly.gusts,
        w.hourly.dirs
      );

      // Worst hour rating across current+future slices we show
      const allShown = parts.current.concat(parts.future);
      let worst = null;
      for (let i = 0; i < allShown.length; i++) {
        const item = allShown[i];
        if (!worst || item.score > worst.score) worst = item;
      }
      const overallRating = worst ? worst.rating : "GO";

      let html = "";

      if (parts.current.length) {
        html +=
          '<div class="card compact"><div class="small"><strong>Current winds</strong></div><div style="margin-top:10px;">';
        html += parts.current
          .map(function (x) {
            return (
              escHtml(x.label) +
              ": <strong>" +
              escHtml(x.mph) +
              " mph</strong> (gust " +
              escHtml(x.gust) +
              " mph) " +
              escHtml(x.dir)
            );
          })
          .join("<br>");
        html += "</div></div>";
      }

      if (parts.future.length) {
        html +=
          '<div class="card compact"><div class="small"><strong>Future winds</strong></div><div style="margin-top:10px;">';
        html += parts.future
          .map(function (x) {
            return (
              escHtml(x.label) +
              ": <strong>" +
              escHtml(x.mph) +
              " mph</strong> (gust " +
              escHtml(x.gust) +
              " mph) " +
              escHtml(x.dir)
            );
          })
          .join("<br>");
        html += "</div></div>";
      }

      // Daily summary blocks (Max wind, Max gust, Temp hi/lo, Rain)
      const daily = pickTodayDailySummary(w.daily);
      if (daily) {
        const maxWind = Number.isFinite(daily.maxWind) ? Math.round(daily.maxWind) : null;
        const maxGust = Number.isFinite(daily.maxGust) ? Math.round(daily.maxGust) : null;
        const tmax = Number.isFinite(daily.tmax) ? Math.round(daily.tmax) : null;
        const tmin = Number.isFinite(daily.tmin) ? Math.round(daily.tmin) : null;
        const rain = Number.isFinite(daily.rain) ? Math.round(daily.rain) : null;

        html +=
          '<div class="card">' +
          '  <div class="small"><strong>Today summary</strong></div>' +
          '  <div class="grid2">' +
          '    <div class="miniBox"><div class="miniLbl">Max wind</div><div class="miniVal">' +
          escHtml(maxWind === null ? "--" : String(maxWind)) +
          " mph</div></div>" +
          '    <div class="miniBox"><div class="miniLbl">Max gust</div><div class="miniVal">' +
          escHtml(maxGust === null ? "--" : String(maxGust)) +
          " mph</div></div>" +
          '    <div class="miniBox"><div class="miniLbl">Temp</div><div class="miniVal">' +
          escHtml(
            tmax === null || tmin === null ? "--/--" : String(tmax) + "/" + String(tmin)
          ) +
          " F</div></div>" +
          '    <div class="miniBox"><div class="miniLbl">Rain</div><div class="miniVal">' +
          escHtml(rain === null ? "--" : String(rain)) +
          "%</div></div>" +
          "  </div>" +
          "</div>";
      }

      // Big rating button BELOW the wind table/cards
      html +=
        '<div class="card">' +
        '  <div class="small"><strong>Kayak rating</strong></div>' +
        '  <div style="margin-top:10px;">' +
        '    <button type="button" class="' +
        escHtml(ratingBtnClass(overallRating)) +
        '" disabled>' +
        escHtml(overallRating) +
        "</button>" +
        (worst
          ? '<div class="small" style="margin-top:8px;">Worst shown hour: ' +
            escHtml(worst.label) +
            " (" +
            escHtml(worst.mph) +
            " mph, gust " +
            escHtml(worst.gust) +
            " mph)</div>"
          : "") +
        "  </div>" +
        "</div>";

      out.innerHTML = html || "No wind data returned.";
    } catch (e) {
      out.textContent = "Could not load wind. Try again.";
    }
  });
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

  if (state.tool === "Best fishing times") renderBestTimesPage();
  else if (state.tool === "Wind forecast") renderWindPage();
  else if (state.tool === "Trolling depth calculator") renderTrollingDepthPage();
  else if (state.tool === "Species tips") renderSpeciesTipsPage();
  else renderSpeedometerPage();
}

// Boot
renderConsentBannerIfNeeded();
render();