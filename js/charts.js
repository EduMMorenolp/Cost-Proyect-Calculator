/* ============================================================
   charts.js — Chart.js para modo tarifas y modo costos
   ============================================================ */
var CSC = (window.CSC = window.CSC || {});

(function () {
  "use strict";

  const PIE_COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];
  const instances = {};
  let currentMode = null;

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

  function doughnut(canvasId) {
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

  function bars(canvasId, colors) {
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

  function build(mode) {
    if (mode === "cost") {
      instances.breakdown = doughnut("chart-breakdown");
      instances.region = doughnut("chart-region");
      instances.contract = bars("chart-contract", ["#2563eb", "#10b981", "#1e3a8a"]);
    } else {
      instances.breakdown = doughnut("chart-breakdown");
      instances.region = bars("chart-region", "#2563eb");
      instances.contract = bars("chart-contract", ["#2563eb", "#94a3b8"]);
    }
  }

  function setDoughnut(chart, cats, t) {
    if (!chart) return;
    const data = cats.filter((c) => c.value > 0.5);
    chart.data.labels = data.map((c) => t(c.key));
    chart.data.datasets[0].data = data.map((c) => Math.round(c.value));
    chart.data.datasets[0].backgroundColor = data.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);
    chart.update();
  }

  function update(view) {
    if (!hasChart()) return;
    const { mode, t, marketRes, costRes, state, params } = view;
    if (mode !== currentMode) {
      destroyAll();
      build(mode);
      currentMode = mode;
    }

    if (mode === "cost") {
      // 1) Composición del costo
      setDoughnut(instances.breakdown, [
        { key: "catPersonnel", value: costRes.personnel },
        { key: "catVarProject", value: costRes.variableProject },
        { key: "catFixed", value: costRes.fixedAllocated },
        { key: "catCostAdj", value: costRes.costAdjTotal }
      ], t);

      // 2) Composición del precio
      setDoughnut(instances.region, [
        { key: "catCost", value: costRes.adjustedCost },
        { key: "catProfit", value: costRes.profit },
        { key: "catPriceAdj", value: costRes.priceAdjTotal }
      ], t);

      // 3) Costo vs. Utilidad vs. Precio
      if (instances.contract) {
        instances.contract.data.labels = [t("catCost"), t("catProfit"), t("catSalePrice")];
        instances.contract.data.datasets[0].data = [Math.round(costRes.adjustedCost), Math.round(costRes.profit), Math.round(costRes.salePrice)];
        instances.contract.data.datasets[0].backgroundColor = ["#2563eb", "#10b981", "#1e3a8a"];
        instances.contract.update();
      }
    } else {
      // 1) Donut por categoría (fases + extras + post + margen)
      setDoughnut(instances.breakdown, [
        { key: "catAnalysis", value: marketRes.phases.analysis },
        { key: "catDesign", value: marketRes.phases.design },
        { key: "catImplementation", value: marketRes.phases.implementation },
        { key: "catQA", value: marketRes.phases.testing },
        { key: "catExtras", value: marketRes.extras },
        { key: "catPost", value: marketRes.post },
        { key: "catMargin", value: marketRes.margin }
      ], t);

      // 2) Regiones
      if (instances.region) {
        const keys = params.regions.map((r) => r.key);
        instances.region.data.labels = keys.map((k) => t("region" + k.toUpperCase()));
        instances.region.data.datasets[0].data = keys.map((k) => Math.round(CSC.Model.computeForRegion(state, params, k).total));
        instances.region.data.datasets[0].backgroundColor = keys.map((k) => (k === state.region ? "#2563eb" : "#bfdbfe"));
        instances.region.update();
      }

      // 3) Contrato
      if (instances.contract) {
        instances.contract.data.labels = [t("lblFixed"), t("lblHourly")];
        instances.contract.data.datasets[0].data = [Math.round(marketRes.fixedTotal), Math.round(marketRes.hourlyTotal)];
        instances.contract.data.datasets[0].backgroundColor = ["#2563eb", "#94a3b8"];
        instances.contract.update();
      }
    }
  }

  CSC.Charts = {
    init: function () { if (hasChart()) baseDefaults(); },
    update: update
  };
})();
