// ============================
// app.js (PART 3 OF 3) BEGIN
// ============================

// ----------------------------
// Home logic helpers
// ----------------------------
function computeBestFishingWindows(sunrise, sunset) {
  const out = [];

  const dawnStart = new Date(sunrise.getTime() - 90 * 60 * 1000);
  const dawnEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
  out.push({ name: "Dawn window", start: dawnStart, end: dawnEnd });

  const duskStart = new Date(sunset.getTime() - 60 * 60 * 1000);
  const duskEnd = new Date(sunset.getTime() + 90 * 60 * 1000);
  out.push({ name: "Dusk window", start: duskStart, end: duskEnd });

  const midStart = new Date(sunrise);
  midStart.setHours(12, 0, 0, 0);
  const midEnd = new Date(sunrise);
  midEnd.setHours(13, 0, 0, 0);
  out.push({ name: "Midday (minor)", start: midStart, end: midEnd });

  return out;
}

// GO/CAUTION/NO-GO
function computeGoStatus(inputs) {
  const craft = inputs.craft || "Kayak (paddle)";
  const water = inputs.waterType || "Small / protected";
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const avgF = (tmin + tmax) / 2;

  let goWind = 10;
  let cautionWind = 14;
  let nogoWind = 18;

  let goGust = 18;
  let cautionGust = 22;
  let nogoGust = 28;

  if (craft === "Kayak (motorized)") {
    goWind += 2;
    cautionWind += 2;
    nogoWind += 2;
    goGust += 2;
    cautionGust += 2;
    nogoGust += 2;
  } else if (craft === "Boat (small)") {
    goWind += 4;
    cautionWind += 4;
    nogoWind += 4;
    goGust += 4;
    cautionGust += 4;
    nogoGust += 4;
  }

  if (water === "Big water / offshore") {
    goWind -= 3;
    cautionWind -= 3;
    nogoWind -= 3;
    goGust -= 3;
    cautionGust -= 3;
    nogoGust -= 3;
  }

  function scoreFromThresholds(value, g, c, n) {
    if (value <= g) return 0;
    if (value >= n) return 100;
    if (value <= c) return ((value - g) / Math.max(1, c - g)) * 45;
    return 45 + ((value - c) / Math.max(1, n - c)) * 55;
  }

  const sWind = scoreFromThresholds(windMax, goWind, cautionWind, nogoWind);
  const sGust = scoreFromThresholds(gustMax, goGust, cautionGust, nogoGust);

  let score = Math.max(sWind, sGust);

  const highF = tmax;
  const lowF = tmin;

  const chillPenalty =
    Math.max(0, 35 - avgF) * 0.6 + Math.max(0, windMax - 5) * 0.4;
  if (avgF < 45) score += Math.min(18, chillPenalty);

  let forceAtLeastCaution = false;
  let forceNoGo = false;

  if (highF <= 30) forceAtLeastCaution = true;
  if (lowF <= 20 || avgF <= 22) forceNoGo = true;

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

  let msg =
    "Generally favorable. Watch for local funnels, open water chop, and changing conditions.";
  if (label === "CAUTION") {
    msg =
      "Use caution. Expect changing wind and chop. Stay close to shore and keep an easy exit plan.";
  }
  if (label === "NO-GO") {
    msg =
      "Not recommended. Conditions are high risk for the selected craft/water type. Consider sheltered water or reschedule.";
  }

  if (highF <= 30 && label !== "NO-GO") {
    msg += " Very cold air increases consequence. Dress for immersion, not just air temp.";
  }
  if (forceNoGo) {
    msg += " Extreme cold can turn a minor issue into an emergency quickly.";
  }

  return { label: label, score: score, needlePct: needlePct, message: msg };
}

function computeExposureTips(inputs) {
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);

  const avgF = (tmin + tmax) / 2;
  const tips = [];

  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  tips.push("Bring a dry bag with a spare layer and gloves. Keep keys/phone in a waterproof pouch.");

  if (avgF <= 50) {
    tips.unshift("Avoid cotton layers. Use synthetics or wool that insulate when wet.");
    tips.unshift("Cold air and likely cold water: lean toward a dry suit or a proper wet suit setup.");
    if (avgF <= 40) tips.unshift("Neoprene gloves/boots help. Limit exposure time and keep shore close.");
  }

  if (tmax >= 78) {
    tips.unshift("Hot day: wear sun shirts and light, sun-repellent clothing. Use a wide-brim hat.");
    tips.unshift("Hydrate early. Bring more water than you think you need.");
  }

  if (windMax >= 12 || gustMax >= 20) {
    tips.push("Wind can spike fast. Leash key gear and plan a protected return route.");
  }

  return tips;
}

// ----------------------------
// Home: Date-driven forecast (within 7 days)
// - Changing the date updates tiles, wind chart, and best windows for that day.
// - Uses cached 7-day forecast bundle; refetches on TTL or location change.
// ----------------------------
function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="small muted">Pick a date (within 7-day forecast), set location, and the app builds tiles, wind chart, and fishing windows.</div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Date</div>
        <input id="home_date" type="date" />
        <div class="small muted" style="margin-top:6px;">Shows forecasted values for the selected date (Open-Meteo 7-day forecast).</div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Water type</div>
        <div class="toggleRow" id="water_toggle_row">
          <button type="button" id="water_small" class="toggleBtn">Small / protected</button>
          <button type="button" id="water_big" class="toggleBtn">Big water / offshore</button>
        </div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Craft</div>
        <select id="home_craft">
          <option>Kayak (paddle)</option>
          <option>Kayak (motorized)</option>
          <option>Boat (small)</option>
        </select>
      </div>
    </div>
  `
  );

  const dateInput = document.getElementById("home_date");
  const craftSel = document.getElementById("home_craft");
  const btnSmall = document.getElementById("water_small");
  const btnBig = document.getElementById("water_big");

  // Default date if not already set
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  dateInput.value = state.dateIso;

  craftSel.value = state.craft || "Kayak (paddle)";

  function paintWaterToggle() {
    const isBig = state.waterType === "Big water / offshore";
    if (isBig) {
      btnBig.classList.add("toggleActive");
      btnSmall.classList.remove("toggleActive");
    } else {
      btnSmall.classList.add("toggleActive");
      btnBig.classList.remove("toggleActive");
    }
  }

  btnSmall.addEventListener("click", function () {
    state.waterType = "Small / protected";
    paintWaterToggle();
    renderHomeDynamic();
  });

  btnBig.addEventListener("click", function () {
    state.waterType = "Big water / offshore";
    paintWaterToggle();
    renderHomeDynamic();
  });

  craftSel.addEventListener("change", function () {
    state.craft = craftSel.value;
    renderHomeDynamic();
  });

  dateInput.addEventListener("change", function () {
    const v = String(dateInput.value || "").trim();
    if (isIsoDate(v)) {
      state.dateIso = v;
    } else {
      state.dateIso = isoTodayLocal();
      dateInput.value = state.dateIso;
    }
    renderHomeDynamic();
  });

  if (state.waterType !== "Big water / offshore") state.waterType = "Small / protected";
  paintWaterToggle();

  // Location picker:
  // - if a saved last location exists, render() will restore it before this renders
  // - if no saved/resolved location exists, this will attempt GPS automatically
  renderLocationPicker(
    page,
    "home",
    function () {
      renderHomeDynamic();
    },
    { autoGPS: true }
  );

  appendHtml(page, `<div id="home_dynamic"></div>`);

  // initial draw
  renderHomeDynamic();

  async function renderHomeDynamic() {
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

    let bundle = null;
    try {
      bundle = await getForecastBundle(state.lat, state.lon);
    } catch (e) {
      dyn.innerHTML =
        '<div class="card"><strong>Could not load data.</strong><div class="small muted">' +
        escHtml(niceErr(e)) +
        "</div></div>";
      return;
    }

    const wx = bundle.wx;
    const sun = bundle.sun;

    const dailyDates = wx && wx.daily && wx.daily.time ? wx.daily.time : [];
    if (!dailyDates.length) {
      dyn.innerHTML =
        '<div class="card"><strong>No forecast returned.</strong><div class="small muted">Try again in a moment.</div></div>';
      return;
    }

    // Use selected date if it exists in the 7-day list, else fall back to closest available (first).
    const wantIso = isIsoDate(state.dateIso) ? state.dateIso : isoTodayLocal();
    let idx = dailyDates.indexOf(wantIso);

    // If user picks outside range, snap to first available.
    if (idx < 0) {
      idx = 0;
      state.dateIso = dailyDates[0];
      const di = document.getElementById("home_date");
      if (di) di.value = state.dateIso;
    }

    const useIso = dailyDates[idx];

    const tmin = safeNum(wx.daily.tmin[idx], 0);
    const tmax = safeNum(wx.daily.tmax[idx], 0);
    const popMax = safeNum(wx.daily.popMax[idx], 0);
    const windMax = safeNum(wx.daily.windMax[idx], 0);
    const gustMax = safeNum(wx.daily.gustMax[idx], 0);

    const sunFor = sunForDate(sun, useIso);
    const windows = sunFor ? computeBestFishingWindows(sunFor.sunrise, sunFor.sunset) : [];

    const status = computeGoStatus({
      craft: state.craft,
      waterType: state.waterType,
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

    // hourly points for selected date
    const pointsRaw = filterHourlyToDate(wx.hourly.time || [], wx.hourly.wind || [], useIso);
    const points = [];
    for (let i = 0; i < pointsRaw.length; i++) {
      if (i % 2 === 0) points.push({ dt: pointsRaw[i].dt, mph: safeNum(pointsRaw[i].v, 0) });
    }
    if (points.length < 2) {
      for (let j = 0; j < pointsRaw.length; j++) {
        points.push({ dt: pointsRaw[j].dt, mph: safeNum(pointsRaw[j].v, 0) });
      }
    }

    dyn.innerHTML = "";

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Overview - ${escHtml(useIso)}</h3>
        <div class="small muted" style="margin-top:4px;">${bundle.fromCache ? "Using cached forecast bundle." : "Fresh forecast bundle."}</div>

        <div class="tilesGrid">
          <div class="tile">
            <div class="tileTop">Temperature</div>
            <div class="tileVal">${escHtml(Math.round(tmin))} to ${escHtml(Math.round(tmax))} F</div>
            <div class="tileSub">Daily min / max</div>
          </div>

          <div class="tile">
            <div class="tileTop">Rain chance (max)</div>
            <div class="tileVal">${escHtml(Math.round(popMax))} %</div>
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
          <div class="sectionTitle">Boating / Kayak status</div>
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
      if (status.label === "GO") pill.style.background = "rgba(143,209,158,0.55)";
      if (status.label === "CAUTION") pill.style.background = "rgba(255,214,102,0.65)";
      if (status.label === "NO-GO") pill.style.background = "rgba(244,163,163,0.70)";
    }

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Hourly wind (line chart)</h3>
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
      : "<li>No sunrise/sunset data for that date.</li>";

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Best fishing windows</h3>
        <ul class="list">${bestHtml}</ul>
      </div>
    `
    );

    const tipsHtml = tips.map(function (t) { return "<li>" + escHtml(t) + "</li>"; }).join("");
    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Exposure tips</h3>
        <ul class="list">${tipsHtml}</ul>
      </div>
    `
    );

    // Re-render chart on resize for current selected day
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
            <option>20</option>
            <option>25</option>
          </select>
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
    const test = safeNum(document.getElementById("dc_test").value, 12);

    const dragFactor = test <= 10 ? 1.0 : test <= 12 ? 0.95 : test <= 20 ? 0.85 : 0.78;
    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);
    let depth = line * base * speedFactor * dragFactor;
    depth = Math.max(0, Math.min(depth, line * 0.95));

    out.style.display = "block";
    out.innerHTML =
      "<strong>Estimated depth:</strong> " +
      escHtml(depth.toFixed(1)) +
      " ft<br>" +
      '<div class="small muted" style="margin-top:6px;">Current and lure drag can change results a lot.</div>';
  });
}

// ----------------------------
// Species Tips (PNW expanded)
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();

  const tips = [
    {
      name: "Largemouth Bass",
      range: "55 to 75 F (most active)",
      bullets: [
        "Topwater early and late when water is warm enough.",
        "Midday: work edges, docks, and weed lines with jigs and plastics.",
        "Cold fronts: slow down with finesse and target deeper transitions."
      ]
    },
    {
      name: "Smallmouth Bass",
      range: "50 to 70 F (most active)",
      bullets: [
        "Wind can improve the bite on rocky points and flats.",
        "Use jigs, tubes, jerkbaits, and small swimbaits.",
        "In cold water, slow down and stay close to bottom structure."
      ]
    },
    {
      name: "Trout (rainbow)",
      range: "45 to 65 F (most active)",
      bullets: [
        "Troll early for consistent action, then switch to casting near inlets.",
        "If sun is high, target deeper water or shaded banks.",
        "Match speed and lure size to water clarity and forage."
      ]
    },
    {
      name: "Kokanee",
      range: "45 to 60 F (best comfort)",
      bullets: [
        "Early light is prime. Troll slow with small dodger + spinner or hoochie.",
        "Use scent and tune speed until you see consistent strikes.",
        "If marks are deep, use heavier weight or downrigger to stay on the school."
      ]
    },
    {
      name: "Chinook Salmon",
      range: "42 to 58 F (typical target water)",
      bullets: [
        "Troll bait or flasher + hoochie; keep speed steady and turns wide.",
        "Fish the temperature band and the bait: adjust depth until you see action.",
        "In wind, stay conservative and prioritize a safe return route."
      ]
    },
    {
      name: "Coho Salmon",
      range: "45 to 60 F",
      bullets: [
        "Coho often respond to faster presentations than Chinook.",
        "Cover water: troll or cast in travel lanes and near current seams.",
        "Bright/flashy presentations can shine in stained water."
      ]
    },
    {
      name: "Sockeye",
      range: "45 to 60 F",
      bullets: [
        "Use legal methods for your water (often specialized; check regs).",
        "Target travel corridors and keep presentation consistent.",
        "If you see fish rolling, adjust depth and speed rather than lure size."
      ]
    },
    {
      name: "Walleye",
      range: "50 to 70 F",
      bullets: [
        "Low light: troll crankbaits or run spinners on edges and flats.",
        "Daytime: jig transitions and humps; slow down when bite is light.",
        "Wind can help: position so you can work structure without drifting too fast."
      ]
    },
    {
      name: "Yellow Perch",
      range: "45 to 70 F",
      bullets: [
        "Small jigs and bait shine. Keep it near bottom.",
        "If you catch one, stay put; perch school up tight.",
        "Light line and subtle motion usually outperforms aggressive jigging."
      ]
    },
    {
      name: "Crappie",
      range: "55 to 75 F",
      bullets: [
        "Look for brush, docks, and protected bays.",
        "Slow vertical presentations and small plastics work well.",
        "On cold fronts, go deeper and slow way down."
      ]
    },
    {
      name: "Northern Pike",
      range: "45 to 70 F",
      bullets: [
        "Edges of weeds and points are key. Cover water with larger baits.",
        "Steel/fluoro leader helps prevent bite-offs.",
        "Handle carefully and keep fingers away from gills/teeth."
      ]
    },
    {
      name: "Lake Trout (Mackinaw)",
      range: "40 to 55 F (cold water)",
      bullets: [
        "Focus deep structure: humps, drop-offs, and basin edges.",
        "Troll or jig where you see marks; speed changes can trigger bites.",
        "Keep your offering in the zone longer rather than racing around."
      ]
    },
    {
      name: "Catfish (Channel/Bullhead)",
      range: "55 to 75 F",
      bullets: [
        "Evening/night can be best. Anchor or drift edges and flats.",
        "Stink baits, cut bait, and worms are consistent producers.",
        "On light bites, keep hooks sharp and give fish time to load up."
      ]
    }
  ];

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Species Tips</h2>
      <div class="small muted">PNW-focused quick guidelines with temperature ranges.</div>
      <div style="margin-top:12px;">
        <select id="tips_sel"></select>
      </div>
      <div id="tips_box" class="card compact" style="margin-top:12px;"></div>
    </div>
  `
  );

  const sel = document.getElementById("tips_sel");
  const box = document.getElementById("tips_box");

  for (let i = 0; i < tips.length; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = tips[i].name;
    sel.appendChild(o);
  }

  function renderTip(i) {
    const t = tips[i];
    const lis = t.bullets.map(function (b) { return "<li>" + escHtml(b) + "</li>"; }).join("");
    box.innerHTML =
      "<strong>" +
      escHtml(t.name) +
      "</strong><br>" +
      '<span class="small muted">Active range: ' +
      escHtml(t.range) +
      "</span>" +
      '<ul class="list">' +
      lis +
      "</ul>";
  }

  sel.addEventListener("change", function () {
    renderTip(Number(sel.value));
  });

  renderTip(0);
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
      <div class="small muted">GPS-based speed. Requires location permission. Best used outside.</div>

      <div class="btnRow" style="margin-top:12px;">
        <button id="spd_start">Start</button>
        <button id="spd_stop" disabled>Stop</button>
      </div>

      <div class="card compact" style="margin-top:12px;">
        <div class="sectionTitle">Current speed</div>
        <div id="spd_val" style="font-size:34px; font-weight:900; margin-top:6px;">0.0 mph</div>
        <div class="small muted" id="spd_note" style="margin-top:6px;"></div>
      </div>
    </div>
  `
  );

  const startBtn = document.getElementById("spd_start");
  const stopBtn = document.getElementById("spd_stop");
  const valEl = document.getElementById("spd_val");
  const noteEl = document.getElementById("spd_note");

  function setRunning(r) {
    startBtn.disabled = r;
    stopBtn.disabled = !r;
  }

  startBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      noteEl.textContent = "Geolocation not supported.";
      return;
    }

    noteEl.textContent = "Starting GPS...";
    setRunning(true);

    try {
      state.speedWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          const ms = pos.coords.speed;
          let mph = Number.isFinite(ms) ? ms * 2.236936 : NaN;
          if (!Number.isFinite(mph)) mph = 0;

          valEl.textContent = mph.toFixed(1) + " mph";
          noteEl.textContent =
            "Accuracy: " + safeNum(pos.coords.accuracy, 0).toFixed(0) + " m";
        },
        function (err) {
          noteEl.textContent = "Speed error: " + escHtml(err.message);
          setRunning(false);
        },
        { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 }
      );
    } catch (e) {
      noteEl.textContent = "Could not start GPS watch.";
      setRunning(false);
    }
  });

  stopBtn.addEventListener("click", function () {
    stopSpeedWatchIfRunning();
    setRunning(false);
    noteEl.textContent = "Stopped.";
  });
}

// ----------------------------
// Render router
// ----------------------------
function render() {
  if (!app) app = document.getElementById("app");
  if (!app) return;

  renderConsentBannerIfNeeded();

  // Restore saved last location (preferred) before attempting auto GPS on Home
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

  state.tool = "Home";
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();

  try {
    window.scrollTo(0, 0);
  } catch (e) {
    // ignore
  }

  render();
});

// ============================
// app.js (PART 3 OF 3) END
// ============================
// ============================
// app.js (PART 2 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.1.1
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// UI: Header + Nav
// - Home button hidden while on Home (only shown elsewhere)
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
    '    <div class="logo"><img src="' +
    escHtml(LOGO_URL) +
    '" alt="FishyNW"></div>' +
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
// UI: Location Picker (reusable)
// - NO clear saved location button
// - auto-clears saved location if user edits the box
// - optional auto GPS on mount (only when no saved location)
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
        placeholder="Example: Spokane, WA or 99201 or Hauser Lake"
        style="width:100%;" />

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

  // Restore existing
  if (hasResolvedLocation()) {
    placeInput.value = state.placeLabel ? state.placeLabel : "";
    renderUsing();
  }

  // Auto-clear saved location as soon as user edits the input away from the saved label.
  placeInput.addEventListener("input", function () {
    const raw = String(placeInput.value || "");
    const val = raw.trim();

    if (hasResolvedLocation()) {
      const currentLabel = String(state.placeLabel || "").trim();

      if (val && val !== currentLabel) {
        clearResolvedLocation();
        matchesEl.innerHTML = "";
        usingEl.textContent = "";
        if (typeof onResolved === "function") onResolved("auto_cleared_by_typing");
      }

      if (!val) {
        clearResolvedLocation();
        matchesEl.innerHTML = "";
        usingEl.textContent = "";
        if (typeof onResolved === "function") onResolved("auto_cleared_empty");
      }
    }
  });

  function doGps() {
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

        placeInput.value = "Locating nearest city...";
        usingEl.innerHTML =
          "<strong>Using:</strong> Current location (" +
          lat.toFixed(4) +
          ", " +
          lon.toFixed(4) +
          ")";

        if (typeof onResolved === "function") onResolved("gps");

        reverseGeocode(lat, lon).then(function (label) {
          if (label) {
            setResolvedLocation(lat, lon, label);
            placeInput.value = label;
          } else {
            placeInput.value = "Current location";
          }
          renderUsing();
          if (typeof onResolved === "function") onResolved("gps_reverse");
        });
      },
      function (err) {
        usingEl.innerHTML = "<strong>Location error:</strong> " + escHtml(err.message);
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
      '<select id="' + placeKey + '_select" style="margin-top:8px;">' +
      optionsHtml +
      "</select>" +
      '<div style="margin-top:10px;">' +
      '<button id="' + placeKey + '_use" style="width:100%;">Use this place</button>' +
      "</div>" +
      '<div class="small muted" style="margin-top:8px;">Pick the correct match, then tap Use this place.</div>';

    document.getElementById(placeKey + "_select").addEventListener("change", function (e) {
      state.selectedIndex = Number(e.target.value);
    });

    document.getElementById(placeKey + "_use").addEventListener("click", function () {
      const chosen = state.matches[state.selectedIndex];
      if (!chosen) return;

      setResolvedLocation(chosen.lat, chosen.lon, chosen.label);
      placeInput.value = chosen.label;
      matchesEl.innerHTML = "";
      renderUsing();

      if (typeof onResolved === "function") onResolved("search_pick");
    });

    usingEl.textContent = "";
  });

  // AUTO GPS ON MOUNT:
  // Only if requested AND no resolved location already exists.
  // This keeps your saved location behavior intact and avoids surprise prompting every load when saved location exists.
  if (autoGps && !hasResolvedLocation()) {
    // small delay so UI draws before permission prompt
    setTimeout(function () {
      // if saved location showed up (e.g., localStorage loaded after render), do nothing
      if (!hasResolvedLocation()) doGps();
    }, 450);
  }
}

// ============================
// app.js (PART 2 OF 3) END
// ============================
// ============================
// app.js (PART 3 OF 3) BEGIN
// FishyNW.com - Fishing Tools (Web)
// Version 1.1.1
// ASCII ONLY. No Unicode. No smart quotes. No special dashes.
// ============================

// ----------------------------
// Home logic helpers
// ----------------------------
function computeBestFishingWindows(sunrise, sunset) {
  const out = [];

  const dawnStart = new Date(sunrise.getTime() - 90 * 60 * 1000);
  const dawnEnd = new Date(sunrise.getTime() + 60 * 60 * 1000);
  out.push({ name: "Dawn window", start: dawnStart, end: dawnEnd });

  const duskStart = new Date(sunset.getTime() - 60 * 60 * 1000);
  const duskEnd = new Date(sunset.getTime() + 90 * 60 * 1000);
  out.push({ name: "Dusk window", start: duskStart, end: duskEnd });

  const midStart = new Date(sunrise);
  midStart.setHours(12, 0, 0, 0);
  const midEnd = new Date(sunrise);
  midEnd.setHours(13, 0, 0, 0);
  out.push({ name: "Midday (minor)", start: midStart, end: midEnd });

  return out;
}

// GO/CAUTION/NO-GO
function computeGoStatus(inputs) {
  const craft = inputs.craft || "Kayak (paddle)";
  const water = inputs.waterType || "Small / protected";
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const avgF = (tmin + tmax) / 2;

  let goWind = 10;
  let cautionWind = 14;
  let nogoWind = 18;

  let goGust = 18;
  let cautionGust = 22;
  let nogoGust = 28;

  if (craft === "Kayak (motorized)") {
    goWind += 2;
    cautionWind += 2;
    nogoWind += 2;
    goGust += 2;
    cautionGust += 2;
    nogoGust += 2;
  } else if (craft === "Boat (small)") {
    goWind += 4;
    cautionWind += 4;
    nogoWind += 4;
    goGust += 4;
    cautionGust += 4;
    nogoGust += 4;
  }

  if (water === "Big water / offshore") {
    goWind -= 3;
    cautionWind -= 3;
    nogoWind -= 3;
    goGust -= 3;
    cautionGust -= 3;
    nogoGust -= 3;
  }

  function scoreFromThresholds(value, g, c, n) {
    if (value <= g) return 0;
    if (value >= n) return 100;
    if (value <= c) return ((value - g) / Math.max(1, c - g)) * 45;
    return 45 + ((value - c) / Math.max(1, n - c)) * 55;
  }

  const sWind = scoreFromThresholds(windMax, goWind, cautionWind, nogoWind);
  const sGust = scoreFromThresholds(gustMax, goGust, cautionGust, nogoGust);

  let score = Math.max(sWind, sGust);

  const highF = tmax;
  const lowF = tmin;

  const chillPenalty =
    Math.max(0, 35 - avgF) * 0.6 + Math.max(0, windMax - 5) * 0.4;
  if (avgF < 45) score += Math.min(18, chillPenalty);

  let forceAtLeastCaution = false;
  let forceNoGo = false;

  if (highF <= 30) forceAtLeastCaution = true;
  if (lowF <= 20 || avgF <= 22) forceNoGo = true;

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

  let msg =
    "Generally favorable. Watch for local funnels, open water chop, and changing conditions.";
  if (label === "CAUTION") {
    msg =
      "Use caution. Expect changing wind and chop. Stay close to shore and keep an easy exit plan.";
  }
  if (label === "NO-GO") {
    msg =
      "Not recommended. Conditions are high risk for the selected craft/water type. Consider sheltered water or reschedule.";
  }

  if (highF <= 30 && label !== "NO-GO") {
    msg += " Very cold air increases consequence. Dress for immersion, not just air temp.";
  }
  if (forceNoGo) {
    msg += " Extreme cold can turn a minor issue into an emergency quickly.";
  }

  return { label: label, score: score, needlePct: needlePct, message: msg };
}

function computeExposureTips(inputs) {
  const tmin = safeNum(inputs.tmin, 40);
  const tmax = safeNum(inputs.tmax, 55);
  const windMax = safeNum(inputs.windMax, 0);
  const gustMax = safeNum(inputs.gustMax, windMax);

  const avgF = (tmin + tmax) / 2;
  const tips = [];

  tips.push("Sunscreen matters even on cloudy days. Reapply and protect lips.");
  tips.push("Bring a dry bag with a spare layer and gloves. Keep keys/phone in a waterproof pouch.");

  if (avgF <= 50) {
    tips.unshift("Avoid cotton layers. Use synthetics or wool that insulate when wet.");
    tips.unshift("Cold air and likely cold water: lean toward a dry suit or a proper wet suit setup.");
    if (avgF <= 40) tips.unshift("Neoprene gloves/boots help. Limit exposure time and keep shore close.");
  }

  if (tmax >= 78) {
    tips.unshift("Hot day: wear sun shirts and light, sun-repellent clothing. Use a wide-brim hat.");
    tips.unshift("Hydrate early. Bring more water than you think you need.");
  }

  if (windMax >= 12 || gustMax >= 20) {
    tips.push("Wind can spike fast. Leash key gear and plan a protected return route.");
  }

  return tips;
}

// ----------------------------
// Home: Date-driven forecast + water toggle + auto refresh
// - Date picker actually drives which daily index is used
// - Hourly chart filters to the selected day
// - Precip tile shows "None" if missing (null/undefined/NaN)
// - If selected date not in returned daily list, shows friendly message
// - Auto GPS on load ONLY when no saved location exists (see Part 2)
// ----------------------------
function renderHome() {
  const page = pageEl();

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Weather/Wind + Best Times</h2>
      <div class="small muted">Pick a date (up to 7 days). Set location and the app builds tiles, wind chart, and fishing windows.</div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Date</div>
        <input id="home_date" type="date" />
        <div class="small muted" style="margin-top:8px;">Forecast is typically available for the next 7 days.</div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Water type</div>
        <div class="toggleRow" id="water_toggle_row">
          <button type="button" id="water_small" class="toggleBtn">Small / protected</button>
          <button type="button" id="water_big" class="toggleBtn">Big water / offshore</button>
        </div>
        <div class="small muted" style="margin-top:8px;">Small water is default. Big water is stricter for wind and cold.</div>
      </div>

      <div style="margin-top:12px;">
        <div class="fieldLabel">Craft</div>
        <select id="home_craft">
          <option>Kayak (paddle)</option>
          <option>Kayak (motorized)</option>
          <option>Boat (small)</option>
        </select>
      </div>
    </div>
  `
  );

  const dateInput = document.getElementById("home_date");
  const craftSel = document.getElementById("home_craft");
  const btnSmall = document.getElementById("water_small");
  const btnBig = document.getElementById("water_big");

  // Date init: default to today, but allow user to change it
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();
  dateInput.value = state.dateIso;

  dateInput.addEventListener("change", function () {
    const v = String(dateInput.value || "").trim();
    if (isIsoDate(v)) state.dateIso = v;
    renderHomeDynamic("date_change");
  });

  craftSel.value = state.craft || "Kayak (paddle)";

  function paintWaterToggle() {
    const isBig = state.waterType === "Big water / offshore";
    if (isBig) {
      btnBig.classList.add("toggleBtnOn");
      btnSmall.classList.remove("toggleBtnOn");
    } else {
      btnSmall.classList.add("toggleBtnOn");
      btnBig.classList.remove("toggleBtnOn");
    }
  }

  btnSmall.addEventListener("click", function () {
    state.waterType = "Small / protected";
    paintWaterToggle();
    renderHomeDynamic("water_change");
  });

  btnBig.addEventListener("click", function () {
    state.waterType = "Big water / offshore";
    paintWaterToggle();
    renderHomeDynamic("water_change");
  });

  craftSel.addEventListener("change", function () {
    state.craft = craftSel.value;
    renderHomeDynamic("craft_change");
  });

  // Default small/protected
  if (state.waterType !== "Big water / offshore") state.waterType = "Small / protected";
  paintWaterToggle();

  // Location picker (auto GPS only when no saved location exists)
  renderLocationPicker(page, "home", function () {
    renderHomeDynamic("location_resolved");
  }, { autoGps: true });

  appendHtml(page, `<div id="home_dynamic"></div>`);

  // initial draw
  renderHomeDynamic("init");

  // Auto refresh when returning to tab (handy on mobile)
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.tool === "Home" && hasResolvedLocation()) {
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
      wx = await fetchWeatherWindMulti(state.lat, state.lon);
      sun = await fetchSunTimesMulti(state.lat, state.lon);
    } catch (e) {
      dyn.innerHTML =
        '<div class="card"><strong>Could not load data.</strong><div class="small muted">Make sure the page is HTTPS. If this persists, the request may be blocked or the network is unstable.</div><div class="small muted" style="margin-top:6px;">' +
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
      // show what IS available so user understands why it did not change
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
        '<div style="margin-top:10px;"><button id="jump_today">Jump to first available</button></div>' +
        "</div>";

      const jumpBtn = document.getElementById("jump_today");
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

    // Precip can be null/undefined depending on data source/season.
    // We treat non-finite as "None" for display.
    const popRaw = wx.daily.popMax && wx.daily.popMax.length ? wx.daily.popMax[idx] : null;
    const popIsFinite = Number.isFinite(Number(popRaw));
    const popMax = popIsFinite ? safeNum(popRaw, 0) : null;

    const windMax = safeNum(wx.daily.windMax[idx], 0);
    const gustMax = safeNum(wx.daily.gustMax[idx], 0);

    const sunFor = sunForDate(sun, useIso);
    const windows = sunFor ? computeBestFishingWindows(sunFor.sunrise, sunFor.sunset) : [];

    const status = computeGoStatus({
      craft: state.craft,
      waterType: state.waterType,
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

    const pointsRaw = filterHourlyToDate(wx.hourly.time || [], wx.hourly.wind || [], useIso);
    const points = [];
    for (let i = 0; i < pointsRaw.length; i++) {
      if (i % 2 === 0) points.push({ dt: pointsRaw[i].dt, mph: safeNum(pointsRaw[i].v, 0) });
    }
    if (points.length < 2) {
      for (let j = 0; j < pointsRaw.length; j++) {
        points.push({ dt: pointsRaw[j].dt, mph: safeNum(pointsRaw[j].v, 0) });
      }
    }

    dyn.innerHTML = "";

    // Precip display string
    const precipDisplay = popIsFinite ? (String(Math.round(popMax)) + " %") : "None";

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
            <div class="tileTop">Rain chance (max)</div>
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
          <div class="sectionTitle">Boating / Kayak status</div>
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
      if (status.label === "GO") pill.style.background = "rgba(143,209,158,0.55)";
      if (status.label === "CAUTION") pill.style.background = "rgba(255,214,102,0.65)";
      if (status.label === "NO-GO") pill.style.background = "rgba(244,163,163,0.70)";
    }

    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Hourly wind (line chart)</h3>
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

    const tipsHtml = tips.map(function (t) { return "<li>" + escHtml(t) + "</li>"; }).join("");
    appendHtml(
      dyn,
      `
      <div class="card">
        <h3>Exposure tips</h3>
        <ul class="list">${tipsHtml}</ul>
      </div>
    `
    );

    // Redraw chart on resize
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
            <option>20</option>
            <option>25</option>
          </select>
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
    const test = safeNum(document.getElementById("dc_test").value, 12);

    const dragFactor = test <= 10 ? 1.0 : test <= 12 ? 0.95 : test <= 20 ? 0.85 : 0.78;
    const base = 0.18 + 0.02 * Math.max(0, weight);
    const speedFactor = 1.5 / Math.max(0.4, speed);
    let depth = line * base * speedFactor * dragFactor;
    depth = Math.max(0, Math.min(depth, line * 0.95));

    out.style.display = "block";
    out.innerHTML =
      "<strong>Estimated depth:</strong> " +
      escHtml(depth.toFixed(1)) +
      " ft<br>" +
      '<div class="small muted" style="margin-top:6px;">Current and lure drag can change results a lot.</div>';
  });
}

// ----------------------------
// Species Tips (PNW expanded)
// ----------------------------
function renderSpeciesTips() {
  const page = pageEl();

  const tips = [
    {
      name: "Largemouth Bass",
      range: "55 to 75 F (most active)",
      bullets: [
        "Topwater early and late when water is warm enough.",
        "Midday: work edges, docks, and weed lines with jigs and plastics.",
        "Cold fronts: slow down with finesse and target deeper transitions."
      ]
    },
    {
      name: "Smallmouth Bass",
      range: "50 to 70 F (most active)",
      bullets: [
        "Wind can improve the bite on rocky points and flats.",
        "Use jigs, tubes, jerkbaits, and small swimbaits.",
        "In cold water, slow down and stay close to bottom structure."
      ]
    },
    {
      name: "Trout (rainbow)",
      range: "45 to 65 F (most active)",
      bullets: [
        "Troll early for consistent action, then switch to casting near inlets.",
        "If sun is high, target deeper water or shaded banks.",
        "Match speed and lure size to water clarity and forage."
      ]
    },
    {
      name: "Kokanee",
      range: "45 to 60 F (best comfort)",
      bullets: [
        "Early light is prime. Troll slow with small dodger + spinner or hoochie.",
        "Use scent and tune speed until you see consistent strikes.",
        "If marks are deep, use heavier weight or downrigger to stay on the school."
      ]
    },
    {
      name: "Chinook Salmon",
      range: "42 to 58 F (typical target water)",
      bullets: [
        "Troll bait or flasher + hoochie; keep speed steady and turns wide.",
        "Fish the temperature band and the bait: adjust depth until you see action.",
        "In wind, stay conservative and prioritize a safe return route."
      ]
    },
    {
      name: "Coho Salmon",
      range: "45 to 60 F",
      bullets: [
        "Coho often respond to faster presentations than Chinook.",
        "Cover water: troll or cast in travel lanes and near current seams.",
        "Bright/flashy presentations can shine in stained water."
      ]
    },
    {
      name: "Sockeye",
      range: "45 to 60 F",
      bullets: [
        "Use legal methods for your water (often specialized; check regs).",
        "Target travel corridors and keep presentation consistent.",
        "If you see fish rolling, adjust depth and speed rather than lure size."
      ]
    },
    {
      name: "Walleye",
      range: "50 to 70 F",
      bullets: [
        "Low light: troll crankbaits or run spinners on edges and flats.",
        "Daytime: jig transitions and humps; slow down when bite is light.",
        "Wind can help: position so you can work structure without drifting too fast."
      ]
    },
    {
      name: "Yellow Perch",
      range: "45 to 70 F",
      bullets: [
        "Small jigs and bait shine. Keep it near bottom.",
        "If you catch one, stay put; perch school up tight.",
        "Light line and subtle motion usually outperforms aggressive jigging."
      ]
    },
    {
      name: "Crappie",
      range: "55 to 75 F",
      bullets: [
        "Look for brush, docks, and protected bays.",
        "Slow vertical presentations and small plastics work well.",
        "On cold fronts, go deeper and slow way down."
      ]
    },
    {
      name: "Northern Pike",
      range: "45 to 70 F",
      bullets: [
        "Edges of weeds and points are key. Cover water with larger baits.",
        "Steel/fluoro leader helps prevent bite-offs.",
        "Handle carefully and keep fingers away from gills/teeth."
      ]
    },
    {
      name: "Lake Trout (Mackinaw)",
      range: "40 to 55 F (cold water)",
      bullets: [
        "Focus deep structure: humps, drop-offs, and basin edges.",
        "Troll or jig where you see marks; speed changes can trigger bites.",
        "Keep your offering in the zone longer rather than racing around."
      ]
    },
    {
      name: "Catfish (Channel/Bullhead)",
      range: "55 to 75 F",
      bullets: [
        "Evening/night can be best. Anchor or drift edges and flats.",
        "Stink baits, cut bait, and worms are consistent producers.",
        "On light bites, keep hooks sharp and give fish time to load up."
      ]
    }
  ];

  appendHtml(
    page,
    `
    <div class="card">
      <h2>Species Tips</h2>
      <div class="small muted">PNW-focused quick guidelines with temperature ranges.</div>
      <div style="margin-top:12px;">
        <select id="tips_sel"></select>
      </div>
      <div id="tips_box" class="card compact" style="margin-top:12px;"></div>
    </div>
  `
  );

  const sel = document.getElementById("tips_sel");
  const box = document.getElementById("tips_box");

  for (let i = 0; i < tips.length; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = tips[i].name;
    sel.appendChild(o);
  }

  function renderTip(i) {
    const t = tips[i];
    const lis = t.bullets.map(function (b) { return "<li>" + escHtml(b) + "</li>"; }).join("");
    box.innerHTML =
      "<strong>" +
      escHtml(t.name) +
      "</strong><br>" +
      '<span class="small muted">Active range: ' +
      escHtml(t.range) +
      "</span>" +
      '<ul class="list">' +
      lis +
      "</ul>";
  }

  sel.addEventListener("change", function () {
    renderTip(Number(sel.value));
  });

  renderTip(0);
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
      <div class="small muted">GPS-based speed. Requires location permission. Best used outside.</div>

      <div class="btnRow" style="margin-top:12px;">
        <button id="spd_start">Start</button>
        <button id="spd_stop" disabled>Stop</button>
      </div>

      <div class="card compact" style="margin-top:12px;">
        <div class="sectionTitle">Current speed</div>
        <div id="spd_val" style="font-size:34px; font-weight:900; margin-top:6px;">0.0 mph</div>
        <div class="small muted" id="spd_note" style="margin-top:6px;"></div>
      </div>
    </div>
  `
  );

  const startBtn = document.getElementById("spd_start");
  const stopBtn = document.getElementById("spd_stop");
  const valEl = document.getElementById("spd_val");
  const noteEl = document.getElementById("spd_note");

  function setRunning(r) {
    startBtn.disabled = r;
    stopBtn.disabled = !r;
  }

  startBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      noteEl.textContent = "Geolocation not supported.";
      return;
    }

    noteEl.textContent = "Starting GPS...";
    setRunning(true);

    try {
      state.speedWatchId = navigator.geolocation.watchPosition(
        function (pos) {
          const ms = pos.coords.speed;
          let mph = Number.isFinite(ms) ? ms * 2.236936 : NaN;
          if (!Number.isFinite(mph)) mph = 0;

          valEl.textContent = mph.toFixed(1) + " mph";
          noteEl.textContent =
            "Accuracy: " + safeNum(pos.coords.accuracy, 0).toFixed(0) + " m";
        },
        function (err) {
          noteEl.textContent = "Speed error: " + escHtml(err.message);
          setRunning(false);
        },
        { enableHighAccuracy: true, maximumAge: 500, timeout: 15000 }
      );
    } catch (e) {
      noteEl.textContent = "Could not start GPS watch.";
      setRunning(false);
    }
  });

  stopBtn.addEventListener("click", function () {
    stopSpeedWatchIfRunning();
    setRunning(false);
    noteEl.textContent = "Stopped.";
  });
}

// ----------------------------
// Render router
// ----------------------------
function render() {
  if (!app) app = document.getElementById("app");
  if (!app) return;

  renderConsentBannerIfNeeded();

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

  state.tool = "Home";
  if (!isIsoDate(state.dateIso)) state.dateIso = isoTodayLocal();

  try {
    window.scrollTo(0, 0);
  } catch (e) {
    // ignore
  }

  render();
});

// ============================
// app.js (PART 3 OF 3) END
// ============================