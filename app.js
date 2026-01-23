"use strict";

const APP_VERSION = "1.0.10";
const LOGO_URL =
  "https://fishynw.com/wp-content/uploads/2025/07/FishyNW-Logo-transparent-with-letters-e1755409608978.png";

// ----------------------------
// State
// ----------------------------
const state = {
  tool: "Home",
  lat: null,
  lon: null,
  placeLabel: "",
  matches: [],
  selectedIndex: 0,
  speedWatchId: null,

  dayIso: "",
  waterType: "small",
  craftType: "kayak_paddle"
};

// ----------------------------
// Utils
// ----------------------------
function escHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
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
  state.lat = lat;
  state.lon = lon;
  state.placeLabel = label || "";
  saveLastLocation(lat, lon, label || "");
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
  return out.filter(function (x) {
    return Number.isFinite(x.v);
  });
}

// ----------------------------
// Local storage
// ----------------------------
const LAST_LOC_KEY = "fishynw_last_location_v2";

function saveLastLocation(lat, lon, label) {
  try {
    localStorage.setItem(
      LAST_LOC_KEY,
      JSON.stringify({ lat: lat, lon: lon, label: label || "" })
    );
  } catch (e) {}
}

function loadLastLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOC_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o) return null;
    if (!Number.isFinite(Number(o.lat)) || !Number.isFinite(Number(o.lon))) return null;
    return { lat: Number(o.lat), lon: Number(o.lon), label: String(o.label || "") };
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
// Styles (STACKED INPUTS)
// ----------------------------
(function injectStyles() {
  const css = `
  :root { --green:#8fd19e; --green2:#7cc78f; --text:#0b2e13; }

  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

  .wrap { max-width: 760px; margin: 0 auto; padding: 12px 12px 36px 12px; }
  .header { text-align:center; margin-top:6px; }
  .logo img { max-width: 240px; width:100%; }
  .title { font-weight:900; font-size:20px; margin-top:6px; }

  .nav { margin-top: 12px; display:grid; grid-template-columns: 1fr; gap:10px; }
  .navBtn {
    padding:14px;
    border-radius:14px;
    border:1px solid #6fbf87;
    background: var(--green);
    font-weight:900;
    cursor:pointer;
  }

  .card {
    border-radius: 16px;
    padding: 14px;
    margin-top: 12px;
    border: 1px solid rgba(0,0,0,0.14);
    background: rgba(0,0,0,0.03);
  }

  .small { font-size:13px; opacity:0.75; }
  .list li { margin-bottom:6px; }

  .controlGrid {
    display:grid;
    grid-template-columns: 1fr;
    gap:10px;
  }

  .btnStack {
    display:grid;
    grid-template-columns: 1fr;
    gap:10px;
    margin-top:8px;
  }

  .controlTile {
    border-radius:14px;
    border:1px solid rgba(0,0,0,0.14);
    background:#fff;
    padding:10px;
    width:100%;
  }

  .controlLabel {
    font-size:12px;
    font-weight:900;
    opacity:0.7;
    margin-bottom:6px;
    text-transform:uppercase;
  }

  .controlField {
    width:100%;
    padding:14px;
    border-radius:14px;
    border:1px solid rgba(0,0,0,0.14);
    font-size:16px;
    font-weight:900;
  }

  .tilesGrid {
    display:grid;
    grid-template-columns: repeat(2,1fr);
    gap:10px;
    margin-top:10px;
  }

  .tile {
    border-radius:14px;
    border:1px solid rgba(0,0,0,0.14);
    padding:10px;
    background:#fff;
  }

  .tileTop { font-size:12px; opacity:0.7; font-weight:900; }
  .tileVal { font-size:20px; font-weight:900; }

  .meterBar {
    margin-top:10px;
    height:14px;
    border-radius:999px;
    display:flex;
    overflow:hidden;
  }
  .segG { flex:1; background:#9dd9ad; }
  .segY { flex:1; background:#ffe08a; }
  .segR { flex:1; background:#f6a3a3; }

  .meterNeedle {
    position:absolute;
    top:-4px;
    width:0;
    height:0;
    border-left:6px solid transparent;
    border-right:6px solid transparent;
    border-top:10px solid #000;
  }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

// ----------------------------
// App boot
// ----------------------------
document.addEventListener("DOMContentLoaded", boot);

function boot() {
  const root = document.getElementById("app");
  root.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  appendHtml(
    wrap,
    `
    <div class="header">
      <div class="logo"><img src="${LOGO_URL}"></div>
      <div class="title">Weather/Wind + Best Times</div>
      <div class="small">v ${APP_VERSION}</div>
    </div>

    <div class="nav">
      <button class="navBtn" id="nav_depth">Depth</button>
      <button class="navBtn" id="nav_tips">Tips</button>
      <button class="navBtn" id="nav_speed">Speed</button>
    </div>

    <div id="content"></div>
  `
  );

  document.getElementById("nav_depth").onclick = function () {
    state.tool = "Depth";
    render();
  };
  document.getElementById("nav_tips").onclick = function () {
    state.tool = "Tips";
    render();
  };
  document.getElementById("nav_speed").onclick = function () {
    state.tool = "Speed";
    render();
  };

  const last = loadLastLocation();
  if (last) {
    state.lat = last.lat;
    state.lon = last.lon;
    state.placeLabel = last.label || "";
  }

  state.dayIso = isoTodayLocal();
  render();
}

// ----------------------------
// Render router
// ----------------------------
function render() {
  const el = document.getElementById("content");
  el.innerHTML = "";

  if (state.tool === "Depth") renderDepth(el);
  else if (state.tool === "Tips") renderTips(el);
  else if (state.tool === "Speed") renderSpeed(el);
  else renderHome(el);
}

// ----------------------------
// Home
// ----------------------------
function renderHome(el) {
  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Weather/Wind + Best Times</div>
      <div class="small">Pick a date once. Weather and fishing windows auto-generate.</div>

      <div class="controlGrid">
        <div class="controlTile">
          <div class="controlLabel">Date</div>
          <input id="home_date" type="date" class="controlField" value="${state.dayIso}">
        </div>

        <div class="controlTile">
          <div class="controlLabel">Water</div>
          <select id="home_water" class="controlField">
            <option value="small">Small / protected</option>
            <option value="big">Big water / open</option>
          </select>
        </div>

        <div class="controlTile">
          <div class="controlLabel">Craft</div>
          <select id="home_craft" class="controlField">
            <option value="kayak_paddle">Kayak (paddle)</option>
            <option value="kayak_motor">Kayak (motorized)</option>
            <option value="boat_small">Small boat</option>
          </select>
        </div>

        <div class="controlTile">
          <div class="controlLabel">Forecast range</div>
          <div id="home_range" style="font-weight:900">--</div>
        </div>
      </div>
    </div>
  `
  );

  renderLocationPicker(el);

  if (!hasResolvedLocation()) {
    appendHtml(
      el,
      `<div class="card"><b>Set a location to load weather and fishing windows.</b></div>`
    );
    bindHomeControls();
    return;
  }

  loadWeatherAndTimes(el);
  bindHomeControls();
}
// app.js - PART 2 of 2
// Continues from renderHome(el) in PART 1

// ----------------------------
// Home bindings
// ----------------------------
function bindHomeControls() {
  const dateEl = document.getElementById("home_date");
  if (dateEl) {
    dateEl.onchange = function (e) {
      state.dayIso = e.target.value;
      render();
    };
  }

  const waterEl = document.getElementById("home_water");
  if (waterEl) {
    waterEl.value = state.waterType;
    waterEl.onchange = function (e) {
      state.waterType = e.target.value;
      render();
    };
  }

  const craftEl = document.getElementById("home_craft");
  if (craftEl) {
    craftEl.value = state.craftType;
    craftEl.onchange = function (e) {
      state.craftType = e.target.value;
      render();
    };
  }
}

// ----------------------------
// Location picker
// ----------------------------
function renderLocationPicker(el) {
  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Location</div>
      <input id="loc_input" class="controlField" placeholder="City, State or ZIP" value="${escHtml(
        state.placeLabel || ""
      )}">
      <div class="btnStack">
        <button class="navBtn" id="loc_search">Search place</button>
        <button class="navBtn" id="loc_gps">Use my location</button>
      </div>
      <div id="loc_matches" style="margin-top:10px"></div>
      <div class="small">Using: ${escHtml(state.placeLabel || "none")}</div>
    </div>
  `
  );

  const input = document.getElementById("loc_input");

  input.addEventListener("input", function () {
    state.lat = null;
    state.lon = null;
    state.placeLabel = "";
    clearLastLocation();
    const box = document.getElementById("loc_matches");
    if (box) box.innerHTML = "";
  });

  document.getElementById("loc_search").onclick = function () {
    const q = input.value.trim();
    if (!q) return;
    geocodeSearch(q);
  };

  document.getElementById("loc_gps").onclick = function () {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        setResolvedLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          "Current location"
        );
        render();
      },
      function () {
        alert("Location permission denied.");
      }
    );
  };
}

// ----------------------------
// Geocoding
// ----------------------------
function geocodeSearch(q) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=5&name=" +
    encodeURIComponent(q);

  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const list = data && data.results ? data.results : [];
      const box = document.getElementById("loc_matches");
      if (!box) return;

      box.innerHTML = "";

      if (!list.length) {
        box.innerHTML =
          "<div class='small' style='margin-top:6px'>No matches found. Try a nearby city name.</div>";
        return;
      }

      list.forEach(function (p) {
        const label =
          p.name +
          ", " +
          (p.admin1 || "") +
          ", " +
          (p.country || "");
        const btn = document.createElement("button");
        btn.className = "navBtn";
        btn.style.marginTop = "8px";
        btn.textContent = label;
        btn.onclick = function () {
          setResolvedLocation(p.latitude, p.longitude, label);
          render();
        };
        box.appendChild(btn);
      });
    })
    .catch(function () {
      const box = document.getElementById("loc_matches");
      if (box) {
        box.innerHTML =
          "<div class='small' style='margin-top:6px'>Could not search right now. Try again.</div>";
      }
    });
}

// ----------------------------
// Weather + Times loader
// ----------------------------
function loadWeatherAndTimes(el) {
  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    "latitude=" +
    state.lat +
    "&longitude=" +
    state.lon +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&hourly=wind_speed_10m,wind_gusts_10m" +
    "&timezone=auto";

  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const daily = data.daily || {};
      const dailyDays = daily.time || [];

      const clamped = clampDateToDailyList(state.dayIso, dailyDays);
      state.dayIso = clamped;

      const idx = dailyDays.indexOf(clamped);

      const tmin = safeNum(daily.temperature_2m_min[idx], 0);
      const tmax = safeNum(daily.temperature_2m_max[idx], 0);
      const rain = safeNum(daily.precipitation_probability_max[idx], 0);

      const hourlyTimes = (data.hourly && data.hourly.time) ? data.hourly.time : [];
      const hourlyWind = (data.hourly && data.hourly.wind_speed_10m) ? data.hourly.wind_speed_10m : [];
      const hourlyGust = (data.hourly && data.hourly.wind_gusts_10m) ? data.hourly.wind_gusts_10m : [];

      const windDay = filterHourlyToDate(hourlyTimes, hourlyWind, clamped);
      const gustDay = filterHourlyToDate(hourlyTimes, hourlyGust, clamped);

      let maxS = 0;
      let maxG = 0;

      windDay.forEach(function (x) {
        if (x.v > maxS) maxS = x.v;
      });
      gustDay.forEach(function (x) {
        if (x.v > maxG) maxG = x.v;
      });

      const status = computeGoStatus(
        tmin,
        tmax,
        maxS,
        maxG,
        state.waterType,
        state.craftType
      );

      const rangeEl = document.getElementById("home_range");
      if (rangeEl && dailyDays.length) {
        rangeEl.textContent =
          dailyDays[0] + " to " + dailyDays[dailyDays.length - 1];
      }

      renderOverview(el, tmin, tmax, rain, maxS, maxG, status);
      renderExposure(el, tmin, tmax, rain, maxS, maxG);
      renderBestTimes(el);
    })
    .catch(function () {
      appendHtml(
        el,
        `<div class="card"><b>Could not load forecast right now.</b><div class="small">Try again in a moment.</div></div>`
      );
    });
}

// ----------------------------
// Overview tiles + meter
// ----------------------------
function renderOverview(el, tmin, tmax, rain, maxS, maxG, status) {
  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Overview - ${state.dayIso}</div>

      <div class="tilesGrid">
        <div class="tile">
          <div class="tileTop">Temperature</div>
          <div class="tileVal">${Math.round(tmin)} to ${Math.round(tmax)} F</div>
        </div>

        <div class="tile">
          <div class="tileTop">Rain chance</div>
          <div class="tileVal">${Math.round(rain)} %</div>
        </div>

        <div class="tile">
          <div class="tileTop">Max wind</div>
          <div class="tileVal">${Math.round(maxS)} mph</div>
        </div>

        <div class="tile">
          <div class="tileTop">Max gust</div>
          <div class="tileVal">${Math.round(maxG)} mph</div>
        </div>
      </div>

      <div style="margin-top:12px;font-weight:900">
        Boating / Kayak status:
        <span>${status.label}</span>
      </div>

      <div style="position:relative;margin-top:6px">
        <div class="meterBar">
          <div class="segG"></div>
          <div class="segY"></div>
          <div class="segR"></div>
        </div>
        <div class="meterNeedle" style="left:${status.needlePct}%"></div>
      </div>

      <div class="small">${status.message}</div>
    </div>
  `
  );
}

// ----------------------------
// GO / CAUTION / NO-GO logic
// ----------------------------
function computeGoStatus(tmin, tmax, maxS, maxG, waterType, craftType) {
  let score = 0;

  score += maxS * 2;
  score += maxG * 1.5;

  if (waterType === "big") score += 10;
  if (craftType === "kayak_paddle") score += 10;
  if (craftType === "boat_small") score -= 5;

  const avg = (tmin + tmax) / 2;

  let forceNoGo = false;
  let forceAtLeastCaution = false;

  if (avg <= 28) forceNoGo = true;
  else if (avg <= 30) forceAtLeastCaution = true;

  let label = "GO";
  if (score >= 70) label = "NO-GO";
  else if (score >= 35) label = "CAUTION";

  if (forceNoGo) label = "NO-GO";
  else if (forceAtLeastCaution && label === "GO") label = "CAUTION";

  if (label === "NO-GO") score = Math.max(score, 75);
  else if (label === "CAUTION") score = Math.max(score, 45);
  else score = Math.min(score, 30);

  const needlePct = Math.max(0, Math.min(100, score));

  let message = "Generally favorable conditions.";
  if (label === "CAUTION")
    message = "Marginal conditions. Cold, wind, or exposure risk.";
  if (label === "NO-GO")
    message = "High risk. Cold exposure and wind make this unsafe.";

  return { label: label, needlePct: needlePct, message: message };
}

// ----------------------------
// Exposure tips
// ----------------------------
function renderExposure(el, tmin, tmax, rain, maxS, maxG) {
  const tips = exposureTips(tmin, tmax, rain, maxS, maxG);

  let html = "<ul class='list'>";
  tips.forEach(function (t) {
    html += "<li>" + escHtml(t) + "</li>";
  });
  html += "</ul>";

  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Exposure tips</div>
      ${html}
    </div>
  `
  );
}

function exposureTips(tmin, tmax, rain, maxS, maxG) {
  const out = [];

  const avg = (tmin + tmax) / 2;

  if (avg <= 35) {
    out.push(
      "Cold air/water risk. Strongly consider a drysuit or a proper cold-water wetsuit setup."
    );
    out.push(
      "Avoid cotton. Wear insulating layers that stay warm when damp (synthetic or wool)."
    );
    out.push("Bring a dry bag with a spare warm top, gloves, and a hat.");
  } else if (avg >= 75) {
    out.push("Hot weather: wear a sun shirt (UPF), hat, and breathable layers.");
    out.push("Hydrate and bring electrolytes if you will be out for hours.");
    out.push("Sunscreen matters even with clouds. Reapply and protect lips.");
  } else {
    out.push("Dress in layers and plan for changing conditions on the water.");
    out.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  }

  if (rain >= 40) {
    out.push("Rain likely: pack a waterproof shell and keep electronics in a dry bag.");
  }

  if (maxG >= 20 || maxS >= 15) {
    out.push("Wind can increase chill fast. Add a windproof outer layer and secure loose gear.");
  }

  out.push("Always wear a PFD. Cold shock happens fast, even near shore.");

  return out;
}

// ----------------------------
// Best fishing times (sunrise/sunset windows)
// ----------------------------
function renderBestTimes(el) {
  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    "latitude=" +
    state.lat +
    "&longitude=" +
    state.lon +
    "&daily=sunrise,sunset" +
    "&forecast_days=7" +
    "&timezone=auto";

  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const d = data.daily || {};
      const days = d.time || [];
      const sr = d.sunrise || [];
      const ss = d.sunset || [];

      const chosen = clampDateToDailyList(state.dayIso, days);
      state.dayIso = chosen;

      const idx = days.indexOf(chosen);
      if (idx < 0) return;

      const sunrise = new Date(sr[idx]);
      const sunset = new Date(ss[idx]);

      const morningStart = new Date(sunrise.getTime() - 60 * 60 * 1000);
      const morningEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
      const eveningStart = new Date(sunset.getTime() - 60 * 60 * 1000);
      const eveningEnd = new Date(sunset.getTime() + 60 * 60 * 1000);

      appendHtml(
        el,
        `
        <div class="card">
          <div class="title">Best Fishing Times</div>

          <div class="tile" style="margin-top:10px">
            <div class="tileTop">Morning window</div>
            <div class="tileVal">${escHtml(formatTime(morningStart))} - ${escHtml(
          formatTime(morningEnd)
        )}</div>
          </div>

          <div class="tile" style="margin-top:10px">
            <div class="tileTop">Evening window</div>
            <div class="tileVal">${escHtml(formatTime(eveningStart))} - ${escHtml(
          formatTime(eveningEnd)
        )}</div>
          </div>
        </div>
      `
      );
    })
    .catch(function () {});
}

// ----------------------------
// Depth page
// ----------------------------
function renderDepth(el) {
  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Trolling Depth Calculator</div>
      <div class="small">Simple estimate.</div>

      <div class="controlGrid" style="margin-top:10px">
        <div class="controlTile">
          <div class="controlLabel">Speed (mph)</div>
          <input id="d_spd" class="controlField" type="number" step="0.1" value="1.3">
        </div>
        <div class="controlTile">
          <div class="controlLabel">Weight (oz)</div>
          <input id="d_wgt" class="controlField" type="number" step="0.5" value="2">
        </div>
        <div class="controlTile">
          <div class="controlLabel">Line out (ft)</div>
          <input id="d_out" class="controlField" type="number" step="5" value="100">
        </div>
      </div>

      <button class="navBtn" id="d_calc" style="margin-top:10px">Calculate</button>

      <div id="d_res" style="margin-top:10px"></div>
    </div>
  `
  );

  document.getElementById("d_calc").onclick = function () {
    const spd = safeNum(document.getElementById("d_spd").value, 1.3);
    const wgt = safeNum(document.getElementById("d_wgt").value, 2);
    const outft = safeNum(document.getElementById("d_out").value, 100);

    const depth = 0.135 * (wgt / Math.pow(spd, 1.35)) * outft;

    document.getElementById("d_res").innerHTML =
      "<div class='tile'><div class='tileTop'>Estimated depth</div><div class='tileVal'>" +
      depth.toFixed(1) +
      " ft</div></div>";
  };
}

// ----------------------------
// Tips page
// ----------------------------
function renderTips(el) {
  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Species Tips</div>
      <div class="small">Quick general guidance.</div>
      <ul class="list">
        <li>Largemouth: frogs and jigs in weeds. Texas rigs in cover.</li>
        <li>Smallmouth: ned rigs and jerkbaits on rock and points.</li>
        <li>Trout: spoons and spinners. Troll 1.2 to 1.8 mph.</li>
      </ul>
    </div>
  `
  );
}

// ----------------------------
// Speed page
// ----------------------------
function renderSpeed(el) {
  appendHtml(
    el,
    `
    <div class="card">
      <div class="title">Speedometer</div>
      <div class="small">Uses GPS speed. Start moving.</div>
      <div class="tile" style="margin-top:10px">
        <div class="tileTop">GPS speed</div>
        <div class="tileVal" id="spd_val">--</div>
      </div>
    </div>
  `
  );

  if (!navigator.geolocation) return;

  if (state.speedWatchId !== null) {
    try {
      navigator.geolocation.clearWatch(state.speedWatchId);
    } catch (e) {}
  }

  state.speedWatchId = navigator.geolocation.watchPosition(
    function (pos) {
      const spd = pos.coords.speed;
      if (spd === null || spd === undefined) return;
      const mph = spd * 2.236936;
      const elv = document.getElementById("spd_val");
      if (elv) elv.textContent = mph.toFixed(1) + " mph";
    },
    function () {},
    { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 }
  );
}