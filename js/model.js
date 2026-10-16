/* ============================================================
   model.js — parámetros, estado por defecto, cálculo y storage
   ============================================================ */
var CSC = (window.CSC = window.CSC || {});

(function () {
  "use strict";

  /* ---------------- Parámetros por defecto (editables) ---------------- */
  const DEFAULT_PARAMS = {
    regions: [
      { key: "na", rates: { junior: 84, mid: 140, senior: 210 }, min: 80, max: 200 },
      { key: "ee", rates: { junior: 36, mid: 60, senior: 90 }, min: 40, max: 80 },
      { key: "as", rates: { junior: 21, mid: 35, senior: 53 }, min: 20, max: 50 }
    ],
    complexityHours: { small: 300, medium: 900, large: 2000 },
    soStep: 10,          // % por plataforma adicional
    soCap: 30,           // % tope
    teamStep: 5,         // % por dev adicional
    teamCap: 30,         // % tope
    fixedMargin: 15,     // % margen precio fijo
    marginAppliesToAll: false,
    budgetRangePct: 20   // ± %
  };

  /* ---------------- Estado por defecto ---------------- */
  const DEFAULT_STATE = {
    region: "na",
    devs: { junior: 1, mid: 1, senior: 1 },
    complexity: "small",
    platforms: ["windows"],
    extrasMode: "usd", // "usd" | "pct"
    extras: {
      auth: { on: true, usd: 4000, pct: 8 },
      analytics: { on: true, usd: 6000, pct: 12 },
      security: { on: false, usd: 7000, pct: 15 },
      docs: { on: false, usd: 2500, pct: 5 }
    },
    post: {
      maintenance: { on: true, usd: 8000, pct: 15 },
      support: { on: false, usd: 5000, pct: 10 },
      training: { on: false, usd: 3000, pct: 6 }
    },
    phases: { analysis: 15, design: 20, implementation: 45, testing: 20 },
    contract: "fixed",

    /* ---- Modo costos (costo + margen) ---- */
    mode: "market", // "market" | "cost"
    cost: {
      months: 4,
      roles: [
        { role: "Desarrollador", qty: 2, monthly: 2500, months: 4, dedication: 100 },
        { role: "Analista funcional", qty: 1, monthly: 3000, months: 4, dedication: 100 },
        { role: "Tester", qty: 1, monthly: 1000, months: 4, dedication: 100 }
      ],
      variableCosts: [
        { concept: "Hosting y servicios en la nube", amount: 1000 },
        { concept: "Reuniones y viajes del equipo", amount: 500 }
      ],
      fixedCosts: [
        { concept: "Alquiler de oficina", monthly: 1200 },
        { concept: "Servicios (luz, internet, agua)", monthly: 300 },
        { concept: "Sueldo administrativo", monthly: 1500 },
        { concept: "Software y licencias", monthly: 500 },
        { concept: "Otros gastos fijos", monthly: 500 }
      ],
      allocationMethod: "months", // "months" | "dedication" | "prorate"
      allocationDedication: 100,
      allocationProjects: 1,
      profitMargin: 25,
      adjustments: []
    }
  };

  const STORAGE = {
    params: "csc.params.v2",
    state: "csc.state.v2",
    scenarios: "csc.scenarios.v2",
    lang: "csc.lang.v2"
  };

  /* ---------------- Utilidades ---------------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function deepMerge(base, override) {
    if (Array.isArray(base)) {
      return Array.isArray(override) ? override : clone(base);
    }
    if (base && typeof base === "object") {
      const out = {};
      const keys = new Set([...Object.keys(base), ...(override && typeof override === "object" ? Object.keys(override) : [])]);
      keys.forEach((k) => {
        out[k] = k in base ? deepMerge(base[k], override ? override[k] : undefined) : override[k];
      });
      return out;
    }
    return override === undefined ? base : override;
  }

  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage no disponible */ }
  }

  function setByPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
      cur = cur[p];
    }
    const last = parts[parts.length - 1];
    cur[/^\d+$/.test(last) ? Number(last) : last] = value;
  }

  /* ---------------- Lógica de cálculo ---------------- */
  const sumPhase = (phases) => Object.values(phases).reduce((a, b) => a + (Number(b) || 0), 0);

  function groupAmount(group, mode, base) {
    let total = 0;
    Object.values(group).forEach((it) => {
      if (!it.on) return;
      total += mode === "pct" ? (base * (Number(it.pct) || 0)) / 100 : Number(it.usd) || 0;
    });
    return total;
  }

  function computeForRegion(state, params, regionKey) {
    const region =
      params.regions.find((r) => r.key === regionKey) || params.regions[0];

    const d = state.devs;
    const totalDevs = (Number(d.junior) || 0) + (Number(d.mid) || 0) + (Number(d.senior) || 0);

    const teamFactor =
      totalDevs > 0
        ? Math.min(1 + (totalDevs - 1) * (params.teamStep / 100), 1 + params.teamCap / 100)
        : 1;

    const baseHours = Number(params.complexityHours[state.complexity]) || 0;
    const totalHours = baseHours * teamFactor;

    let blendedRate;
    if (totalDevs > 0) {
      blendedRate =
        (d.junior * region.rates.junior +
          d.mid * region.rates.mid +
          d.senior * region.rates.senior) /
        totalDevs;
    } else {
      blendedRate = region.rates.mid;
    }

    const soCount = state.platforms.length;
    const soMult = 1 + Math.min(Math.max(soCount - 1, 0) * (params.soStep / 100), params.soCap / 100);

    const devBaseCost = totalHours * blendedRate;
    const devWithSO = devBaseCost * soMult;

    // Reparto por fases (normalizado a 100%)
    const pSum = sumPhase(state.phases);
    const share = (k) => (pSum > 0 ? (Number(state.phases[k]) || 0) / pSum : 0);
    const phaseAmount = (k) => devWithSO * share(k);

    // Extras y post-venta según modo
    const extras = groupAmount(state.extras, state.extrasMode, devWithSO);
    const post = groupAmount(state.post, state.extrasMode, devWithSO);

    // Margen: se calcula siempre (para la comparativa), pero solo se aplica si el contrato es Precio Fijo
    const marginBase = params.marginAppliesToAll ? devWithSO + extras + post : devWithSO + extras;
    const marginAlways = marginBase * (params.fixedMargin / 100);
    const margin = state.contract === "fixed" ? marginAlways : 0;

    const hourlyTotal = devWithSO + extras + post;
    const fixedTotal = hourlyTotal + marginAlways;
    const total = state.contract === "fixed" ? fixedTotal : hourlyTotal;

    const budgetRangePct = Number(params.budgetRangePct) || 0;

    return {
      regionKey: regionKey,
      baseHours: baseHours,
      teamFactor: teamFactor,
      totalDevs: totalDevs,
      totalHours: totalHours,
      blendedRate: blendedRate,
      soCount: soCount,
      soMult: soMult,
      devBaseCost: devBaseCost,
      devWithSO: devWithSO,
      phases: {
        analysis: phaseAmount("analysis"),
        design: phaseAmount("design"),
        implementation: phaseAmount("implementation"),
        testing: phaseAmount("testing")
      },
      extras: extras,
      post: post,
      margin: margin,
      hourlyTotal: hourlyTotal,
      fixedTotal: fixedTotal,
      total: total,
      rangeMin: total * (1 - budgetRangePct / 100),
      rangeMax: total * (1 + budgetRangePct / 100)
    };
  }

  /* ---------------- Motor del modo costos (costo + margen) ---------------- */
  function computeCost(state) {
    const c = state.cost || {};

    const roles = (c.roles || []).map((r) => {
      const qty = Number(r.qty) || 0;
      const monthly = Number(r.monthly) || 0;
      const months = Number(r.months) || 0;
      const dedRaw = Number(r.dedication);
      const dedication = Number.isFinite(dedRaw) ? dedRaw : 100;
      return {
        role: r.role || "",
        qty: qty, monthly: monthly, months: months, dedication: dedication,
        subtotal: qty * monthly * months * (dedication / 100)
      };
    });
    const personnel = roles.reduce((a, r) => a + r.subtotal, 0);
    const variableProject = (c.variableCosts || []).reduce((a, v) => a + (Number(v.amount) || 0), 0);
    const variableTotal = personnel + variableProject;

    const fixedMonthly = (c.fixedCosts || []).reduce((a, f) => a + (Number(f.monthly) || 0), 0);
    const months = Number(c.months) || 0;
    let fixedAllocated;
    if (c.allocationMethod === "dedication") {
      fixedAllocated = fixedMonthly * months * ((Number(c.allocationDedication) || 0) / 100);
    } else if (c.allocationMethod === "prorate") {
      fixedAllocated = (fixedMonthly * months) / Math.max(1, Number(c.allocationProjects) || 1);
    } else {
      fixedAllocated = fixedMonthly * months;
    }

    const totalCost = variableTotal + fixedAllocated;
    const adjustments = c.adjustments || [];

    // Ajustes que aplican al costo
    const costAdjTotal = adjustments
      .filter((a) => a.appliesTo === "cost")
      .reduce((acc, a) => acc + (a.type === "amount" ? Number(a.value) || 0 : (totalCost * (Number(a.value) || 0)) / 100), 0);
    const adjustedCost = totalCost + costAdjTotal;

    const profitMargin = Number(c.profitMargin) || 0;
    const profit = (adjustedCost * profitMargin) / 100;
    const basePrice = adjustedCost + profit;

    // Ajustes que aplican al precio
    const priceAdjTotal = adjustments
      .filter((a) => a.appliesTo === "price")
      .reduce((acc, a) => acc + (a.type === "amount" ? Number(a.value) || 0 : (basePrice * (Number(a.value) || 0)) / 100), 0);
    const salePrice = basePrice + priceAdjTotal;

    return {
      roles: roles,
      personnel: personnel,
      variableProject: variableProject,
      variableTotal: variableTotal,
      fixedMonthly: fixedMonthly,
      months: months,
      fixedAllocated: fixedAllocated,
      totalCost: totalCost,
      costAdjTotal: costAdjTotal,
      adjustedCost: adjustedCost,
      profitMargin: profitMargin,
      profit: profit,
      basePrice: basePrice,
      priceAdjTotal: priceAdjTotal,
      salePrice: salePrice
    };
  }

  /* ---------------- API pública ---------------- */
  CSC.Model = {
    DEFAULT_PARAMS: DEFAULT_PARAMS,
    DEFAULT_STATE: DEFAULT_STATE,
    STORAGE: STORAGE,

    clone: clone,
    deepMerge: deepMerge,
    setByPath: setByPath,

    defaults() {
      return { params: clone(DEFAULT_PARAMS), state: clone(DEFAULT_STATE) };
    },

    loadParams() {
      return deepMerge(clone(DEFAULT_PARAMS), safeGet(STORAGE.params, {}));
    },
    loadState() {
      return deepMerge(clone(DEFAULT_STATE), safeGet(STORAGE.state, {}));
    },
    loadScenarios() {
      const list = safeGet(STORAGE.scenarios, []);
      return Array.isArray(list) ? list : [];
    },
    loadLang() {
      return safeGet(STORAGE.lang, "es");
    },

    saveParams(p) { safeSet(STORAGE.params, p); },
    saveState(s) { safeSet(STORAGE.state, s); },
    saveScenarios(list) { safeSet(STORAGE.scenarios, list); },
    saveLang(l) { safeSet(STORAGE.lang, l); },

    computeForRegion: computeForRegion,
    computeCost: computeCost,
    sumPhase: sumPhase
  };
})();
