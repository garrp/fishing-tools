// ============================
// app.js (PART 1 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Cleaned build
// ============================

"use strict";

const APP_VERSION = "Beta 1.1";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";

// ----------------------------
// Analytics (unchanged)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const CONSENT_KEY = "fishynw_ga_consent_v1";
let gaLoaded = false;

function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY) || ""; } catch (e) { return ""; }
}
function setConsent(val) {
  try { localStorage.setItem(CONSENT_KEY, val); } catch (e) {}
}
function loadGa4() {
  if (gaLoaded) return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
  document.head.appendChild(s);

  gtag("js", new Date());
  gtag("config", GA4_ID);
}

// ----------------------------
// Location persistence
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v2";

function saveLastLocation(lat, lon, label) {
  try {
    localStorage.setItem(LAST_LOC_KEY, JSON.stringify({
      lat:Number(lat), lon:Number(lon), label:String(label||"")
    }));
  } catch(e){}
}
function loadLastLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e){ return null; }
}

// ----------------------------
// STATE (cleaned)
// ----------------------------
const state = {
  tool: "Home",
  lat: null,
  lon: null,
  placeLabel: "",
  dateIso: ""
};

// ----------------------------
// DOM root
// ----------------------------
let app = null;

// ----------------------------
// UTIL
// ----------------------------
function escHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function safeNum(v,f){
  const n = Number(v);
  return Number.isFinite(n)?n:Number(f||0);
}

function isoToday(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function hasLocation(){
  return Number.isFinite(state.lat) && Number.isFinite(state.lon);
}

function setLocation(lat,lon,label){
  state.lat = lat;
  state.lon = lon;
  state.placeLabel = label || "";
  saveLastLocation(lat,lon,label);
}

// ============================
// app.js (PART 1 OF 5) END
// ============================
// ============================
// app.js (PART 2 OF 5) BEGIN
// APIs + data fetching (cleaned)
// ============================

// ----------------------------
// Reverse Geocode (GPS label only)
// ----------------------------
async function reverseGeocode(lat, lon) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/reverse" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&language=en&format=json";

  try {
    const r = await fetch(url);
    const data = await r.json();
    const res = data && data.results ? data.results[0] : null;
    if (!res) return null;

    return [res.name, res.admin1, res.country].filter(Boolean).join(", ");
  } catch (e) {
    return null;
  }
}

// ----------------------------
// Weather API (7-day)
// ----------------------------
async function fetchWeather(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&daily=temperature_2m_min,temperature_2m_max,wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max" +
    "&hourly=wind_speed_10m" +
    "&forecast_days=7" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph" +
    "&timezone=auto";

  const r = await fetch(url);
  return r.json();
}

// ----------------------------
// Sunrise / Sunset
// ----------------------------
async function fetchSun(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&daily=sunrise,sunset" +
    "&forecast_days=7" +
    "&timezone=auto";

  const r = await fetch(url);
  return r.json();
}

// ----------------------------
// Cache (unchanged logic)
// ----------------------------
const forecastCache = {
  key: "",
  ts: 0,
  wx: null,
  sun: null
};

const CACHE_TTL = 10 * 60 * 1000;

function cacheKey(lat, lon) {
  return lat.toFixed(3) + "," + lon.toFixed(3);
}

async function getForecast(lat, lon) {
  const key = cacheKey(lat, lon);
  const now = Date.now();

  if (
    forecastCache.key === key &&
    forecastCache.wx &&
    forecastCache.sun &&
    now - forecastCache.ts < CACHE_TTL
  ) {
    return forecastCache;
  }

  const wx = await fetchWeather(lat, lon);
  const sun = await fetchSun(lat, lon);

  forecastCache.key = key;
  forecastCache.ts = now;
  forecastCache.wx = wx;
  forecastCache.sun = sun;

  return forecastCache;
}

// ----------------------------
// GPS ONLY (no search)
// ----------------------------
function requestGPS(onDone) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      setLocation(lat, lon, "Current location");

      const label = await reverseGeocode(lat, lon);
      if (label) setLocation(lat, lon, label);

      if (onDone) onDone();
    },
    function (err) {
      console.log(err);
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

// ============================
// app.js (PART 2 OF 5) END
// ============================
// ============================
// app.js (PART 3 OF 5) BEGIN
// Home logic (cleaned)
// ============================

// ----------------------------
// Fishing windows
// ----------------------------
function computeWindows(sunrise, sunset) {
  return [
    {
      name: "Dawn",
      start: new Date(sunrise.getTime() - 90 * 60000),
      end: new Date(sunrise.getTime() + 60 * 60000)
    },
    {
      name: "Dusk",
      start: new Date(sunset.getTime() - 60 * 60000),
      end: new Date(sunset.getTime() + 90 * 60000)
    }
  ];
}

// ----------------------------
// Status Logic (simplified)
// ----------------------------
function computeStatus(inputs) {
  const wind = safeNum(inputs.windMax, 0);
  const gust = safeNum(inputs.gustMax, wind);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);

  const avg = (tmin + tmax) / 2;

  let score = 0;

  // wind factor
  if (wind > 10) score += 20;
  if (wind > 14) score += 30;
  if (wind > 18) score += 40;

  // gust factor
  if (gust > 18) score += 20;
  if (gust > 25) score += 30;

  // cold factor (important)
  if (avg < 50) score = Math.max(score, 40);
  if (avg < 40) score = Math.max(score, 70);

  let label = "GO";
  if (score >= 70) label = "NO-GO";
  else if (score >= 40) label = "CAUTION";

  return {
    label: label,
    score: score,
    needle: Math.min(100, score)
  };
}

// ----------------------------
// Exposure Tips
// ----------------------------
function exposureTips(tmin, tmax, wind) {
  const tips = [];

  if ((tmin + tmax) / 2 < 50) {
    tips.push("Cold conditions: wear non-cotton layers.");
    tips.push("Dress for water temperature, not air.");
  }

  if (wind > 12) {
    tips.push("Wind can shift fast. Stay close to safe water.");
  }

  if (tmax > 75) {
    tips.push("Hot conditions: hydrate early and often.");
  }

  tips.push("Always carry a dry bag and spare gear.");

  return tips;
}

// ----------------------------
// Render Home
// ----------------------------
function renderHome() {
  const page = document.getElementById("page");

  page.innerHTML = `
    <div class="card">
      <h2>Weather and Fishing Conditions</h2>

      <input id="home_date" type="date" />
      <button id="gps_btn">Use my location</button>

      <div id="home_output"></div>
    </div>
  `;

  const dateInput = document.getElementById("home_date");
  const output = document.getElementById("home_output");

  if (!state.dateIso) state.dateIso = isoToday();
  dateInput.value = state.dateIso;

  dateInput.addEventListener("change", () => {
    state.dateIso = dateInput.value;
    loadData();
  });

  document.getElementById("gps_btn").onclick = () => {
    requestGPS(loadData);
  };

  async function loadData() {
    if (!hasLocation()) return;

    output.innerHTML = "Loading...";

    const data = await getForecast(state.lat, state.lon);

    const wx = data.wx.daily;
    const idx = wx.time.indexOf(state.dateIso);

    if (idx < 0) {
      output.innerHTML = "Date not available.";
      return;
    }

    const tmin = wx.temperature_2m_min[idx];
    const tmax = wx.temperature_2m_max[idx];
    const wind = wx.wind_speed_10m_max[idx];
    const gust = wx.wind_gusts_10m_max[idx];
    const rain = wx.precipitation_probability_max[idx];

    const status = computeStatus({
      windMax: wind,
      gustMax: gust,
      tmin: tmin,
      tmax: tmax
    });

    const tips = exposureTips(tmin, tmax, wind);

    output.innerHTML = `
      <div class="card">
        <strong>${state.placeLabel}</strong><br>

        Temp: ${tmin} to ${tmax} F<br>
        Wind: ${wind} mph<br>
        Gust: ${gust} mph<br>
        Rain: ${rain || 0}%<br><br>

        <strong>Status: ${status.label}</strong><br>

        <ul>
          ${tips.map(t => `<li>${t}</li>`).join("")}
        </ul>
      </div>
    `;
  }
}

// ============================
// app.js (PART 3 OF 5) END
// ============================
// ============================
// app.js (PART 4 OF 5) BEGIN
// Tools (Depth + Species)
// ============================

// ----------------------------
// Depth Calculator
// ----------------------------
function renderDepth() {
  const page = document.getElementById("page");

  page.innerHTML = `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>

      <input id="speed" type="number" step="0.1" value="1.3" placeholder="Speed (mph)">
      <input id="weight" type="number" step="0.5" value="2" placeholder="Weight (oz)">
      <input id="line" type="number" value="100" placeholder="Line out (ft)">

      <button id="calc_btn">Calculate</button>

      <div id="depth_output"></div>
    </div>
  `;

  document.getElementById("calc_btn").onclick = function () {
    const speed = safeNum(document.getElementById("speed").value, 1.3);
    const weight = safeNum(document.getElementById("weight").value, 2);
    const line = safeNum(document.getElementById("line").value, 100);

    const base = 0.18 + (weight * 0.02);
    const depth = line * base * (1.5 / Math.max(0.4, speed));

    document.getElementById("depth_output").innerHTML =
      "<strong>Depth:</strong> " + depth.toFixed(1) + " ft";
  };
}

// ----------------------------
// Species Tips
// ----------------------------
function renderTips() {
  const page = document.getElementById("page");

  const species = [
    {
      name: "Largemouth Bass",
      tips: [
        "Fish shallow during spawn.",
        "Use wacky rigs and frogs.",
        "Target cover and warm water."
      ]
    },
    {
      name: "Smallmouth Bass",
      tips: [
        "Rocky areas and points.",
        "Wind helps activate bites.",
        "Use tubes and drop shots."
      ]
    },
    {
      name: "Kokanee",
      tips: [
        "Troll 1.0 to 1.5 mph.",
        "Use dodger + hoochie.",
        "Watch depth closely."
      ]
    },
    {
      name: "Trout",
      tips: [
        "Early morning best.",
        "Use spinners or trolling rigs.",
        "Follow temperature bands."
      ]
    },
    {
      name: "Pike",
      tips: [
        "Weed edges and ambush zones.",
        "Use flashy lures.",
        "Hold near structure."
      ]
    }
  ];

  page.innerHTML = `
    <div class="card">
      <h2>Species Tips</h2>
      ${species.map(s => `
        <div class="card">
          <strong>${s.name}</strong>
          <ul>
            ${s.tips.map(t => `<li>${t}</li>`).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  `;
}

// ============================
// app.js (PART 4 OF 5) END
// ============================
// ============================
// app.js (PART 5 OF 5) BEGIN
// Navigation + App Init
// ============================

// ----------------------------
// Header + Nav (unchanged design)
// ----------------------------
function renderHeader() {
  app.innerHTML = `
    <div class="wrap">
      <div class="header">
        <div class="logo">
          <a href="https://fishynw.com">
            <img src="${LOGO_URL}" />
          </a>
        </div>
        <div class="title">
          FishyNW Tools
          <div class="small">v ${APP_VERSION}</div>
        </div>
      </div>

      <div class="nav" id="nav"></div>
      <div id="page"></div>
    </div>
  `;

  const nav = document.getElementById("nav");

  const items = [
    ["Home", "Home"],
    ["Depth", "Depth"],
    ["Tips", "Tips"]
  ];

  items.forEach(([label, tool]) => {
    const btn = document.createElement("button");
    btn.className = "navBtn";
    btn.textContent = label;

    if (state.tool === tool) {
      btn.classList.add("navBtnActive");
      btn.disabled = true;
    }

    btn.onclick = () => {
      state.tool = tool;
      render();
    };

    nav.appendChild(btn);
  });
}

// ----------------------------
// Main render switch
// ----------------------------
function render() {
  renderHeader();

  if (state.tool === "Home") renderHome();
  else if (state.tool === "Depth") renderDepth();
  else if (state.tool === "Tips") renderTips();
}

// ----------------------------
// Boot
// ----------------------------
function init() {
  app = document.getElementById("app");

  const saved = loadLastLocation();
  if (saved) {
    state.lat = saved.lat;
    state.lon = saved.lon;
    state.placeLabel = saved.label;
  }

  state.dateIso = isoToday();

  render();
}

// ----------------------------
window.addEventListener("load", init);

// ============================
// app.js (PART 5 OF 5) END
// ============================
