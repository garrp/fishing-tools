// ============================
// app.js (PART 1 OF 5) BEGIN
// FishyNW.com - Fishing Tools (Web)
// CLEANED: removed waterType + craft from state
// ============================

"use strict";

const APP_VERSION = "Beta 1.0";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";

// ----------------------------
// Analytics consent (UNCHANGED)
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
  } catch (e) {}
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

// ----------------------------
// Persisted last location (UNCHANGED)
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v2";

function saveLastLocation(lat, lon, label) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    localStorage.setItem(
      LAST_LOC_KEY,
      JSON.stringify({
        lat: Number(lat),
        lon: Number(lon),
        label: String(label || "")
      })
    );
  } catch (e) {}
}

function loadLastLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearLastLocation() {
  try {
    localStorage.removeItem(LAST_LOC_KEY);
  } catch (e) {}
}

// ----------------------------
// STATE (UPDATED)
// ----------------------------
const state = {
  tool: "Home",
  lat: null,
  lon: null,
  placeLabel: "",
  matches: [],
  selectedIndex: 0,
  speedWatchId: null,

  // date still used
  dateIso: ""
};

// ----------------------------
// DOM
// ----------------------------
let app = null;

// ----------------------------
// Utilities (UNCHANGED)
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

// ============================
// app.js (PART 1 OF 5) END
// ============================
// ============================
// app.js (PART 2 OF 5) BEGIN
// CLEANED: removed geocodeSearch + "Search place" usage
// ============================

// ----------------------------
// API: Reverse Geocode (KEPT)
// ----------------------------
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
    return parts.join(", ") || null;
  } catch (e) {
    return null;
  }
}

// ----------------------------
// API: Sunrise/Sunset (UNCHANGED)
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

  return {
    days: data.daily.time || [],
    sunrise: data.daily.sunrise || [],
    sunset: data.daily.sunset || []
  };
}

function sunForDate(sunData, dateIso) {
  if (!sunData || !sunData.days) return null;
  const idx = sunData.days.indexOf(dateIso);
  if (idx < 0) return null;

  return {
    sunrise: new Date(sunData.sunrise[idx]),
    sunset: new Date(sunData.sunset[idx])
  };
}

// ----------------------------
// API: Weather (UNCHANGED)
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

  return {
    daily: {
      time: data.daily.time || [],
      tmin: data.daily.temperature_2m_min || [],
      tmax: data.daily.temperature_2m_max || [],
      popMax: data.daily.precipitation_probability_max || [],
      windMax: data.daily.wind_speed_10m_max || [],
      gustMax: data.daily.wind_gusts_10m_max || []
    },
    hourly: {
      time: data.hourly.time || [],
      wind: data.hourly.wind_speed_10m || []
    }
  };
}

// ----------------------------
// Forecast Cache (UNCHANGED)
// ----------------------------
const forecastCache = {
  key: "",
  ts: 0,
  wx: null,
  sun: null
};

const FORECAST_TTL_MS = 10 * 60 * 1000;

function cacheKey(lat, lon) {
  return lat.toFixed(4) + "," + lon.toFixed(4);
}

async function getForecastBundle(lat, lon) {
  const key = cacheKey(lat, lon);
  const now = Date.now();

  if (
    forecastCache.key === key &&
    forecastCache.wx &&
    forecastCache.sun &&
    now - forecastCache.ts < FORECAST_TTL_MS
  ) {
    return forecastCache;
  }

  const wx = await fetchWeatherWindMulti(lat, lon);
  const sun = await fetchSunTimesMulti(lat, lon);

  forecastCache.key = key;
  forecastCache.ts = now;
  forecastCache.wx = wx;
  forecastCache.sun = sun;

  return forecastCache;
}

// ============================
// LOCATION PICKER (UPDATED)
// ============================

function renderLocationPicker(container, placeKey, onResolved, opts) {
  const autoGps = !!(opts && opts.autoGps);

  appendHtml(
    container,
    `
    <div class="card">
      <h3>Location</h3>

      <div class="btnRow">
        <button id="${placeKey}_gps">Use my location</button>
      </div>

      <div id="${placeKey}_using" class="small muted" style="margin-top:10px;"></div>
    </div>
  `
  );

  const usingEl = document.getElementById(placeKey + "_using");

  function renderUsing() {
    if (hasResolvedLocation()) {
      const lbl = state.placeLabel || "Current location";
      usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(lbl);
    }
  }

  document
    .getElementById(placeKey + "_gps")
    .addEventListener("click", function () {
      if (!navigator.geolocation) return;

      usingEl.textContent = "Getting location...";

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          setResolvedLocation(lat, lon, "Current location");

          if (onResolved) onResolved();

          reverseGeocode(lat, lon).then(function (label) {
            if (label) {
              setResolvedLocation(lat, lon, label);
            }
            renderUsing();
            if (onResolved) onResolved();
          });
        },
        function () {
          usingEl.textContent = "Location error.";
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });

  if (autoGps && !hasResolvedLocation()) {
    setTimeout(() => {
      document.getElementById(placeKey + "_gps").click();
    }, 400);
  }

  renderUsing();
}

// ============================
// app.js (PART 2 OF 5) END
// ============================
// ============================
// app.js (PART 3 OF 5) BEGIN
// CLEANED: removed water/craft UI + simplified GO/NO-GO
// ============================

// ----------------------------
// Best fishing windows (UNCHANGED)
// ----------------------------
function computeBestFishingWindows(sunrise, sunset) {
  return [
    {
      name: "Dawn window",
      start: new Date(sunrise.getTime() - 90 * 60000),
      end: new Date(sunrise.getTime() + 60 * 60000)
    },
    {
      name: "Dusk window",
      start: new Date(sunset.getTime() - 60 * 60000),
      end: new Date(sunset.getTime() + 90 * 60000)
    }
  ];
}

// ----------------------------
// SIMPLIFIED STATUS LOGIC
// GO or NO-GO only
// ----------------------------
function computeGoStatus(inputs) {
  const wind = safeNum(inputs.windMax, 0);
  const gust = safeNum(inputs.gustMax, wind);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);

  const avg = (tmin + tmax) / 2;

  let score = 0;

  // Wind risk
  if (wind > 12) score += 30;
  if (wind > 16) score += 40;
  if (wind > 20) score += 50;

  // Gust risk
  if (gust > 20) score += 30;
  if (gust > 30) score += 40;

  // Cold risk (important for kayak safety)
  if (avg < 50) score = Math.max(score, 50);
  if (avg < 40) score = Math.max(score, 80);

  let label = score >= 60 ? "NO-GO" : "GO";

  return {
    label: label,
    needlePct: Math.min(100, score),
    message:
      label === "GO"
        ? "Conditions look reasonable. Stay aware and fish smart."
        : "Conditions are risky. Consider staying off the water."
  };
}

// ----------------------------
// Exposure tips (UNCHANGED)
// ----------------------------
function computeExposureTips(inputs) {
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const wind = safeNum(inputs.windMax, 0);

  const avg = (tmin + tmax) / 2;

  const tips = [];

  if (avg < 50) {
    tips.push("Cold conditions: wear non-cotton layers.");
    tips.push("Dress for water temperature, not air.");
  }

  if (wind > 12) {
    tips.push("Wind can build quickly. Stay near safe water.");
  }

  if (tmax > 75) {
    tips.push("Hydrate early and often.");
  }

  tips.push("Keep spare gear in a dry bag.");

  return tips;
}

// ----------------------------
// HOME RENDER (UI preserved)
// ----------------------------
function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Date</div>
        <input id="home_date" type="date" />
      </div>
    </div>
  `
  );

  const dateInput = document.getElementById("home_date");

  if (!state.dateIso) state.dateIso = isoTodayLocal();
  dateInput.value = state.dateIso;

  dateInput.addEventListener("change", function () {
    state.dateIso = dateInput.value;
    renderHomeDynamic();
  });

  renderLocationPicker(page, "home", function () {
    renderHomeDynamic();
  }, { autoGps: true });

  appendHtml(page, `<div id="home_dynamic"></div>`);

  renderHomeDynamic();

  async function renderHomeDynamic() {
    const dyn = document.getElementById("home_dynamic");
    if (!dyn || !hasResolvedLocation()) return;

    dyn.innerHTML = `
      <div class="card compact">
        <strong>Loading forecast...</strong>
      </div>
    `;

    let bundle;
    try {
      bundle = await getForecastBundle(state.lat, state.lon);
    } catch (e) {
      dyn.innerHTML = `<div class="card">Error loading weather</div>`;
      return;
    }

    const wx = bundle.wx.daily;
    const idx = wx.time.indexOf(state.dateIso);

    if (idx < 0) {
      dyn.innerHTML = `<div class="card">Date not available</div>`;
      return;
    }

    const tmin = wx.tmin[idx];
    const tmax = wx.tmax[idx];
    const wind = wx.windMax[idx];
    const gust = wx.gustMax[idx];
    const rain = wx.popMax[idx];

    const status = computeGoStatus({
      windMax: wind,
      gustMax: gust,
      tmin: tmin,
      tmax: tmax
    });

    const tips = computeExposureTips({
      tmin: tmin,
      tmax: tmax,
      windMax: wind
    });

    dyn.innerHTML = `
      <div class="card">
        <h3>Overview</h3>

        <div class="tilesGrid">
          <div class="tile">
            <div class="tileTop">Temp</div>
            <div class="tileVal">${Math.round(tmin)} - ${Math.round(tmax)} F</div>
          </div>

          <div class="tile">
            <div class="tileTop">Wind</div>
            <div class="tileVal">${Math.round(wind)} mph</div>
          </div>

          <div class="tile">
            <div class="tileTop">Gust</div>
            <div class="tileVal">${Math.round(gust)} mph</div>
          </div>

          <div class="tile">
            <div class="tileTop">Rain</div>
            <div class="tileVal">${Math.round(rain || 0)}%</div>
          </div>
        </div>

        <div class="statusRow">
          <div class="sectionTitle">Status</div>
          <div class="pill">${status.label}</div>
        </div>

        <div class="small muted" style="margin-top:8px;">
          ${status.message}
        </div>
      </div>

      <div class="card">
        <h3>Tips</h3>
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
// Depth + Species (UNCHANGED DESIGN)
// ============================

// ----------------------------
// Depth Calculator (UNCHANGED)
// ----------------------------
function renderDepthCalculator() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>

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

    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);

    let depth = line * base * speedFactor;

    depth = Math.max(0, Math.min(depth, line * 0.95));

    out.style.display = "block";
    out.innerHTML =
      "<strong>Estimated depth:</strong> " +
      escHtml(depth.toFixed(1)) +
      " ft<br>" +
      "<div class='small muted' style='margin-top:6px;'>Estimate only. Lure drag and current will change results.</div>";
  });
}

// ----------------------------
// Species Tips (KEPT STYLE)
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();

  const tips = [
    {
      name: "Largemouth Bass",
      bullets: [
        "Shallow during spawn, deeper midday in summer.",
        "Target cover like docks, weeds, and wood.",
        "Wacky rigs and frogs work well."
      ]
    },
    {
      name: "Smallmouth Bass",
      bullets: [
        "Rocky areas and points.",
        "Wind improves bite activity.",
        "Use tubes, Ned rigs, and jerkbaits."
      ]
    },
    {
      name: "Kokanee",
      bullets: [
        "Troll around 1.0 to 1.5 mph.",
        "Use dodger and hoochie combos.",
        "Stay on depth with fish finder."
      ]
    },
    {
      name: "Trout",
      bullets: [
        "Early morning bite is best.",
        "Follow temperature layers.",
        "Use spinners or trolling setups."
      ]
    },
    {
      name: "Northern Pike",
      bullets: [
        "Ambush predators near weeds.",
        "Use flashy, aggressive lures.",
        "Fish edges and drop-offs."
      ]
    }
  ];

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Species Tips</h2>
      ${tips
        .map(
          (s) => `
        <div class="card compact">
          <h3>${escHtml(s.name)}</h3>
          <ul class="list">
            ${s.bullets.map((b) => `<li>${escHtml(b)}</li>`).join("")}
          </ul>
        </div>
      `
        )
        .join("")}
    </div>
  `
  );
}

// ============================
// app.js (PART 4 OF 5) END
// ============================
// ============================
// app.js (PART 5 OF 5) BEGIN
// Navigation + Render + Init (kept structure)
// ============================

// ----------------------------
// Header + Nav (same layout/style)
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
    '    <div class="logo"><a href="https://fishynw.com"><img src="' +
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
    '  <div class="footer"><strong>FishyNW.com</strong><br>Independent Northwest fishing tools</div>' +
    "</div>";

  const nav = document.getElementById("nav");

  const items = [];
  if (state.tool !== "Home") items.push(["Home", "Home"]);
  items.push(["Depth", "Trolling depth calculator"]);
  items.push(["Tips", "Species tips"]);

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
        state.tool = toolName;
        render();
      });
    }

    nav.appendChild(btn);
  }
}

// ----------------------------
// Render Router (unchanged structure)
// ----------------------------
function render() {
  renderHeaderAndNav();

  if (state.tool === "Home") {
    renderHome();
  } else if (state.tool === "Trolling depth calculator") {
    renderDepthCalculator();
  } else if (state.tool === "Species tips") {
    renderSpeciesTips();
  }
}

// ----------------------------
// App Init
// ----------------------------
function init() {
  app = document.getElementById("app");

  // restore last location
  const last = loadLastLocation();
  if (last) {
    state.lat = last.lat;
    state.lon = last.lon;
    state.placeLabel = last.label;
  }

  // default date
  state.dateIso = isoTodayLocal();

  render();

  // analytics consent (unchanged behavior)
  const consent = getConsent();
  if (consent === "granted") loadGa4();
}

// ----------------------------
window.addEventListener("load", init);

// ============================
// app.js (PART 5 OF 5) END
// ============================
