/* ============================================================
   charts.js — Bloque de 3 gráficos navegable (conjuntos) por modo
   ============================================================ */
var CSC = (window.CSC = window.CSC || {});

(function () {
  "use strict";

  const PIE_COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];
  const instances = {};
  const CANVAS_IDS = ["chart-breakdown", "chart-region", "chart-contract"];
  const TITLE_IDS = ["chart1-title", "chart2-title", "chart3-title"];

  let currentMode = null;
  let currentSlide = 0;
  let currentSig = null;

  const hasChart = () => typeof Chart !== "undefined";

  function currencyTick(v) {
    const abs = Math.abs(v);
    return abs >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v);
  }

  function baseDefaults() {
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = "#475569";
  }

  function destroyAll() {
    Object.keys(instances).forEach((k) => {
      try { instances[k].destroy(); } catch (e) { /* noop */ }
      delete instances[k];
    });
  }

  function makeDoughnut(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return new Chart(canvas, {
      type: "doughnut",
      data: { labels: [], datasets: [{ data: [], backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: "#fff" }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "56%",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
          tooltip: { callbacks: { label: (c) => `${c.label}: $${Math.round(c.parsed).toLocaleString()}` } }
        }
      }
    });
  }

  function makeBar(canvasId, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return new Chart(canvas, {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: colors || "#2563eb", borderRadius: 6, maxBarThickness: 80 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => "$" + Math.round(c.parsed.y).toLocaleString() } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: currencyTick }, grid: { color: "#eef2f7" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function makeChart(canvasId, kind) {
    return kind === "bar" ? makeBar(canvasId) : makeDoughnut(canvasId);
  }

  /* ----------------------------------------------------------
     Conjuntos de gráficos. Cada conjunto tiene EXACTAMENTE 3.
     data(view) devuelve:
       - doughnut: [{ key, value }]
       - bar:      { labels:[], values:[], colors }
     Los rótulos ya vienen traducidos por data() usando view.t.
     ---------------------------------------------------------- */
  function tcoBars(v) {
    const tco = CSC.Model.computeTco(v.expected, v.state);
    return {
      labels: [v.t("tcoDevLabel"), v.t("tcoAnnualLabel"), v.t("tcoTotalLabel")],
      values: [tco.devCost, tco.annual, tco.total],
      colors: ["#2563eb", "#60a5fa", "#1e3a8a"]
    };
  }

  const SLIDES = {
    cost: [
      {
        name: "chartSetComposition",
        charts: [
          { kind: "doughnut", title: "chartCostComposition", data: (v) => [
            { key: "catPersonnel", value: v.costRes.personnel },
            { key: "catVarProject", value: v.costRes.variableProject },
            { key: "catFixed", value: v.costRes.fixedAllocated },
            { key: "catCostAdj", value: v.costRes.costAdjTotal }
          ] },
          { kind: "doughnut", title: "chartPriceComposition", data: (v) => [
            { key: "catCost", value: v.costRes.adjustedCost },
            { key: "catProfit", value: v.costRes.profit },
            { key: "catPriceAdj", value: v.costRes.priceAdjTotal }
          ] },
          { kind: "bar", title: "chartCostPrice", data: (v) => ({
            labels: [v.t("catCost"), v.t("catProfit"), v.t("catSalePrice")],
            values: [v.costRes.adjustedCost, v.costRes.profit, v.costRes.salePrice],
            colors: ["#2563eb", "#10b981", "#1e3a8a"]
          }) }
        ]
      },
      {
        name: "chartSetDetail",
        charts: [
          { kind: "doughnut", title: "chartVariableFixed", data: (v) => [
            { key: "catPersonnel", value: v.costRes.personnel },
            { key: "catVarProject", value: v.costRes.variableProject },
            { key: "catFixed", value: v.costRes.fixedAllocated }
          ] },
          { kind: "bar", title: "chartPersonnelByRole", data: (v) => ({
            labels: v.costRes.roles.map((r) => r.role || "—"),
            values: v.costRes.roles.map((r) => r.subtotal),
            colors: "#2563eb"
          }) },
          { kind: "bar", title: "chartFixedConcept", data: (v) => ({
            labels: (v.state.cost.fixedCosts || []).map((f) => f.concept || "—"),
            values: (v.state.cost.fixedCosts || []).map((f) => Number(f.monthly) || 0),
            colors: "#60a5fa"
          }) }
        ]
      },
      {
        name: "chartSetForecast",
        charts: [
          { kind: "doughnut", title: "chartProfitDoughnut", data: (v) => [
            { key: "catCost", value: v.costRes.adjustedCost },
            { key: "catProfit", value: v.costRes.profit }
          ] },
          { kind: "bar", title: "chartTco", data: tcoBars },
          { kind: "bar", title: "chartRange", data: (v) => ({
            labels: [v.t("tpOptimistic"), v.t("kpiExpected"), v.t("tpPessimistic")],
            values: [v.costRes.rangeMin, v.costRes.expected, v.costRes.rangeMax],
            colors: ["#60a5fa", "#2563eb", "#1e3a8a"]
          }) }
        ]
      }
    ],
    market: [
      {
        name: "chartSetComposition",
        charts: [
          { kind: "doughnut", title: "chartBreakdown", data: (v) => [
            { key: "catAnalysis", value: v.marketRes.phases.analysis },
            { key: "catDesign", value: v.marketRes.phases.design },
            { key: "catImplementation", value: v.marketRes.phases.implementation },
            { key: "catQA", value: v.marketRes.phases.testing },
            { key: "catExtras", value: v.marketRes.extras },
            { key: "catPost", value: v.marketRes.post },
            { key: "catMargin", value: v.marketRes.margin }
          ] },
          { kind: "bar", title: "chartRegion", data: (v) => {
            const keys = v.params.regions.map((r) => r.key);
            return {
              labels: keys.map((k) => v.t("region" + k.toUpperCase())),
              values: keys.map((k) => CSC.Model.computeForRegion(v.state, v.params, k).total),
              colors: keys.map((k) => (k === v.state.region ? "#2563eb" : "#bfdbfe"))
            };
          } },
          { kind: "bar", title: "chartContract", data: (v) => ({
            labels: [v.t("lblFixed"), v.t("lblHourly")],
            values: [v.marketRes.fixedTotal, v.marketRes.hourlyTotal],
            colors: ["#2563eb", "#94a3b8"]
          }) }
        ]
      },
      {
        name: "chartSetTeam",
        charts: [
          { kind: "bar", title: "chartHoursByPhase", data: (v) => {
            const total = M_sumPhase(v.state.phases) || 100;
            const hours = (p) => (v.marketRes.totalHours * (Number(p) || 0)) / total;
            return {
              labels: [v.t("catAnalysis"), v.t("catDesign"), v.t("catImplementation"), v.t("catQA")],
              values: [hours(v.state.phases.analysis), hours(v.state.phases.design), hours(v.state.phases.implementation), hours(v.state.phases.testing)],
              colors: ["#2563eb", "#60a5fa", "#93c5fd", "#1e3a8a"]
            };
          } },
          { kind: "doughnut", title: "chartTeamComposition", data: (v) => {
            if (v.state.teamMode === "role") {
              return (v.params.marketRoles || [])
                .map((mr) => ({ key: "role" + mr.key.charAt(0).toUpperCase() + mr.key.slice(1), value: (v.state.marketTeam && v.state.marketTeam[mr.key]) || 0 }))
                .filter((x) => x.value > 0);
            }
            return [
              { key: "colJunior", value: (v.state.devs && v.state.devs.junior) || 0 },
              { key: "colMid", value: (v.state.devs && v.state.devs.mid) || 0 },
              { key: "colSenior", value: (v.state.devs && v.state.devs.senior) || 0 }
            ];
          } },
          { kind: "bar", title: "chartRateByLevel", data: (v) => {
            const region = (v.params.regions || []).find((x) => x.key === v.state.region) || { rates: {} };
            return {
              labels: [v.t("colJunior"), v.t("colMid"), v.t("colSenior")],
              values: [(region.rates || {}).junior || 0, (region.rates || {}).mid || 0, (region.rates || {}).senior || 0],
              colors: ["#93c5fd", "#60a5fa", "#2563eb"]
            };
          } }
        ]
      },
      {
        name: "chartSetForecast",
        charts: [
          { kind: "bar", title: "chartTco", data: tcoBars },
          { kind: "bar", title: "chartRange", data: (v) => ({
            labels: [v.t("tpOptimistic"), v.t("kpiExpected"), v.t("tpPessimistic")],
            values: [v.marketRes.rangeMin, v.marketRes.expected, v.marketRes.rangeMax],
            colors: ["#60a5fa", "#2563eb", "#1e3a8a"]
          }) },
          { kind: "bar", title: "chartExtrasPost", data: (v) => ({
            labels: [v.t("catExtras"), v.t("catPost"), v.t("catMargin")],
            values: [v.marketRes.extras, v.marketRes.post, v.marketRes.margin],
            colors: ["#f59e0b", "#10b981", "#1e3a8a"]
          }) }
        ]
      }
    ]
  };

  function M_sumPhase(phases) {
    return Object.values(phases || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function slidesFor(mode) {
    return SLIDES[mode] || SLIDES.cost;
  }

  function ensureSlide() {
    const slides = slidesFor(currentMode || "cost");
    if (currentSlide >= slides.length) currentSlide = slides.length - 1;
    if (currentSlide < 0) currentSlide = 0;
    return slides[currentSlide];
  }

  function setTitles(t, mode) {
    const slide = ensureSlide();
    slide.charts.forEach((spec, i) => {
      const el = document.getElementById(TITLE_IDS[i]);
      if (el) el.textContent = t(spec.title);
    });
  }

  function ensureCharts(mode) {
    const sig = mode + ":" + currentSlide;
    if (sig === currentSig) return;
    destroyAll();
    const slide = ensureSlide();
    slide.charts.forEach((spec, i) => {
      instances[i] = makeChart(CANVAS_IDS[i], spec.kind);
    });
    currentSig = sig;
  }

  function update(view) {
    const { mode, t } = view;
    if (mode !== currentMode) {
      currentMode = mode;
      currentSlide = 0;
      currentSig = null;
    }
    setTitles(t, mode);
    if (!hasChart()) return;
    ensureCharts(mode);

    const slide = ensureSlide();
    slide.charts.forEach((spec, i) => {
      const chart = instances[i];
      if (!chart) return;
      if (spec.kind === "doughnut") {
        const items = spec.data(view).filter((x) => x.value > 0.5);
        chart.data.labels = items.map((x) => t(x.key));
        chart.data.datasets[0].data = items.map((x) => Math.round(x.value));
        chart.data.datasets[0].backgroundColor = items.map((_, j) => PIE_COLORS[j % PIE_COLORS.length]);
        chart.update();
      } else {
        const out = spec.data(view);
        chart.data.labels = out.labels;
        chart.data.datasets[0].data = out.values.map((x) => Math.round(x));
        chart.data.datasets[0].backgroundColor = out.colors || "#2563eb";
        chart.update();
      }
    });
  }

  function changeSlide(delta) {
    const slides = slidesFor(currentMode || "cost");
    currentSlide = (currentSlide + delta + slides.length) % slides.length;
    currentSig = null;
  }

  CSC.Charts = {
    init: function () { if (hasChart()) baseDefaults(); },
    update: update,
    next: function () { changeSlide(1); },
    prev: function () { changeSlide(-1); },
    goTo: function (i) { currentSlide = i; currentSig = null; },
    slide: function () { return currentSlide; },
    count: function () { return slidesFor(currentMode || "cost").length; },
    slideNames: function () { return slidesFor(currentMode || "cost").map((s) => s.name); }
  };
})();
