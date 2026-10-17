var CSC = (window.CSC = window.CSC || {});

/* ============================================================
   app.js — UI, binding de eventos y render (modos tarifas/costos)
   ============================================================ */
(function () {
  "use strict";

  const M = CSC.Model;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def || 0;
  };
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- Estado global ---------------- */
  let lang = "es";
  let t = (k) => k;
  let params = M.loadParams();
  let state = M.loadState();
  let scenarios = M.loadScenarios();
  let lastFocus = null;

  const PIE_COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];
  const EXTRA_KEYS = ["auth", "analytics", "security", "docs"];
  const POST_KEYS = ["maintenance", "support", "training"];
  const PHASE_KEYS = ["analysis", "design", "implementation", "testing"];
  const EFFORT_METHODS = ["complexity", "catalog", "cocomo", "fp", "sp", "manual"];
  const GSC_KEYS = [
    "gscDataComms", "gscDistributed", "gscPerformance", "gscHeavyConfig", "gscTransactionRate",
    "gscOnlineData", "gscEfficiency", "gscOnlineUpdate", "gscComplex", "gscReusability",
    "gscInstallEase", "gscOperational", "gscMultipleSites", "gscFacilitateChange"
  ];
  const MARKET_ROLE_LEVELS = ["junior", "mid", "senior"];

  const mode = () => (state.mode === "cost" ? "cost" : "market");

  /* ---------------- DOM refs ---------------- */
  const dom = {};
  function cacheDom() {
    [
      "lang", "calc-form", "region", "devs-junior", "devs-mid", "devs-senior",
      "contract", "phase-total-value", "phase-warning", "warnings",
      "kpi-grid", "numeric-breakdown", "trace-body",
      "market-panel", "cost-panel", "cost-body",
      "effort-method", "effort-body", "team-profile", "team-role", "market-team-body",
      "tp-enabled", "tp-opt", "tp-pess", "risk-level",
      "engagement", "hours-per-month", "tco-maint", "tco-years", "tco-hosting", "tco-api",
      "timeline-body", "tco-body",
      "chart1-title", "chart2-title", "chart3-title", "chart-prev", "chart-next", "chart-dots",
      "params-modal", "params-body", "params-reset", "params-export", "params-import", "params-close",
      "scenarios-modal", "scenarios-body", "scenarios-close", "scenarios-print",
      "btn-params", "btn-scenarios", "btn-print", "btn-csv", "btn-excel", "btn-report", "btn-share"
    ].forEach((id) => { dom[id] = document.getElementById(id); });
  }

  /* ---------------- Formateadores ---------------- */
  const locale = () => (lang === "es" ? "es-ES" : "en-US");
  const fmtNum = (v) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Math.round(v || 0));
  const fmtUSD = (v) => "$" + fmtNum(v);

  /* ---------------- Modo ---------------- */
  function renderModeUI() {
    const isCost = mode() === "cost";
    if (dom["market-panel"]) dom["market-panel"].hidden = isCost;
    if (dom["cost-panel"]) dom["cost-panel"].hidden = !isCost;
    $$(".mode-opt").forEach((b) => {
      const active = b.dataset.mode === mode();
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  function setMode(next) {
    state.mode = next === "cost" ? "cost" : "market";
    persist();
    renderModeUI();
    renderForm();
    recompute();
  }

  /* ---------------- Estimación de esfuerzo [Fase A/C] ---------------- */
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function renderEffortOptions() {
    if (!dom["effort-method"]) return;
    dom["effort-method"].innerHTML = EFFORT_METHODS
      .map((m) => `<option value="${m}">${t("effort" + cap(m))}</option>`)
      .join("");
    dom["effort-method"].value = state.effortMethod || "complexity";
  }

  function effortPreviewHtml() {
    const eff = M.computeEffort(state, params);
    const d = eff.detail || {};
    const extra = [];
    if (eff.method === "catalog") extra.push(`${t("catalogBase")}: ${fmtNum(d.base)} ${t("unitHours")}`);
    if (eff.method === "cocomo") extra.push(`${t("cocomoEffort")}: ${(d.pm || 0).toFixed(1)} PM · ${t("cocomoEaf")}: ${(d.eaf || 1).toFixed(2)}`);
    if (eff.method === "fp") extra.push(`${t("fpUfp")}: ${fmtNum(d.ufp)} · ${t("fpVaf")}: ${(d.vaf || 0).toFixed(2)} · ${t("fpAfp")}: ${fmtNum(d.afp)}`);
    if (eff.method === "sp") extra.push(`${t("spSprints")}: ${(d.sprints || 0).toFixed(1)}`);
    return `<div id="effort-preview" class="effort-preview"><strong>${fmtNum(eff.hours)} ${t("unitHours")}</strong>${extra.length ? " · " + extra.join(" · ") : ""}</div>`;
  }

  function updateEffortPreview() {
    const el = document.getElementById("effort-preview");
    if (!el) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = effortPreviewHtml();
    el.replaceWith(wrap.firstElementChild);
  }

  function renderEffortPanel() {
    const body = dom["effort-body"];
    if (!body) return;
    const m = state.effortMethod || "complexity";
    let html = "";

    if (m === "complexity") {
      html = `<div class="space-y-2" role="radiogroup" aria-label="${t("secComplexity")}">
        ${["small", "medium", "large"].map((k) => `<label class="option-row"><input type="radio" name="complexity" value="${k}" class="radio" data-effort="complexity" ${state.complexity === k ? "checked" : ""} /><span class="option-text">${t("comp" + cap(k))}</span></label>`).join("")}
      </div>${effortPreviewHtml()}`;
    } else if (m === "catalog") {
      const c = state.catalog;
      const archOpts = (params.archetypes || [])
        .map((a) => `<option value="${a.key}" ${!c.useCustom && c.archetypeKey === a.key ? "selected" : ""}>${t("arch" + cap(a.key))}</option>`)
        .join("");
      const feats = (params.catalogFeatures || [])
        .map((f) => `<label class="option-row option-row--compact feature-item"><input type="checkbox" class="checkbox" data-effort="catalog.features.${f.key}" ${c.features[f.key] ? "checked" : ""} /><span class="option-text">${t("feat" + cap(f.key))}</span><span class="feat-hours">+${f.hours} ${t("unitHours")}</span></label>`)
        .join("");
      html = `
        <div class="field">
          <label class="field-label">${t("archetypeLabel")}</label>
          <select class="input" data-effort="archetype">
            ${archOpts}
            <option value="custom" ${c.useCustom ? "selected" : ""}>${t("archCustom")}</option>
          </select>
        </div>
        ${c.useCustom ? `<div class="param-field" style="max-width:220px"><label>${t("customHoursLabel")}</label><input class="input" type="number" min="0" data-effort="catalog.customHours" value="${c.customHours}"></div>` : ""}
        <span class="field-label">${t("catalogFeaturesLabel")}</span>
        <div class="feature-grid">${feats}</div>
        ${effortPreviewHtml()}`;
    } else if (m === "cocomo") {
      const co = state.cocomo;
      const driverRows = M.COCOMO_DRIVER_KEYS.map((k) => {
        const opts = ["veryLow", "low", "nominal", "high", "veryHigh"]
          .map((lv) => `<option value="${lv}" ${co.drivers[k] === lv ? "selected" : ""}>${t("lvl" + cap(lv))}</option>`)
          .join("");
        return `<div class="param-field"><label>${t("driver" + cap(k))}</label><select class="input input--sm" data-effort="cocomo.drivers.${k}">${opts}</select></div>`;
      }).join("");
      html = `
        <div class="param-grid">
          <div class="param-field"><label>${t("cocomoKloc")}</label><input class="input input--sm" type="number" min="0" step="0.5" data-effort="cocomo.kloc" value="${co.kloc}"></div>
          <div class="param-field"><label>${t("cocomoModeLabel")}</label><select class="input input--sm" data-effort="cocomo.mode">
            <option value="organic" ${co.mode === "organic" ? "selected" : ""}>${t("cocomoOrganic")}</option>
            <option value="semidetached" ${co.mode === "semidetached" ? "selected" : ""}>${t("cocomoSemi")}</option>
            <option value="embedded" ${co.mode === "embedded" ? "selected" : ""}>${t("cocomoEmbedded")}</option>
          </select></div>
        </div>
        <h3 class="param-section">${t("cocomoDrivers")}</h3>
        <div class="param-grid">${driverRows}</div>
        ${effortPreviewHtml()}`;
    } else if (m === "fp") {
      const f = state.fp;
      const counts = [["ei", "fpEi"], ["eo", "fpEo"], ["eq", "fpEq"], ["ilf", "fpIlf"], ["eif", "fpEif"]]
        .map(([k, label]) => `<div class="param-field"><label>${t(label)}</label><input class="input input--sm" type="number" min="0" data-effort="fp.${k}" value="${f[k]}"></div>`)
        .join("");
      const gsc = GSC_KEYS.map((label, i) => `<div class="phase-row"><span class="phase-name">${t(label)}</span><input type="range" min="0" max="5" step="1" class="range" data-effort="fp.gsc.${i}" value="${f.gsc[i]}" aria-label="${t(label)}" /><span class="phase-value" data-gsc-value="${i}">${f.gsc[i]}</span></div>`).join("");
      html = `<h3 class="param-section">${t("fpCounts")}</h3>
        <div class="param-grid">${counts}</div>
        <h3 class="param-section">${t("fpGsc")}</h3>
        <div class="space-y-2">${gsc}</div>
        ${effortPreviewHtml()}`;
    } else if (m === "sp") {
      const s = state.sp;
      html = `<div class="param-grid">
        <div class="param-field"><label>${t("spPoints")}</label><input class="input input--sm" type="number" min="0" data-effort="sp.points" value="${s.points}"></div>
        <div class="param-field"><label>${t("spVelocity")}</label><input class="input input--sm" type="number" min="1" data-effort="sp.velocity" value="${s.velocity}"></div>
        <div class="param-field"><label>${t("spHoursPerSprint")}</label><input class="input input--sm" type="number" min="0" data-effort="sp.hoursPerSprint" value="${s.hoursPerSprint}"></div>
      </div>${effortPreviewHtml()}`;
    } else {
      html = `<div class="param-field" style="max-width:220px"><label>${t("manualHoursLabel")}</label><input class="input" type="number" min="0" data-effort="manual.hours" value="${state.manual.hours}"></div>${effortPreviewHtml()}`;
    }
    body.innerHTML = html;
  }

  function handleEffortInput(target) {
    const path = target.dataset.effort;
    if (!path) return;
    if (path === "archetype") {
      if (target.value === "custom") {
        state.catalog.useCustom = true;
      } else {
        state.catalog.useCustom = false;
        state.catalog.archetypeKey = target.value;
      }
      renderEffortPanel();
      return;
    }
    let value;
    if (target.type === "number" || target.type === "range") value = Math.max(0, num(target.value));
    else if (target.type === "checkbox") value = target.checked;
    else value = target.value;
    M.setByPath(state, path, value);
    if (/^fp\.gsc\./.test(path)) {
      const out = $(`[data-gsc-value="${path.split(".").pop()}"]`);
      if (out) out.textContent = value;
    }
    updateEffortPreview();
  }

  /* ---------------- Equipo [Fase A] ---------------- */
  function renderTeamMode() {
    const isRole = state.teamMode === "role";
    if (dom["team-profile"]) dom["team-profile"].hidden = isRole;
    if (dom["team-role"]) dom["team-role"].hidden = !isRole;
    $$(".team-opt").forEach((b) => {
      const active = b.dataset.team === (isRole ? "role" : "profile");
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  function renderMarketTeam() {
    if (!dom["market-team-body"]) return;
    const region = params.regions.find((r) => r.key === state.region) || params.regions[0];
    dom["market-team-body"].innerHTML = (params.marketRoles || [])
      .map((r) => {
        const rate = num(region.rates[r.level], region.rates.mid);
        return `<tr>
          <td class="param-region">${t("role" + cap(r.key))}</td>
          <td><input class="input input--sm" type="number" min="0" data-team-role="${r.key}" value="${state.marketTeam[r.key] || 0}" aria-label="${t("colCount")}"></td>
          <td>${t("col" + cap(r.level))}</td>
          <td class="cost-subtotal">${fmtUSD(rate)}${t("unitPerHour")}</td>
        </tr>`;
      })
      .join("");
  }

  function handleMarketTeamInput(target) {
    const key = target.dataset.teamRole;
    if (!key) return;
    state.marketTeam[key] = Math.max(0, num(target.value));
  }

  function renderDynamics() {
    renderModeUI();
    renderEffortOptions();
    renderEffortPanel();
    renderTeamMode();
    renderMarketTeam();
    renderCostPanel();
  }

  /* ---------------- Bindings: modo tarifas ---------------- */
  const extraChk = (k) => $(`.extra[data-key="${k}"]`);
  const extraCost = (k) => $(`.extra-cost[data-key="${k}"]`);
  const postChk = (k) => $(`.post[data-key="${k}"]`);
  const postCost = (k) => $(`.post-cost[data-key="${k}"]`);
  const extraSign = (k) => $(`.extra-sign[data-key="${k}"]`);
  const postSign = (k) => $(`.post-sign[data-key="${k}"]`);

  function renderRegionOptions() {
    const current = state.region;
    dom.region.innerHTML = params.regions
      .map((r) => `<option value="${r.key}">${t("region" + r.key.toUpperCase())} — ${fmtUSD(r.rates.mid)}/h (${fmtUSD(r.min)}–${fmtUSD(r.max)})</option>`)
      .join("");
    dom.region.value = params.regions.some((r) => r.key === current) ? current : params.regions[0].key;
    state.region = dom.region.value;
  }

  function renderForm() {
    dom.region.value = state.region;
    dom["devs-junior"].value = state.devs.junior;
    dom["devs-mid"].value = state.devs.mid;
    dom["devs-senior"].value = state.devs.senior;
    const radio = $(`input[name="complexity"][value="${state.complexity}"]`);
    if (radio) radio.checked = true;
    $$(".platform").forEach((c) => { c.checked = state.platforms.includes(c.value); });

    EXTRA_KEYS.forEach((k) => {
      extraChk(k).checked = state.extras[k].on;
      setCostInput(extraCost(k), state.extras[k]);
      if (extraSign(k)) extraSign(k).textContent = state.extrasMode === "pct" ? "%" : "$";
    });
    POST_KEYS.forEach((k) => {
      postChk(k).checked = state.post[k].on;
      setCostInput(postCost(k), state.post[k]);
      if (postSign(k)) postSign(k).textContent = state.extrasMode === "pct" ? "%" : "$";
    });
    PHASE_KEYS.forEach((k) => {
      const slider = $(`.phase[data-key="${k}"]`);
      if (slider) slider.value = state.phases[k];
      const out = $(`[data-phase-value="${k}"]`);
      if (out) out.textContent = state.phases[k] + "%";
    });
    dom.contract.value = state.contract;
    if (dom["tp-enabled"]) {
      dom["tp-enabled"].checked = !!state.threePoint.enabled;
      dom["tp-opt"].value = state.threePoint.optimistic;
      dom["tp-pess"].value = state.threePoint.pessimistic;
      dom["tp-opt"].disabled = !state.threePoint.enabled;
      dom["tp-pess"].disabled = !state.threePoint.enabled;
    }
    if (dom["risk-level"]) dom["risk-level"].value = state.risk.level || "none";
    if (dom["engagement"]) dom["engagement"].value = state.engagement || "dedicated";
    if (dom["hours-per-month"]) dom["hours-per-month"].value = state.timeline.hoursPerMonth;
    if (dom["tco-maint"]) dom["tco-maint"].value = state.tco.maintenancePct;
    if (dom["tco-years"]) dom["tco-years"].value = state.tco.years;
    if (dom["tco-hosting"]) dom["tco-hosting"].value = state.tco.hostingMonthly;
    if (dom["tco-api"]) dom["tco-api"].value = state.tco.apiMonthly;
    $$(".mode-btn").forEach((b) => {
      const active = b.dataset.mode === state.extrasMode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  function setCostInput(input, item) {
    if (input) input.value = state.extrasMode === "pct" ? item.pct : item.usd;
  }

  function syncStateFromDom() {
    state.region = dom.region.value;
    state.devs = {
      junior: Math.max(0, num(dom["devs-junior"].value)),
      mid: Math.max(0, num(dom["devs-mid"].value)),
      senior: Math.max(0, num(dom["devs-senior"].value))
    };
    const radio = $('input[name="complexity"]:checked');
    if (radio) state.complexity = radio.value;
    state.platforms = $$(".platform:checked").map((c) => c.value);
    state.contract = dom.contract.value;
    EXTRA_KEYS.forEach((k) => {
      const it = state.extras[k];
      it.on = extraChk(k).checked;
      const v = Math.max(0, num(extraCost(k).value));
      if (state.extrasMode === "pct") it.pct = v; else it.usd = v;
    });
    POST_KEYS.forEach((k) => {
      const it = state.post[k];
      it.on = postChk(k).checked;
      const v = Math.max(0, num(postCost(k).value));
      if (state.extrasMode === "pct") it.pct = v; else it.usd = v;
    });
    PHASE_KEYS.forEach((k) => {
      const slider = $(`.phase[data-key="${k}"]`);
      if (slider) state.phases[k] = Math.max(0, num(slider.value));
    });
    if (dom["tp-enabled"]) {
      state.threePoint.enabled = dom["tp-enabled"].checked;
      state.threePoint.optimistic = Math.max(0, num(dom["tp-opt"].value));
      state.threePoint.pessimistic = Math.max(0, num(dom["tp-pess"].value));
    }
    if (dom["risk-level"]) state.risk.level = dom["risk-level"].value;
    if (dom["engagement"]) state.engagement = dom["engagement"].value;
    if (dom["hours-per-month"]) state.timeline.hoursPerMonth = Math.max(1, num(dom["hours-per-month"].value));
    if (dom["tco-maint"]) state.tco.maintenancePct = Math.max(0, num(dom["tco-maint"].value));
    if (dom["tco-years"]) state.tco.years = Math.max(1, num(dom["tco-years"].value));
    if (dom["tco-hosting"]) state.tco.hostingMonthly = Math.max(0, num(dom["tco-hosting"].value));
    if (dom["tco-api"]) state.tco.apiMonthly = Math.max(0, num(dom["tco-api"].value));
  }

  /* ---------------- Panel de costos ---------------- */
  function roleSubtotal(r) {
    return (num(r.qty) * num(r.monthly) * num(r.months) * (Number.isFinite(Number(r.dedication)) ? Number(r.dedication) : 100)) / 100;
  }

  function addButtonsRow(kind) {
    return `<button class="btn btn--ghost btn--sm" type="button" data-add="${kind}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>${t(kind === "roles" ? "addRole" : kind === "adjust" ? "addAdj" : "addRow")}</span></button>`;
  }

  function renderCostPanel() {
    const c = state.cost;
    const cr = M.computeCost(state, params);

    const rolesRows = c.roles
      .map((r, i) => `<tr>
        <td><input class="input input--sm input--text" type="text" data-cost="roles.${i}.role" value="${esc(r.role)}" aria-label="${t("colRole")}"></td>
        <td><input class="input input--sm" type="number" min="0" data-cost="roles.${i}.qty" value="${r.qty}" aria-label="${t("colQty")}"></td>
        <td><input class="input input--sm" type="number" min="0" data-cost="roles.${i}.monthly" value="${r.monthly}" aria-label="${t("colMonthly")}"></td>
        <td><input class="input input--sm" type="number" min="0" data-cost="roles.${i}.months" value="${r.months}" aria-label="${t("colMonths")}"></td>
        <td><input class="input input--sm" type="number" min="0" max="100" data-cost="roles.${i}.dedication" value="${r.dedication}" aria-label="${t("colDedication")}"></td>
        <td class="cost-subtotal" data-subtotal="roles.${i}">${fmtUSD(cr.roles[i] ? cr.roles[i].subtotal : 0)}</td>
        <td><button class="icon-btn" type="button" data-del="roles.${i}" aria-label="${t("removeLabel")}">×</button></td>
      </tr>`)
      .join("");

    const varRows = c.variableCosts
      .map((v, i) => `<tr>
        <td><input class="input input--sm input--text" type="text" data-cost="variableCosts.${i}.concept" value="${esc(v.concept)}" aria-label="${t("colConcept")}"></td>
        <td><input class="input input--sm" type="number" min="0" data-cost="variableCosts.${i}.amount" value="${v.amount}" aria-label="${t("colAmount")}"></td>
        <td><button class="icon-btn" type="button" data-del="variableCosts.${i}" aria-label="${t("removeLabel")}">×</button></td>
      </tr>`)
      .join("");

    const fixedRows = c.fixedCosts
      .map((f, i) => `<tr>
        <td><input class="input input--sm input--text" type="text" data-cost="fixedCosts.${i}.concept" value="${esc(f.concept)}" aria-label="${t("colConcept")}"></td>
        <td><input class="input input--sm" type="number" min="0" data-cost="fixedCosts.${i}.monthly" value="${f.monthly}" aria-label="${t("colMonthlyFixed")}"></td>
        <td><button class="icon-btn" type="button" data-del="fixedCosts.${i}" aria-label="${t("removeLabel")}">×</button></td>
      </tr>`)
      .join("");

    const adjRows = c.adjustments
      .map((a, i) => `<tr>
        <td><input class="input input--sm input--text" type="text" data-cost="adjustments.${i}.concept" value="${esc(a.concept)}" aria-label="${t("colAdjConcept")}"></td>
        <td><select class="input input--sm" data-cost="adjustments.${i}.type" aria-label="${t("colAdjType")}">
          <option value="pct" ${a.type === "pct" ? "selected" : ""}>${t("adjTypePct")}</option>
          <option value="amount" ${a.type === "amount" ? "selected" : ""}>${t("adjTypeAmount")}</option>
        </select></td>
        <td><input class="input input--sm" type="number" min="0" data-cost="adjustments.${i}.value" value="${a.value}" aria-label="${t("colAdjValue")}"></td>
        <td><select class="input input--sm" data-cost="adjustments.${i}.appliesTo" aria-label="${t("colAdjApply")}">
          <option value="cost" ${a.appliesTo === "cost" ? "selected" : ""}>${t("applyCost")}</option>
          <option value="price" ${a.appliesTo === "price" ? "selected" : ""}>${t("applyPrice")}</option>
        </select></td>
        <td><button class="icon-btn" type="button" data-del="adjustments.${i}" aria-label="${t("removeLabel")}">×</button></td>
      </tr>`)
      .join("");

    const allocMethod = c.allocationMethod;
    const allocExtra = allocMethod === "dedication"
      ? `<div class="param-field"><label>${t("allocDedicationLabel")}</label>
          <div class="param-input"><input class="input input--sm" type="number" min="0" max="100" data-cost="allocationDedication" value="${c.allocationDedication}"><span class="param-unit">%</span></div></div>`
      : allocMethod === "prorate"
      ? `<div class="param-field"><label>${t("allocProjectsLabel")}</label>
          <div class="param-input"><input class="input input--sm" type="number" min="1" data-cost="allocationProjects" value="${c.allocationProjects}"></div></div>`
      : "";

    dom["cost-body"].innerHTML = `
      <section class="card">
        <h2 class="card-title" data-i18n="secCostDuration">${t("secCostDuration")}</h2>
        <div class="param-field" style="max-width:220px">
          <label>${t("monthsLabel")}</label>
          <input class="input" type="number" min="0" data-cost="months" value="${c.months}">
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title card-title--flush" data-i18n="secRoles">${t("secRoles")}</h2>
          <select class="input input--sm" data-cost="rolesUnit" aria-label="${t("rolesUnitLabel")}" style="width:auto">
            <option value="months" ${c.rolesUnit !== "hours" ? "selected" : ""}>${t("rolesUnitMonths")}</option>
            <option value="hours" ${c.rolesUnit === "hours" ? "selected" : ""}>${t("rolesUnitHours")}</option>
          </select>
        </div>
        <div class="table-scroll" style="margin-top:0.6rem">
          <table class="param-table cost-table">
            <thead><tr>
              <th>${t("colRole")}</th><th>${t("colQty")}</th><th>${c.rolesUnit === "hours" ? t("colHourly") : t("colMonthly")}</th>
              <th>${c.rolesUnit === "hours" ? t("colHours") : t("colMonths")}</th><th>${t("colDedication")}</th><th>${t("colSubtotal")}</th><th></th>
            </tr></thead>
            <tbody>${rolesRows}</tbody>
          </table>
        </div>
        ${addButtonsRow("roles")}
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="secVariableProject">${t("secVariableProject")}</h2>
        <div class="table-scroll">
          <table class="param-table cost-table">
            <thead><tr><th>${t("colConcept")}</th><th>${t("colAmount")}</th><th></th></tr></thead>
            <tbody>${varRows}</tbody>
          </table>
        </div>
        ${addButtonsRow("variable")}
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="secFixed">${t("secFixed")}</h2>
        <div class="table-scroll">
          <table class="param-table cost-table">
            <thead><tr><th>${t("colConcept")}</th><th>${t("colMonthlyFixed")}</th><th></th></tr></thead>
            <tbody>${fixedRows}</tbody>
          </table>
        </div>
        ${addButtonsRow("fixed")}
        <p class="cost-total-line">${t("fixedMonthlyTotal")}: <strong id="fixed-monthly-total">${fmtUSD(cr.fixedMonthly)}</strong></p>
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="allocationTitle">${t("allocationTitle")}</h2>
        <div class="field" style="max-width:340px">
          <select class="input" data-cost="allocationMethod">
            <option value="months" ${allocMethod === "months" ? "selected" : ""}>${t("allocMonths")}</option>
            <option value="dedication" ${allocMethod === "dedication" ? "selected" : ""}>${t("allocDedication")}</option>
            <option value="prorate" ${allocMethod === "prorate" ? "selected" : ""}>${t("allocProrate")}</option>
          </select>
        </div>
        ${allocExtra}
        <div class="param-field" style="max-width:220px;margin-top:0.75rem">
          <label>${t("profitMargin")}</label>
          <div class="param-input"><input class="input input--sm" type="number" min="0" data-cost="profitMargin" value="${c.profitMargin}"><span class="param-unit">%</span></div>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="secAdjust">${t("secAdjust")}</h2>
        <p class="card-hint" data-i18n="adjHint">${t("adjHint")}</p>
        <div class="table-scroll">
          <table class="param-table cost-table">
            <thead><tr><th>${t("colAdjConcept")}</th><th>${t("colAdjType")}</th><th>${t("colAdjValue")}</th><th>${t("colAdjApply")}</th><th></th></tr></thead>
            <tbody>${adjRows}</tbody>
          </table>
        </div>
        ${addButtonsRow("adjust")}
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="secUncertainty">${t("secUncertainty")}</h2>
        <label class="option-row option-row--plain">
          <input type="checkbox" class="checkbox" data-cost="threePoint.enabled" ${state.threePoint.enabled ? "checked" : ""} />
          <span class="option-text">${t("tpEnable")}</span>
        </label>
        <div class="grid grid-cols-2 gap-3" style="margin-top:0.6rem">
          <div class="mini-field"><label>${t("tpOptimistic")}</label><input class="input" type="number" min="0" max="90" data-cost="threePoint.optimistic" value="${state.threePoint.optimistic}" ${state.threePoint.enabled ? "" : "disabled"}></div>
          <div class="mini-field"><label>${t("tpPessimistic")}</label><input class="input" type="number" min="0" data-cost="threePoint.pessimistic" value="${state.threePoint.pessimistic}" ${state.threePoint.enabled ? "" : "disabled"}></div>
        </div>
        <div class="field" style="margin-top:0.85rem;margin-bottom:0">
          <label class="field-label">${t("riskLabel")}</label>
          <select class="input" data-cost="risk.level">
            <option value="none" ${state.risk.level === "none" ? "selected" : ""}>${t("riskNone")}</option>
            <option value="low" ${state.risk.level === "low" ? "selected" : ""}>${t("riskLow")}</option>
            <option value="medium" ${state.risk.level === "medium" ? "selected" : ""}>${t("riskMedium")}</option>
            <option value="high" ${state.risk.level === "high" ? "selected" : ""}>${t("riskHigh")}</option>
          </select>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="secTimeline">${t("secTimeline")}</h2>
        <div class="field">
          <label class="field-label">${t("engagementLabel")}</label>
          <select class="input" data-cost="engagement">
            <option value="augmentation" ${state.engagement === "augmentation" ? "selected" : ""}>${t("engagementAugmentation")}</option>
            <option value="dedicated" ${state.engagement === "dedicated" ? "selected" : ""}>${t("engagementDedicated")}</option>
            <option value="outsourcing" ${state.engagement === "outsourcing" ? "selected" : ""}>${t("engagementOutsourcing")}</option>
          </select>
        </div>
        <div class="mini-field" style="max-width:220px">
          <label>${t("hoursPerMonthLabel")}</label>
          <input class="input" type="number" min="1" data-cost="timeline.hoursPerMonth" value="${state.timeline.hoursPerMonth}">
        </div>
      </section>

      <section class="card">
        <h2 class="card-title" data-i18n="secTco">${t("secTco")}</h2>
        <div class="grid grid-cols-2 gap-3">
          <div class="mini-field"><label>${t("tcoMaintenance")}</label><input class="input" type="number" min="0" data-cost="tco.maintenancePct" value="${state.tco.maintenancePct}"></div>
          <div class="mini-field"><label>${t("tcoYears")}</label><input class="input" type="number" min="1" data-cost="tco.years" value="${state.tco.years}"></div>
          <div class="mini-field"><label>${t("tcoHosting")}</label><input class="input" type="number" min="0" data-cost="tco.hostingMonthly" value="${state.tco.hostingMonthly}"></div>
          <div class="mini-field"><label>${t("tcoApi")}</label><input class="input" type="number" min="0" data-cost="tco.apiMonthly" value="${state.tco.apiMonthly}"></div>
        </div>
      </section>`;
  }

  function updateCostSubtotals() {
    const cr = M.computeCost(state, params);
    state.cost.roles.forEach((_, i) => {
      const cell = $(`#cost-body [data-subtotal="roles.${i}"]`);
      if (cell && cr.roles[i]) cell.textContent = fmtUSD(cr.roles[i].subtotal);
    });
    const ft = $("#fixed-monthly-total");
    if (ft) ft.textContent = fmtUSD(cr.fixedMonthly);
  }

  function handleCostInput(target) {
    const path = target.dataset.cost;
    if (!path) return;
    let value;
    if (target.type === "number") value = Math.max(0, num(target.value));
    else if (target.type === "checkbox") value = target.checked;
    else value = target.value;
    const root = /^(threePoint|risk|engagement|timeline|tco)\b/.test(path) ? state : state.cost;
    M.setByPath(root, path, value);
    if (path === "allocationMethod" || path === "rolesUnit" || path === "threePoint.enabled") {
      renderCostPanel();
    } else {
      updateCostSubtotals();
    }
  }

  function handleCostClick(target) {
    const add = target.closest("[data-add]");
    if (add) {
      const kind = add.dataset.add;
      if (kind === "roles") state.cost.roles.push({ role: t("defaultRole"), qty: 1, monthly: 1000, months: state.cost.months, dedication: 100 });
      else if (kind === "variable") state.cost.variableCosts.push({ concept: t("defaultConcept"), amount: 0 });
      else if (kind === "fixed") state.cost.fixedCosts.push({ concept: t("defaultConcept"), monthly: 0 });
      else if (kind === "adjust") state.cost.adjustments.push({ concept: t("defaultAdj"), type: "pct", value: 0, appliesTo: "cost" });
      persist();
      renderCostPanel();
      updateCostSubtotals();
      recompute();
      return true;
    }
    const del = target.closest("[data-del]");
    if (del) {
      const parts = del.dataset.del.split(".");
      const idx = Number(parts.pop());
      const arr = parts.reduce((o, p) => o[p], state.cost);
      if (Array.isArray(arr)) arr.splice(idx, 1);
      persist();
      renderCostPanel();
      recompute();
      return true;
    }
    return false;
  }

  /* ---------------- Render de salidas ---------------- */
  function kpiCard(o) {
    return `<div class="kpi${o.primary ? " kpi--primary" : ""}">
      <span class="kpi-label">${o.label}</span>
      <span class="kpi-value${o.small ? " kpi-value--sm" : ""}"${o.primary ? ' aria-live="polite"' : ""}>${o.value}</span>
      <span class="kpi-sub">${o.sub || ""}</span>
    </div>`;
  }

  function renderKPIs(marketRes, costRes) {
    if (mode() === "cost") {
      dom["kpi-grid"].innerHTML = [
        kpiCard({ label: t("kpiSalePrice"), value: fmtUSD(costRes.expected), sub: t("kpiSaleSub"), primary: true }),
        kpiCard({ label: t("kpiCostTotal"), value: fmtUSD(costRes.adjustedCost), sub: t("kpiCostSub") }),
        kpiCard({ label: t("kpiProfit"), value: fmtUSD(costRes.profit), sub: costRes.profitMargin + "%" }),
        kpiCard({ label: t("kpiVarFixed"), value: `${fmtUSD(costRes.variableTotal)} / ${fmtUSD(costRes.fixedAllocated)}`, small: true })
      ].join("");
    } else {
      dom["kpi-grid"].innerHTML = [
        kpiCard({ label: t("kpiTotal"), value: fmtUSD(marketRes.expected), sub: state.contract === "fixed" ? t("fixedContractSub") : t("hourlyContractSub"), primary: true }),
        kpiCard({ label: t("kpiHours"), value: `${fmtNum(marketRes.totalHours)} ${t("unitHours")}`, sub: t("kpiHoursSub") }),
        kpiCard({ label: t("kpiRange"), value: `${fmtUSD(marketRes.rangeMin)} – ${fmtUSD(marketRes.rangeMax)}`, sub: t("kpiRangeSub"), small: true }),
        kpiCard({ label: t("kpiRate"), value: `${fmtUSD(marketRes.blendedRate)}${t("unitPerHour")}`, sub: t("kpiRateSub") })
      ].join("");
    }
  }

  function marketCategories(res) {
    return [
      { key: "catAnalysis", value: res.phases.analysis, color: PIE_COLORS[0] },
      { key: "catDesign", value: res.phases.design, color: PIE_COLORS[1] },
      { key: "catImplementation", value: res.phases.implementation, color: PIE_COLORS[2] },
      { key: "catQA", value: res.phases.testing, color: PIE_COLORS[3] },
      { key: "catExtras", value: res.extras, color: PIE_COLORS[4] },
      { key: "catPost", value: res.post, color: PIE_COLORS[5] },
      { key: "catMargin", value: res.margin, color: PIE_COLORS[6] }
    ].filter((c) => c.value > 0.5);
  }

  function renderBreakdown(marketRes, costRes) {
    const item = (c) => `<div class="breakdown-item">
      <span class="breakdown-label"><span class="breakdown-dot" style="background:${c.color}"></span>${t(c.key)}</span>
      <span class="breakdown-value">${fmtUSD(c.value)}</span>
    </div>`;
    const total = (label, value) => `<div class="breakdown-item breakdown-item--total">
      <span class="breakdown-label">${label}</span><span class="breakdown-value">${fmtUSD(value)}</span></div>`;

    if (mode() === "cost") {
      const cats = [
        { key: "catPersonnel", value: costRes.personnel, color: PIE_COLORS[0] },
        { key: "catVarProject", value: costRes.variableProject, color: PIE_COLORS[1] },
        { key: "catFixed", value: costRes.fixedAllocated, color: PIE_COLORS[2] },
        { key: "catCostAdj", value: costRes.costAdjTotal, color: PIE_COLORS[3] }
      ].filter((c) => c.value > 0.5);
      let html = cats.map(item).join("");
      html += total(t("catCost"), costRes.adjustedCost);
      html += item({ key: "catProfit", value: costRes.profit, color: PIE_COLORS[4] });
      if (costRes.priceAdjTotal > 0.5) html += item({ key: "catPriceAdj", value: costRes.priceAdjTotal, color: PIE_COLORS[5] });
      html += total(t("catSalePrice"), costRes.salePrice);
      dom["numeric-breakdown"].innerHTML = html;
    } else {
      dom["numeric-breakdown"].innerHTML =
        marketCategories(marketRes).map(item).join("") + total(t("totalLabel"), marketRes.total);
    }
  }

  function traceSteps(steps) {
    return steps
      .map((s, i) => `<div class="trace-step">
        <span class="trace-idx">${i + 1}</span>
        <span class="trace-label">${s[0]}</span>
        <span class="trace-value">${s[1]}</span>
      </div>`)
      .join("");
  }

  function renderTrace(marketRes, costRes) {
    if (mode() === "cost") {
      const steps = [
        [t("stepPersonnel"), fmtUSD(costRes.personnel)],
        [t("stepVarProject"), fmtUSD(costRes.variableProject)],
        [t("stepVarTotal"), fmtUSD(costRes.variableTotal)],
        [t("stepFixedMonthly"), fmtUSD(costRes.fixedMonthly) + " × " + costRes.months + " " + t("colMonths").toLowerCase()],
        [t("stepFixedAllocated"), fmtUSD(costRes.fixedAllocated)]
      ];
      if (costRes.costAdjTotal > 0.5) steps.push([t("stepCostAdj"), fmtUSD(costRes.costAdjTotal)]);
      if (costRes.riskAmount > 0.5) steps.push([t("stepRisk"), fmtUSD(costRes.riskAmount) + " (" + costRes.riskPct + "%)"]);
      steps.push([t("stepCostTotal"), fmtUSD(costRes.adjustedCost)]);
      steps.push([t("stepProfit"), fmtUSD(costRes.profit) + " (" + costRes.profitMargin + "%)"]);
      if (costRes.priceAdjTotal > 0.5) steps.push([t("stepPriceAdj"), fmtUSD(costRes.priceAdjTotal)]);
      const cTotalLabel = state.threePoint.enabled ? t("stepExpected") : t("stepSalePrice");
      dom["trace-body"].innerHTML =
        traceSteps(steps) +
        `<div class="trace-step trace-step--total"><span class="trace-idx">Σ</span><span class="trace-label">${cTotalLabel}</span><span class="trace-value">${fmtUSD(costRes.expected)}</span></div>`;
    } else {
      const steps = [
        [t("effortLabel"), t("effort" + cap(marketRes.effortMethod))],
        [t("stepBaseHours"), fmtNum(marketRes.baseHours) + " " + t("unitHours")],
        [t("stepTeamFactor"), "×" + marketRes.teamFactor.toFixed(2) + " (" + marketRes.totalDevs + " dev)"],
        [t("stepTotalHours"), fmtNum(marketRes.totalHours) + " " + t("unitHours")],
        [t("stepRate"), fmtUSD(marketRes.blendedRate) + t("unitPerHour")],
        [t("stepDevBase"), fmtUSD(marketRes.devBaseCost)],
        [t("stepSO"), "×" + marketRes.soMult.toFixed(2) + " (" + marketRes.soCount + ") = " + fmtUSD(marketRes.devWithSO)],
        [t("stepExtras"), fmtUSD(marketRes.extras)],
        [t("stepPost"), fmtUSD(marketRes.post)],
        [t("stepMargin"), fmtUSD(marketRes.margin)]
      ];
      if (marketRes.riskAmount > 0.5) steps.push([t("stepRisk"), fmtUSD(marketRes.riskAmount) + " (" + marketRes.riskPct + "%)"]);
      const mTotalLabel = state.threePoint.enabled ? t("stepExpected") : t("stepTotal");
      dom["trace-body"].innerHTML =
        traceSteps(steps) +
        `<div class="trace-step trace-step--total"><span class="trace-idx">Σ</span><span class="trace-label">${mTotalLabel}</span><span class="trace-value">${fmtUSD(marketRes.expected)}</span></div>`;
    }
  }

  function renderWarnings() {
    const list = [];
    if (mode() === "cost") {
      const c = state.cost;
      if (c.roles.length === 0 && c.variableCosts.length === 0 && c.fixedCosts.length === 0) list.push(t("warnNoCosts"));
    } else {
      if (M.sumPhase(state.phases) !== 100) list.push(t("warnPhases"));
      if (state.platforms.length === 0) list.push(t("warnNoPlatform"));
      if (state.teamMode !== "role" && state.devs.junior + state.devs.mid + state.devs.senior === 0) list.push(t("warnNoDevs"));
      if (params.regions.some((r) => num(r.min) > num(r.max))) list.push(t("warnRange"));
      if (!num(M.computeEffort(state, params).hours)) list.push(t("warnNoHours"));
    }
    dom.warnings.innerHTML = list.map((m) => `<span class="warning-chip">${m}</span>`).join("");
    dom.warnings.hidden = list.length === 0;
  }

  function renderChartDots() {
    if (dom["chart-prev"]) dom["chart-prev"].setAttribute("aria-label", t("chartPrev"));
    if (dom["chart-next"]) dom["chart-next"].setAttribute("aria-label", t("chartNext"));
    const dots = dom["chart-dots"];
    if (!dots || !CSC.Charts || !CSC.Charts.count) return;
    const count = CSC.Charts.count();
    const active = CSC.Charts.slide();
    const names = CSC.Charts.slideNames();
    let html = "";
    for (let i = 0; i < count; i++) {
      html += `<button class="chart-dot${i === active ? " is-active" : ""}" type="button" role="tab" aria-selected="${i === active}" data-slide="${i}" aria-label="${esc(t(names[i]))}">${esc(t(names[i]))}</button>`;
    }
    dots.innerHTML = html;
  }

  function chartNav(delta) {
    if (delta > 0) CSC.Charts.next(); else CSC.Charts.prev();
    recompute();
  }

  function renderTimeline(marketRes, costRes) {
    const el = dom["timeline-body"];
    if (!el) return;
    if (mode() === "cost") {
      const teamSize = costRes.roles.reduce((a, r) => a + (Number(r.qty) || 0) * ((Number(r.dedication) || 100) / 100), 0);
      el.innerHTML = `<div class="breakdown-item breakdown-item--total"><span class="breakdown-label">${t("timelineMonths")}</span><span class="breakdown-value">${fmtNum(costRes.months)} ${t("timelineMonthsUnit")}</span></div>
        <div class="breakdown-item"><span class="breakdown-label">${t("timelineTeam")}</span><span class="breakdown-value">${fmtNum(teamSize)}</span></div>`;
      return;
    }
    const tl = M.computeTimeline(marketRes.totalHours, marketRes.totalDevs, state, params);
    const pSum = M.sumPhase(state.phases) || 1;
    let acc = 0;
    const rows = PHASE_KEYS.map((k) => {
      const share = (Number(state.phases[k]) || 0) / pSum;
      const from = acc;
      acc += share * tl.months;
      return `<div class="breakdown-item"><span class="breakdown-label">${t("phase" + cap(k))}</span><span class="breakdown-value">${from.toFixed(1)} – ${acc.toFixed(1)} ${t("timelineMonthsUnit")}</span></div>`;
    }).join("");
    el.innerHTML = `<div class="breakdown-item breakdown-item--total"><span class="breakdown-label">${t("timelineMonths")}</span><span class="breakdown-value">${tl.months.toFixed(1)} ${t("timelineMonthsUnit")}</span></div>
      <div class="breakdown-item"><span class="breakdown-label">${t("timelineTeam")}</span><span class="breakdown-value">${fmtNum(tl.teamSize)}</span></div>
      ${rows}`;
  }

  function renderTco(expected) {
    const el = dom["tco-body"];
    if (!el) return;
    const tco = M.computeTco(expected, state);
    el.innerHTML = [
      `<div class="breakdown-item"><span class="breakdown-label">${t("kpiTotal")}</span><span class="breakdown-value">${fmtUSD(tco.devCost)}</span></div>`,
      `<div class="breakdown-item"><span class="breakdown-label">${t("tcoMaintenanceLabel")}</span><span class="breakdown-value">${fmtUSD(tco.maintenance)}</span></div>`,
      `<div class="breakdown-item"><span class="breakdown-label">${t("tcoInfraLabel")}</span><span class="breakdown-value">${fmtUSD(tco.infra)}</span></div>`,
      `<div class="breakdown-item breakdown-item--total"><span class="breakdown-label">${t("tcoAnnualLabel")}</span><span class="breakdown-value">${fmtUSD(tco.annual)}</span></div>`,
      `<div class="breakdown-item breakdown-item--total"><span class="breakdown-label">${t("tcoTotalLabel")} ${tco.years} ${t("tcoYearsSuffix")}</span><span class="breakdown-value">${fmtUSD(tco.total)}</span></div>`
    ].join("");
  }

  function updatePhaseUI() {
    const sum = M.sumPhase(state.phases);
    PHASE_KEYS.forEach((k) => {
      const out = $(`[data-phase-value="${k}"]`);
      if (out) out.textContent = (Number(state.phases[k]) || 0) + "%";
    });
    const totalEl = dom["phase-total-value"];
    if (totalEl) {
      totalEl.textContent = sum + "%";
      totalEl.style.color = sum === 100 ? "" : "#b45309";
    }
    const warn = dom["phase-warning"];
    if (warn) warn.classList.toggle("is-visible", sum !== 100);
  }

  function recompute() {
    const marketRes = M.computeForRegion(state, params, state.region);
    const costRes = M.computeCost(state, params);
    renderKPIs(marketRes, costRes);
    renderBreakdown(marketRes, costRes);
    renderTimeline(marketRes, costRes);
    renderTco(mode() === "cost" ? costRes.expected : marketRes.expected);
    renderTrace(marketRes, costRes);
    renderWarnings();
    updatePhaseUI();
    const expected = mode() === "cost" ? costRes.expected : marketRes.expected;
    CSC.Charts.update({ mode: mode(), t: t, marketRes: marketRes, costRes: costRes, state: state, params: params, expected: expected });
    renderChartDots();
  }

  /* ---------------- Persistencia ---------------- */
  function persist() {
    M.saveState(state);
    M.saveParams(params);
  }

  /* ---------------- i18n ---------------- */
  function applyStaticI18n() {
    $$("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((node) => { node.placeholder = t(node.dataset.i18nPh); });
    document.documentElement.lang = lang;
    document.title = t("appTitle");
  }

  function setLanguage(next) {
    lang = next === "en" ? "en" : "es";
    t = (k) => (CSC.I18N[lang] && CSC.I18N[lang][k]) || k;
    dom.lang.value = lang;
    applyStaticI18n();
    renderRegionOptions();
    renderForm();
    renderDynamics();
    recompute();
    M.saveLang(lang);
  }

  /* ---------------- Modal helpers ---------------- */
  function openModal(modal, trigger) {
    lastFocus = trigger || document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    const focusable = modal.querySelector("input, select, button, textarea");
    if (focusable) focusable.focus();
    document.addEventListener("keydown", escHandler);
  }
  function closeModal(modal) {
    modal.classList.remove("is-open");
    setTimeout(() => { modal.hidden = true; }, 150);
    document.removeEventListener("keydown", escHandler);
    if (lastFocus) lastFocus.focus();
  }
  function escHandler(e) {
    if (e.key === "Escape") $$(".modal-backdrop.is-open").forEach((m) => closeModal(m));
  }

  /* ---------------- Parámetros del modelo ---------------- */
  function buildParamsBody() {
    const regionRows = params.regions
      .map((r, i) => `<tr>
        <td class="param-region">${t("region" + r.key.toUpperCase())}</td>
        <td><input class="input input--sm" type="number" min="0" data-param="regions.${i}.rates.junior" value="${r.rates.junior}"></td>
        <td><input class="input input--sm" type="number" min="0" data-param="regions.${i}.rates.mid" value="${r.rates.mid}"></td>
        <td><input class="input input--sm" type="number" min="0" data-param="regions.${i}.rates.senior" value="${r.rates.senior}"></td>
        <td><input class="input input--sm" type="number" min="0" data-param="regions.${i}.min" value="${r.min}"></td>
        <td><input class="input input--sm" type="number" min="0" data-param="regions.${i}.max" value="${r.max}"></td>
      </tr>`)
      .join("");

    const field = (labelKey, path, val, unit) => `
      <div class="param-field">
        <label>${t(labelKey)}</label>
        <div class="param-input">
          <input class="input input--sm" type="number" min="0" data-param="${path}" value="${val}">
          ${unit ? `<span class="param-unit">${unit}</span>` : ""}
        </div>
      </div>`;

    return `
      <p class="modal-intro">${t("paramsIntro")}</p>
      <h3 class="param-section">${t("matrixTitle")}</h3>
      <div class="table-scroll">
        <table class="param-table">
          <thead><tr><th>${t("regionLabel")}</th><th>${t("colJunior")}</th><th>${t("colMid")}</th><th>${t("colSenior")}</th><th>${t("minLabel")}</th><th>${t("maxLabel")}</th></tr></thead>
          <tbody>${regionRows}</tbody>
        </table>
      </div>
      <h3 class="param-section">${t("secComplexityHours")}</h3>
      <div class="param-grid">
        ${field("labelSmall", "complexityHours.small", params.complexityHours.small, t("unitHours"))}
        ${field("labelMedium", "complexityHours.medium", params.complexityHours.medium, t("unitHours"))}
        ${field("labelLarge", "complexityHours.large", params.complexityHours.large, t("unitHours"))}
      </div>
      <h3 class="param-section">${t("secSO")}</h3>
      <div class="param-grid">
        ${field("soStep", "soStep", params.soStep, "%")}
        ${field("soCap", "soCap", params.soCap, "%")}
      </div>
      <h3 class="param-section">${t("secTeam2")}</h3>
      <div class="param-grid">
        ${field("teamStep", "teamStep", params.teamStep, "%")}
        ${field("teamCap", "teamCap", params.teamCap, "%")}
      </div>
      <h3 class="param-section">${t("secMargin")}</h3>
      <div class="param-grid">
        ${field("fixedMargin", "fixedMargin", params.fixedMargin, "%")}
      </div>
      <label class="option-row option-row--compact param-check">
        <input type="checkbox" class="checkbox" data-param="marginAppliesToAll" ${params.marginAppliesToAll ? "checked" : ""}>
        <span class="option-text">${t("marginAll")}</span>
      </label>
      <h3 class="param-section">${t("secBudget")}</h3>
      <div class="param-grid">
        ${field("budgetRangePct", "budgetRangePct", params.budgetRangePct, "±%")}
      </div>
      <h3 class="param-section">${t("secEffortParams")}</h3>
      <div class="param-grid">
        ${field("catalogExponentLabel", "catalogExponent", params.catalogExponent, "×")}
        ${field("hoursPerFP", "hoursPerFP", params.hoursPerFP, t("unitHours"))}
        ${field("hoursPerPersonMonth", "hoursPerPersonMonth", params.hoursPerPersonMonth, t("unitHours"))}
        ${field("spHoursPerSprint", "hoursPerSprint", params.hoursPerSprint, t("unitHours"))}
      </div>
      <h3 class="param-section">${t("secMarketRolesParams")}</h3>
      <div class="table-scroll">
        <table class="param-table">
          <thead><tr><th>${t("colRole")}</th><th>${t("colLevel")}</th></tr></thead>
          <tbody>
            ${(params.marketRoles || []).map((r, i) => `<tr>
              <td class="param-region">${t("role" + cap(r.key))}</td>
              <td><select class="input input--sm" data-param="marketRoles.${i}.level">${MARKET_ROLE_LEVELS.map((l) => `<option value="${l}" ${r.level === l ? "selected" : ""}>${t("col" + cap(l))}</option>`).join("")}</select></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function openParams(trigger) {
    dom["params-body"].innerHTML = buildParamsBody();
    openModal(dom["params-modal"], trigger);
  }

  function onParamInput(e) {
    const input = e.target.closest("[data-param]");
    if (!input) return;
    let value;
    if (input.type === "checkbox") value = input.checked;
    else if (input.tagName === "SELECT") value = input.value;
    else value = Math.max(0, num(input.value));
    M.setByPath(params, input.dataset.param, value);
    persist();
    renderRegionOptions();
    renderMarketTeam();
    updateEffortPreview();
    recompute();
  }

  function resetAll() {
    const d = M.defaults();
    params = d.params;
    state = d.state;
    persist();
    renderRegionOptions();
    renderForm();
    renderDynamics();
    recompute();
    dom["params-body"].innerHTML = buildParamsBody();
  }

  /* ---------------- Import / Export ---------------- */
  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download("calculadora-costos-config.json", JSON.stringify({ params, state, scenarios }, null, 2));
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.params) params = M.deepMerge(M.clone(M.DEFAULT_PARAMS), data.params);
        if (data.state) state = M.deepMerge(M.clone(M.DEFAULT_STATE), data.state);
        if (Array.isArray(data.scenarios)) scenarios = data.scenarios;
        persist();
        M.saveScenarios(scenarios);
        renderRegionOptions();
        renderForm();
        renderDynamics();
        recompute();
        dom["params-body"].innerHTML = buildParamsBody();
      } catch (err) {
        alert(t("importError"));
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- Exportación (CSV / Excel) ---------------- */
  function exportCsv() {
    const rows = [];
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    rows.push([q(t("appTitle")), q(new Date().toLocaleString(locale()))]);
    rows.push([]);
    rows.push([q(t("xlsxCategory")), q(t("xlsxAmount"))]);
    if (mode() === "cost") {
      const c = M.computeCost(state, params);
      rows.push([q(t("catPersonnel")), Math.round(c.personnel)]);
      rows.push([q(t("catVarProject")), Math.round(c.variableProject)]);
      rows.push([q(t("catFixed")), Math.round(c.fixedAllocated)]);
      if (c.costAdjTotal > 0.5) rows.push([q(t("catCostAdj")), Math.round(c.costAdjTotal)]);
      if (c.riskAmount > 0.5) rows.push([q(t("stepRisk")), Math.round(c.riskAmount)]);
      rows.push([q(t("catCost")), Math.round(c.adjustedCost)]);
      rows.push([q(t("catProfit")), Math.round(c.profit)]);
      if (c.priceAdjTotal > 0.5) rows.push([q(t("catPriceAdj")), Math.round(c.priceAdjTotal)]);
      rows.push([q(t("catSalePrice")), Math.round(c.salePrice)]);
    } else {
      const res = M.computeForRegion(state, params, state.region);
      marketCategories(res).forEach((c) => rows.push([q(t(c.key)), Math.round(c.value)]));
      if (res.riskAmount > 0.5) rows.push([q(t("stepRisk")), Math.round(res.riskAmount)]);
      rows.push([q(t("totalLabel")), Math.round(res.expected)]);
      rows.push([q(t("kpiHours")), Math.round(res.totalHours)]);
      rows.push([q(t("kpiRate")), res.blendedRate.toFixed(2)]);
    }
    const csv = rows.map((r) => r.join(",")).join("\r\n");
    download("presupuesto.csv", "\uFEFF" + csv, "text/csv;charset=utf-8;");
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* Libro Excel con varias hojas, estilos y gráficos embebidos [Fase E] */
  function exportExcel() {
    if (typeof ExcelJS === "undefined") { exportCsv(); return; }
    const isCost = mode() === "cost";
    const marketRes = M.computeForRegion(state, params, state.region);
    const costRes = M.computeCost(state, params);
    const expected = isCost ? costRes.expected : marketRes.expected;
    const tco = M.computeTco(expected, state);
    const min = isCost ? costRes.rangeMin : marketRes.rangeMin;
    const max = isCost ? costRes.rangeMax : marketRes.rangeMax;

    const NAVY = "FF1E3A8A", BLUE = "FF2563EB", LIGHT = "FFDBEAFE", GREY = "FF475569", WHITE = "FFFFFFFF", RED = "FFB91C1C", GREEN = "FF15803D";
    const MONEY = '"$"#,##0';
    const wb = new ExcelJS.Workbook();
    wb.creator = t("appTitle");
    wb.created = new Date();

    const write = (ws, rowIdx, cells) => {
      const row = ws.getRow(rowIdx);
      cells.forEach((cell, i) => {
        const c = row.getCell(i + 1);
        c.value = cell.v;
        if (cell.money && typeof cell.v === "number") c.numFmt = MONEY;
        if (cell.bold) c.font = { bold: true, color: { argb: cell.color || NAVY } };
        else if (cell.color) c.font = { color: { argb: cell.color } };
        if (cell.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cell.fill } };
        c.alignment = { horizontal: cell.align || (i === 0 ? "left" : "right") };
      });
      return row;
    };
    const sheetTitle = (ws, range, text) => {
      ws.mergeCells(range);
      const first = range.split(":")[0];
      const c = ws.getCell(first);
      c.value = text;
      c.font = { size: 15, bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      ws.getRow(parseInt(first.replace(/\D/g, ""), 10)).height = 28;
    };
    const headerRow = (ws, rowIdx, labels) => {
      write(ws, rowIdx, labels.map((l) => ({ v: l, bold: true, color: WHITE, fill: BLUE })));
      ws.getRow(rowIdx).height = 20;
    };

    /* ---- Resumen + gráficos ---- */
    const ws = wb.addWorksheet(t("xlsxSummary"), { properties: { tabColor: { argb: BLUE } }, views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 30; ws.getColumn(2).width = 26; ws.getColumn(3).width = 18;
    sheetTitle(ws, "A1:C1", t("appTitle"));
    write(ws, 2, [{ v: t("reportGenerated") + " · " + new Date().toLocaleString(locale()), color: GREY }]);
    let r = 4;
    write(ws, r++, [{ v: isCost ? t("kpiSalePrice") : t("kpiTotal"), bold: true }, { v: expected, money: true, bold: true, color: NAVY }]);
    write(ws, r++, [{ v: t("reportMode") }, { v: isCost ? t("modeCost") : t("modeMarket") }]);
    write(ws, r++, [{ v: t("kpiRange") }, { v: fmtUSD(min) + " – " + fmtUSD(max) }]);
    if (isCost) {
      write(ws, r++, [{ v: t("monthsLabel") }, { v: costRes.months }]);
      write(ws, r++, [{ v: t("profitMargin") }, { v: costRes.profitMargin + "%" }]);
    } else {
      write(ws, r++, [{ v: t("kpiHours"), bold: false }, { v: Math.round(marketRes.totalHours) }]);
      write(ws, r++, [{ v: t("xlsxTeam") }, { v: marketRes.totalDevs }]);
      write(ws, r++, [{ v: t("kpiRate") }, { v: marketRes.blendedRate, money: true }]);
    }
    if (tco.annual > 0.5) {
      write(ws, r++, [{ v: t("tcoAnnualLabel") }, { v: tco.annual, money: true }]);
      write(ws, r++, [{ v: tcoTotalLabel(tco) }, { v: tco.total, money: true }]);
    }
    const embeds = [];
    ["chart-breakdown", "chart-region", "chart-contract"].forEach((id) => {
      const canvas = document.getElementById(id);
      if (!canvas || typeof canvas.toDataURL !== "function") return;
      let data = null;
      try { data = canvas.toDataURL("image/png"); } catch (e) { data = null; }
      if (data && data.length > 200) embeds.push(data.split(",")[1]);
    });
    embeds.forEach((b64, i) => {
      try {
        const imgId = wb.addImage({ base64: b64, extension: "png" });
        ws.addImage(imgId, { tl: { col: 0.1, row: r + i * 15 }, ext: { width: 520, height: 320 }, editAs: "oneCell" });
      } catch (e) { /* imagen no soportada: se omite */ }
    });

    /* ---- Desglose ---- */
    const wb1 = wb.addWorksheet(t("xlsxBreakdown"), { views: [{ showGridLines: false }] });
    wb1.getColumn(1).width = 42; wb1.getColumn(2).width = 20;
    sheetTitle(wb1, "A1:B1", t("xlsxBreakdown"));
    headerRow(wb1, 3, [t("xlsxCategory"), t("xlsxAmount")]);
    let rr = 4;
    if (isCost) {
      const base = [
        [t("catPersonnel"), costRes.personnel],
        [t("catVarProject"), costRes.variableProject],
        [t("catFixed"), costRes.fixedAllocated]
      ];
      if (costRes.costAdjTotal > 0.5) base.push([t("catCostAdj"), costRes.costAdjTotal]);
      if (costRes.riskAmount > 0.5) base.push([t("stepRisk"), costRes.riskAmount]);
      base.push([t("catCost"), costRes.adjustedCost]);
      base.push([t("catProfit"), costRes.profit]);
      if (costRes.priceAdjTotal > 0.5) base.push([t("catPriceAdj"), costRes.priceAdjTotal]);
      base.forEach((row) => write(wb1, rr++, [{ v: row[0] }, { v: row[1], money: true }]));
      write(wb1, rr, [{ v: t("catSalePrice"), bold: true, fill: LIGHT }, { v: costRes.salePrice, money: true, bold: true, color: NAVY, fill: LIGHT }]);
    } else {
      marketCategories(marketRes).forEach((c) => write(wb1, rr++, [{ v: t(c.key) }, { v: c.value, money: true }]));
      if (marketRes.riskAmount > 0.5) write(wb1, rr++, [{ v: t("stepRisk") }, { v: marketRes.riskAmount, money: true }]);
      write(wb1, rr, [{ v: t("totalLabel"), bold: true, fill: LIGHT }, { v: marketRes.expected, money: true, bold: true, color: NAVY, fill: LIGHT }]);
    }

    /* ---- Fases (tarifas) o detalle de costos (modo costos) ---- */
    if (!isCost) {
      const wf = wb.addWorksheet(t("xlsxPhases"), { views: [{ showGridLines: false }] });
      wf.getColumn(1).width = 30; wf.getColumn(2).width = 12; wf.getColumn(3).width = 18;
      sheetTitle(wf, "A1:C1", t("xlsxPhases"));
      headerRow(wf, 3, [t("xlsxPhases"), "%", t("xlsxAmount")]);
      let f = 4;
      [["analysis", t("catAnalysis")], ["design", t("catDesign")], ["implementation", t("catImplementation")], ["testing", t("catQA")]].forEach(([k, label]) => {
        write(wf, f++, [{ v: label }, { v: (state.phases[k] || 0) + "%" }, { v: marketRes.phases[k], money: true }]);
      });
      write(wf, f, [{ v: t("totalLabel"), bold: true, fill: LIGHT }, { v: M.sumPhase(state.phases) + "%", bold: true, color: NAVY, fill: LIGHT }, { v: marketRes.totalBefore, money: true, bold: true, color: NAVY, fill: LIGHT }]);

      const region = (params.regions || []).find((x) => x.key === state.region) || { rates: {} };
      const wt = wb.addWorksheet(t("xlsxTeam"), { views: [{ showGridLines: false }] });
      wt.getColumn(1).width = 30; wt.getColumn(2).width = 14; wt.getColumn(3).width = 20;
      sheetTitle(wt, "A1:C1", t("xlsxTeam"));
      headerRow(wt, 3, [t("colRole"), t("colQty"), t("colMonthly")]);
      let tt = 4;
      if (state.teamMode === "role") {
        (params.marketRoles || []).forEach((mr) => {
          const qty = (state.marketTeam && state.marketTeam[mr.key]) || 0;
          if (qty > 0) write(wt, tt++, [{ v: t("role" + cap(mr.key)) + " · " + t("col" + cap(mr.level)) }, { v: qty }, { v: (region.rates || {})[mr.level] || 0, money: true }]);
        });
      } else {
        ["junior", "mid", "senior"].forEach((lv) => {
          write(wt, tt++, [{ v: t("col" + cap(lv)) }, { v: (state.devs && state.devs[lv]) || 0 }, { v: (region.rates || {})[lv] || 0, money: true }]);
        });
      }
    } else {
      const wr = wb.addWorksheet(t("xlsxRoles"), { views: [{ showGridLines: false }] });
      wr.getColumn(1).width = 28; wr.getColumn(2).width = 10; wr.getColumn(3).width = 16; wr.getColumn(4).width = 12; wr.getColumn(5).width = 12; wr.getColumn(6).width = 18;
      sheetTitle(wr, "A1:F1", t("xlsxRoles"));
      headerRow(wr, 3, [t("colRole"), t("colQty"), t("colMonthly"), t("colMonths"), t("colDedication"), t("totalLabel")]);
      let k = 4;
      costRes.roles.forEach((role) => {
        write(wr, k++, [{ v: role.role }, { v: role.qty }, { v: role.monthly, money: true }, { v: role.months }, { v: role.dedication + "%" }, { v: role.subtotal, money: true }]);
      });
      write(wr, k, [{ v: t("catPersonnel"), bold: true, fill: LIGHT }, { v: "" }, { v: "" }, { v: "" }, { v: "" }, { v: costRes.personnel, money: true, bold: true, color: NAVY, fill: LIGHT }]);

      const wv = wb.addWorksheet(t("secVariableProject"), { views: [{ showGridLines: false }] });
      wv.getColumn(1).width = 42; wv.getColumn(2).width = 18;
      sheetTitle(wv, "A1:B1", t("secVariableProject"));
      headerRow(wv, 3, [t("colConcept"), t("colAmount")]);
      let vv = 4;
      (state.cost.variableCosts || []).forEach((v) => write(wv, vv++, [{ v: v.concept }, { v: Number(v.amount) || 0, money: true }]));
      write(wv, vv, [{ v: t("totalLabel"), bold: true, fill: LIGHT }, { v: costRes.variableProject, money: true, bold: true, color: NAVY, fill: LIGHT }]);

      const wf2 = wb.addWorksheet(t("secFixed"), { views: [{ showGridLines: false }] });
      wf2.getColumn(1).width = 42; wf2.getColumn(2).width = 22;
      sheetTitle(wf2, "A1:B1", t("secFixed"));
      headerRow(wf2, 3, [t("colConcept"), t("colMonthlyFixed")]);
      let ff = 4;
      (state.cost.fixedCosts || []).forEach((fc) => write(wf2, ff++, [{ v: fc.concept }, { v: Number(fc.monthly) || 0, money: true }]));
      write(wf2, ff, [{ v: t("fixedMonthlyTotal"), bold: true, fill: LIGHT }, { v: costRes.fixedMonthly, money: true, bold: true, color: NAVY, fill: LIGHT }]);
    }

    /* ---- Escenarios ---- */
    if (scenarios.length) {
      const wsc = wb.addWorksheet(t("xlsxScenarios"), { views: [{ showGridLines: false }] });
      wsc.getColumn(1).width = 26; wsc.getColumn(2).width = 14; wsc.getColumn(3).width = 22; wsc.getColumn(4).width = 20; wsc.getColumn(5).width = 18;
      sheetTitle(wsc, "A1:E1", t("scenariosReportTitle"));
      headerRow(wsc, 3, [t("scenariosTitle"), t("scenarioDate"), t("reportMode"), t("kpiTotal"), t("versionDelta")]);
      let s = 4;
      scenarios.forEach((sc, i) => {
        const val = primaryFor(sc);
        const prev = i > 0 ? primaryFor(scenarios[i - 1]) : null;
        const delta = prev == null ? null : val - prev;
        write(wsc, s++, [
          { v: sc.name },
          { v: sc.createdAt ? new Date(sc.createdAt).toLocaleDateString(locale()) : "—" },
          { v: (sc.state.mode || "market") === "cost" ? t("modeCost") : t("modeMarket") },
          { v: val, money: true },
          { v: delta == null ? "—" : (delta >= 0 ? "+" : "−") + fmtUSD(Math.abs(delta)), color: delta > 0 ? RED : delta < 0 ? GREEN : GREY, bold: true }
        ]);
      });
    }

    /* ---- Supuestos ---- */
    const wa = wb.addWorksheet(t("xlsxAssumptions"), { views: [{ showGridLines: false }] });
    wa.getColumn(1).width = 34; wa.getColumn(2).width = 34;
    sheetTitle(wa, "A1:B1", t("xlsxAssumptions"));
    let a = 3;
    const assumption = (label, value) => write(wa, a++, [{ v: label }, { v: value }]);
    assumption(t("reportMode"), isCost ? t("modeCost") : t("modeMarket"));
    if (!isCost) {
      assumption(t("regionLabel"), t("region" + state.region.toUpperCase()));
      assumption(t("effortLabel"), t("effort" + cap(state.effortMethod)));
      assumption(t("contractLabel"), t("contract" + cap(state.contract)));
      assumption(t("fixedMargin"), params.fixedMargin + "%");
      assumption(t("budgetRangePct"), "±" + params.budgetRangePct + "%");
    } else {
      assumption(t("profitMargin"), (state.cost.profitMargin || 0) + "%");
      assumption(t("rolesUnitLabel"), t("rolesUnit" + cap(state.cost.rolesUnit)));
    }
    assumption(t("riskLabel"), t("risk" + cap(state.risk.level)));
    assumption(t("engagementLabel"), t("engagement" + cap(state.engagement)));
    assumption(t("hoursPerMonthLabel"), state.timeline.hoursPerMonth);
    assumption(t("tcoMaintenance"), state.tco.maintenancePct + "%");
    assumption(t("tcoYears"), state.tco.years);
    assumption(t("tcoHosting"), fmtUSD(state.tco.hostingMonthly));
    assumption(t("tcoApi"), fmtUSD(state.tco.apiMonthly));

    const fname = "presupuesto-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    wb.xlsx.writeBuffer().then((buffer) => {
      downloadBlob(fname, new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    }).catch(() => exportCsv());
  }

  function tcoTotalLabel(tco) {
    return t("tcoTotalLabel") + " (" + tco.years + " " + t("tcoYearsSuffix") + ")";
  }

  /* ---------------- Compartir y reporte [Fase E] ---------------- */
  function encodeState() {
    const payload = JSON.stringify({ v: 1, state: state, params: params });
    return btoa(unescape(encodeURIComponent(payload)));
  }
  function decodeState(str) {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  }

  function shareLink() {
    const url = location.origin + location.pathname + "#s=" + encodeState();
    const okCopy = () => alert(t("shareCopied"));
    const fallback = () => window.prompt(t("btnShare"), url);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(okCopy, fallback);
      } else {
        fallback();
      }
    } catch (e) {
      fallback();
    }
  }

  function loadFromHash() {
    const m = /[#&]s=([^&]+)/.exec(location.hash || "");
    if (!m) return false;
    try {
      const data = decodeState(m[1]);
      if (data.params) params = M.deepMerge(M.clone(M.DEFAULT_PARAMS), data.params);
      if (data.state) state = M.deepMerge(M.clone(M.DEFAULT_STATE), data.state);
      return true;
    } catch (e) {
      return false;
    }
  }

  function reportHtml() {
    const isCost = mode() === "cost";
    const marketRes = M.computeForRegion(state, params, state.region);
    const costRes = M.computeCost(state, params);
    const expected = isCost ? costRes.expected : marketRes.expected;
    const tco = M.computeTco(expected, state);
    const row = (l, v) => `<tr><td>${esc(l)}</td><td class="r">${esc(v)}</td></tr>`;

    let detail;
    if (isCost) {
      detail = row(t("kpiSalePrice"), fmtUSD(costRes.salePrice)) +
        row(t("catPersonnel"), fmtUSD(costRes.personnel)) +
        row(t("catVarProject"), fmtUSD(costRes.variableProject)) +
        row(t("catFixed"), fmtUSD(costRes.fixedAllocated)) +
        (costRes.riskAmount > 0.5 ? row(t("stepRisk"), fmtUSD(costRes.riskAmount)) : "") +
        row(t("catCost"), fmtUSD(costRes.adjustedCost)) +
        row(t("catProfit"), fmtUSD(costRes.profit));
    } else {
      detail = row(t("effortLabel"), t("effort" + cap(marketRes.effortMethod))) +
        row(t("stepTotalHours"), fmtNum(marketRes.totalHours) + " " + t("unitHours")) +
        row(t("stepRate"), fmtUSD(marketRes.blendedRate) + t("unitPerHour")) +
        row(t("catAnalysis"), fmtUSD(marketRes.phases.analysis)) +
        row(t("catDesign"), fmtUSD(marketRes.phases.design)) +
        row(t("catImplementation"), fmtUSD(marketRes.phases.implementation)) +
        row(t("catQA"), fmtUSD(marketRes.phases.testing)) +
        row(t("catExtras"), fmtUSD(marketRes.extras)) +
        row(t("catPost"), fmtUSD(marketRes.post)) +
        row(t("catMargin"), fmtUSD(marketRes.margin));
    }
    if (tco.annual > 0.5) {
      detail += row(t("tcoAnnualLabel"), fmtUSD(tco.annual)) +
        row(t("tcoTotalLabel") + " " + tco.years + " " + t("tcoYearsSuffix"), fmtUSD(tco.total));
    }

    const dateStr = new Date().toLocaleDateString(locale());
    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(t("reportTitle"))}</title>
<style>
  body{font-family:'Inter',system-ui,'Segoe UI',Roboto,sans-serif;color:#1e293b;margin:36px;max-width:760px;}
  h1{font-size:20px;margin:0 0 2px;} h2{font-size:13px;margin:24px 0 8px;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;text-transform:uppercase;letter-spacing:.03em;}
  .muted{color:#64748b;font-size:12px;} .big{font-size:30px;font-weight:800;color:#1e3a8a;margin:6px 0;}
  table{border-collapse:collapse;width:100%;font-size:13px;} td{padding:6px;border-bottom:1px solid #eef2f7;} .r{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
  @media print{body{margin:0;}}
</style></head><body>
  <h1>${esc(t("appTitle"))}</h1>
  <p class="muted">${esc(t("reportGenerated"))} · ${esc(dateStr)}</p>
  <h2>${esc(t("reportTitle"))}</h2>
  <div class="big">${esc(fmtUSD(expected))}</div>
  <p class="muted">${esc(t("reportDate"))}: ${esc(dateStr)}</p>
  <h2>${esc(isCost ? t("kpiSalePrice") : t("kpiTotal"))}</h2>
  <table>${detail}</table>
  <p class="muted" style="margin-top:26px">${esc(t("disclaimer"))}</p>
</body></html>`;
  }

  function openPrintable(html) {
    let w = null;
    try { w = window.open("", "_blank"); } catch (e) { w = null; }
    if (!w) { download("propuesta.html", html, "text/html"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    try { w.focus(); } catch (e) { /* noop */ }
  }

  function generateReport() {
    openPrintable(reportHtml());
  }

  function scenariosReportHtml() {
    const dateStr = new Date().toLocaleDateString(locale());
    const rows = scenarios
      .map((s, i) => {
        const val = primaryFor(s);
        const prev = i > 0 ? primaryFor(scenarios[i - 1]) : null;
        const delta = prev == null ? null : val - prev;
        const deltaTxt = delta == null ? "—" : (delta >= 0 ? "+" : "−") + fmtUSD(Math.abs(delta));
        const dateTxt = s.createdAt ? new Date(s.createdAt).toLocaleDateString(locale()) : "—";
        const modeTxt = (s.state.mode || "market") === "cost" ? t("modeCost") : t("modeMarket");
        return `<tr><td>${esc(s.name)}</td><td>${esc(dateTxt)}</td><td>${esc(modeTxt)}</td><td class="r">${esc(fmtUSD(val))}</td><td class="r">${esc(deltaTxt)}</td></tr>`;
      })
      .join("");
    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(t("scenariosReportTitle"))}</title>
<style>
  body{font-family:'Inter',system-ui,'Segoe UI',Roboto,sans-serif;color:#1e293b;margin:36px;}
  h1{font-size:20px;margin:0 0 2px;} h2{font-size:13px;margin:22px 0 8px;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:4px;text-transform:uppercase;letter-spacing:.03em;}
  .muted{color:#64748b;font-size:12px;}
  table{border-collapse:collapse;width:100%;font-size:13px;} th{text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;padding:6px;border-bottom:2px solid #e2e8f0;}
  td{padding:6px;border-bottom:1px solid #eef2f7;} .r{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
  @media print{body{margin:0;}}
</style></head><body>
  <h1>${esc(t("appTitle"))}</h1>
  <p class="muted">${esc(t("reportGenerated"))} · ${esc(dateStr)}</p>
  <h2>${esc(t("scenariosReportTitle"))}</h2>
  <table><thead><tr><th>${esc(t("scenariosTitle"))}</th><th>${esc(t("scenarioDate"))}</th><th>${esc(t("reportMode"))}</th><th class="r">${esc(t("kpiTotal"))}</th><th class="r">${esc(t("versionDelta"))}</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="muted" style="margin-top:26px">${esc(t("disclaimer"))}</p>
</body></html>`;
  }

  function printScenarios() {
    if (scenarios.length === 0) return;
    openPrintable(scenariosReportHtml());
  }

  /* ---------------- Escenarios ---------------- */
  let scenariosChart = null;

  function primaryFor(s) {
    if ((s.state.mode || "market") === "cost") return M.computeCost(s.state, params).expected;
    return M.computeForRegion(s.state, params, s.state.region).expected;
  }

  function buildScenariosBody() {
    const controls = `
      <div class="scenario-new">
        <input id="scenario-name" class="input" type="text" data-i18n-ph="scenarioNamePh" placeholder="${t("scenarioNamePh")}">
        <button id="scenario-save" class="btn btn--primary" type="button">${t("saveScenario")}</button>
      </div>`;
    if (scenarios.length === 0) return controls + `<p class="empty-note">${t("noScenarios")}</p>`;

    const rows = scenarios
      .map((s, i) => {
        const val = primaryFor(s);
        const prev = i > 0 ? primaryFor(scenarios[i - 1]) : null;
        const delta = prev == null ? null : val - prev;
        const deltaTxt = delta == null ? "—" : (delta >= 0 ? "+" : "−") + fmtUSD(Math.abs(delta));
        const dateTxt = s.createdAt ? new Date(s.createdAt).toLocaleDateString(locale()) : "—";
        const deltaCls = delta == null ? "" : delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "";
        return `<tr>
        <td>${esc(s.name)}</td>
        <td>${esc(dateTxt)}</td>
        <td>${fmtUSD(val)}</td>
        <td class="${deltaCls}">${esc(deltaTxt)}</td>
        <td class="row-actions">
          <button class="btn btn--ghost" data-load="${i}" type="button">${t("loadLabel")}</button>
          <button class="btn btn--ghost btn--danger" data-del="${i}" type="button">${t("deleteLabel")}</button>
        </td>
      </tr>`;
      })
      .join("");

    return `${controls}
      <h3 class="param-section">${t("compareTitle")}</h3>
      <div class="table-scroll">
        <table class="param-table">
          <thead><tr><th>${t("scenariosTitle")}</th><th>${t("scenarioDate")}</th><th>${t("kpiTotal")}</th><th>${t("versionDelta")}</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="chart-box chart-box--sm"><canvas id="chart-scenarios" aria-label="${t("compareTitle")}"></canvas></div>`;
  }

  function renderScenariosChart() {
    if (typeof Chart === "undefined" || scenarios.length === 0) return;
    const canvas = document.getElementById("chart-scenarios");
    if (!canvas) return;
    if (scenariosChart) { scenariosChart.destroy(); scenariosChart = null; }
    scenariosChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: scenarios.map((s) => s.name),
        datasets: [{ data: scenarios.map((s) => Math.round(primaryFor(s))), backgroundColor: "#2563eb", borderRadius: 6, maxBarThickness: 70 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "$" + c.parsed.y.toLocaleString() } } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => (Math.abs(v) >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v)) }, grid: { color: "#eef2f7" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function rebuildScenarios() {
    dom["scenarios-body"].innerHTML = buildScenariosBody();
    renderScenariosChart();
  }

  function openScenarios(trigger) {
    rebuildScenarios();
    openModal(dom["scenarios-modal"], trigger);
  }

  function saveScenario() {
    const nameInput = document.getElementById("scenario-name");
    const name = (nameInput.value || "").trim() || t("scenariosTitle") + " " + (scenarios.length + 1);
    scenarios.push({ name: name, state: M.clone(state), createdAt: Date.now() });
    M.saveScenarios(scenarios);
    rebuildScenarios();
  }

  function loadScenario(i) {
    const s = scenarios[i];
    if (!s) return;
    state = M.deepMerge(M.clone(M.DEFAULT_STATE), s.state);
    M.saveState(state);
    renderModeUI();
    renderRegionOptions();
    renderForm();
    renderDynamics();
    recompute();
    closeModal(dom["scenarios-modal"]);
  }

  function deleteScenario(i) {
    scenarios.splice(i, 1);
    M.saveScenarios(scenarios);
    rebuildScenarios();
  }

  /* ---------------- Eventos ---------------- */
  function bindEvents() {
    dom["calc-form"].addEventListener("input", onFormInput);
    dom["calc-form"].addEventListener("change", onFormInput);

    function onFormInput(e) {
      if (e.target.closest("#cost-body")) handleCostInput(e.target);
      else if (e.target.closest("#effort-body")) handleEffortInput(e.target);
      else if (e.target.closest("#market-team-body")) handleMarketTeamInput(e.target);
      else syncStateFromDom();
      persist();
      recompute();
    }

    dom["cost-body"].addEventListener("click", (e) => {
      if (handleCostClick(e.target)) return;
    });

    // Selector de modo (tarifas / costos)
    $$(".mode-opt").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    // Método de estimación de esfuerzo [Fase A]
    if (dom["effort-method"]) {
      dom["effort-method"].addEventListener("change", () => {
        state.effortMethod = dom["effort-method"].value;
        renderEffortPanel();
        persist();
        recompute();
      });
    }
    // Equipo por perfil / rol [Fase A]
    $$(".team-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.teamMode = btn.dataset.team;
        renderTeamMode();
        persist();
        recompute();
      });
    });

    // Modo de costo de extras (USD / %)
    $$(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.extrasMode = btn.dataset.mode;
        renderForm();
        persist();
        recompute();
      });
    });

    dom.lang.addEventListener("change", () => setLanguage(dom.lang.value));

    dom["btn-params"].addEventListener("click", (e) => openParams(e.currentTarget));
    dom["btn-scenarios"].addEventListener("click", (e) => openScenarios(e.currentTarget));
    dom["btn-print"].addEventListener("click", () => window.print());
    dom["btn-csv"].addEventListener("click", exportCsv);
    dom["btn-excel"].addEventListener("click", exportExcel);
    dom["btn-report"].addEventListener("click", generateReport);
    dom["btn-share"].addEventListener("click", shareLink);

    // Navegación del bloque de gráficos (conjuntos de 3) [Fase E]
    if (dom["chart-prev"]) dom["chart-prev"].addEventListener("click", (e) => { e.preventDefault(); chartNav(-1); });
    if (dom["chart-next"]) dom["chart-next"].addEventListener("click", (e) => { e.preventDefault(); chartNav(1); });
    if (dom["chart-dots"]) dom["chart-dots"].addEventListener("click", (e) => {
      const dot = e.target.closest("[data-slide]");
      if (!dot) return;
      CSC.Charts.goTo(Number(dot.dataset.slide));
      recompute();
    });

    dom["params-body"].addEventListener("input", onParamInput);
    dom["params-body"].addEventListener("change", onParamInput);
    dom["params-reset"].addEventListener("click", resetAll);
    dom["params-export"].addEventListener("click", exportJson);
    dom["params-import"].addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) importJson(e.target.files[0]);
      e.target.value = "";
    });
    dom["params-close"].addEventListener("click", () => closeModal(dom["params-modal"]));

    dom["scenarios-body"].addEventListener("click", (e) => {
      const save = e.target.closest("#scenario-save");
      const load = e.target.closest("[data-load]");
      const del = e.target.closest("[data-del]");
      if (save) saveScenario();
      else if (load) loadScenario(Number(load.dataset.load));
      else if (del) deleteScenario(Number(del.dataset.del));
    });
    dom["scenarios-body"].addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.id === "scenario-name") { e.preventDefault(); saveScenario(); }
    });
    dom["scenarios-close"].addEventListener("click", () => closeModal(dom["scenarios-modal"]));
    dom["scenarios-print"].addEventListener("click", printScenarios);

    $$(".modal-backdrop").forEach((m) => {
      m.addEventListener("mousedown", (e) => { if (e.target === m) closeModal(m); });
    });
    $$("[data-modal-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-backdrop");
        if (modal) closeModal(modal);
      });
    });
  }

  /* ---------------- Init ---------------- */
  function init() {
    cacheDom();
    CSC.Charts.init();
    loadFromHash();
    setLanguage(M.loadLang());
    bindEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
