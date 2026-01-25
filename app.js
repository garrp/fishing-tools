// ============================
// app.js (PART 1 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Add: Depth Calculator "Line type" selector (braid is thinner, etc.)
// Uses line type + test to adjust drag factor.
// ASCII ONLY.
// ============================

"use strict";

// ----------------------------
// App meta
// ----------------------------
const APP_VERSION = "1.1.1";
const APP_TITLE = "Trolling Depth Calculator";

// ----------------------------
// Global state
// ----------------------------
let app = null;

const state = {
  tool: "Home",

  // Location
  lat: null,
  lon: null,
  placeLabel: "",

  // Home inputs
  dateIso: "",
  waterType: "Small / protected",
  craft: "Kayak (paddle)",

  // Speed watch
  speedWatchId: null
};

// ----------------------------
// Small utils
// ----------------------------
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appendHtml(el, html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  while (d.firstChild) el.appendChild(d.firstChild);
}

function safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isoTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function niceErr(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  return String(e);
}

function pageEl() {
  return document.getElementById("page");
}

// ----------------------------
// Local storage for location
// ----------------------------
const LS_KEY_LOC = "fishynw_last_location_v1";

function saveLastLocation(lat, lon, label) {
  try {
    localStorage.setItem(
      LS_KEY_LOC,
      JSON.stringify({ lat: lat, lon: lon, label: label || "" })
    );
  } catch (e) {
    // ignore
  }
}

function loadLastLocation() {
  try {
    const raw = localStorage.getItem(LS_KEY_LOC);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj) return null;
    if (!Number.isFinite(Number(obj.lat))) return null;
    if (!Number.isFinite(Number(obj.lon))) return null;
    return obj;
  } catch (e) {
    return null;
  }
}

function setResolvedLocation(lat, lon, label) {
  state.lat = Number(lat);
  state.lon = Number(lon);
  state.placeLabel = String(label || "");
  saveLastLocation(state.lat, state.lon, state.placeLabel);
}

function hasResolvedLocation() {
  return Number.isFinite(Number(state.lat)) && Number.isFinite(Number(state.lon));
}

// ----------------------------
// Consent + GA4 (kept minimal)
// ----------------------------
const GA4_ID = "G-9R61DE2HLR";
const LS_KEY_GA = "fishynw_ga_ok_v1";

function gaAllowed() {
  try {
    return localStorage.getItem(LS_KEY_GA) === "1";
  } catch (e) {
    return false;
  }
}

function setGaAllowed(v) {
  try {
    localStorage.setItem(LS_KEY_GA, v ? "1" : "0");
  } catch (e) {
    // ignore
  }
}

function loadGa4IfAllowed() {
  if (!gaAllowed()) return;
  if (window.__fishynw_ga_loaded) return;
  window.__fishynw_ga_loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA4_ID, { anonymize_ip: true });
}

function renderConsentBannerIfNeeded() {
  loadGa4IfAllowed();
  if (gaAllowed()) return;

  const existing = document.getElementById("ga_banner");
  if (existing) return;

  const banner = document.createElement("div");
  banner.id = "ga_banner";
  banner.style.position = "fixed";
  banner.style.left = "12px";
  banner.style.right = "12px";
  banner.style.bottom = "12px";
  banner.style.zIndex = "9999";
  banner.style.background = "#0b0f12";
  banner.style.color = "#f6f2e7";
  banner.style.borderRadius = "14px";
  banner.style.padding = "12px";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  banner.innerHTML =
    '<div style="font-weight:800;">Analytics consent</div>' +
    '<div style="font-size:13px; opacity:0.9; margin-top:4px;">Allow anonymous analytics to improve this tool?</div>' +
    '<div style="display:flex; gap:10px; margin-top:10px;">' +
    '<button id="ga_yes" style="flex:1; padding:10px; border-radius:12px; border:none; font-weight:800;">Allow</button>' +
    '<button id="ga_no" style="flex:1; padding:10px; border-radius:12px; border:none; font-weight:800;">No thanks</button>' +
    "</div>";

  document.body.appendChild(banner);

  document.getElementById("ga_yes").addEventListener("click", function () {
    setGaAllowed(true);
    banner.remove();
    loadGa4IfAllowed();
  });

  document.getElementById("ga_no").addEventListener("click", function () {
    setGaAllowed(false);
    banner.remove();
  });
}

// ----------------------------
// Header + nav
// ----------------------------
function renderHeaderAndNav() {
  app.innerHTML = "";

  appendHtml(
    app,
    `
    <div class="wrap">
      <div class="topCard">
        <div class="brandRow">
          <div class="brandTitle">${escHtml(APP_TITLE)}</div>
          <div class="brandVer">v ${escHtml(APP_VERSION)}</div>
        </div>

        <div class="navGrid">
          <button class="navBtn" data-tool="Home">Home</button>
          <button class="navBtn" data-tool="Trolling depth calculator">Depth</button>
          <button class="navBtn" data-tool="Species tips">Tips</button>
          <button class="navBtn" data-tool="Speedometer">Speed</button>
        </div>
      </div>

      <div id="page"></div>

      <div class="footer">
        <div class="footTitle">FishyNW.com</div>
        <div class="footSub">Independent Northwest fishing tools</div>
      </div>
    </div>
  `
  );

  const btns = app.querySelectorAll(".navBtn");
  btns.forEach(function (b) {
    const t = b.getAttribute("data-tool");
    if (t === state.tool) b.classList.add("navBtnOn");
    b.addEventListener("click", function () {
      stopSpeedWatchIfRunning();
      state.tool = t;
      render();
      try {
        window.scrollTo(0, 0);
      } catch (e) {
        // ignore
      }
    });
  });

  injectBaseCssIfMissing();
}

function injectBaseCssIfMissing() {
  if (document.getElementById("fishynw_css")) return;

  const css = document.createElement("style");
  css.id = "fishynw_css";
  css.textContent = `
    :root{
      --bg:#f6f2e7;
      --card:#ffffff;
      --ink:#0b0f12;
      --muted:#6b7280;
      --green:#6fbf4a;
      --green2:#8fd19e;
      --line:#e5e7eb;
    }
    body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}
    .wrap{max-width:860px;margin:0 auto;padding:14px;}
    .topCard{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:0 6px 18px rgba(0,0,0,0.06);}
    .brandRow{display:flex;align-items:flex-end;justify-content:center;gap:10px;}
    .brandTitle{font-size:22px;font-weight:900;letter-spacing:0.2px;text-align:center;}
    .brandVer{font-size:13px;color:var(--muted);font-weight:700;}
    .navGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}
    .navBtn{padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(111,191,74,0.22);font-weight:900;font-size:16px;}
    .navBtnOn{background:rgba(111,191,74,0.45);}
    .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:0 6px 18px rgba(0,0,0,0.06);margin-top:12px;}
    .card h2{margin:0 0 6px 0;font-size:22px;}
    .card h3{margin:0 0 6px 0;font-size:20px;}
    .small{font-size:13px;}
    .muted{color:var(--muted);}
    .fieldLabel{font-weight:900;margin:10px 0 6px 2px;}
    input,select{width:100%;padding:14px;border-radius:16px;border:1px solid var(--line);font-size:18px;box-sizing:border-box;background:#fff;}
    button{cursor:pointer;}
    .btnRow{display:flex;gap:10px;}
    .grid2{display:grid;grid-template-columns:1fr;gap:10px;}
    @media(min-width:680px){ .grid2{grid-template-columns:1fr 1fr;} .navGrid{grid-template-columns:1fr 1fr 1fr 1fr;} }
    .footer{margin:18px 0 10px 0;text-align:center;color:var(--muted);}
    .footTitle{font-weight:900;color:var(--ink);}
    .footSub{font-size:13px;}
  `;
  document.head.appendChild(css);
}

function stopSpeedWatchIfRunning() {
  if (state.speedWatchId !== null && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(state.speedWatchId);
    } catch (e) {
      // ignore
    }
  }
  state.speedWatchId = null;
}

// ----------------------------
// Weather fetch (range) for Home (used by other parts)
// ----------------------------
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

// Open-Meteo daily/hourly for wind + temp + precip prob
async function fetchWeatherWindRange(lat, lon, days) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(String(lat)) +
    "&longitude=" + encodeURIComponent(String(lon)) +
    "&timezone=auto" +
    "&forecast_days=" + encodeURIComponent(String(days)) +
    "&hourly=wind_speed_10m" +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max";

  const j = await fetchJson(url);

  const out = {
    daily: {
      time: (((j || {}).daily || {}).time) || [],
      tmin: (((j || {}).daily || {}).temperature_2m_min) || [],
      tmax: (((j || {}).daily || {}).temperature_2m_max) || [],
      popMax: (((j || {}).daily || {}).precipitation_probability_max) || [],
      windMax: (((j || {}).daily || {}).wind_speed_10m_max) || [],
      gustMax: (((j || {}).daily || {}).wind_gusts_10m_max) || []
    },
    hourly: {
      time: (((j || {}).hourly || {}).time) || [],
      wind: (((j || {}).hourly || {}).wind_speed_10m) || []
    }
  };

  return out;
}

// Sun times range
async function fetchSunTimesRange(lat, lon, days) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(String(lat)) +
    "&longitude=" + encodeURIComponent(String(lon)) +
    "&timezone=auto" +
    "&forecast_days=" + encodeURIComponent(String(days)) +
    "&daily=sunrise,sunset";

  const j = await fetchJson(url);
  return {
    time: (((j || {}).daily || {}).time) || [],
    sunrise: (((j || {}).daily || {}).sunrise) || [],
    sunset: (((j || {}).daily || {}).sunset) || []
  };
}

function sunForDate(sun, iso) {
  if (!sun || !Array.isArray(sun.time)) return null;
  const idx = sun.time.indexOf(iso);
  if (idx < 0) return null;

  const sr = sun.sunrise[idx];
  const ss = sun.sunset[idx];
  if (!sr || !ss) return null;

  const sunrise = new Date(sr);
  const sunset = new Date(ss);
  if (isNaN(sunrise.getTime()) || isNaN(sunset.getTime())) return null;

  return { sunrise: sunrise, sunset: sunset };
}

// Filter hourly arrays to selected date
function filterHourlyToDate(times, values, iso) {
  const out = [];
  for (let i = 0; i < times.length && i < values.length; i++) {
    const t = String(times[i] || "");
    if (t.slice(0, 10) === iso) {
      out.push({ dt: new Date(t), v: values[i] });
    }
  }
  return out;
}

// Time formatting
function formatTime(d) {
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

// Placeholder chart; full draw function continues in Part 2
function drawWindLineChart(canvas, points) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.clientWidth || 320;
  const h = 220;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  ctx.clearRect(0, 0, w, h);

  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText("Chart renders in Part 2", 10, 20);
}

// ----------------------------
// Location picker (minimal; more in Part 2)
// ----------------------------
function renderLocationPicker(parentEl, context, onChanged, autoGps) {
  appendHtml(
    parentEl,
    `
    <div class="card">
      <h3>Location</h3>
      <input id="loc_input_${escHtml(context)}" type="text" placeholder="City, ST or place name" value="${escHtml(state.placeLabel || "")}">
      <div class="btnRow" style="margin-top:10px;">
        <button id="loc_search_${escHtml(context)}" style="flex:1;">Search place</button>
        <button id="loc_gps_${escHtml(context)}" style="flex:1;">Use my location</button>
      </div>
      <div class="small muted" id="loc_using_${escHtml(context)}" style="margin-top:8px;"></div>
    </div>
  `
  );

  const input = document.getElementById("loc_input_" + context);
  const using = document.getElementById("loc_using_" + context);
  const btnSearch = document.getElementById("loc_search_" + context);
  const btnGps = document.getElementById("loc_gps_" + context);

  function paintUsing() {
    if (hasResolvedLocation()) {
      using.textContent = "Using: " + (state.placeLabel || "Current location");
    } else {
      using.textContent = "Set a location to load forecast.";
    }
  }
  paintUsing();

  btnGps.addEventListener("click", function () {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        setResolvedLocation(pos.coords.latitude, pos.coords.longitude, "Current location");
        paintUsing();
        if (typeof onChanged === "function") onChanged();
      },
      function (err) {
        using.textContent = "GPS error: " + (err && err.message ? err.message : "unknown");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  });

  // Search place implemented in Part 2 (geocoding)
  btnSearch.addEventListener("click", function () {
    using.textContent = "Place search is implemented in Part 2.";
  });

  // Clear saved location if user edits the box (so stale buttons do not mislead)
  input.addEventListener("input", function () {
    // do not auto-clear state.lat/lon here; just reflect that input changed
    // (actual search occurs when user presses Search)
  });

  if (autoGps && !hasResolvedLocation()) {
    const last = loadLastLocation();
    if (last) {
      setResolvedLocation(last.lat, last.lon, last.label || "");
      paintUsing();
      if (typeof onChanged === "function") onChanged();
    }
  }
}

// ----------------------------
// Home page placeholder (full in Part 2/3)
// ----------------------------
function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="small muted">Home renders fully in Part 2 and Part 3.</div>
    </div>
  `
  );

  renderLocationPicker(page, "home", function () {
    render();
  }, true);
}

// ----------------------------
// Depth Calculator (UPDATED)
// Add: Line type selection affects drag factor.
// Braid is thinner, mono is thicker.
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
            <option>50</option>
          </select>
        </div>
        <div>
          <div class="fieldLabel">Line type</div>
          <select id="dc_linetype">
            <option value="braid" selected>Braid (thinner)</option>
            <option value="fluoro">Fluoro (medium)</option>
            <option value="mono">Mono (thicker)</option>
            <option value="leadcore">Leadcore (thick)</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;">
        <button id="dc_calc" style="width:100%; padding:14px; border-radius:16px; border:1px solid var(--line); background:rgba(111,191,74,0.35); font-weight:900; font-size:18px;">Calculate</button>
      </div>

      <div id="dc_out" class="card" style="margin-top:12px; display:none;"></div>
    </div>
  `
  );

  const out = document.getElementById("dc_out");

  document.getElementById("dc_calc").addEventListener("click", function () {
    const speed = safeNum(document.getElementById("dc_speed").value, 1.3);
    const weight = safeNum(document.getElementById("dc_weight").value, 2);
    const line = safeNum(document.getElementById("dc_line").value, 100);
    const test = safeNum(document.getElementById("dc_test").value, 12);
    const lineType = String(document.getElementById("dc_linetype").value || "braid");

    // Baseline by test (thicker test, more drag)
    let baseDrag = 1.0;
    if (test <= 10) baseDrag = 1.0;
    else if (test <= 12) baseDrag = 0.95;
    else if (test <= 20) baseDrag = 0.85;
    else if (test <= 25) baseDrag = 0.80;
    else if (test <= 30) baseDrag = 0.76;
    else if (test <= 40) baseDrag = 0.72;
    else baseDrag = 0.68;

    // Line type modifier (braid thinner -> less drag -> deeper)
    // Values tuned to feel plausible, not lab-accurate.
    let typeMod = 1.0;
    if (lineType === "braid") typeMod = 1.08;
    else if (lineType === "fluoro") typeMod = 1.00;
    else if (lineType === "mono") typeMod = 0.92;
    else if (lineType === "leadcore") typeMod = 0.85;

    const dragFactor = baseDrag * typeMod;

    // Simple physics-ish model
    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);
    let depth = line * base * speedFactor * dragFactor;

    depth = Math.max(0, Math.min(depth, line * 0.95));

    out.style.display = "block";
    out.innerHTML =
      "<div style=\"display:flex; justify-content:space-between; align-items:flex-end; gap:12px;\">" +
      "<div><div class=\"small muted\">Estimated depth</div><div style=\"font-size:34px; font-weight:900;\">" +
      escHtml(depth.toFixed(1)) +
      " ft</div></div>" +
      "<div class=\"small muted\" style=\"text-align:right;\">Line: " +
      escHtml(lineType) +
      "<br>Test: " +
      escHtml(String(test)) +
      " lb</div>" +
      "</div>" +
      "<div class=\"small muted\" style=\"margin-top:10px;\">Current, lure drag, and knots can change results a lot. Use this as a starting point.</div>";
  });
}

// ----------------------------
// Tips + Speed placeholders (full in Part 3)
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();
  appendHtml(page, `<div class="card"><h2>Species Tips</h2><div class="small muted">Renders fully in Part 3.</div></div>`);
}

function renderSpeedometer() {
  const page = pageEl();
  appendHtml(page, `<div class="card"><h2>Speedometer</h2><div class="small muted">Renders fully in Part 3.</div></div>`);
}

// ----------------------------
// Router
// ----------------------------
function render() {
  if (!app) app = document.getElementById("app");
  if (!app) return;

  renderConsentBannerIfNeeded();

  // Restore location if possible
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
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  render();
});

// ============================
// app.js (PART 1 OF 3) END
// ============================
// ============================
// app.js (PART 2 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Home page: date-driven forecast + chart + go/caution/no-go + funny remark
// Includes place search (Open-Meteo geocoding)
// ASCII ONLY.
// ============================

"use strict";

// ----------------------------
// Place search (Open-Meteo Geocoding)
// ----------------------------
async function geocodePlace(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    "?name=" + encodeURIComponent(q) +
    "&count=6&language=en&format=json";

  const j = await fetchJson(url);
  const res = (j && j.results) ? j.results : [];
  return res.map(function (r) {
    const name = r.name || "";
    const admin1 = r.admin1 || "";
    const country = r.country || "";
    const label = [name, admin1, country].filter(Boolean).join(", ");
    return {
      label: label || name || q,
      lat: r.latitude,
      lon: r.longitude
    };
  });
}

// ----------------------------
// Funny remark pool (random pick each render)
// ----------------------------
const FUNNY_REMARKS = [
  "Look at that. Now you have a scientific reason to tell your wife you need to go kayak fishing.",
  "Forecast says its fine. If you come home skunked, blame the barometer, not your tackle box.",
  "If anyone asks, you are not avoiding chores. You are conducting field research.",
  "Conditions look decent. Go make a memory and maybe lose one lure for the cause.",
  "If the wind starts acting up, just remember: the lake always wins. Paddle like you mean it."
];

function pickFunnyRemark(seedText) {
  // Deterministic-ish per day + location, but still feels random.
  const s = String(seedText || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % FUNNY_REMARKS.length;
  return FUNNY_REMARKS[idx];
}

// ----------------------------
// Go/Caution/No-go scoring
// Uses wind + gust + temp + water type + craft
// ----------------------------
function statusFromConditions(opts) {
  const tmin = safeNum(opts.tmin, null);
  const tmax = safeNum(opts.tmax, null);
  const windMax = safeNum(opts.windMax, null);
  const gustMax = safeNum(opts.gustMax, null);

  const water = String(opts.waterType || "Small / protected");
  const craft = String(opts.craft || "Kayak (paddle)");

  // If missing core values, default to caution.
  if (tmin === null || tmax === null || windMax === null || gustMax === null) {
    return {
      level: "CAUTION",
      meter: 0.55,
      note: "Not enough forecast data to be confident. Use caution and verify local conditions."
    };
  }

  const avg = (tmin + tmax) / 2;

  // Thresholds by water type / craft
  const bigWater = water.indexOf("Big") >= 0;

  let windGo = bigWater ? 10 : 12;
  let windCaution = bigWater ? 14 : 16;
  let windNoGo = bigWater ? 18 : 22;

  let gustGo = bigWater ? 15 : 18;
  let gustCaution = bigWater ? 20 : 24;
  let gustNoGo = bigWater ? 26 : 30;

  // Craft adjustments
  if (craft.indexOf("Boat") >= 0 || craft.indexOf("Motor") >= 0) {
    windGo += 4;
    windCaution += 4;
    windNoGo += 4;
    gustGo += 4;
    gustCaution += 4;
    gustNoGo += 4;
  } else if (craft.indexOf("Kayak") >= 0 && craft.indexOf("pedal") >= 0) {
    windGo += 1;
    windCaution += 1;
    windNoGo += 1;
  }

  // Temperature risk scoring
  // Cold: immersion risk; Hot: heat risk
  let tempRisk = 0; // 0..1
  let tempNote = "";

  if (avg <= 20) {
    tempRisk = 1.0;
    tempNote = "Extreme cold. Immersion risk is serious.";
  } else if (avg <= 30) {
    tempRisk = 0.8;
    tempNote = "Very cold. Dress for immersion. Consider a drysuit.";
  } else if (avg <= 38) {
    tempRisk = 0.55;
    tempNote = "Cold. The water can punish mistakes fast.";
  } else if (avg >= 95) {
    tempRisk = 0.85;
    tempNote = "Extreme heat. Heat stress risk is high.";
  } else if (avg >= 88) {
    tempRisk = 0.6;
    tempNote = "Hot. Sun and dehydration risk.";
  } else {
    tempRisk = 0.15;
    tempNote = "Temperature is generally manageable.";
  }

  // Wind risk scoring
  let windRisk = 0;
  if (windMax >= windNoGo || gustMax >= gustNoGo) windRisk = 1.0;
  else if (windMax >= windCaution || gustMax >= gustCaution) windRisk = 0.7;
  else if (windMax >= windGo || gustMax >= gustGo) windRisk = 0.45;
  else windRisk = 0.15;

  // Combine: wind dominates big water, temp boosts consequence.
  let risk = 0.65 * windRisk + 0.35 * tempRisk;

  // Slight bump for big water because consequence is higher.
  if (bigWater) risk = Math.min(1.0, risk + 0.07);

  let level = "GO";
  if (risk >= 0.72) level = "NO-GO";
  else if (risk >= 0.42) level = "CAUTION";

  const noteParts = [];
  if (tempNote) noteParts.push(tempNote);

  if (level === "NO-GO") {
    noteParts.push("Not recommended for the selected craft/water type.");
  } else if (level === "CAUTION") {
    noteParts.push("Proceed carefully and watch for changing conditions.");
  } else {
    noteParts.push("Generally favorable. Keep an eye on local effects and forecasts.");
  }

  return { level: level, meter: risk, note: noteParts.join(" ") };
}

function meterPointerPct(risk01) {
  const r = Math.max(0, Math.min(1, Number(risk01)));
  // Map 0..1 to 0..100
  return Math.round(r * 100);
}

// ----------------------------
// Canvas line chart (wind hourly)
// ----------------------------
function drawWindLineChart(canvas, points) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.clientWidth || 320;
  const h = 220;

  canvas.width = Math.round(w * devicePixelRatio);
  canvas.height = Math.round(h * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  ctx.clearRect(0, 0, w, h);

  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 32;

  if (!points || points.length < 2) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("No hourly wind data for this date.", 12, 24);
    return;
  }

  // Values
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const v = safeNum(points[i].v, 0);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  }
  if (!Number.isFinite(vMin) || !Number.isFinite(vMax)) {
    vMin = 0;
    vMax = 1;
  }
  if (vMax - vMin < 1) {
    vMax = vMin + 1;
  }

  const x0 = padL;
  const x1 = w - padR;
  const y0 = h - padB;
  const y1 = padT;

  // Axes
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.stroke();

  // Grid + labels (min/mid/max)
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  const ticks = 3;
  for (let t = 0; t < ticks; t++) {
    const frac = t / (ticks - 1);
    const y = y0 - frac * (y0 - y1);
    const val = vMin + frac * (vMax - vMin);

    ctx.strokeStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    ctx.fillText(Math.round(val) + " mph", 6, y + 4);
  }

  // X labels: first, middle, last hour
  function hrLabel(d) {
    try {
      return d.toLocaleTimeString([], { hour: "numeric" });
    } catch (e) {
      return "";
    }
  }

  const first = points[0].dt;
  const mid = points[Math.floor(points.length / 2)].dt;
  const last = points[points.length - 1].dt;

  ctx.fillText(hrLabel(first), x0, h - 10);
  ctx.fillText(hrLabel(mid), (x0 + x1) / 2 - 10, h - 10);
  ctx.fillText(hrLabel(last), x1 - 30, h - 10);

  // Line
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < points.length; i++) {
    const fracX = points.length === 1 ? 0 : i / (points.length - 1);
    const x = x0 + fracX * (x1 - x0);
    const v = safeNum(points[i].v, vMin);
    const fracY = (v - vMin) / (vMax - vMin);
    const y = y0 - fracY * (y0 - y1);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Dots
  ctx.fillStyle = "#111827";
  for (let i = 0; i < points.length; i += Math.max(1, Math.floor(points.length / 10))) {
    const fracX = points.length === 1 ? 0 : i / (points.length - 1);
    const x = x0 + fracX * (x1 - x0);
    const v = safeNum(points[i].v, vMin);
    const fracY = (v - vMin) / (vMax - vMin);
    const y = y0 - fracY * (y0 - y1);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----------------------------
// Home: date + forecast for selected day (not just today)
// ----------------------------
let __home_cache_key = "";
let __home_cache_weather = null;
let __home_cache_sun = null;

function forecastDaysNeeded(selectedIso) {
  // Fetch enough days so that the selected date is included.
  // Open-Meteo forecast_days max is typically 16.
  const today = new Date();
  const startIso = isoTodayLocal();
  const start = new Date(startIso + "T00:00:00");
  const sel = new Date(selectedIso + "T00:00:00");
  if (isNaN(sel.getTime())) return 7;

  const diffMs = sel.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (24 * 3600 * 1000));
  const days = Math.min(16, Math.max(1, diffDays + 2));
  return days;
}

function ensureDateInRange(iso) {
  if (!isIsoDate(iso)) return isoTodayLocal();

  // Clamp to [today .. today+15] so it is always forecastable
  const start = new Date(isoTodayLocal() + "T00:00:00");
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return isoTodayLocal();

  const max = new Date(start.getTime() + 15 * 24 * 3600 * 1000);
  if (d < start) return isoTodayLocal();
  if (d > max) {
    const y = max.getFullYear();
    const m = String(max.getMonth() + 1).padStart(2, "0");
    const day = String(max.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  return iso;
}

function popText(popVal) {
  if (popVal === null || popVal === undefined) return "None";
  const n = Number(popVal);
  if (!Number.isFinite(n)) return "None";
  return String(Math.round(n)) + " %";
}

function renderHome() {
  const page = pageEl();

  // Date init (clamped)
  state.dateIso = ensureDateInRange(state.dateIso || isoTodayLocal());

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="small muted">Choose a date. Forecast, wind chart, and status update for that day.</div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Date</div>
        <input id="home_date" type="date" value="${escHtml(state.dateIso)}" min="${escHtml(isoTodayLocal())}">
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Water type</div>
        <div class="btnRow">
          <button id="wt_small" style="flex:1; padding:12px; border-radius:16px; border:1px solid var(--line); font-weight:900;">Small / protected</button>
          <button id="wt_big" style="flex:1; padding:12px; border-radius:16px; border:1px solid var(--line); font-weight:900;">Big water / offshore</button>
        </div>
        <div class="small muted" style="margin-top:8px;">Small water is default. Big water is stricter for wind and temperature risk.</div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Craft</div>
        <select id="home_craft">
          <option>Kayak (paddle)</option>
          <option>Kayak (pedal)</option>
          <option>Small boat</option>
        </select>
      </div>
    </div>
  `
  );

  renderLocationPicker(
    page,
    "home",
    function () {
      render();
    },
    true
  );

  appendHtml(
    page,
    `
    <div id="home_loading" class="card" style="display:none;">
      <h3>Loading forecast...</h3>
      <div class="small muted">Fetching weather for the selected date.</div>
    </div>

    <div id="home_err" class="card" style="display:none;"></div>

    <div id="home_out" style="display:none;">
      <div class="card">
        <h3>Overview - <span id="ov_date"></span></h3>

        <div class="grid2" style="margin-top:12px;">
          <div class="card" style="margin:0;">
            <div class="small muted" style="font-weight:900;">Temperature</div>
            <div id="ov_temp" style="font-size:34px; font-weight:900;"></div>
            <div class="small muted">Daily min / max</div>
          </div>
          <div class="card" style="margin:0;">
            <div class="small muted" style="font-weight:900;">Rain chance (max)</div>
            <div id="ov_pop" style="font-size:34px; font-weight:900;"></div>
            <div class="small muted">Peak probability</div>
          </div>
          <div class="card" style="margin:0;">
            <div class="small muted" style="font-weight:900;">Max sustained wind</div>
            <div id="ov_wind" style="font-size:34px; font-weight:900;"></div>
            <div class="small muted">Day max</div>
          </div>
          <div class="card" style="margin:0;">
            <div class="small muted" style="font-weight:900;">Max gust</div>
            <div id="ov_gust" style="font-size:34px; font-weight:900;"></div>
            <div class="small muted">Day max</div>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div style="font-weight:900; font-size:20px;">Boating / Kayak status</div>
            <div id="status_badge" style="padding:10px 16px; border-radius:999px; font-weight:900; border:1px solid var(--line);"></div>
          </div>

          <div style="margin-top:12px; height:18px; border-radius:999px; border:1px solid var(--line); overflow:hidden; display:flex;">
            <div style="flex:1; background:rgba(111,191,74,0.55);"></div>
            <div style="flex:1; background:rgba(245,158,11,0.45);"></div>
            <div style="flex:1; background:rgba(239,68,68,0.35);"></div>
          </div>
          <div style="position:relative; height:18px; margin-top:-18px;">
            <div id="status_ptr" style="position:absolute; top:-2px; width:0; height:0; border-left:10px solid transparent; border-right:10px solid transparent; border-top:14px solid #111827;"></div>
          </div>

          <div id="status_note" class="small muted" style="margin-top:8px;"></div>
          <div id="status_funny" class="small" style="margin-top:10px; font-weight:900;"></div>
        </div>
      </div>

      <div class="card">
        <h3>Hourly wind (line chart)</h3>
        <div class="small muted">Wind speed at 10m in mph for the selected date.</div>
        <div style="margin-top:10px;">
          <canvas id="wind_canvas" style="width:100%; height:220px; display:block;"></canvas>
        </div>
      </div>

      <div class="card" id="best_times_card">
        <h3>Best fishing windows</h3>
        <div id="best_times" class="small muted">Calculates in Part 3.</div>
      </div>
    </div>
  `
  );

  // Wire controls
  const dateEl = document.getElementById("home_date");
  const craftEl = document.getElementById("home_craft");
  craftEl.value = state.craft || "Kayak (paddle)";

  function paintWaterBtns() {
    const small = document.getElementById("wt_small");
    const big = document.getElementById("wt_big");
    const isBig = String(state.waterType).indexOf("Big") >= 0;

    small.style.background = isBig ? "rgba(111,191,74,0.18)" : "rgba(111,191,74,0.45)";
    big.style.background = isBig ? "rgba(111,191,74,0.45)" : "rgba(111,191,74,0.18)";
  }
  paintWaterBtns();

  document.getElementById("wt_small").addEventListener("click", function () {
    state.waterType = "Small / protected";
    paintWaterBtns();
    loadHomeForecast();
  });

  document.getElementById("wt_big").addEventListener("click", function () {
    state.waterType = "Big water / offshore";
    paintWaterBtns();
    loadHomeForecast();
  });

  craftEl.addEventListener("change", function () {
    state.craft = craftEl.value;
    loadHomeForecast();
  });

  dateEl.addEventListener("change", function () {
    // Ensure it really updates by clamping and re-fetching range if needed
    const v = ensureDateInRange(dateEl.value);
    state.dateIso = v;
    dateEl.value = v;
    loadHomeForecast();
  });

  // Override location picker search button (now that Part 2 adds geocoding)
  const btnSearch = document.getElementById("loc_search_home");
  const input = document.getElementById("loc_input_home");
  const using = document.getElementById("loc_using_home");

  btnSearch.addEventListener("click", async function () {
    const q = String(input.value || "").trim();
    if (!q) {
      using.textContent = "Type a place name first.";
      return;
    }
    using.textContent = "Searching...";
    try {
      const matches = await geocodePlace(q);
      if (!matches.length) {
        using.textContent = "No matches found.";
        return;
      }

      // Simple inline chooser
      let html = '<div style="margin-top:10px;">';
      html += '<div class="small muted" style="font-weight:900;">Select a match</div>';
      for (let i = 0; i < matches.length; i++) {
        html +=
          '<button class="pickPlaceBtn" data-i="' + i + '" ' +
          'style="margin-top:8px; width:100%; padding:12px; border-radius:14px; border:1px solid var(--line); background:#fff; font-weight:800; text-align:left;">' +
          escHtml(matches[i].label) +
          "</button>";
      }
      html += "</div>";

      using.innerHTML = html;

      const btns = using.querySelectorAll(".pickPlaceBtn");
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          const i = Number(b.getAttribute("data-i"));
          const m = matches[i];
          setResolvedLocation(m.lat, m.lon, m.label);
          input.value = m.label;
          using.textContent = "Using: " + m.label;
          loadHomeForecast();
        });
      });
    } catch (e) {
      using.textContent = "Search failed: " + niceErr(e);
    }
  });

  // Load initial forecast if we have location
  loadHomeForecast();
}

async function loadHomeForecast() {
  const loading = document.getElementById("home_loading");
  const err = document.getElementById("home_err");
  const out = document.getElementById("home_out");

  err.style.display = "none";
  err.textContent = "";
  out.style.display = "none";

  if (!hasResolvedLocation()) {
    loading.style.display = "none";
    return;
  }

  const iso = ensureDateInRange(state.dateIso || isoTodayLocal());
  state.dateIso = iso;

  const days = forecastDaysNeeded(iso);

  const key =
    String(state.lat) + "," +
    String(state.lon) + "," +
    String(days);

  loading.style.display = "block";

  try {
    // Cache by lat/lon/days; date selection pulls from arrays
    if (__home_cache_key !== key || !__home_cache_weather || !__home_cache_sun) {
      __home_cache_key = key;
      __home_cache_weather = await fetchWeatherWindRange(state.lat, state.lon, days);
      __home_cache_sun = await fetchSunTimesRange(state.lat, state.lon, days);
    }

    // Find selected day in daily arrays
    const d = __home_cache_weather.daily;
    const idx = d.time.indexOf(iso);

    if (idx < 0) {
      // If not included, force larger range once (up to 16)
      __home_cache_key = "";
      __home_cache_weather = null;
      __home_cache_sun = null;
      loading.style.display = "none";
      err.style.display = "block";
      err.innerHTML =
        "<h3>Forecast unavailable</h3>" +
        "<div class=\"small muted\">That date is outside the available forecast range. Try a nearer date.</div>";
      return;
    }

    const tmin = d.tmin[idx];
    const tmax = d.tmax[idx];
    const popMax = d.popMax[idx];
    const windMax = d.windMax[idx];
    const gustMax = d.gustMax[idx];

    // Fill overview
    document.getElementById("ov_date").textContent = iso;

    const tminR = Math.round(Number(tmin));
    const tmaxR = Math.round(Number(tmax));

    document.getElementById("ov_temp").textContent =
      (Number.isFinite(tminR) && Number.isFinite(tmaxR))
        ? (tminR + " to " + tmaxR + " F")
        : "None";

    document.getElementById("ov_pop").textContent = popText(popMax);

    document.getElementById("ov_wind").textContent =
      Number.isFinite(Number(windMax)) ? (Math.round(Number(windMax)) + " mph") : "None";

    document.getElementById("ov_gust").textContent =
      Number.isFinite(Number(gustMax)) ? (Math.round(Number(gustMax)) + " mph") : "None";

    // Status
    const status = statusFromConditions({
      tmin: tmin,
      tmax: tmax,
      windMax: windMax,
      gustMax: gustMax,
      waterType: state.waterType,
      craft: state.craft
    });

    const badge = document.getElementById("status_badge");
    badge.textContent = status.level;

    if (status.level === "GO") badge.style.background = "rgba(111,191,74,0.30)";
    else if (status.level === "CAUTION") badge.style.background = "rgba(245,158,11,0.25)";
    else badge.style.background = "rgba(239,68,68,0.22)";

    // Pointer
    const ptr = document.getElementById("status_ptr");
    const pct = meterPointerPct(status.meter);
    // Clamp to keep pointer on bar
    const left = Math.max(0, Math.min(100, pct));
    ptr.style.left = "calc(" + left + "% - 10px)";

    document.getElementById("status_note").textContent = status.note;

    // Funny line (stable per day + place)
    const seed = (state.placeLabel || "") + "|" + iso + "|" + state.waterType + "|" + state.craft;
    document.getElementById("status_funny").textContent = pickFunnyRemark(seed);

    // Hourly wind for selected date
    const hourlyPoints = filterHourlyToDate(__home_cache_weather.hourly.time, __home_cache_weather.hourly.wind, iso)
      .map(function (p) {
        return { dt: p.dt, v: p.v };
      });

    const canvas = document.getElementById("wind_canvas");
    drawWindLineChart(canvas, hourlyPoints);

    // Best times placeholder (Part 3 uses sunForDate)
    const sun = sunForDate(__home_cache_sun, iso);
    const bestEl = document.getElementById("best_times");
    if (!sun) {
      bestEl.textContent = "Sunrise/sunset unavailable for this date.";
    } else {
      bestEl.textContent = "Calculates in Part 3 using sunrise/sunset for " + iso + ".";
    }

    loading.style.display = "none";
    out.style.display = "block";

    // Force scroll to show updated overview when date changes
    try {
      // keep user near where they were, but ensure header updates
      // no-op for now
    } catch (e) {
      // ignore
    }
  } catch (e) {
    loading.style.display = "none";
    err.style.display = "block";
    err.innerHTML =
      "<h3>Could not load forecast</h3>" +
      "<div class=\"small muted\">" + escHtml(niceErr(e)) + "</div>";
  }
}

// ============================
// app.js (PART 2 OF 3) END
// ============================
// ============================
// app.js (PART 3 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Adds: Best fishing windows (sun-based), Trolling Depth Calculator w/ line type,
// and app boot/render.
// ASCII ONLY.
// ============================

"use strict";

// ----------------------------
// Best fishing windows (simple, readable, date-aware)
// Uses sunrise/sunset for the SELECTED date.
// ----------------------------
function fmtTimeLocal(d) {
  if (!d || isNaN(d.getTime())) return "None";
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    // Fallback
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }
}

function addMinutes(dt, mins) {
  const d = new Date(dt.getTime() + mins * 60000);
  return d;
}

function buildBestWindows(sun) {
  // A simple approach: around dawn and dusk.
  // Dawn: sunrise - 30 to sunrise + 2h
  // Dusk: sunset - 2h to sunset + 30
  if (!sun || !sun.sunrise || !sun.sunset) return null;

  const sunrise = sun.sunrise;
  const sunset = sun.sunset;

  const dawnStart = addMinutes(sunrise, -30);
  const dawnEnd = addMinutes(sunrise, 150); // +2h30 total window
  const duskStart = addMinutes(sunset, -150);
  const duskEnd = addMinutes(sunset, 30);

  return {
    dawnStart: dawnStart,
    dawnEnd: dawnEnd,
    duskStart: duskStart,
    duskEnd: duskEnd
  };
}

function renderBestWindows(iso) {
  const bestEl = document.getElementById("best_times");
  if (!bestEl) return;

  // Use cached range from Part 2
  const sun = (__home_cache_sun) ? sunForDate(__home_cache_sun, iso) : null;
  const windows = buildBestWindows(sun);

  if (!windows) {
    bestEl.innerHTML = '<div class="small muted">Sunrise/sunset unavailable for this date.</div>';
    return;
  }

  const dawnLine =
    "<li><b>Dawn window</b>: " + escHtml(fmtTimeLocal(windows.dawnStart)) +
    " to " + escHtml(fmtTimeLocal(windows.dawnEnd)) + "</li>";

  const duskLine =
    "<li><b>Dusk window</b>: " + escHtml(fmtTimeLocal(windows.duskStart)) +
    " to " + escHtml(fmtTimeLocal(windows.duskEnd)) + "</li>";

  bestEl.innerHTML =
    '<ul style="margin:10px 0 0 18px; font-size:16px;">' +
    dawnLine + duskLine +
    "</ul>" +
    '<div class="small muted" style="margin-top:8px;">Tip: Adjust based on pressure changes, cloud cover, and your target species.</div>';
}

// Hook: after Home finishes loading forecast, Part 2 sets placeholder.
// We call this after each successful load.
function homePostRenderExtras() {
  const iso = state.dateIso || isoTodayLocal();
  renderBestWindows(iso);
}

// Patch loadHomeForecast to call homePostRenderExtras after success.
// Safe wrapper without rewriting Part 2.
const __orig_loadHomeForecast = (typeof loadHomeForecast === "function") ? loadHomeForecast : null;
if (__orig_loadHomeForecast) {
  window.loadHomeForecast = async function () {
    await __orig_loadHomeForecast();
    try { homePostRenderExtras(); } catch (e) { /* ignore */ }
  };
}

// ----------------------------
// Trolling Depth Calculator
// Adds: line type selection (thinner line gets a boost).
// ----------------------------

// Simple depth model (not physics-perfect, but consistent):
// depth_ft = k * (weight_oz^a) * (line_out_ft^b) / (speed_mph^c) * lineFactor / lineTestFactor
// and clamp between 0 and line_out.
function calcTrollingDepth(params) {
  const speed = Math.max(0.1, safeNum(params.speed, 1.5));
  const weight = Math.max(0.1, safeNum(params.weight, 2));
  const lineOut = Math.max(0, safeNum(params.lineOut, 50));
  const lineTest = Math.max(4, safeNum(params.lineTest, 12));
  const lineType = String(params.lineType || "Monofilament");

  // Line type factor: thinner = deeper for same weight/speed.
  // These are relative nudges, not gospel.
  let lineFactor = 1.0;
  if (lineType === "Braid") lineFactor = 1.12;
  else if (lineType === "Fluorocarbon") lineFactor = 1.06;
  else if (lineType === "Copolymer") lineFactor = 1.02;
  else lineFactor = 1.0; // Mono baseline

  // Slightly penalize higher test (thicker)
  const testFactor = Math.pow(lineTest / 12, 0.12);

  // Constants tuned for plausible outputs
  const k = 0.085;
  const a = 0.9;
  const b = 0.95;
  const c = 1.15;

  let depth = k * Math.pow(weight, a) * Math.pow(lineOut, b) / Math.pow(speed, c);
  depth = depth * lineFactor / testFactor;

  // Cannot exceed line out, and no negative
  depth = Math.max(0, Math.min(depth, lineOut));
  return depth;
}

function renderDepthPage() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>
      <div class="small muted">Simple estimate. Use as a starting point.</div>

      <div style="margin-top:14px;">
        <div class="fieldLabel">Speed (mph)</div>
        <input id="d_speed" type="number" step="0.1" value="${escHtml(String(state.depth_speed || 1.3))}">
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Weight (oz)</div>
        <input id="d_weight" type="number" step="0.5" value="${escHtml(String(state.depth_weight || 2))}">
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Line out (ft)</div>
        <input id="d_lineout" type="number" step="1" value="${escHtml(String(state.depth_lineout || 100))}">
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Line test (lb)</div>
        <select id="d_linetest">
          ${[6,8,10,12,15,20,30,40].map(function(n){
            const sel = (Number(state.depth_linetest || 12) === n) ? "selected" : "";
            return '<option ' + sel + '>' + n + '</option>';
          }).join("")}
        </select>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Line type</div>
        <select id="d_linetype">
          ${["Monofilament","Copolymer","Fluorocarbon","Braid"].map(function(t){
            const sel = (String(state.depth_linetype || "Monofilament") === t) ? "selected" : "";
            const note =
              (t === "Braid") ? " (thinner, deeper)" :
              (t === "Fluorocarbon") ? " (a bit deeper)" :
              (t === "Copolymer") ? " (slightly deeper)" :
              " (baseline)";
            return '<option value="' + escHtml(t) + '" ' + sel + '>' + escHtml(t + note) + '</option>';
          }).join("")}
        </select>
        <div class="small muted" style="margin-top:8px;">Thinner lines usually track deeper at the same speed and weight.</div>
      </div>

      <button id="d_calc" class="primaryBtn" style="margin-top:14px;">Calculate</button>

      <div id="d_out" class="card" style="margin-top:12px; display:none;">
        <div class="small muted" style="font-weight:900;">Estimated depth</div>
        <div id="d_depth" style="font-size:38px; font-weight:900;"></div>
        <div id="d_hint" class="small muted" style="margin-top:6px;"></div>
      </div>
    </div>
  `
  );

  const speedEl = document.getElementById("d_speed");
  const weightEl = document.getElementById("d_weight");
  const lineOutEl = document.getElementById("d_lineout");
  const lineTestEl = document.getElementById("d_linetest");
  const lineTypeEl = document.getElementById("d_linetype");

  function calculate() {
    const p = {
      speed: Number(speedEl.value),
      weight: Number(weightEl.value),
      lineOut: Number(lineOutEl.value),
      lineTest: Number(lineTestEl.value),
      lineType: String(lineTypeEl.value)
    };

    // persist
    state.depth_speed = p.speed;
    state.depth_weight = p.weight;
    state.depth_lineout = p.lineOut;
    state.depth_linetest = p.lineTest;
    state.depth_linetype = p.lineType;
    saveState();

    const depth = calcTrollingDepth(p);

    const out = document.getElementById("d_out");
    const depthEl = document.getElementById("d_depth");
    const hintEl = document.getElementById("d_hint");

    out.style.display = "block";
    depthEl.textContent = Math.round(depth) + " ft";

    const hint =
      "Speed " + p.speed + " mph, " +
      "Weight " + p.weight + " oz, " +
      "Line out " + p.lineOut + " ft, " +
      "Line " + p.lineTest + " lb, " +
      p.lineType + ".";
    hintEl.textContent = hint;
  }

  document.getElementById("d_calc").addEventListener("click", calculate);
}

// ----------------------------
// Tips page (simple, keep as-is)
// ----------------------------
function renderTipsPage() {
  const page = pageEl();
  appendHtml(
    page,
    `
    <div class="card">
      <h2>Tips</h2>
      <div class="small muted">Quick notes for the tools.</div>
      <ul style="margin:10px 0 0 18px;">
        <li>Home: pick a date within the next 16 days to see forecast data.</li>
        <li>Big water is stricter. Small/protected is more forgiving.</li>
        <li>Depth calculator is an estimate. Current, lure drag, and speed changes matter.</li>
      </ul>
    </div>
  `
  );
}

// ----------------------------
// Router + render
// ----------------------------
function render() {
  // Build shell (from Part 1)
  renderShell();

  // Nav highlighting
  const navHome = document.getElementById("nav_home");
  const navDepth = document.getElementById("nav_depth");
  const navTips = document.getElementById("nav_tips");
  const activeBg = "rgba(111,191,74,0.30)";
  const inactiveBg = "rgba(111,191,74,0.15)";

  if (navHome) navHome.style.background = (state.route === "home") ? activeBg : inactiveBg;
  if (navDepth) navDepth.style.background = (state.route === "depth") ? activeBg : inactiveBg;
  if (navTips) navTips.style.background = (state.route === "tips") ? activeBg : inactiveBg;

  // Render page content
  if (state.route === "depth") renderDepthPage();
  else if (state.route === "tips") renderTipsPage();
  else renderHome();

  // Footer brand
  const foot = document.getElementById("footer_brand");
  if (foot) foot.textContent = "FishyNW.com";
}

// ----------------------------
// Boot
// ----------------------------
function boot() {
  loadState();

  // Defaults
  if (!state.route) state.route = "home";
  if (!state.waterType) state.waterType = "Small / protected";
  if (!state.craft) state.craft = "Kayak (paddle)";
  if (!state.dateIso) state.dateIso = isoTodayLocal();

  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// ============================
// app.js (PART 3 OF 3) END
// ============================