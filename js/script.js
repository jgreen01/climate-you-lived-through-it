/* =====================================================================
 * "You've Already Lived Through It" - CS416 Narrative Visualization
 * Structure: parameters (state) -> scenes (render functions) -> triggers
 * ===================================================================== */

// ===== Parameters (state variables) =====
const state = {
  scene: 0,            // scene index
  city: "chicago",     // key into heat.json; featured city
  metric: "hot-days",  // which day of concern; see METRIC_META
  baseline: "now",     // map change measured since "now" (2015-24) or "past" (1980s)
};
const baselineLabel = () => (state.baseline === "past" ? "the 1980s" : "today");

// Per-metric copy, color, and direction of concern.
// dir "up" = an increase is the danger; "down" = a decrease is (freezing days).
const METRIC_META = {
  "hot-days": {
    label: "Hot days", noun: "hot days", unit: "days", def: "days at or above 30°C",
    accent: "#c0392b", dir: "up", change: "more hot days",
  },
  "hot-nights": {
    label: "Hot nights", noun: "hot nights", unit: "nights", def: "nights at or above 26°C",
    accent: "#8856a7", dir: "up", change: "more hot nights",
  },
  "danger-days": {
    label: "Dangerous heat", noun: "dangerous-heat days", unit: "days",
    def: "days at or above 40°C, too hot to safely work or play outside",
    accent: "#7b1a1a", dir: "up", change: "more dangerous-heat days",
  },
  "freezing": {
    label: "Freezing days", noun: "freezing days", unit: "days", def: "days below 0°C",
    accent: "#2166ac", dir: "down", change: "freezing days lost",
  },
};
const meta = () => METRIC_META[state.metric];

let DATA = null; // loaded once at init from data/heat.json

// ===== Waffle Year renderer (the one chart) =====
// A year = 365 squares in a near-square block (20 rows, filled column-major).
// The first `days` squares are heat-red, the rest grey.
const WAFFLE = {
  rows: 20,
  cols: Math.ceil(365 / 20), // 19
  cell: 15,
  gap: 3,
};
WAFFLE.width = WAFFLE.cols * (WAFFLE.cell + WAFFLE.gap);
WAFFLE.height = WAFFLE.rows * (WAFFLE.cell + WAFFLE.gap);

const COLOR_COOL = "#e8e6e1"; // grey squares (days that don't meet the metric)

// Draw one waffle year as its own <svg> appended to `container` (a d3 HTML
// selection). Each waffle is a self-contained, viewBox-scaled chart so the
// flex container can lay two out side by side or stack them (see #waffle-pair).
// cfg: { days, label, sublabel }
function drawWaffle(container, cfg) {
  const g = container
    .append("svg")
    .attr("class", "waffle-svg")
    .attr("viewBox", `0 0 ${WAFFLE.width} ${WAFFLE.height + 50}`) // +50 for labels below
    .attr("role", "img")
    .append("g")
    .attr("class", "waffle");

  const hot = Math.round(cfg.days);
  const squares = d3.range(365).map((i) => ({
    i,
    hot: i < hot,
    // column-major: fill top-to-bottom, then left-to-right
    cx: Math.floor(i / WAFFLE.rows) * (WAFFLE.cell + WAFFLE.gap),
    cy: (i % WAFFLE.rows) * (WAFFLE.cell + WAFFLE.gap),
  }));

  g.selectAll("rect")
    .data(squares)
    .join("rect")
    .attr("x", (d) => d.cx)
    .attr("y", (d) => d.cy)
    .attr("width", WAFFLE.cell)
    .attr("height", WAFFLE.cell)
    .attr("rx", 1.5)
    .attr("class", (d) => (d.hot ? "sq sq-hot" : "sq sq-cool"))
    .attr("fill", (d) => (d.hot ? meta().accent : COLOR_COOL))
    .append("title")
    .text(() => `${cfg.label}: ${hot} ${meta().noun} in an average year`);

  g.append("text")
    .attr("class", "waffle-label")
    .attr("x", 0)
    .attr("y", WAFFLE.height + 22)
    .text(cfg.label);

  if (cfg.sublabel) {
    g.append("text")
      .attr("class", "waffle-sublabel")
      .attr("x", 0)
      .attr("y", WAFFLE.height + 40)
      .text(cfg.sublabel);
  }

  // big number readout: the headline figure of the waffle
  g.append("text")
    .attr("class", "waffle-count")
    .attr("x", WAFFLE.width)
    .attr("y", WAFFLE.height + 28)
    .attr("text-anchor", "end")
    .text(`${hot} ${meta().unit}`);

  return g;
}

function cityEra(cityKey, eraKey) {
  return DATA.cities[cityKey].metrics[state.metric][eraKey];
}

// Every city as a flat {key, name, country, lat, lon, ...} record.
const cityList = () =>
  Object.entries(DATA.cities).map(([key, c]) => ({ key, ...c }));

// ===== Scenes =====
const svg = d3.select("#chart");
const WIDTH = 960;
const HEIGHT = 540;

// Cached selections for the static elements in index.html (present at load).
const sceneTitle = d3.select("#scene-title");
const sceneSubtitle = d3.select("#scene-subtitle");
const btnPrev = d3.select("#btn-prev");
const btnNext = d3.select("#btn-next");
const breadcrumbs = d3.select("#scene-breadcrumbs");
const metricBar = d3.select("#metric-bar");
const citySelect = d3.select("#city-select");
const citySelectLabel = d3.select("#city-select-label");
const mapControls = d3.select("#map-controls");
const wafflePair = d3.select("#waffle-pair");

// Map hover tooltip: positioned in HTML pixel space (not SVG viewBox units),
// so it tracks the cursor correctly at any zoom/scale of the SVG.
const chartBox = document.getElementById("chart-box");
const mapTooltip = d3.select("#map-tooltip");
function moveMapTooltip(event) {
  const rect = chartBox.getBoundingClientRect();
  mapTooltip
    .style("left", `${event.clientX - rect.left}px`)
    .style("top", `${event.clientY - rect.top - 12}px`);
}
function sceneTitleBlock(title, subtitle) {
  sceneTitle.text(title);
  sceneSubtitle.text(subtitle);
}

// Draw the two waffles into the flex container. It lays them side by side when
// there is room and wraps to a stacked column on narrow screens (see the
// #waffle-pair CSS); each waffle scales itself, so no coordinates are needed.
function drawWafflePair(left, right) {
  drawWaffle(wafflePair, left);
  drawWaffle(wafflePair, right);
}

// Scene: 1980s vs. now (the change already lived through).
function drawThenNow() {
  const c = DATA.cities[state.city];
  sceneTitleBlock(
    "You've already lived through it",
    `${c.name}: ${meta().def}. Then, and now.`
  );
  drawWafflePair(
    { days: cityEra(state.city, "past"), label: "The 1980s", sublabel: "average year, 1980–1989" },
    { days: cityEra(state.city, "present"), label: "Now", sublabel: "average year, 2015–2024" }
  );
}

// Scene: the next 20 years, already locked in by past emissions.
function drawLockedIn() {
  const c = DATA.cities[state.city];
  sceneTitleBlock(
    "The next 20 years are already decided",
    `The next 20 years are already locked in by emissions we've already released. Here's what's coming for ${c.name} around 2045*, regardless of what we do next.`
  );
  drawWafflePair(
    { days: cityEra(state.city, "present"), label: "Now", sublabel: "average year, 2015–2024" },
    { days: cityEra(state.city, "near"), label: "Around 2045", sublabel: "already locked in, regardless of policy" }
  );
}

// Scene: two 2080 futures, low vs. high emissions.
function drawTwoFutures() {
  const c = DATA.cities[state.city];
  sceneTitleBlock(
    "Two futures: the gap is the choice",
    `By the 2080s*, ${c.name}'s future splits in two, and which one happens is still up to us.`
  );
  drawWafflePair(
    { days: cityEra(state.city, "farLow"), label: "If we act (low emissions)", sublabel: "SSP2-4.5, average year 2076–2085" },
    { days: cityEra(state.city, "farHigh"), label: "If we don't (high emissions)", sublabel: "SSP5-8.5, average year 2076–2085" }
  );
}

// ===== Century line chart: one city's whole century on one chart =====
// Shared line 1980s -> today -> 2045, then forks into two 2080 futures.
const LINE_ERAS = [
  { year: 1985, key: "past", label: "1980s" },
  { year: 2020, key: "present", label: "today" },
  { year: 2045, key: "near", label: "2045" },
];

function drawCentury() {
  const c = DATA.cities[state.city];
  sceneTitleBlock(
    "The century ahead, and the fork in it",
    `One shared past, two possible futures. The whole century for ${c.name}, in one line.`
  );

  const M = { top: 70, right: 150, bottom: 55, left: 60 };
  const x = d3.scaleLinear([1980, 2085], [M.left, WIDTH - M.right]);
  const y = d3.scaleLinear([0, 365], [HEIGHT - M.bottom, M.top]);

  const line = d3
    .line()
    .x((d) => x(d[0]))
    .y((d) => y(d[1]));

  const shared = LINE_ERAS.map((e) => [e.year, cityEra(state.city, e.key)]);
  const fork = [2045, cityEra(state.city, "near")];
  const highPts = [fork, [2080, cityEra(state.city, "farHigh")]];
  const lowPts = [fork, [2080, cityEra(state.city, "farLow")]];

  const lowColor = d3.interpolateMagma(0.55); // mid (lighter = better path)
  const highColor = d3.interpolateMagma(0.15); // dark (worse path)

  const g = svg.append("g").attr("class", "linechart");

  // y gridlines + axis
  const yTicks = [0, 100, 200, 300, 365];
  g.selectAll("line.grid")
    .data(yTicks)
    .join("line")
    .attr("class", "grid")
    .attr("x1", M.left)
    .attr("x2", WIDTH - M.right)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d));
  g.selectAll("text.ytick")
    .data(yTicks)
    .join("text")
    .attr("class", "axis-label ytick")
    .attr("x", M.left - 8)
    .attr("y", (d) => y(d) + 3)
    .attr("text-anchor", "end")
    .text((d) => d);
  g.append("text")
    .attr("class", "axis-title")
    .attr("x", M.left - 40)
    .attr("y", M.top - 22)
    .text(`${meta().noun} / year`);

  // x axis labels
  [...LINE_ERAS, { year: 2080, label: "2080" }].forEach((e) => {
    g.append("text")
      .attr("class", "axis-label")
      .attr("x", x(e.year))
      .attr("y", HEIGHT - M.bottom + 20)
      .attr("text-anchor", "middle")
      .text(e.label);
  });

  // the gap between the two futures is the choice
  g.append("path")
    .attr("class", "choice-gap")
    .attr(
      "d",
      `M${x(2045)},${y(cityEra(state.city, "near"))} L${x(2080)},${y(
        cityEra(state.city, "farHigh")
      )} L${x(2080)},${y(cityEra(state.city, "farLow"))} Z`
    );

  // shared past -> present -> 2045 line
  g.append("path").attr("class", "line-shared").attr("d", line(shared));
  // two forks
  g.append("path")
    .attr("class", "line-fork")
    .attr("d", line(lowPts))
    .attr("stroke", lowColor);
  g.append("path")
    .attr("class", "line-fork")
    .attr("d", line(highPts))
    .attr("stroke", highColor);

  // dots on the shared points
  g.selectAll("circle.pt")
    .data(shared)
    .join("circle")
    .attr("class", "pt")
    .attr("cx", (d) => x(d[0]))
    .attr("cy", (d) => y(d[1]))
    .attr("r", 4);

  // endpoint labels
  const endLabel = (pts, color, title, sub) => {
    const [yr, val] = pts[1];
    const gg = g
      .append("g")
      .attr("transform", `translate(${x(yr) + 10},${y(val)})`);
    gg.append("circle").attr("r", 5).attr("fill", color);
    gg.append("text")
      .attr("class", "end-title")
      .attr("x", 10)
      .attr("y", -2)
      .attr("fill", color)
      .text(`${title}: ${Math.round(val)} days`);
    gg.append("text")
      .attr("class", "end-sub")
      .attr("x", 10)
      .attr("y", 13)
      .text(sub);
  };
  endLabel(highPts, highColor, "If we don't act", "high emissions");
  endLabel(lowPts, lowColor, "If we act", "low emissions");
}

// ===== World map: explore every city =====
let WORLD = null; // topojson basemap, loaded at init
let GRID = null; // baked global delta grid, loaded at init

// Raw signed change from today (2015-24) to the high-emissions 2080s.
// Most metrics are increases (positive); "freezing" is a decrease (negative,
// "days lost") shown on its own negative scale rather than flipped to positive.
function cityDelta(key) {
  const start = state.baseline === "past" ? "past" : "present";
  return cityEra(key, "farHigh") - cityEra(key, start);
}

// Colorblind-safe (protan) sequential: pale -> dark magma, magnitude carried
// by lightness not red-vs-green. interpolateMagma(1-t) => low = pale, high = deep.
const heatRamp = (t) => d3.interpolateMagma(1 - t);

const gridObj = () => GRID[state.metric][state.baseline];

function drawMap() {
  sceneTitleBlock(
    "Now find your city",
    `Every dot is a real city. Color shows ${meta().change} by the 2080s* (vs. ${baselineLabel()}). Click one to follow its story.`
  );

  const g = gridObj();
  const rawGridVals = g.values; // signed: positive = increase, negative = decrease
  const cityDeltas = Object.keys(DATA.cities).map(cityDelta);

  // Per-metric domain, combining the grid's own extreme with the city
  // roster's extreme, so the legend, the dots, and the background overlay
  // are always on the exact same scale (no separate/mismatched domains).
  // "up" metrics (increase is the danger): domain 0 -> max.
  // "down" metrics (freezing: a decrease is the danger): domain 0 -> min,
  // i.e. a negative "days lost" scale.
  const domain =
    meta().dir === "down"
      ? [0, Math.min(d3.min(rawGridVals), d3.min(cityDeltas), 0)]
      : [0, Math.max(d3.max(rawGridVals), d3.max(cityDeltas), 0)];
  const colorScale = d3.scaleSequential(heatRamp).domain(domain).clamp(true);

  const projection = d3
    .geoNaturalEarth1()
    .fitExtent([[20, 20], [WIDTH - 20, HEIGHT - 70]], { type: "Sphere" });
  const path = d3.geoPath(projection);

  const countries = topojson.feature(WORLD, WORLD.objects.countries);
  const landFeature = topojson.feature(WORLD, WORLD.objects.land);

  const gMap = svg.append("g").attr("class", "map").attr("id", "map-content");
  gMap
    .append("path")
    .attr("class", "sphere")
    .attr("d", path({ type: "Sphere" }));

  // Smooth contours of the global grid, clipped to land, for sub-country
  // detail (a country average would hide exactly the local variation this
  // tool is meant to show, e.g. Amazon interior vs. coast).
  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "land-clip")
    .append("path")
    .attr("d", path(landFeature));

  const [lo, hi] = [Math.min(...domain), Math.max(...domain)];
  const step = Math.max(2, Math.round((hi - lo) / 12));
  const contours = d3
    .contours()
    .size([g.width, g.height])
    .thresholds(d3.range(lo + step / 2, hi, step))(rawGridVals);
  const toLonLat = ([x, y]) => [
    g.lon0 + x * g.dlon,
    g.lat0 + y * g.dlat,
  ];
  const reproject = (c) => ({
    type: c.type,
    coordinates: c.coordinates.map((poly) =>
      poly.map((ring) => ring.map(toLonLat))
    ),
  });
  gMap
    .append("g")
    .attr("clip-path", "url(#land-clip)")
    .selectAll("path.contour")
    .data(contours)
    .join("path")
    .attr("class", "contour")
    .attr("d", (c) => path(reproject(c)))
    .attr("fill", (c) => colorScale(c.value));

  // country borders, for orientation only (no choropleth fill)
  gMap
    .selectAll("path.country")
    .data(countries.features)
    .join("path")
    .attr("class", "country-outline")
    .attr("d", path);

  // strong coastline: merged land silhouette on top, so continents read clearly
  gMap
    .append("path")
    .attr("class", "land-outline")
    .attr("d", path(landFeature));

  const cities = cityList();
  const cityX = (d) => projection([d.lon, d.lat])[0];
  const cityY = (d) => projection([d.lon, d.lat])[1];
  const cityR = (d) => (d.key === state.city ? 8 : 5);

  // Base (undistorted) position/radius; fx/fy/fr are the fisheye-adjusted
  // values actually rendered, updated live on mousemove.
  cities.forEach((d) => {
    d.baseX = cityX(d);
    d.baseY = cityY(d);
    d.baseR = cityR(d);
    d.fx = d.baseX;
    d.fy = d.baseY;
    d.fr = d.baseR;
  });

  // Position a circle selection at each city's current fisheye state.
  // rOffset grows the two halo rings (black, then white) behind the dot.
  const placeCircles = (sel, rOffset) =>
    sel
      .attr("cx", (d) => d.fx)
      .attr("cy", (d) => d.fy)
      .attr("r", (d) => d.fr + rOffset);

  // Two halo rings behind each dot keep every marker legible on any map color.
  const makeHalo = (cls, rOffset) =>
    placeCircles(
      gMap.selectAll(`circle.${cls}`).data(cities).join("circle").attr("class", cls),
      rOffset
    ).style("pointer-events", "none");

  const haloBlack = makeHalo("city-halo-black", 3);
  const haloWhite = makeHalo("city-halo-white", 1.5);

  const cityDots = placeCircles(
    gMap
      .selectAll("circle.city")
      .data(cities)
      .join("circle")
      .attr("class", (d) => `city${d.key === state.city ? " city-selected" : ""}`),
    0
  )
    .attr("fill", (d) => colorScale(cityDelta(d.key)))
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      state.city = d.key;
      state.scene = 1; // drill into the chosen city's story (scene 0 is this map)
      renderScene();
    })
    .on("mouseenter", (event, d) => {
      mapTooltip.html(`<strong>${d.name}</strong><br>${fmtTick(cityDelta(d.key))} ${meta().unit}`);
      moveMapTooltip(event);
      mapTooltip.property("hidden", false);
    })
    .on("mousemove", moveMapTooltip)
    .on("mouseleave", () => mapTooltip.property("hidden", true));

  // Fisheye: dots near the cursor push radially outward from it and enlarge,
  // easing back to their true position/size by FISHEYE_RADIUS away, so dense
  // clusters (e.g. Europe, SE Asia) become separable on hover.
  const FISHEYE_RADIUS = 60;
  const PUSH = 1.25; // max radial displacement multiplier at the cursor
  const MAX_SCALE = 1.25; // max dot-size multiplier at the cursor

  // Magnifying-glass lens: a live <use> copy of the whole map, scaled up
  // around the cursor and clipped to a circle. A cheap stand-in for truly
  // warping the map geometry, which would mean recomputing thousands of
  // path vertices per mousemove.
  const LENS_RADIUS = 90;
  const LENS_SCALE = 2.2;

  const lensClip = svg
    .append("clipPath")
    .attr("id", "map-lens-clip")
    .append("circle")
    .attr("r", LENS_RADIUS);

  const lensGroup = svg
    .append("g")
    .attr("class", "map-lens")
    .attr("clip-path", "url(#map-lens-clip)")
    .style("display", "none");
  lensGroup.append("use").attr("href", "#map-content");

  const lensRing = svg
    .append("circle")
    .attr("class", "map-lens-ring")
    .attr("r", LENS_RADIUS)
    .style("display", "none");

  function applyFisheye(mx, my) {
    for (const d of cities) {
      const dx = d.baseX - mx;
      const dy = d.baseY - my;
      const dist = Math.hypot(dx, dy);
      if (mx === null || dist >= FISHEYE_RADIUS) {
        d.fx = d.baseX;
        d.fy = d.baseY;
        d.fr = d.baseR;
        continue;
      }
      const t = 1 - dist / FISHEYE_RADIUS;
      const ease = t * t * (3 - 2 * t); // smoothstep
      const push = 1 + ease * (PUSH - 1);
      d.fx = dist === 0 ? d.baseX : mx + dx * push;
      d.fy = dist === 0 ? d.baseY : my + dy * push;
      d.fr = d.baseR * (1 + ease * (MAX_SCALE - 1));
    }
    placeCircles(haloBlack, 3);
    placeCircles(haloWhite, 1.5);
    placeCircles(cityDots, 0);

    if (mx === null) {
      lensGroup.style("display", "none");
      lensRing.style("display", "none");
    } else {
      lensClip.attr("cx", mx).attr("cy", my);
      lensGroup
        .select("use")
        .attr("transform", `translate(${mx - mx * LENS_SCALE},${my - my * LENS_SCALE}) scale(${LENS_SCALE})`);
      lensGroup.style("display", null);
      lensRing.attr("cx", mx).attr("cy", my).style("display", null);
    }
  }

  // Bound on the map group itself so it fires regardless of which child
  // (ocean, land, country, dot) is under the cursor: mousemove bubbles, and
  // mouseleave fires when the pointer leaves the whole map area.
  gMap
    .on("mousemove", (event) => {
      const [mx, my] = d3.pointer(event, svg.node());
      applyFisheye(mx, my);
    })
    .on("mouseleave", () => applyFisheye(null, null));

  buildMapControls(colorScale, domain);
}

// The legend + baseline toggle live in an HTML row above the map graphic,
// rebuilt each time the map re-renders.
function buildMapControls(scale, domain) {
  mapControls.selectAll("*").remove();
  drawLegend(mapControls, scale, domain);
  drawBaselineToggle(mapControls);
}

// Horizontal sequential legend. domain = [d0, d1]; d0 is always the
// "no change" end (0), d1 the metric's extreme (negative for "days lost"
// metrics like freezing, positive otherwise).
const fmtTick = (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);

function drawLegend(parent, scale, domain) {
  const [d0, d1] = domain;
  const stops = d3
    .range(0, 1.01, 0.1)
    .map((t) => `${scale(d0 + t * (d1 - d0))} ${(t * 100).toFixed(0)}%`)
    .join(", ");

  const g = parent.append("div").attr("class", "map-legend");
  g.append("div")
    .attr("class", "map-legend-title")
    .text(`${meta().change} by the 2080s`);
  g.append("div")
    .attr("class", "map-legend-sub")
    .text("2076–2085 average, high emissions (SSP5-8.5)");
  g.append("div")
    .attr("class", "map-legend-bar")
    .style("background", `linear-gradient(to right, ${stops})`);
  const ticks = g.append("div").attr("class", "map-legend-ticks");
  ticks.append("span").text(fmtTick(d0));
  ticks.append("span").text(fmtTick(d0 + (d1 - d0) / 2));
  ticks.append("span").text(fmtTick(d1));
}

// baseline switch (a trigger): measure change since the 1980s or since today
function drawBaselineToggle(parent) {
  const modes = [
    ["past", "1980s"],
    ["now", "today"],
  ];
  const g = parent.append("div").attr("class", "baseline-toggle");
  g.append("span").attr("class", "map-toggle-label").text("Change since:");
  modes.forEach(([mode, label]) => {
    g.append("button")
      .attr("type", "button")
      .attr("class", `map-toggle-btn${state.baseline === mode ? " map-toggle-active" : ""}`)
      .text(label)
      .on("click", () => {
        state.baseline = mode;
        renderScene();
      });
  });
}

// The scenes, in order. The map is the entry point (scene 0), then the
// drill-down story. Each descriptor carries:
//   draw  - the render function
//   short - breadcrumb hover label
//   dest  - noun phrase for Back/Next on an adjacent scene
//           ("Back to the next 20 years", "See the 2080 fork")
// The measured-vs-modeled footnote is static (same on every scene); see the
// page <footer>.
// `waffle: true` scenes render into the #waffle-pair flex container; the rest
// (map, century line) render into the single #chart svg.
const SCENES = [
  { draw: drawMap, short: "Map", dest: "the map" },
  { draw: drawThenNow, short: "1980s vs. now", dest: "1980s vs. now", waffle: true },
  { draw: drawLockedIn, short: "Next 20 years", dest: "the next 20 years", waffle: true },
  { draw: drawTwoFutures, short: "Two 2080 futures", dest: "the 2080 fork", waffle: true },
  { draw: drawCentury, short: "The century ahead", dest: "the century view" },
];

// Clear-and-repopulate scene pattern
function renderScene() {
  svg.selectAll("*").remove();
  wafflePair.selectAll("*").remove();
  mapTooltip.property("hidden", true);
  btnPrev
    .property("disabled", state.scene === 0)
    .text(state.scene === 0 ? "← Back" : `← Back to ${SCENES[state.scene - 1].dest}`);
  // the last scene loops back to the map instead of dead-ending
  const isLastScene = state.scene === SCENES.length - 1;
  btnNext
    .property("disabled", false)
    .text(
      isLastScene
        ? "Return to map ↺"
        : state.scene === 0
        ? `Explore ${DATA.cities[state.city].name}'s story →`
        : `See ${SCENES[state.scene + 1].dest} →`
    );
  buildBreadcrumbs();
  // the map (scene 0) picks the city by clicking a dot; other scenes get the dropdown
  citySelectLabel.property("hidden", state.scene === 0);
  citySelect.property("value", state.city);
  // the legend + toggles only apply to the map (scene 0)
  mapControls.property("hidden", state.scene !== 0);
  // waffle scenes use the flex container; map + line use the single svg.
  // Toggle the `hidden` attribute (not the property) so it works on the svg,
  // which does not reflect the HTML `hidden` IDL property.
  const usesWaffle = !!SCENES[state.scene].waffle;
  svg.attr("hidden", usesWaffle ? "" : null);
  wafflePair.attr("hidden", usesWaffle ? null : "");
  SCENES[state.scene].draw();
}

// Breadcrumbs (a trigger): jump directly to any scene, with a hover label
// naming it, the free-jump affordance a drill-down story is meant to offer.
function buildBreadcrumbs() {
  breadcrumbs
    .selectAll("button")
    .data(SCENES)
    .join("button")
    .attr("type", "button")
    .attr("class", (_, i) => `breadcrumb-dot${i === state.scene ? " breadcrumb-active" : ""}`)
    .attr("title", (d) => d.short)
    .attr("aria-label", (d) => `Jump to: ${d.short}`)
    .on("click", (event, d) => {
      state.scene = SCENES.indexOf(d);
      renderScene();
    });
}

// ===== Triggers (event listeners that mutate parameters) =====
btnPrev.on("click", () => {
  if (state.scene > 0) {
    state.scene -= 1;
    renderScene();
  }
});

btnNext.on("click", () => {
  state.scene = state.scene < SCENES.length - 1 ? state.scene + 1 : 0;
  renderScene();
});

// Keyboard affordance: arrow keys also navigate scenes
d3.select("body").on("keydown", (event) => {
  if (event.key === "ArrowRight") btnNext.node().click();
  if (event.key === "ArrowLeft") btnPrev.node().click();
});

// Metric selector (a trigger): switch which "day of concern" the whole story shows
function buildMetricBar() {
  metricBar
    .selectAll("button")
    .data(Object.keys(METRIC_META))
    .join("button")
    .attr("type", "button")
    .attr("class", (m) => `metric-btn${m === state.metric ? " metric-active" : ""}`)
    .style("border-top-color", (m) =>
      m === state.metric ? METRIC_META[m].accent : "#e0e0e0"
    )
    .text((m) => METRIC_META[m].label)
    .on("click", (event, m) => {
      state.metric = m;
      buildMetricBar();
      renderScene();
    });
}

// City dropdown (a trigger): pick a city directly on any non-map scene
const COUNTRY_ABBR = {
  Brazil: "BR", Canada: "CA", China: "CN", India: "IN", USA: "US",
  Singapore: "SG", "United Arab Emirates": "AE", "Saudi Arabia": "SA",
  Nigeria: "NG", Thailand: "TH", Sudan: "SD", Australia: "AU", Algeria: "DZ",
  Panama: "PA", "South Africa": "ZA", "New Zealand": "NZ", Iceland: "IS",
  Greenland: "GL", Chile: "CL", Switzerland: "CH", Peru: "PE", Russia: "RU",
  Finland: "FI", Sweden: "SE", France: "FR", Germany: "DE", Italy: "IT",
  Spain: "ES", "United Kingdom": "GB", Mexico: "MX", Cuba: "CU", Japan: "JP",
  "South Korea": "KR", Kazakhstan: "KZ", Mongolia: "MN",
  Azerbaijan: "AZ", "Sri Lanka": "LK", Philippines: "PH",
  "Papua New Guinea": "PG", Fiji: "FJ", Norway: "NO", Argentina: "AR",
  Angola: "AO", "DR Congo": "CD", Djibouti: "DJ", Greece: "GR",
  Ukraine: "UA", Madagascar: "MG", Venezuela: "VE", Ecuador: "EC",
  "Trinidad and Tobago": "TT", "Puerto Rico": "PR", "Ivory Coast": "CI",
  "Cabo Verde": "CV", Senegal: "SN", Egypt: "EG", Tunisia: "TN",
  Guam: "GU", "Falkland Islands": "FK", Taiwan: "TW", "Hong Kong": "HK",
  Tanzania: "TZ", Antarctica: "AQ", "South Georgia": "GS", Vietnam: "VN",
  Chad: "TD", "Central African Republic": "CF", Uganda: "UG", Cameroon: "CM",
  Zambia: "ZM", Namibia: "NA", "Republic of the Congo": "CG", Iran: "IR",
  Afghanistan: "AF", Israel: "IL", Nepal: "NP", Indonesia: "ID",
  Guatemala: "GT", "El Salvador": "SV", Honduras: "HN", Nicaragua: "NI",
  "Costa Rica": "CR", Scotland: "GB-SCT", Ireland: "IE", Morocco: "MA",
  Uzbekistan: "UZ", Kyrgyzstan: "KG", Tajikistan: "TJ", Turkmenistan: "TM",
  "Marshall Islands": "MH", Kiribati: "KI", Tuvalu: "TV", Bangladesh: "BD",
  Ethiopia: "ET", Kenya: "KE", Yemen: "YE",
};

function buildCityBar() {
  const byCountry = d3.groups(cityList(), (d) => d.country);
  byCountry.sort((a, b) => a[0].localeCompare(b[0]));
  byCountry.forEach(([, cities]) => cities.sort((a, b) => a.name.localeCompare(b.name)));

  citySelect
    .selectAll("optgroup")
    .data(byCountry, ([country]) => country)
    .join("optgroup")
    .attr("label", ([country]) => country)
    .selectAll("option")
    .data(([, cities]) => cities, (d) => d.key)
    .join("option")
    .attr("value", (d) => d.key)
    .text((d) => `${d.name}, ${COUNTRY_ABBR[d.country] ?? d.country}`);

  citySelect
    .property("value", state.city)
    .on("change", function () {
      state.city = this.value;
      renderScene();
    });
}

// ===== Init =====
Promise.all([
  d3.json("data/heat.json"),
  d3.json("js/lib/countries-110m.json"),
  d3.json("data/heat-grid.json"),
]).then(([data, world, grid]) => {
  DATA = data;
  WORLD = world;
  GRID = grid;
  buildMetricBar();
  buildCityBar();
  renderScene();
});
