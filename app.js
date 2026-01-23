// app.js
// FishyNW.com - Fishing Tools (Web)
// Version 1.1.0
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.

"use strict";

const APP_VERSION = "1.1.0";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";

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
  bigWater: false,
  motorized: false
};

// ----------------------------
// DOM root
// ----------------------------
let app = null;

// ----------------------------
// Styles
// ----------------------------
function injectStyles() {
  const css = `
  :root { --green:#8fd19e; --green2:#7cc78f; --greenBorder:#6fbf87; --text:#0b2e13; }

  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, Arial, sans-serif; }

  .wrap { max-width: 760px; margin: 0 auto; padding: 12px; }

  .header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .logo img { max-width:240px; }

  .nav { margin-top:12px; display:grid; grid-template-columns: repeat(5,1fr); gap:8px; }

  .navBtn {
    padding:10px;
    border-radius:10px;
    border:1px solid var(--greenBorder);
    background:var(--green);
    font-weight:900;
  }
  .navBtnActive { background:#eee; }

  .card {
    border-radius:16px;
    padding:14px;
    margin-top:12px;
    border:1px solid rgba(0,0,0,0.15);
    background:rgba(0,0,0,0.03);
  }

  .hourList { margin-top: 10px; }
  .hourRow {
    display: grid;
    grid-template-columns: 110px 1fr 50px;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(0,0,0,0.10);
    background: rgba(0,0,0,0.02);
    margin-top: 8px;
  }
  .hourTime { font-weight:900; }
  .hourWind { font-weight:900; }
  .hourWind span { opacity:0.75; }
  .hourDir { text-align:right; font-weight:900; }

  .grid2 {
    display:grid;
    grid-template-columns: repeat(2,1fr);
    gap:10px;
  }
  .miniBox {
    border:1px solid rgba(0,0,0,0.14);
    border-radius:14px;
    padding:12px;
    text-align:center;
  }
  .miniLbl { font-size:13px; opacity:0.8; }
  .miniVal { font-size:26px; font-weight:900; }

  .goBtn { background:#8fd19e; }
  .cautionBtn { background:#f1c40f; }
  .noGoBtn { background:#e74c3c; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

// ----------------------------
// Utilities
// ----------------------------
function escHtml(s) {
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
}

// 1/23 2 AM
function formatMDTime(dt) {
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  let h = dt.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return m + "/" + d + " " + h + " " + ampm;
}

function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.floor((deg / 22.5) + 0.5) % 16;
  return dirs[i];
}

// ----------------------------
// Ratings
// ----------------------------
function computeWindRating(speed, gust) {
  const s = Number(speed);
  const g = Number(gust);

  let windWeight = state.motorized ? 0.6 : 1.0;

  const effS = s * windWeight;
  const effG = g * windWeight;

  if (!state.bigWater) {
    if (effS >= 16 || effG >= 23) return "NO GO";
    if (effS > 10 || effG > 15) return "CAUTION";
    return "GO";
  }

  if (effS >= 13 || effG >= 19) return "NO GO";
  if (effS > 8 || effG > 12) return "CAUTION";
  return "GO";
}

// Temp overrides
function computeTempOverride(tmin, tmax) {
  if (tmin < 10) return "NO GO";
  if (tmin < 20) return "CAUTION";
  if (tmax > 105) return "NO GO";
  if (tmax > 90) return "CAUTION";
  return "";
}

function combineRatings(wind, temp) {
  if (temp === "NO GO" || wind === "NO GO") return "NO GO";
  if (temp === "CAUTION" || wind === "CAUTION") return "CAUTION";
  return "GO";
}

function ratingBtnClass(r) {
  if (r === "GO") return "goBtn";
  if (r === "CAUTION") return "cautionBtn";
  return "noGoBtn";
}

// ----------------------------
// Geocoding API
// ----------------------------
async function geocodeSearch(query) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(query) + "&count=10&language=en";

  const r = await fetch(url);
  const data = await r.json();
  return (data.results || []).map(x => ({
    label: x.name + ", " + (x.admin1 || ""),
    lat: x.latitude,
    lon: x.longitude
  }));
}

// ----------------------------
// Weather API
// ----------------------------
async function fetchWeather(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + lat +
    "&longitude=" + lon +
    "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max" +
    "&wind_speed_unit=mph" +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  const r = await fetch(url);
  return await r.json();
}

// ----------------------------
// Wind split
// ----------------------------
function splitCurrentFutureWind(times, speeds, gusts, dirs) {
  const now = new Date();
  const cur = [];
  const fut = [];

  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i]);
    const item = {
      label: formatMDTime(dt),
      mph: speeds[i].toFixed(1),
      gust: gusts[i].toFixed(1),
      dir: degToCompass(dirs[i]),
      rating: computeWindRating(speeds[i], gusts[i]),
      score: speeds[i] + gusts[i],
      dt
    };
    if (dt <= now) cur.push(item);
    else fut.push(item);
  }

  return {
    current: cur.slice(-6),
    future: fut.slice(0, 12)
  };
}

// ----------------------------
// Graph renderer
// ----------------------------
function renderWindGraph(canvasId, times, speeds) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const max = Math.max(...speeds, 5);

  ctx.beginPath();
  ctx.moveTo(0, h);

  speeds.slice(0,12).forEach((v,i) => {
    const x = (i / 11) * w;
    const y = h - (v / max) * h;
    ctx.lineTo(x,y);
  });

  ctx.lineTo(w,h);
  ctx.closePath();
  ctx.fillStyle = "rgba(143,209,158,0.6)";
  ctx.fill();
}
// ----------------------------
// Header + Nav
// ----------------------------
function renderHeaderAndNav() {
  app.innerHTML = `
    <div class="wrap">
      <div class="header">
        <div class="logo"><img src="${LOGO_URL}"></div>
        <div style="font-weight:900">FishyNW Tools<br><span style="opacity:.7">v ${APP_VERSION}</span></div>
      </div>
      <div class="nav">
        <button class="navBtn ${state.tool==="Best fishing times"?"navBtnActive":""}" onclick="switchTool('Best fishing times')">Times</button>
        <button class="navBtn ${state.tool==="Weather/Wind"?"navBtnActive":""}" onclick="switchTool('Weather/Wind')">Weather/Wind</button>
      </div>
      <div id="page"></div>
    </div>
  `;
}

function switchTool(t) {
  state.tool = t;
  render();
}

function pageEl() {
  return document.getElementById("page");
}

// ----------------------------
// Location Picker
// ----------------------------
function renderLocationPicker(container, onResolved) {
  container.innerHTML += `
    <div class="card">
      <input id="place_input" placeholder="Spokane, WA or Hauser Lake">
      <button onclick="useGps()">Use my location</button>
      <button onclick="searchPlace()">Search</button>
      <div id="place_matches"></div>
      <div id="place_using" style="margin-top:6px;opacity:.8"></div>
    </div>
  `;

  if (hasResolvedLocation()) {
    document.getElementById("place_using").innerHTML =
      "Using: " + state.placeLabel;
    if (onResolved) onResolved();
  }
}

async function useGps() {
  navigator.geolocation.getCurrentPosition(pos => {
    state.lat = pos.coords.latitude;
    state.lon = pos.coords.longitude;
    state.placeLabel = "Current location";
    render();
  });
}

async function searchPlace() {
  const q = document.getElementById("place_input").value;
  const matches = await geocodeSearch(q);
  const out = document.getElementById("place_matches");
  out.innerHTML = matches.map((m,i)=>`
    <div onclick="selectPlace(${i})">${m.label}</div>
  `).join("");
  state.matches = matches;
}

function selectPlace(i) {
  const m = state.matches[i];
  state.lat = m.lat;
  state.lon = m.lon;
  state.placeLabel = m.label;
  render();
}

// ----------------------------
// Best Times Page
// ----------------------------
function renderBestTimesPage() {
  const page = pageEl();
  page.innerHTML = `
    <div class="card">
      <h2>Best Fishing Times</h2>
      <div>Sunrise and sunset based windows.</div>
    </div>
  `;
  renderLocationPicker(page, ()=>{});
}

// ----------------------------
// Weather / Wind Page
// ----------------------------
async function renderWeatherWindPage() {
  const page = pageEl();
  page.innerHTML = `
    <div class="card">
      <h2>Weather / Wind</h2>
      <div>Wind focused with temperature + rain safety.</div>
    </div>

    <div class="card">
      <label><input type="checkbox" onchange="state.bigWater=this.checked"> Big water</label><br>
      <label><input type="checkbox" onchange="state.motorized=this.checked"> Motorized kayak</label>
    </div>
  `;

  renderLocationPicker(page, loadWeather);

  page.innerHTML += `<div id="weather_out"></div>`;

  async function loadWeather() {
    if (!hasResolvedLocation()) return;

    const out = document.getElementById("weather_out");
    out.innerHTML = "Loading...";

    const data = await fetchWeather(state.lat, state.lon);
    const daily = data.daily;
    const hourly = data.hourly;

    const tmax = Math.round(daily.temperature_2m_max[0]);
    const tmin = Math.round(daily.temperature_2m_min[0]);
    const rain = Math.round(daily.precipitation_probability_max[0]);
    const maxWind = Math.round(daily.wind_speed_10m_max[0]);
    const maxGust = Math.round(daily.wind_gusts_10m_max[0]);

    const tempOverride = computeTempOverride(tmin, tmax);

    const parts = splitCurrentFutureWind(
      hourly.time,
      hourly.wind_speed_10m,
      hourly.wind_gusts_10m,
      hourly.wind_direction_10m
    );

    let worst = null;
    parts.current.concat(parts.future).forEach(x=>{
      if (!worst || x.score > worst.score) worst = x;
    });

    const overall = combineRatings(worst.rating, tempOverride);

    let html = `
      <div class="card">
        <div class="grid2">
          <div class="miniBox"><div class="miniLbl">Max wind</div><div class="miniVal">${maxWind} mph</div></div>
          <div class="miniBox"><div class="miniLbl">Max gust</div><div class="miniVal">${maxGust} mph</div></div>
          <div class="miniBox"><div class="miniLbl">Temp</div><div class="miniVal">${tmax}/${tmin} F</div></div>
          <div class="miniBox"><div class="miniLbl">Rain</div><div class="miniVal">${rain}%</div></div>
        </div>
      </div>

      <div class="card">
        <button class="${ratingBtnClass(overall)}">${overall}</button>
      </div>

      <div class="card" id="hourly_card" style="display:none">
        <canvas id="wind_graph" width="700" height="140"></canvas>
        <div id="hour_blocks"></div>
      </div>
    `;

    out.innerHTML = html;

    renderWindGraph("wind_graph", hourly.time, hourly.wind_speed_10m);
    document.getElementById("hourly_card").style.display = "block";

    const hb = document.getElementById("hour_blocks");
    function rows(list) {
      return list.map(x=>`
        <div class="hourRow">
          <div class="hourTime">${x.label}</div>
          <div class="hourWind">${x.mph} mph <span>/ gust ${x.gust}</span></div>
          <div class="hourDir">${x.dir}</div>
        </div>
      `).join("");
    }

    hb.innerHTML = `
      <div class="card compact">
        <strong>Current</strong>
        ${rows(parts.current)}
      </div>
      <div class="card compact">
        <strong>Future</strong>
        ${rows(parts.future)}
      </div>
    `;
  }
}

// ----------------------------
// Render router
// ----------------------------
function render() {
  renderHeaderAndNav();
  if (state.tool === "Best fishing times") renderBestTimesPage();
  if (state.tool === "Weather/Wind") renderWeatherWindPage();
}

// ----------------------------
// Boot
// ----------------------------
function boot() {
  app = document.getElementById("app");
  injectStyles();
  render();
}

document.addEventListener("DOMContentLoaded", boot);
