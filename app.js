const app = document.getElementById("app");

document.querySelectorAll(".nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;
    loadTool(tool);
  });
});
// Shared app state
const state = {
  lat: null,
  lon: null,
  placeLabel: "",
  matches: [],
  selectedIndex: 0
};

function escHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setResolvedLocation(lat, lon, label) {
  state.lat = lat;
  state.lon = lon;
  state.placeLabel = label || "";
}

function hasResolvedLocation() {
  return typeof state.lat === "number" && typeof state.lon === "number";
}

function loadTool(tool) {
  app.innerHTML = "";

  if (tool === "times") renderTimes();
  if (tool === "wind") renderWind();
  if (tool === "depth") renderDepth();
  if (tool === "tips") renderTips();
  if (tool === "speed") renderSpeed();
}

function renderTimes() {
  app.innerHTML = `
    <div class="card">
      <h2>Best Fishing Times</h2>
      <p>This will calculate sunrise and sunset windows.</p>
      <button onclick="useLocationForTimes()">Use My Location</button>
    </div>
  `;
}
function renderBestTimes() {
  app.innerHTML = `
    <div class="card">
      <h2>Best Fishing Times</h2>
      <button onclick="useLocationTimes()">Use My Location</button>
    </div>
  `;
}

function useLocationTimes() {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto`)
      .then(r => r.json())
      .then(data => {
        const sunrise = new Date(data.daily.sunrise[0]);
        const sunset = new Date(data.daily.sunset[0]);

        const morningStart = new Date(sunrise.getTime() - 60 * 60 * 1000);
        const morningEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
        const eveningStart = new Date(sunset.getTime() - 60 * 60 * 1000);
        const eveningEnd = new Date(sunset.getTime() + 60 * 60 * 1000);

        app.innerHTML += `
          <div class="card">
            <strong>Morning Window</strong><br>
            ${formatTime(morningStart)} – ${formatTime(morningEnd)}
          </div>
          <div class="card">
            <strong>Evening Window</strong><br>
            ${formatTime(eveningStart)} – ${formatTime(eveningEnd)}
          </div>
        `;
      });
  });
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function renderBestTimes() {
  app.innerHTML = `
    <div class="card">
      <h2>Best Fishing Times</h2>
      <button onclick="useLocationTimes()">Use My Location</button>
    </div>
  `;
}

function useLocationTimes() {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto`)
      .then(r => r.json())
      .then(data => {
        const sunrise = new Date(data.daily.sunrise[0]);
        const sunset = new Date(data.daily.sunset[0]);

        const morningStart = new Date(sunrise.getTime() - 60 * 60 * 1000);
        const morningEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
        const eveningStart = new Date(sunset.getTime() - 60 * 60 * 1000);
        const eveningEnd = new Date(sunset.getTime() + 60 * 60 * 1000);

        app.innerHTML += `
          <div class="card">
            <strong>Morning Window</strong><br>
            ${formatTime(morningStart)} – ${formatTime(morningEnd)}
          </div>
          <div class="card">
            <strong>Evening Window</strong><br>
            ${formatTime(eveningStart)} – ${formatTime(eveningEnd)}
          </div>
        `;
      });
  });
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function renderWind() {
  app.innerHTML = `
    <div class="card">
      <h2>Wind Forecast</h2>
      <button onclick="useLocationWind()">Use My Location</button>
    </div>
  `;
}

function useLocationWind() {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m&wind_speed_unit=mph&timezone=auto`)
      .then(r => r.json())
      .then(data => {
        const times = data.hourly.time;
        const speeds = data.hourly.wind_speed_10m;
        const now = new Date();

        let currentHTML = "<div class='card'><strong>Current Winds</strong><br>";
        let futureHTML = "<div class='card'><strong>Future Winds</strong><br>";

        for (let i = 0; i < times.length; i++) {
          const t = new Date(times[i]);
          const label = t.toLocaleString([], { weekday: "short", hour: "numeric" });
          const mph = speeds[i].toFixed(1);

          if (t <= now && currentHTML.split("<br>").length <= 7) {
            currentHTML += `${label}: ${mph} mph<br>`;
          }
          if (t > now && futureHTML.split("<br>").length <= 13) {
            futureHTML += `${label}: ${mph} mph<br>`;
          }
        }

        app.innerHTML += currentHTML + "</div>" + futureHTML + "</div>";
      });
  });
}
function renderDepth() {
  app.innerHTML = `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>

      Speed (mph)<br>
      <input id="spd" type="number" step="0.1" value="1.3"><br><br>

      Weight (oz)<br>
      <input id="wt" type="number" step="0.5" value="2"><br><br>

      Line out (ft)<br>
      <input id="line" type="number" step="5" value="100"><br><br>

      Line type<br>
      <select id="type">
        <option>Braid</option>
        <option>Fluorocarbon</option>
        <option>Monofilament</option>
      </select><br><br>

      Line test (lb)<br>
      <select id="test">
        <option>6</option><option>8</option><option>10</option>
        <option selected>12</option>
        <option>15</option><option>20</option><option>25</option>
      </select><br><br>

      <button onclick="calcDepth()">Calculate</button>
      <div id="depthResult"></div>
    </div>
  `;
}

function calcDepth() {
  const speed = Number(document.getElementById("spd").value);
  const weight = Number(document.getElementById("wt").value);
  const lineOut = Number(document.getElementById("line").value);
  const type = document.getElementById("type").value;
  const test = Number(document.getElementById("test").value);

  const typeDrag = { Braid: 1.0, Fluorocarbon: 1.12, Monofilament: 1.2 }[type];
  const testDrag = Math.pow(test / 20, 0.35);
  const depth = 0.135 * (weight / (typeDrag * testDrag * Math.pow(speed, 1.35))) * lineOut;

  document.getElementById("depthResult").innerHTML =
    `<div class="card"><strong>Estimated Depth:</strong> ${depth.toFixed(1)} ft</div>`;
}

function useLocationForTimes() {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&daily=sunrise,sunset&timezone=auto\`)
      .then(r => r.json())
      .then(data => {
        const sunrise = data.daily.sunrise[0];
        const sunset = data.daily.sunset[0];

        app.innerHTML += `
          <div class="card">
            <strong>Morning:</strong> ${sunrise}<br>
            <strong>Evening:</strong> ${sunset}
          </div>
        `;
      });
  });
}

function renderWind() {
  app.innerHTML = `
    <div class="card">
      <h2>Wind</h2>
      <p>Wind forecast will go here.</p>
    </div>
  `;
}

function renderDepth() {
  app.innerHTML = `
    <div class="card">
      <h2>Trolling Depth Calculator</h2>
      <p>Depth math will go here next.</p>
    </div>
  `;
}

function renderTips() {
  app.innerHTML = `
    <div class="card">
      <h2>Species Tips</h2>
      <p>Species database will go here next.</p>
    </div>
  `;
}

function renderSpeed() {
  app.innerHTML = `
    <div class="card">
      <h2>Speedometer</h2>
      <p>GPS speed will go here.</p>
    </div>
  `;
}
const speciesDB = {
  "Largemouth bass": {
    depths: ["Top","Mid","Bottom"],
    baits: ["Frogs","Buzzbaits","Jigs","Texas rigs"],
    Top: ["Frogs and buzzbaits around cover"],
    Mid: ["Swim jigs and paddletails"],
    Bottom: ["Texas rigs and jigs in structure"]
  },
  "Channel catfish": {
    depths: ["Bottom"],
    baits: ["Cut bait","Worms","Stink bait"],
    Bottom: ["Soak bait on bottom near holes"]
  }
};

function renderSpeciesTips() {
  let options = Object.keys(speciesDB).map(s => `<option>${s}</option>`).join("");

  app.innerHTML = `
    <div class="card">
      <h2>Species Tips</h2>
      <select id="species" onchange="showSpecies()">${options}</select>
      <div id="speciesOut"></div>
    </div>
  `;
  showSpecies();
}

function showSpecies() {
  const s = document.getElementById("species").value;
  const data = speciesDB[s];

  let html = `<strong>Popular Baits</strong><ul>${data.baits.map(b=>`<li>${b}</li>`).join("")}</ul>`;

  data.depths.forEach(d => {
    html += `<strong>${d}</strong><ul>${data[d].map(t=>`<li>${t}</li>`).join("")}</ul>`;
  });

  document.getElementById("speciesOut").innerHTML = html;
}
function renderSpeedometer() {
  app.innerHTML = `
    <div class="card">
      <h2>Speedometer</h2>
      <div id="mph" style="font-size:36px;font-weight:800">--</div>
      <div id="status">Waiting for GPS...</div>
    </div>
  `;

  navigator.geolocation.watchPosition(pos => {
    const spd = pos.coords.speed;
    if (spd == null) return;
    document.getElementById("mph").textContent = (spd * 2.23694).toFixed(1) + " mph";
    document.getElementById("status").textContent = "GPS speed";
  });
}
