/* ============================================================
   model.js — parámetros, estado por defecto, cálculo y storage
   ============================================================ */
var CSC = (window.CSC = window.CSC || {});

(function () {
  "use strict";

  /* ---------------- Constantes de modelos paramétricos ---------------- */
  // COCOMO 81 básico: esfuerzo (persona-mes) = a · (KLOC)^b
  const COCOMO_MODES = {
    organic: { a: 2.4, b: 1.05 },
    semidetached: { a: 3.0, b: 1.12 },
    embedded: { a: 3.6, b: 1.2 }
  };
  // Multiplicadores de cost drivers (EAF). "nominal" = 1.
  const COCOMO_DRIVERS = {
    reliability: { veryLow: 0.75, low: 0.88, nominal: 1, high: 1.15, veryHigh: 1.4 },
    complexity: { veryLow: 0.7, low: 0.85, nominal: 1, high: 1.15, veryHigh: 1.3 },
    analyst: { veryLow: 1.46, low: 1.19, nominal: 1, high: 0.86, veryHigh: 0.71 },
    programmer: { veryLow: 1.42, low: 1.17, nominal: 1, high: 0.86, veryHigh: 0.7 },
    tools: { veryLow: 1.24, low: 1.1, nominal: 1, high: 0.91, veryHigh: 0.83 },
    schedule: { veryLow: 1.23, low: 1.08, nominal: 1, high: 1.04, veryHigh: 1.1 }
  };
  const COCOMO_DRIVER_KEYS = Object.keys(COCOMO_DRIVERS);

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
    budgetRangePct: 20,  // ± %
    riskBuffers: { none: 0, low: 10, medium: 20, high: 35 }, // % por nivel de riesgo [Fase B]

    // Catálogo de arquetipos (horas base) [Fase A]
    archetypes: [
      { key: "webSimple", hours: 195 },
      { key: "mvp", hours: 260 },
      { key: "businessApp", hours: 390 },
      { key: "saasRequired", hours: 520 },
      { key: "ecommerce", hours: 585 },
      { key: "portal", hours: 650 },
      { key: "saasFull", hours: 780 },
      { key: "erp", hours: 975 }
    ],
    // Catálogo de funcionalidades (esfuerzo por ítem) [Fase A]
    catalogFeatures: [
      { key: "auth", hours: 40 },
      { key: "payments", hours: 60 },
      { key: "realtime", hours: 80 },
      { key: "maps", hours: 45 },
      { key: "notifications", hours: 35 },
      { key: "adminPanel", hours: 70 },
      { key: "reporting", hours: 55 },
      { key: "multilang", hours: 50 },
      { key: "integrations", hours: 90 },
      { key: "ai", hours: 120 },
      { key: "dataMigration", hours: 65 }
    ],
    catalogExponent: 1.15, // factor no lineal por función acumulada

    // Equipo por rol en modo tarifas [Fase A]
    marketRoles: [
      { key: "backend", level: "mid" },
      { key: "frontend", level: "mid" },
      { key: "mobile", level: "mid" },
      { key: "qa", level: "junior" },
      { key: "pm", level: "senior" },
      { key: "devops", level: "senior" },
      { key: "uxui", level: "mid" },
      { key: "analyst", level: "mid" }
    ],

    // Conversión de esfuerzo a horas [Fase C]
    hoursPerPersonMonth: 160,
    hoursPerFP: 8,
    hoursPerSprint: 320,
    fpWeights: { ei: 4, eo: 5, eq: 4, ilf: 10, eif: 7 },

    // Cronograma y engagement [Fase D]
    hoursPerMonth: 160,
    engagementOverhead: { augmentation: 0, dedicated: 0, outsourcing: 0 }
  };

  /* ---------------- Estado por defecto ---------------- */
  const DEFAULT_STATE = {
    region: "na",
    devs: { junior: 1, mid: 1, senior: 1 },

    // Equipo del modo tarifas [Fase A]
    teamMode: "profile", // "profile" | "role"
    marketTeam: { backend: 1, frontend: 1, mobile: 0, qa: 0, pm: 0, devops: 0, uxui: 0, analyst: 0 },

    complexity: "small",

    // Método de estimación de esfuerzo [Fase A/C]
    effortMethod: "complexity", // complexity | catalog | cocomo | fp | sp | manual

    // Catálogo [Fase A]
    catalog: {
      archetypeKey: "webSimple",
      useCustom: false,
      customHours: 195,
      features: {
        auth: true, payments: false, realtime: false, maps: false, notifications: false,
        adminPanel: true, reporting: false, multilang: false, integrations: false, ai: false, dataMigration: false
      }
    },

    // COCOMO [Fase C]
    cocomo: {
      kloc: 10,
      mode: "organic",
      drivers: { reliability: "nominal", complexity: "nominal", analyst: "nominal", programmer: "nominal", tools: "nominal", schedule: "nominal" }
    },

    // Puntos de función [Fase C]
    fp: { ei: 0, eo: 0, eq: 0, ilf: 0, eif: 0, gsc: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },

    // Puntos de historia [Fase C]
    sp: { points: 100, velocity: 20, hoursPerSprint: 320 },

    // Horas manuales [Fase A]
    manual: { hours: 900 },

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

    // Incertidumbre [Fase B]
    threePoint: { enabled: false, optimistic: 10, pessimistic: 30 },
    risk: { level: "none" }, // none | low | medium | high

    // Cronograma, TCO y engagement [Fase D]
    engagement: "dedicated", // augmentation | dedicated | outsourcing
    timeline: { hoursPerMonth: 160 },
    tco: { maintenancePct: 18, years: 3, hostingMonthly: 0, apiMonthly: 0 },

    /* ---- Modo costos (costo + margen) ---- */
    mode: "cost", // "market" | "cost"  (default: costos)
    cost: {
      months: 4,
      rolesUnit: "months", // "months" | "hours"
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
    params: "csc.params.v3",
    state: "csc.state.v3",
    scenarios: "csc.scenarios.v3",
    lang: "csc.lang.v3"
  };

  /* ---------------- Utilidades ---------------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def || 0;
  };

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

  /* ---------------- Estimación de esfuerzo (horas) ---------------- */
  function computeEffort(state, params) {
    const method = state.effortMethod || "complexity";
    const notes = [];
    let hours = 0;
    let detail = {};

    if (method === "catalog") {
      const c = state.catalog || {};
      const arch = (params.archetypes || []).find((a) => a.key === c.archetypeKey);
      const base = c.useCustom ? num(c.customHours) : (arch ? num(arch.hours) : 0);
      const exp = num(params.catalogExponent, 1) || 1;
      const selected = (params.catalogFeatures || []).filter((f) => c.features && c.features[f.key]);
      const featHours = selected.reduce((acc, f, i) => acc + num(f.hours) * Math.pow(exp, i), 0);
      hours = base + featHours;
      detail = { base: base, featHours: featHours, featureCount: selected.length };
      if (selected.length > 1) notes.push("catalogExpNote");
    } else if (method === "cocomo") {
      const co = state.cocomo || {};
      const coef = COCOMO_MODES[co.mode] || COCOMO_MODES.organic;
      const drivers = co.drivers || {};
      const eaf = COCOMO_DRIVER_KEYS.reduce((acc, k) => {
        const table = COCOMO_DRIVERS[k];
        return acc * (table && table[drivers[k]] ? table[drivers[k]] : 1);
      }, 1);
      const pm = coef.a * Math.pow(num(co.kloc), coef.b) * eaf;
      hours = pm * num(params.hoursPerPersonMonth, 160);
      detail = { pm: pm, eaf: eaf, mode: co.mode };
    } else if (method === "fp") {
      const f = state.fp || {};
      const w = params.fpWeights || { ei: 4, eo: 5, eq: 4, ilf: 10, eif: 7 };
      const ufp = num(f.ei) * w.ei + num(f.eo) * w.eo + num(f.eq) * w.eq + num(f.ilf) * w.ilf + num(f.eif) * w.eif;
      const sumGsc = (f.gsc || []).reduce((a, b) => a + num(b), 0);
      const vaf = 0.65 + 0.01 * sumGsc;
      const afp = ufp * vaf;
      hours = afp * num(params.hoursPerFP, 8);
      detail = { ufp: ufp, vaf: vaf, afp: afp };
    } else if (method === "sp") {
      const s = state.sp || {};
      const velocity = Math.max(1, num(s.velocity, 1) || 1);
      const sprints = num(s.points) / velocity;
      hours = sprints * num(s.hoursPerSprint, 320);
      detail = { points: num(s.points), velocity: velocity, sprints: sprints };
    } else if (method === "manual") {
      hours = num((state.manual || {}).hours);
      detail = {};
    } else {
      hours = num(params.complexityHours[state.complexity]);
      detail = { complexity: state.complexity };
    }

    if (hours < 0) hours = 0;
    return { method: method, hours: hours, detail: detail, notes: notes };
  }

  /* ---------------- Lógica de cálculo (modo tarifas) ---------------- */
  const sumPhase = (phases) => Object.values(phases).reduce((a, b) => a + (Number(b) || 0), 0);

  function groupAmount(group, mode, base) {
    let total = 0;
    Object.values(group).forEach((it) => {
      if (!it.on) return;
      total += mode === "pct" ? (base * (Number(it.pct) || 0)) / 100 : Number(it.usd) || 0;
    });
    return total;
  }

  /* ---------------- Incertidumbre (3 puntos + riesgo) [Fase B] ---------------- */
  function riskPctFor(state, params) {
    const level = (state.risk && state.risk.level) || "none";
    const buffers = (params && params.riskBuffers) || {};
    return num(buffers[level], num(buffers.none, 0));
  }

  function overheadPct(state, params) {
    const eng = state.engagement || "dedicated";
    const map = (params && params.engagementOverhead) || {};
    return num(map[eng], 0);
  }

  function applyUncertainty(baseTotal, state, params) {
    const riskPct = riskPctFor(state, params);
    const oh = overheadPct(state, params);
    const withRisk = baseTotal * (1 + riskPct / 100) * (1 + oh / 100);
    const tp = state.threePoint || {};
    let expected = withRisk;
    let rangeMin = withRisk;
    let rangeMax = withRisk;
    if (tp.enabled) {
      const o = withRisk * (1 - num(tp.optimistic) / 100);
      const p = withRisk * (1 + num(tp.pessimistic) / 100);
      expected = (o + 4 * withRisk + p) / 6;
      rangeMin = o;
      rangeMax = p;
    } else {
      const bp = num(params.budgetRangePct);
      rangeMin = withRisk * (1 - bp / 100);
      rangeMax = withRisk * (1 + bp / 100);
    }
    return { riskPct: riskPct, overheadPct: oh, riskAmount: withRisk - baseTotal, withRisk: withRisk, expected: expected, rangeMin: rangeMin, rangeMax: rangeMax };
  }

  /* ---------------- Cronograma y TCO [Fase D] ---------------- */
  function computeTimeline(totalHours, teamSize, state, params) {
    const hpm = num((state.timeline && state.timeline.hoursPerMonth), num(params.hoursPerMonth, 160)) || 160;
    const size = Math.max(1, num(teamSize) || 1);
    const months = totalHours / (size * hpm);
    return { months: months, teamSize: size, hoursPerMonth: hpm };
  }

  function computeTco(devCost, state) {
    const t = state.tco || {};
    const maintenance = (devCost * num(t.maintenancePct)) / 100;
    const infra = (num(t.hostingMonthly) + num(t.apiMonthly)) * 12;
    const annual = maintenance + infra;
    const years = num(t.years);
    return { devCost: devCost, maintenance: maintenance, infra: infra, annual: annual, years: years, total: devCost + annual * years };
  }

  function blendedRateFor(state, params, region) {    if (state.teamMode === "role") {
      const team = state.marketTeam || {};
      let count = 0;
      let sum = 0;
      (params.marketRoles || []).forEach((r) => {
        const c = num(team[r.key]);
        count += c;
        sum += c * num(region.rates[r.level], region.rates.mid);
      });
      return { totalPeople: count, blendedRate: count > 0 ? sum / count : region.rates.mid };
    }
    const d = state.devs || {};
    const totalPeople = num(d.junior) + num(d.mid) + num(d.senior);
    let blended;
    if (totalPeople > 0) {
      blended = (num(d.junior) * region.rates.junior + num(d.mid) * region.rates.mid + num(d.senior) * region.rates.senior) / totalPeople;
    } else {
      blended = region.rates.mid;
    }
    return { totalPeople: totalPeople, blendedRate: blended };
  }

  function computeForRegion(state, params, regionKey) {
    const region = params.regions.find((r) => r.key === regionKey) || params.regions[0];

    const team = blendedRateFor(state, params, region);
    const totalDevs = team.totalPeople;
    const blendedRate = team.blendedRate;

    // Factor de carga del equipo: solo aplica al método "complejidad" (heurística clásica)
    const isClassic = (state.effortMethod || "complexity") === "complexity";
    const teamFactor = isClassic && totalDevs > 0
      ? Math.min(1 + (totalDevs - 1) * (params.teamStep / 100), 1 + params.teamCap / 100)
      : 1;

    const effort = computeEffort(state, params);
    const baseHours = effort.hours;
    const totalHours = baseHours * teamFactor;

    const soCount = state.platforms.length;
    const soMult = 1 + Math.min(Math.max(soCount - 1, 0) * (params.soStep / 100), params.soCap / 100);

    const devBaseCost = totalHours * blendedRate;
    const devWithSO = devBaseCost * soMult;

    const pSum = sumPhase(state.phases);
    const share = (k) => (pSum > 0 ? (Number(state.phases[k]) || 0) / pSum : 0);
    const phaseAmount = (k) => devWithSO * share(k);

    const extras = groupAmount(state.extras, state.extrasMode, devWithSO);
    const post = groupAmount(state.post, state.extrasMode, devWithSO);

    const marginBase = params.marginAppliesToAll ? devWithSO + extras + post : devWithSO + extras;
    const marginAlways = marginBase * (params.fixedMargin / 100);
    const margin = state.contract === "fixed" ? marginAlways : 0;

    const hourlyTotal = devWithSO + extras + post;
    const fixedTotal = hourlyTotal + marginAlways;
    const totalBefore = state.contract === "fixed" ? fixedTotal : hourlyTotal;

    const unc = applyUncertainty(totalBefore, state, params);

    return {
      regionKey: regionKey,
      effort: effort,
      effortMethod: effort.method,
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
      totalBefore: totalBefore,
      total: unc.withRisk,
      expected: unc.expected,
      riskPct: unc.riskPct,
      riskAmount: unc.riskAmount,
      rangeMin: unc.rangeMin,
      rangeMax: unc.rangeMax
    };
  }

  /* ---------------- Motor del modo costos (costo + margen) ---------------- */
  function computeCost(state, params) {
    params = params || {};
    const c = state.cost || {};
    const rolesUnit = c.rolesUnit === "hours" ? "hours" : "months";

    const roles = (c.roles || []).map((r) => {
      const qty = num(r.qty);
      const rate = num(r.monthly);           // costo mensual o costo por hora según rolesUnit
      const amount = num(r.months);          // meses u horas según rolesUnit
      const dedRaw = Number(r.dedication);
      const dedication = Number.isFinite(dedRaw) ? dedRaw : 100;
      return {
        role: r.role || "",
        qty: qty, monthly: rate, months: amount, dedication: dedication, unit: rolesUnit,
        subtotal: qty * rate * amount * (dedication / 100)
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

    const costAdjTotal = adjustments
      .filter((a) => a.appliesTo === "cost")
      .reduce((acc, a) => acc + (a.type === "amount" ? Number(a.value) || 0 : (totalCost * (Number(a.value) || 0)) / 100), 0);
    const oh = overheadPct(state, params);
    const costWithOverhead = totalCost * (1 + oh / 100);
    const riskPct = riskPctFor(state, params);
    const riskAmount = (costWithOverhead * riskPct) / 100;
    const adjustedCost = costWithOverhead + costAdjTotal + riskAmount;

    const profitMargin = Number(c.profitMargin) || 0;
    const profit = (adjustedCost * profitMargin) / 100;
    const basePrice = adjustedCost + profit;

    const priceAdjTotal = adjustments
      .filter((a) => a.appliesTo === "price")
      .reduce((acc, a) => acc + (a.type === "amount" ? Number(a.value) || 0 : (basePrice * (Number(a.value) || 0)) / 100), 0);
    const salePrice = basePrice + priceAdjTotal;

    const tp = state.threePoint || {};
    let expected = salePrice;
    let rangeMin = salePrice;
    let rangeMax = salePrice;
    if (tp.enabled) {
      const o = salePrice * (1 - num(tp.optimistic) / 100);
      const p = salePrice * (1 + num(tp.pessimistic) / 100);
      expected = (o + 4 * salePrice + p) / 6;
      rangeMin = o;
      rangeMax = p;
    }

    return {
      roles: roles,
      rolesUnit: rolesUnit,
      personnel: personnel,
      variableProject: variableProject,
      variableTotal: variableTotal,
      fixedMonthly: fixedMonthly,
      months: months,
      fixedAllocated: fixedAllocated,
      totalCost: totalCost,
      costAdjTotal: costAdjTotal,
      overheadPct: oh,
      riskPct: riskPct,
      riskAmount: riskAmount,
      adjustedCost: adjustedCost,
      profitMargin: profitMargin,
      profit: profit,
      basePrice: basePrice,
      priceAdjTotal: priceAdjTotal,
      salePrice: salePrice,
      expected: expected,
      rangeMin: rangeMin,
      rangeMax: rangeMax
    };
  }

  /* ---------------- API pública ---------------- */
  CSC.Model = {
    DEFAULT_PARAMS: DEFAULT_PARAMS,
    DEFAULT_STATE: DEFAULT_STATE,
    STORAGE: STORAGE,
    COCOMO_MODES: COCOMO_MODES,
    COCOMO_DRIVERS: COCOMO_DRIVERS,
    COCOMO_DRIVER_KEYS: COCOMO_DRIVER_KEYS,

    clone: clone,
    deepMerge: deepMerge,
    setByPath: setByPath,
    num: num,

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

    computeEffort: computeEffort,
    computeForRegion: computeForRegion,
    computeCost: computeCost,
    computeTimeline: computeTimeline,
    computeTco: computeTco,
    sumPhase: sumPhase
  };
})();
