const app = document.getElementById("app");

document.querySelectorAll(".nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;
    loadTool(tool);
  });
});

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
