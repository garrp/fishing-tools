// app.js
// FishyNW.com - Fishing Tools (Web)
// Version 1.0.0
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.

"use strict";

// ----------------------------
// Config
// ----------------------------
const APP_VERSION = "1.0.0";
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
  speedWatchId: null
};

// ----------------------------
// DOM
// ----------------------------
const app = document.getElementById("app");

// ----------------------------
// Helpers
// ----------------------------
function appendHtml(el, html) {
  el.insertAdjacentHTML("beforeend", html);
}

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

function setResolvedLocation(lat, lon, label) {
  state.lat = lat;
  state.lon = lon;
  state.placeLabel = label || "";
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
}

function normalizePlaceQuery(s) {
  return String(s || "").trim().split(/\s+/).join(" ");
}

function clearSpeedWatch() {
  if (state.speedWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(state.speedWatchId);
    state.speedWatchId = null;
  }
}

// ----------------------------
// Styles (neutral + light green buttons)
// ----------------------------
(function injectStyles() {
  const css = `
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px 14px 44px 14px; }
  .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px; }
  .logo { max-width: 70%; }
  .logo img { width: 100%; max-width: 260px; height: auto; display:block; }
  .title { text-align:right; font-weight:800; font-size:18px; line-height:20px; }
  .small { opacity:0.82; font-size: 13.5px; }
  .nav { margin-top: 12px; margin-bottom: 12px; display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .navLabel { text-align:center; font-weight:900; opacity:0.85; padding-top: 10px; }
  .card { border-radius: 18px; padding: 16px; margin-top: 14px; border: 1px solid rgba(0,0,0,0.14); background: rgba(0,0,0,0.03); }
  .compact { margin-top: 10px; padding: 14px 16px; }
  h2 { margin: 0 0 6px 0; font-size: 18px; }
  h3 { margin: 0 0 8px 0; font-size: 16px; }
  input, select { width:100%; padding:10px; border-radius:10px; border:1px solid rgba(0,0,0,0.14); }
  button { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #6fbf87; background:#8fd19e; color:#0b2e13; font-weight:800; cursor:pointer; }
  button:hover { background:#7cc78f; color:#08210f; }
  button:active { background:#6bbb83; color:#04160a; }
  button:disabled { background:#cfe8d6; color:#6b6b6b; border-color:#b6d6c1; cursor:not-allowed; }
  .btnRow { display:flex; gap:10px; margin-top:10px; }
  .btnRow > button { flex: 1; }
  .footer { margin-top: 34px; padding-top: 18px; border-top: 1px solid rgba(0,0,0,0.14); text-align:center; font-size: 13.5px; opacity:0.90; }
  .sectionTitle { margin-top: 12px; font-weight: 900; }
  .list { margin: 8px 0 0 18px; }
  .list li { margin-bottom: 6px; }
  .dangerBtn { background:#f4a3a3 !important; border-color:#e48f8f !important; color:#3b0a0a !important; }
  .dangerBtn:hover { background:#ee8f8f !important; }
  @media (max-width: 520px) {
    .logo img { max-width: 70vw; }
    .nav { grid-template-columns: repeat(2, 1fr); }
  }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

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
      .map((x) => {
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
      .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  } catch (e) {
    return [];
  }
}

// ----------------------------
// API: Best times
// ----------------------------
async function fetchSunTimes(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&daily=sunrise,sunset&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();
  const sr = data && data.daily && data.daily.sunrise ? data.daily.sunrise[0] : null;
  const ss = data && data.daily && data.daily.sunset ? data.daily.sunset[0] : null;
  if (!sr || !ss) return null;

  return {
    sunrise: new Date(sr),
    sunset: new Date(ss)
  };
}

// ----------------------------
// API: Wind
// ----------------------------
async function fetchWind(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&hourly=wind_speed_10m&wind_speed_unit=mph&timezone=auto";

  const r = await fetch(url);
  const data = await r.json();
  const times = data && data.hourly && data.hourly.time ? data.hourly.time : [];
  const speeds = data && data.hourly && data.hourly.wind_speed_10m ? data.hourly.wind_speed_10m : [];
  return { times, speeds };
}

function splitCurrentFutureWind(times, speeds) {
  const now = new Date();
  const current = [];
  const future = [];

  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i]);
    const mph = speeds[i];
    if (!Number.isFinite(Number(mph))) continue;

    const label = dt.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric"
    });

    if (dt <= now) current.push({ label, mph: Number(mph).toFixed(1) });
    else future.push({ label, mph: Number(mph).toFixed(1) });
  }

  return {
    current: current.slice(-6),
    future: future.slice(0, 12)
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
  "Speedometer": "Speedometer"
};

function renderHeaderAndNav() {
  const title = PAGE_TITLES[state.tool] || "";

  app.innerHTML = `
    <div class="wrap">
      <div class="header">
        <div class="logo"><img src="${escHtml(LOGO_URL)}" alt="FishyNW"></div>
        <div class="title">${escHtml(title)}<div class="small">v ${escHtml(APP_VERSION)}</div></div>
      </div>
      <div class="nav" id="nav"></div>
      <div id="page"></div>
      <div class="footer"><strong>FishyNW.com</strong><br>Independent Northwest fishing tools</div>
    </div>
  `;

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

    if (toolName === state.tool) {
      const div = document.createElement("div");
      div.className = "navLabel";
      div.textContent = label;
      nav.appendChild(div);
    } else {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        clearSpeedWatch();
        state.tool = toolName;
        render();
      });
      nav.appendChild(btn);
    }
  }
}

function pageEl() {
  return document.getElementById("page");
}

// ----------------------------
// UI: Location Picker (reusable)
// ----------------------------
function renderLocationPicker(container, placeKey) {
  appendHtml(container, `
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
  `);

  const usingEl = document.getElementById(placeKey + "_using");
  const matchesEl = document.getElementById(placeKey + "_matches");
  const placeInput = document.getElementById(placeKey + "_place");

  if (hasResolvedLocation()) {
    const lbl = state.placeLabel
      ? state.placeLabel
      : "Lat " + state.lat.toFixed(4) + ", Lon " + state.lon.toFixed(4);
    usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(lbl);
  }

  document.getElementById(placeKey + "_gps").addEventListener("click", () => {
    if (!navigator.geolocation) {
      usingEl.textContent = "Geolocation not supported on this device/browser.";
      return;
    }

    usingEl.textContent = "Requesting location permission...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResolvedLocation(pos.coords.latitude, pos.coords.longitude, "");
        state.matches = [];
        state.selectedIndex = 0;
        matchesEl.innerHTML = "";
        usingEl.innerHTML = "<strong>Using:</strong> your current location";
      },
      (err) => {
        usingEl.innerHTML = "<strong>Location error:</strong> " + escHtml(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 }
    );
  });

  document.getElementById(placeKey + "_search").addEventListener("click", async () => {
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
      .map((m, i) => `<option value="${i}">${escHtml(m.label)}</option>`)
      .join("");

    matchesEl.innerHTML = `
      <label class="small"><strong>Choose the correct match</strong></label>
      <select id="${placeKey}_select">${optionsHtml}</select>
      <div style="margin-top:10px;">
        <button id="${placeKey}_use" style="width:100%;">Use this place</button>
      </div>
    `;

    document.getElementById(placeKey + "_select").addEventListener("change", (e) => {
      state.selectedIndex = Number(e.target.value);
    });

    document.getElementById(placeKey + "_use").addEventListener("click", () => {
      const chosen = state.matches[state.selectedIndex];
      if (!chosen) return;
      setResolvedLocation(chosen.lat, chosen.lon, chosen.label);
      usingEl.innerHTML = "<strong>Using:</strong> " + escHtml(chosen.label);
    });

    usingEl.textContent = "Pick the correct match, then tap Use this place.";
  });
}

// ----------------------------
// Pages
// ----------------------------
function renderBestTimesPage() {
  const page = pageEl();
  page.innerHTML = `
    <div class="card">
      <h2>Best Fishing Times</h2>
      <div class="small">Search a place or use your location, then display times.</div>
    </div>
  `;

  renderLocationPicker(page, "times");

  appendHtml(page, `
    <div class="card">
      <button id="times_go" class="dangerBtn">Display Best Fishing Times</button>
      <div id="times_out" style="margin-top:10px;"></div>
    </div>
  `);

  document.getElementById("times_go").addEventListener("click", async () => {
    const out = document.getElementById("times_out");
    out.innerHTML = "";

    if (!hasResolvedLocation()) {
      out.textContent = "Pick a place or use your location first.";
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

      out.innerHTML = `
        <div class="card compact">
          <div class="small"><strong>Morning Window</strong></div>
          <div style="font-size:20px;font-weight:900;">${escHtml(formatTime(morningStart))} - ${escHtml(formatTime(morningEnd))}</div>
        </div>
        <div class="card compact">
          <div class="small"><strong>Evening Window</strong></div>
          <div style="font-size:20px;font-weight:900;">${escHtml(formatTime(eveningStart))} - ${escHtml(formatTime(eveningEnd))}</div>
        </div>
      `;
    } catch (e) {
      out.textContent = "Could not load sunrise/sunset. Try again.";
    }
  });
}

function renderWindPage() {
  const page = pageEl();
  page.innerHTML = `
    <div class="card">
      <h2>Wind Forecast</h2>
      <div class="small">Current and future hourly wind speeds from your location or a place name.</div>
    </div>
  `;

  renderLocationPicker(page, "wind");

  appendHtml(page, `
    <div class="card">
      <button id="wind_go" class="dangerBtn">Display Winds</button>
      <div id="wind_out" style="margin-top:10px;"></div>
    </div>
  `);

  document.getElementById("wind_go").addEventListener("click", async () => {
    const out = document.getElementById("wind_out");
    out.innerHTML = "";

    if (!hasResolvedLocation()) {
      out.textContent = "Pick a place or use your location first.";
      return;
    }

    out.textContent = "Loading...";
    try {
      const w = await fetchWind(state.lat, state.lon);
      const parts = splitCurrentFutureWind(w.times, w.speeds);

      let html = "";
      if (parts.current.length) {
        html += `<div class="card compact"><div class="small"><strong>Current winds</strong></div><div style="margin-top:8px;">`;
        html += parts.current
          .map((x) => `${escHtml(x.label)}: <strong>${escHtml(x.mph)} mph</strong>`)
          .join("<br>");
        html += `</div></div>`;
      }

      if (parts.future.length) {
        html += `<div class="card compact"><div class="small"><strong>Future winds</strong></div><div style="margin-top:8px;">`;
        html += parts.future
          .map((x) => `${escHtml(x.label)}: <strong>${escHtml(x.mph)} mph</strong>`)
          .join("<br>");
        html += `</div></div>`;
      }

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
    if (speedMph <= 0 || weightOz <= 0 || lineOutFt <= 0 || lineTestLb <= 0) return null;

    const typeDrag = { Braid: 1.0, Fluorocarbon: 1.12, Monofilament: 1.2 }[lineType] || 1.0;
    const testRatio = lineTestLb / 20.0;
    const testDrag = Math.pow(testRatio, 0.35);
    const totalDrag = typeDrag * testDrag;

    const depth = 0.135 * (weightOz / (totalDrag * Math.pow(speedMph, 1.35))) * lineOutFt;
    return Math.round(depth * 10) / 10;
  }

  document.getElementById("calc").addEventListener("click", () => {
    const out = document.getElementById("depth_out");

    const spd = Number(document.getElementById("spd").value);
    const wgt = Number(document.getElementById("wgt").value);
    const outft = Number(document.getElementById("outft").value);
    const lt = document.getElementById("lt").value;
    const lb = Number(document.getElementById("lb").value);

    const d = trollingDepth(spd, wgt, outft, lt, lb);

    out.innerHTML = `
      <div class="card compact">
        <div class="small"><strong>Estimated depth</strong></div>
        <div style="font-size:24px;font-weight:900;">${d === null ? "--" : escHtml(String(d))} ft</div>
        <div class="small" style="margin-top:8px;">Heavier line runs shallower. Current and lure drag affect results.</div>
      </div>
    `;
  });
}

function speciesDb() {
  return {
    "Kokanee": {
      temp: "42 to 55 F",
      baits: ["Small hoochies", "Small spinners (wedding ring)", "Corn with scent (where used)"],
      rigs: ["Dodger + leader + hoochie/spinner", "Weights or downrigger to match marks"],
      Mid: [
        "Troll dodger plus small hoochie or spinner behind it.",
        "Run scent and tune speed until you get a steady rod thump."
      ]
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
    "Walleye": {
      temp: "55 to 70 F",
      baits: ["Crankbaits (trolling)", "Jigs with soft plastics", "Jigs with crawler (where used)", "Blade baits"],
      rigs: ["Jig and soft plastic", "Bottom bouncer + harness (where used)", "Trolling crankbaits on breaks"],
      Mid: ["Troll crankbaits along breaks at dusk and dawn."],
      Bottom: ["Jig near bottom on transitions and edges."]
    },
    "Perch": {
      temp: "55 to 75 F",
      baits: ["Small jigs", "Worm pieces", "Minnow (where allowed)", "Tiny grubs"],
      rigs: ["Small jighead + bait", "Dropper loop with small hook (where used)"],
      Mid: ["Small jigs tipped with bait, slowly swum through schools."],
      Bottom: ["Vertical jig small baits on bottom."]
    },
    "Bluegill": {
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
    .map((s) => `<option${s === defaultSpecies ? " selected" : ""}>${escHtml(s)}</option>`)
    .join("");

  function renderOne(name) {
    const info = db[name];
    if (!info) return;

    const out = document.getElementById("sp_out");

    let html = "";
    html += `<div class="card compact"><div class="small"><strong>Most active water temperature range</strong></div><div style="font-size:20px;font-weight:900;">${escHtml(info.temp)}</div></div>`;

    if (info.baits && info.baits.length) {
      html += `<div class="card compact"><div class="small"><strong>Popular baits</strong></div><ul class="list">` +
        info.baits.map((x) => `<li>${escHtml(x)}</li>`).join("") +
        `</ul></div>`;
    }

    if (info.rigs && info.rigs.length) {
      html += `<div class="card compact"><div class="small"><strong>Common rigs</strong></div><ul class="list">` +
        info.rigs.map((x) => `<li>${escHtml(x)}</li>`).join("") +
        `</ul></div>`;
    }

    if (info.Top && info.Top.length) {
      html += `<div class="card compact"><div class="small"><strong>Topwater</strong></div><ul class="list">` +
        info.Top.map((x) => `<li>${escHtml(x)}</li>`).join("") +
        `</ul></div>`;
    }
    if (info.Mid && info.Mid.length) {
      html += `<div class="card compact"><div class="small"><strong>Mid water</strong></div><ul class="list">` +
        info.Mid.map((x) => `<li>${escHtml(x)}</li>`).join("") +
        `</ul></div>`;
    }
    if (info.Bottom && info.Bottom.length) {
      html += `<div class="card compact"><div class="small"><strong>Bottom</strong></div><ul class="list">` +
        info.Bottom.map((x) => `<li>${escHtml(x)}</li>`).join("") +
        `</ul></div>`;
    }

    out.innerHTML = html;
  }

  renderOne(defaultSpecies);

  sel.addEventListener("change", () => {
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

  clearSpeedWatch();

  state.speedWatchId = navigator.geolocation.watchPosition(
    (pos) => {
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
    (err) => {
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
render();
