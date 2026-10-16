/* ============================================================
   Calculadora de Costos de Software — lógica de la aplicación
   - Modelo combinado: complejidad fija horas base; el equipo
     pondera la tarifa promedio y un factor de carga.
   - Bilingüe ES/EN
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- Constantes del modelo ---------------- */
  const REGIONS = {
    na: { rate: 140, min: 80, max: 200, key: "regionNA" },
    ee: { rate: 60, min: 40, max: 80, key: "regionEE" },
    as: { rate: 35, min: 20, max: 50, key: "regionAS" }
  };

  const EXPERIENCE = { junior: 0.6, mid: 1.0, senior: 1.5 };

  const COMPLEXITY_HOURS = { small: 300, medium: 900, large: 2000 };

  const SO_STEP = 0.10;   // +10% por plataforma adicional
  const SO_CAP = 0.30;    // tope +30%
  const TEAM_STEP = 0.05; // +5% de carga por dev adicional
  const TEAM_CAP = 0.30;  // tope +30%
  const FIXED_MARGIN = 0.15; // contingencia precio fijo

  /* ---------------- Diccionario i18n ---------------- */
  const I18N = {
    es: {
      appTitle: "Calculadora de Costos de Software",
      appSubtitle: "Estima presupuesto, horas y visualiza el desglose de tu proyecto en tiempo real.",
      langLabel: "Idioma",
      secTeam: "Equipo y Experiencia",
      region: "Ubicación geográfica del equipo",
      regionNA: "Norteamérica / Europa Occidental",
      regionEE: "Europa del Este",
      regionAS: "Asia / Sudamérica",
      teamComposition: "Composición del equipo (n.º de desarrolladores)",
      devsJunior: "Junior (0–2 años)",
      devsMid: "Mid-level (2–5 años)",
      devsSenior: "Senior (>5 años)",
      secComplexity: "Complejidad del Proyecto",
      compSmall: "Pequeño / Básico ($5.000 – $50.000)",
      compMedium: "Mediano / Empresarial ($50.000 – $150.000)",
      compLarge: "Grande / ERP Complejo ($100.000+)",
      secPlatforms: "Cobertura de Sistemas Operativos",
      platformsHint: "Cada plataforma adicional suma +10% de complejidad (tope +30%).",
      secExtras: "Funciones Adicionales",
      extrasHint: "Marcá las funciones e ingresá su costo estimado en USD.",
      extraAuth: "Sistema de Autenticación",
      extraAnalytics: "Herramientas de Análisis de Datos",
      extraSecurity: "Seguridad Avanzada",
      extraDocs: "Documentación y Manuales",
      secPhases: "Distribución por Fases",
      phasesHint: "Ajustá el esfuerzo (%) entre fases. Debe sumar 100%.",
      phaseAnalysis: "Análisis",
      phaseDesign: "Diseño",
      phaseImplementation: "Implementación",
      phaseTesting: "Pruebas",
      phaseTotal: "Total",
      phaseWarning: "La suma no es 100%; se normaliza para el cálculo.",
      secPost: "Servicios Posteriores y Mantenimiento",
      postHint: "Servicios post-venta (costo estimado en USD).",
      postMaintenance: "Mantenimiento y Actualizaciones",
      postSupport: "Soporte Técnico",
      postTraining: "Capacitación de Usuarios",
      secContract: "Tipo de Contrato",
      contractFixed: "Precio Fijo (+15% de contingencia)",
      contractHourly: "Por Horas / Tiempo y Materiales",
      footnote: "Los valores de funciones extra y servicios post-venta son editables y no escalan automáticamente con el tamaño del proyecto.",
      dashTitle: "Dashboard de Resultados",
      liveBadge: "Cálculo en vivo",
      kpiTotal: "Costo Total Estimado",
      kpiHours: "Horas Totales",
      kpiHoursSub: "esfuerzo estimado",
      kpiRange: "Rango Presupuestario",
      kpiRangeSub: "±20%",
      kpiRate: "Tarifa Promedio",
      kpiRateSub: "ponderada por experiencia",
      chartBreakdown: "Desglose del Presupuesto por Categoría",
      chartRegion: "Costo Total según Región Geográfica",
      chartContract: "Precio Fijo vs. Por Horas",
      numericBreakdown: "Desglose numérico",
      catDevBase: "Desarrollo Base",
      catExtras: "Funciones Extra",
      catQA: "Pruebas / QA",
      catMaintenance: "Mantenimiento",
      catMargin: "Margen de Contingencia",
      lblFixed: "Precio Fijo",
      lblHourly: "Por Horas",
      totalLabel: "TOTAL",
      fixedContractSub: "+15% contingencia",
      hourlyContractSub: "sin margen fijo",
      disclaimer: "Estimación referencial. Ajustá los supuestos según tu proyecto."
    },
    en: {
      appTitle: "Software Cost Calculator",
      appSubtitle: "Estimate budget, hours and visualize your project breakdown in real time.",
      langLabel: "Language",
      secTeam: "Team & Experience",
      region: "Team geographic location",
      regionNA: "North America / Western Europe",
      regionEE: "Eastern Europe",
      regionAS: "Asia / South America",
      teamComposition: "Team composition (number of developers)",
      devsJunior: "Junior (0–2 yrs)",
      devsMid: "Mid-level (2–5 yrs)",
      devsSenior: "Senior (>5 yrs)",
      secComplexity: "Project Complexity",
      compSmall: "Small / Basic ($5,000 – $50,000)",
      compMedium: "Medium / Enterprise ($50,000 – $150,000)",
      compLarge: "Large / Complex ERP ($100,000+)",
      secPlatforms: "Operating System Coverage",
      platformsHint: "Each additional platform adds +10% complexity (capped at +30%).",
      secExtras: "Additional Features",
      extrasHint: "Check the features and enter their estimated cost in USD.",
      extraAuth: "Authentication System",
      extraAnalytics: "Data Analytics Tools",
      extraSecurity: "Advanced Security",
      extraDocs: "Documentation & Manuals",
      secPhases: "Phase Distribution",
      phasesHint: "Adjust effort (%) across phases. Must add up to 100%.",
      phaseAnalysis: "Analysis",
      phaseDesign: "Design",
      phaseImplementation: "Implementation",
      phaseTesting: "Testing",
      phaseTotal: "Total",
      phaseWarning: "Sum is not 100%; it is normalized for the calculation.",
      secPost: "Post-Delivery & Maintenance",
      postHint: "After-sales services (estimated cost in USD).",
      postMaintenance: "Maintenance & Updates",
      postSupport: "Technical Support",
      postTraining: "User Training",
      secContract: "Contract Type",
      contractFixed: "Fixed Price (+15% contingency)",
      contractHourly: "Hourly / Time & Materials",
      footnote: "Extra-feature and after-sales values are editable and do not scale automatically with project size.",
      dashTitle: "Results Dashboard",
      liveBadge: "Live calculation",
      kpiTotal: "Estimated Total Cost",
      kpiHours: "Total Hours",
      kpiHoursSub: "estimated effort",
      kpiRange: "Budget Range",
      kpiRangeSub: "±20%",
      kpiRate: "Average Rate",
      kpiRateSub: "weighted by experience",
      chartBreakdown: "Budget Breakdown by Category",
      chartRegion: "Total Cost by Geographic Region",
      chartContract: "Fixed Price vs. Hourly",
      numericBreakdown: "Numeric breakdown",
      catDevBase: "Base Development",
      catExtras: "Extra Features",
      catQA: "Testing / QA",
      catMaintenance: "Maintenance",
      catMargin: "Contingency Margin",
      lblFixed: "Fixed Price",
      lblHourly: "Hourly",
      totalLabel: "TOTAL",
      fixedContractSub: "+15% contingency",
      hourlyContractSub: "no fixed margin",
      disclaimer: "Referential estimate. Adjust assumptions to your project."
    }
  };

  let lang = "es";
  const t = (key) => (I18N[lang] && I18N[lang][key]) || key;

  /* ---------------- Referencias DOM ---------------- */
  const form = document.getElementById("calc-form");
  const el = {
    lang: document.getElementById("lang"),
    region: document.getElementById("region"),
    junior: document.getElementById("devs-junior"),
    mid: document.getElementById("devs-mid"),
    senior: document.getElementById("devs-senior"),
    contract: document.getElementById("contract"),
    phaseTotalValue: document.getElementById("phase-total-value"),
    phaseWarning: document.getElementById("phase-warning"),
    kpiTotal: document.getElementById("kpi-total"),
    kpiTotalSub: document.getElementById("kpi-total-sub"),
    kpiHours: document.getElementById("kpi-hours"),
    kpiRange: document.getElementById("kpi-range"),
    kpiRate: document.getElementById("kpi-rate"),
    kpiRateSub: document.getElementById("kpi-rate-sub"),
    breakdown: document.getElementById("numeric-breakdown")
  };

  const PIE_COLORS = ["#2563eb", "#60a5fa", "#f59e0b", "#10b981", "#ef4444"];
  const CATEGORY_KEYS = ["catDevBase", "catExtras", "catQA", "catMaintenance", "catMargin"];

  /* ---------------- Formateadores ---------------- */
  const locale = () => (lang === "es" ? "es-ES" : "en-US");
  const fmtNum = (v) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Math.round(v || 0));
  const fmtUSD = (v) => "$" + fmtNum(v);

  /* ---------------- Lectura del estado del formulario ---------------- */
  function readState() {
    const complexity = (form.querySelector('input[name="complexity"]:checked') || {}).value || "small";
    return {
      region: el.region.value,
      devs: {
        junior: Math.max(0, Number(el.junior.value) || 0),
        mid: Math.max(0, Number(el.mid.value) || 0),
        senior: Math.max(0, Number(el.senior.value) || 0)
      },
      complexity: complexity,
      platforms: Array.from(form.querySelectorAll(".platform:checked")).map((c) => c.value),
      extras: readCostGroup(".extra", ".extra-cost"),
      post: readCostGroup(".post", ".post-cost"),
      contract: el.contract.value,
      phases: readPhases()
    };
  }

  function readCostGroup(checkSel, costSel) {
    const out = [];
    form.querySelectorAll(checkSel).forEach((chk) => {
      if (!chk.checked) return;
      const costEl = form.querySelector(`${costSel}[data-key="${chk.dataset.key}"]`);
      const value = Math.max(0, Number(costEl && costEl.value) || 0);
      out.push({ key: chk.dataset.key, value: value });
    });
    return out;
  }

  function readPhases() {
    const phases = {};
    let sum = 0;
    form.querySelectorAll(".phase").forEach((r) => {
      const v = Math.max(0, Number(r.value) || 0);
      phases[r.dataset.key] = v;
      sum += v;
    });
    return { values: phases, sum: sum };
  }

  const sumValues = (arr) => arr.reduce((acc, x) => acc + x.value, 0);

  /* ---------------- Núcleo de cálculo ---------------- */
  /**
   * Calcula las métricas para una región dada (permite comparar regiones).
   */
  function computeForRegion(state, regionKey) {
    const region = REGIONS[regionKey] || REGIONS.na;
    const totalDevs = state.devs.junior + state.devs.mid + state.devs.senior;

    // Factor de carga del equipo (1 dev = 1.0)
    const teamFactor = totalDevs > 0 ? Math.min(1 + (totalDevs - 1) * TEAM_STEP, 1 + TEAM_CAP) : 1;

    // Horas totales = horas base (complejidad) × factor de equipo
    const baseHours = COMPLEXITY_HOURS[state.complexity] || COMPLEXITY_HOURS.small;
    const totalHours = baseHours * teamFactor;

    // Tarifa promedio ponderada por perfil y experiencia
    let blendedRate;
    if (totalDevs > 0) {
      const weighted =
        state.devs.junior * EXPERIENCE.junior * region.rate +
        state.devs.mid * EXPERIENCE.mid * region.rate +
        state.devs.senior * EXPERIENCE.senior * region.rate;
      blendedRate = weighted / totalDevs;
    } else {
      blendedRate = region.rate * EXPERIENCE.mid;
    }

    // Costo de desarrollo base con recargo por SO
    const soCount = state.platforms.length;
    const soMult = 1 + Math.min(Math.max(soCount - 1, 0) * SO_STEP, SO_CAP);
    const devBaseCost = totalHours * blendedRate;
    const devWithSO = devBaseCost * soMult;

    // Extras y post-venta
    const extras = sumValues(state.extras);
    const post = sumValues(state.post);

    // Reparto por fases (normalizado a 100%)
    const testingShare = state.phases.sum > 0 ? state.phases.values.testing / state.phases.sum : 0;
    const qa = devWithSO * testingShare;
    const devBase = devWithSO - qa;

    // Contrato
    const margin = state.contract === "fixed" ? (devWithSO + extras) * FIXED_MARGIN : 0;
    const total = devBase + qa + extras + post + margin;

    return {
      regionKey: regionKey,
      totalHours: totalHours,
      blendedRate: blendedRate,
      soMult: soMult,
      devWithSO: devWithSO,
      devBase: devBase,
      qa: qa,
      extras: extras,
      post: post,
      margin: margin,
      total: total,
      fixedTotal: (devWithSO + extras) * (1 + FIXED_MARGIN) + post,
      hourlyTotal: devWithSO + extras + post
    };
  }

  /* ---------------- Render de KPIs y desglose ---------------- */
  function renderNumericBreakdown(res) {
    const cats = [
      { label: t("catDevBase"), value: res.devBase, color: PIE_COLORS[0] },
      { label: t("catExtras"), value: res.extras, color: PIE_COLORS[1] },
      { label: t("catQA"), value: res.qa, color: PIE_COLORS[2] },
      { label: t("catMaintenance"), value: res.post, color: PIE_COLORS[3] }
    ];
    if (res.margin > 0) cats.push({ label: t("catMargin"), value: res.margin, color: PIE_COLORS[4] });

    const rows = cats
      .map(
        (c) => `
      <div class="breakdown-item">
        <span class="breakdown-label"><span class="breakdown-dot" style="background:${c.color}"></span>${c.label}</span>
        <span class="breakdown-value">${fmtUSD(c.value)}</span>
      </div>`
      )
      .join("");

    el.breakdown.innerHTML =
      rows +
      `<div class="breakdown-item breakdown-item--total">
        <span class="breakdown-label">${t("totalLabel")}</span>
        <span class="breakdown-value">${fmtUSD(res.total)}</span>
      </div>`;
  }

  function renderKPIs(res) {
    const min = res.total * 0.8;
    const max = res.total * 1.2;

    el.kpiTotal.textContent = fmtUSD(res.total);
    el.kpiTotalSub.textContent =
      res.margin > 0 ? t("fixedContractSub") : t("hourlyContractSub");
    el.kpiHours.textContent = `${fmtNum(res.totalHours)} h`;
    el.kpiRange.textContent = `${fmtUSD(min)} – ${fmtUSD(max)}`;
    el.kpiRate.textContent = `${fmtUSD(res.blendedRate)}/h`;
    el.kpiRateSub.textContent = t("kpiRateSub");
  }

  /* ---------------- Gráficos (Chart.js) ---------------- */
  let charts = {};

  function initCharts() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = "#475569";

    charts.breakdown = new Chart(document.getElementById("chart-breakdown"), {
      type: "doughnut",
      data: { labels: [], datasets: [{ data: [], backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: "#fff" }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14 } } }
      }
    });

    charts.region = new Chart(document.getElementById("chart-region"), {
      type: "bar",
      data: { labels: [], datasets: [{ label: "", data: [], backgroundColor: "#2563eb", borderRadius: 6, maxBarThickness: 64 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => "$" + Math.round(v / 1000) + "k" }, grid: { color: "#eef2f7" } },
          x: { grid: { display: false } }
        }
      }
    });

    charts.contract = new Chart(document.getElementById("chart-contract"), {
      type: "bar",
      data: { labels: [], datasets: [{ label: "", data: [], backgroundColor: ["#2563eb", "#94a3b8"], borderRadius: 6, maxBarThickness: 80 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => "$" + Math.round(v / 1000) + "k" }, grid: { color: "#eef2f7" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function updateCharts(state, res) {
    if (!charts.breakdown) return;

    // Gráfico 1: donut
    const cats = [
      { label: t("catDevBase"), value: res.devBase },
      { label: t("catExtras"), value: res.extras },
      { label: t("catQA"), value: res.qa },
      { label: t("catMaintenance"), value: res.post }
    ];
    if (res.margin > 0) cats.push({ label: t("catMargin"), value: res.margin });
    charts.breakdown.data.labels = cats.map((c) => c.label);
    charts.breakdown.data.datasets[0].data = cats.map((c) => Math.round(c.value));
    charts.breakdown.data.datasets[0].backgroundColor = PIE_COLORS.slice(0, cats.length);
    charts.breakdown.update();

    // Gráfico 2: regiones
    const regionKeys = ["na", "ee", "as"];
    const regionTotals = regionKeys.map((k) => computeForRegion(state, k).total);
    charts.region.data.labels = regionKeys.map((k) => t(REGIONS[k].key));
    charts.region.data.datasets[0].data = regionTotals.map((v) => Math.round(v));
    // Resalta la región seleccionada
    charts.region.data.datasets[0].backgroundColor = regionKeys.map((k) =>
      k === state.region ? "#2563eb" : "#bfdbfe"
    );
    charts.region.update();

    // Gráfico 3: contrato
    const comp = computeForRegion(state, state.region);
    charts.contract.data.labels = [t("lblFixed"), t("lblHourly")];
    charts.contract.data.datasets[0].data = [Math.round(comp.fixedTotal), Math.round(comp.hourlyTotal)];
    charts.contract.data.datasets[0].backgroundColor = ["#2563eb", "#94a3b8"];
    charts.contract.update();
  }

  /* ---------------- Ciclo principal ---------------- */
  function updatePhaseUI(state) {
    form.querySelectorAll(".phase").forEach((r) => {
      const out = form.querySelector(`[data-phase-value="${r.dataset.key}"]`);
      if (out) out.textContent = Math.max(0, Number(r.value) || 0) + "%";
    });
    el.phaseTotalValue.textContent = state.phases.sum + "%";
    const off = state.phases.sum !== 100;
    el.phaseWarning.classList.toggle("is-visible", off);
    el.phaseTotalValue.style.color = off ? "#b45309" : "";
  }

  function recalculate() {
    const state = readState();
    updatePhaseUI(state);
    const res = computeForRegion(state, state.region);
    renderKPIs(res);
    renderNumericBreakdown(res);
    updateCharts(state, res);
  }

  /* ---------------- i18n: aplicar idioma ---------------- */
  function applyStaticI18n() {
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;
      node.textContent = t(key);
    });
    document.documentElement.lang = lang;
    document.title = t("appTitle");
  }

  function renderRegionOptions(keepValue) {
    const current = keepValue || el.region.value || "na";
    el.region.innerHTML = Object.keys(REGIONS)
      .map((k) => {
        const r = REGIONS[k];
        return `<option value="${k}">${t(r.key)} — ${fmtUSD(r.rate)}/h (${fmtUSD(r.min)}–${fmtUSD(r.max)})</option>`;
      })
      .join("");
    el.region.value = REGIONS[current] ? current : "na";
  }

  function setLanguage(next) {
    lang = next === "en" ? "en" : "es";
    el.lang.value = lang;
    applyStaticI18n();
    renderRegionOptions(el.region.value);
    recalculate();
  }

  /* ---------------- Init ---------------- */
  function init() {
    initCharts();
    // Opciones de región y textos iniciales
    renderRegionOptions("na");
    applyStaticI18n();
    setLanguage(el.lang.value || "es");

    // Listeners: cualquier cambio recalcula en vivo
    form.addEventListener("input", recalculate);
    form.addEventListener("change", recalculate);
    el.lang.addEventListener("change", () => setLanguage(el.lang.value));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
