const $ = (id) => document.getElementById(id);
const COLORS = { Rape: "#f472b6", Theft: "#38bdf8", Property: "#f5b942" };
const charts = {};
const fmt = (n) => Number(n).toLocaleString("en-IN");

async function api(path) {
  const r = await fetch(path);
  return r.json();
}

function draw(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

const axes = {
  x: { ticks: { color: "#8b95a7" }, grid: { color: "#1f2937" } },
  y: { ticks: { color: "#8b95a7" }, grid: { color: "#1f2937" }, beginAtZero: true },
};
const legend = { labels: { color: "#8b95a7" } };

function trendChart(id, years, values, crime) {
  draw(id, {
    type: "line",
    data: { labels: years, datasets: [{ label: crime, data: values, borderColor: COLORS[crime],
      backgroundColor: COLORS[crime] + "33", fill: true, tension: 0.3, pointRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: axes, plugins: { legend } },
  });
}

function forecastChart(id, years, values, fyears, fvalues, crime) {
  const labels = [...years, ...fyears];
  const hist = [...values, ...fyears.map(() => null)];
  const fc = [...years.map(() => null), ...fvalues];
  if (values.length) fc[years.length - 1] = values[values.length - 1]; // connect the lines
  draw(id, {
    type: "line",
    data: { labels, datasets: [
      { label: crime + " (actual)", data: hist, borderColor: COLORS[crime], tension: 0.3, pointRadius: 3 },
      { label: crime + " (forecast)", data: fc, borderColor: "#34d399", borderDash: [6, 4], tension: 0.3, pointRadius: 3 },
    ] },
    options: { responsive: true, maintainAspectRatio: false, scales: axes, plugins: { legend } },
  });
}

// ---------- Overview ----------
async function loadOverview() {
  const o = await api("/api/overview");
  $("k-total").textContent = fmt(o.total_cases);
  $("k-states").textContent = o.states;
  $("k-years").textContent = o.year_min + " - " + o.year_max;
  $("k-top").textContent = o.top_crime;
  draw("cat-pie", {
    type: "doughnut",
    data: { labels: Object.keys(o.by_crime), datasets: [{ data: Object.values(o.by_crime),
      backgroundColor: Object.keys(o.by_crime).map((c) => COLORS[c]), borderColor: "#121826" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend } },
  });
  loadOverviewCharts();
}

async function loadOverviewCharts() {
  const crime = $("ov-crime").value;
  const s = await api("/api/state?state=" + encodeURIComponent("All India"));
  trendChart("ov-trend", s.years, s.trend[crime], crime);
  forecastChart("ov-forecast", s.years, s.trend[crime], s.forecast_years, s.forecast[crime], crime);
}

// ---------- State ----------
async function loadState() {
  const state = $("st-state").value, crime = $("st-crime").value;
  const s = await api("/api/state?state=" + encodeURIComponent(state));
  trendChart("st-trend", s.years, s.trend[crime], crime);
  forecastChart("st-forecast", s.years, s.trend[crime], s.forecast_years, s.forecast[crime], crime);
}

// ---------- Yearly ----------
async function loadYearly() {
  const crime = $("yr-crime").value;
  const s = await api("/api/state?state=" + encodeURIComponent("All India"));
  draw("yr-bar", {
    type: "bar",
    data: { labels: s.years, datasets: [{ label: crime, data: s.trend[crime], backgroundColor: COLORS[crime] }] },
    options: { responsive: true, maintainAspectRatio: false, scales: axes, plugins: { legend } },
  });
}

// ---------- Heatmap ----------
function heatColor(v) {
  // 0 = pale yellow, 1 = deep red
  const r = Math.round(255 - 60 * v), g = Math.round(245 - 215 * v), b = Math.round(160 - 140 * v);
  return `rgb(${r},${g},${b})`;
}

async function loadHeatmap() {
  const h = await api("/api/heatmap?year=" + $("hm-year").value);
  let html = "<table class='hm'><tr><th></th>";
  h.states.forEach((s) => (html += `<th class='col'><div>${s}</div></th>`));
  html += "</tr>";
  h.crimes.forEach((c, i) => {
    html += `<tr><th class='row'>${c}</th>`;
    h.matrix[i].forEach((v) => (html += `<td style='background:${heatColor(v)}'>${v.toFixed(2)}</td>`));
    html += "</tr>";
  });
  $("hm-wrap").innerHTML = html + "</table>";
}
// ---------- India map ----------
const GEO_URL = "https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson";
const ALIAS = {
  andamanandnicobarisland: "andamanandnicobarislands",
  anislands: "andamanandnicobarislands",
  arunanchalpradesh: "arunachalpradesh",
  dadaraandnagarhaveli: "dadraandnagarhaveli",
  dnhaveli: "dadraandnagarhaveli",
  nctofdelhi: "delhi",
  delhiut: "delhi",
  uttaranchal: "uttarakhand",
  orissa: "odisha",
  pondicherry: "puducherry",
  telangana: "andhrapradesh", // data predates the 2014 split
  ladakh: "jammuandkashmir",
};
const key = (s) => {
  const k = String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
  return ALIAS[k] || k;
};

let map, geoLayer, geoData;
async function loadMap() {
  const d = await api(`/api/map?year=${$("hm-year").value}&metric=${$("mp-metric").value}`);
  const byKey = {};
  Object.entries(d.values).forEach(([s, v]) => (byKey[key(s)] = v));

  if (!map) map = L.map("map", { attributionControl: false, zoomSnap: 0.25 });
  if (!geoData) {
    try {
      geoData = await (await fetch(GEO_URL)).json();
    } catch (e) {
      $("map").innerHTML = "<p style='padding:20px'>Could not load the map outline. Check your internet connection.</p>";
      return;
    }
  }
  if (geoLayer) geoLayer.remove();
  const unmatched = [];
  geoLayer = L.geoJSON(geoData, {
    style: (f) => {
      const v = byKey[key(f.properties.ST_NM)];
      return { fillColor: v === undefined ? "#2b3345" : heatColor(v / d.max), fillOpacity: 1, color: "#0b0f17", weight: 1 };
    },
    onEachFeature: (f, layer) => {
      const name = f.properties.ST_NM, v = byKey[key(name)];
      if (v === undefined) unmatched.push(name);
      layer.bindTooltip(`<b>${name}</b><br>${v === undefined ? "No data" : fmt(v)}`, { sticky: true });
    },
  }).addTo(map);
  map.invalidateSize();
  map.fitBounds(geoLayer.getBounds());
  if (unmatched.length) console.warn("Map: no data matched for", unmatched);
}

const refreshHeat = () => { loadMap(); loadHeatmap(); };
// ---------- Ranking ----------
async function loadRanking() {
  const r = await api("/api/ranking?year=" + $("rk-year").value);
  $("rk-list").innerHTML = r.items
    .map((i) => `<li><span>${i.state}</span><span>${i.score} <span class='tag ${i.level}'>${i.level}</span></span></li>`)
    .join("");
}

// ---------- Predict ----------
async function runPredict() {
  const p = await api(`/api/predict?state=${encodeURIComponent($("pr-state").value)}&year=${$("pr-year").value}`);
  if (p.error) return;
  $("pr-result").classList.remove("hidden");
  $("pr-badge").className = "badge " + p.level;
  $("pr-badge").textContent = p.level + " RISK";
  $("pr-insight").textContent = p.insight;
  $("pr-top").textContent = `${p.top_crime} (${fmt(p.top_value)} cases)`;
  $("pr-score").textContent = p.score;
  $("pr-year-used").textContent = p.year_used + (p.forecast ? " (forecast)" : "");
  draw("pr-bars", {
    type: "bar",
    data: { labels: Object.keys(p.values), datasets: [{ data: Object.values(p.values),
      backgroundColor: Object.keys(p.values).map((c) => COLORS[c]) }] },
    options: { responsive: true, maintainAspectRatio: false, scales: axes, plugins: { legend: { display: false } } },
  });

  // Next 5 years
  const LV = { HIGH: "#f87171", MEDIUM: "#fbbf24", LOW: "#34d399" };
  $("pr-future").innerHTML =
    "<tr><th>Year</th><th>Rape</th><th>Theft</th><th>Property</th><th>Score</th><th>Risk</th></tr>" +
    p.future.map((f) =>
      `<tr><td>${f.year}</td><td>${fmt(f.values.Rape)}</td><td>${fmt(f.values.Theft)}</td>` +
      `<td>${fmt(f.values.Property)}</td><td>${f.score}</td><td><span class='tag ${f.level}'>${f.level}</span></td></tr>`
    ).join("");
  $("pr-thr").textContent = `HIGH if score >= ${p.high}, MEDIUM if >= ${p.low}, otherwise LOW. Forecast is a straight-line trend, so treat it as indicative.`;
  draw("pr-forecast", {
    type: "bar",
    data: { labels: p.future.map((f) => f.year), datasets: [{ label: "Risk score",
      data: p.future.map((f) => f.score), backgroundColor: p.future.map((f) => LV[f.level]) }] },
    options: { responsive: true, maintainAspectRatio: false, scales: axes, plugins: { legend: { display: false } } },
  });
}

// ---------- Navigation + init ----------
const loaded = {};
const loaders = { state: loadState, yearly: loadYearly, heatmap: refreshHeat, categories: loadRanking };

function show(page) {
  document.querySelectorAll(".nav").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
  if (loaders[page]) loaders[page](); // reload so charts size correctly
}

function fill(id, items) {
  $(id).innerHTML = items.map((i) => `<option>${i}</option>`).join("");
}

async function init() {
  const m = await api("/api/meta");
  fill("st-state", ["All India", ...m.states]);
  fill("pr-state", m.states);
  ["hm-year", "rk-year", "pr-year"].forEach((id) => fill(id, m.years));
  ["hm-year", "rk-year", "pr-year"].forEach((id) => ($(id).value = m.years[m.years.length - 1]));
    const last = m.years[m.years.length - 1];
  $("pr-year").innerHTML =
    m.years.map((y) => `<option>${y}</option>`).join("") +
    [1, 2, 3, 4, 5].map((i) => `<option value="${last + i}">${last + i} (forecast)</option>`).join("");
  $("pr-year").value = last;

  document.querySelectorAll(".nav").forEach((b) => b.addEventListener("click", () => show(b.dataset.page)));
  $("ov-crime").addEventListener("change", loadOverviewCharts);
  $("st-state").addEventListener("change", loadState);
  $("st-crime").addEventListener("change", loadState);
  $("yr-crime").addEventListener("change", loadYearly);
  $("hm-year").addEventListener("change", refreshHeat);
  $("mp-metric").addEventListener("change", loadMap);
  $("rk-year").addEventListener("change", loadRanking);
  $("pr-go").addEventListener("click", runPredict);

  loadOverview();
}
init();