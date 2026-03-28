const STORAGE_KEY = "synchrotower_state_v3";
const DAY_MS = 24 * 60 * 60 * 1000;

const ROLE_LABELS = {
  executive: "Executive",
  procurement: "Procurement",
  warehouse: "Warehouse",
  production: "Production",
};

const ROLE_FOCUS = {
  executive: ["Stockout", "Space", "SLA", "RCA"],
  procurement: ["Stockout", "Inbound Delay", "Supplier"],
  warehouse: ["Space", "Putaway", "Returns", "Staging"],
  production: ["Stockout", "Sequencing", "Capacity"],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fmtPct(value) {
  return `${value.toFixed(1)}%`;
}

function fmtNum(value) {
  return value.toLocaleString("en-US");
}

function fmtDate(dateText) {
  const date = new Date(dateText);
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function isoDay(date, offset = 0) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function movingAverage(array, windowSize) {
  const sample = array.slice(-windowSize);
  if (!sample.length) return 0;
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function stdDev(array) {
  if (array.length <= 1) return 0;
  const mean = array.reduce((sum, n) => sum + n, 0) / array.length;
  const variance = array.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (array.length - 1);
  return Math.sqrt(variance);
}

function roleOwner(type) {
  if (type === "Stockout" || type === "Inbound Delay") return "Procurement";
  if (type === "Space" || type === "Putaway") return "Warehouse";
  if (type === "Sequencing") return "Production";
  return "Executive";
}

function defaultState() {
  const today = isoDay(new Date());

  const suppliers = [
    { id: "SUP-A", reliability: 0.92, leadTimeMean: 7, leadTimeStd: 2 },
    { id: "SUP-B", reliability: 0.84, leadTimeMean: 9, leadTimeStd: 3 },
    { id: "SUP-C", reliability: 0.88, leadTimeMean: 6, leadTimeStd: 1.5 },
  ];

  const skus = [
    {
      id: "SKU-1042",
      name: "Premium Sparkling Water 500ml",
      channel: "B2C",
      criticality: "A",
      supplierId: "SUP-B",
      onHand: 142,
      inboundQty: 180,
      inboundEveryDays: 7,
      nextInboundInDays: 4,
      leadTimeMean: 8,
      leadTimeStd: 2,
      dim: { l: 24, w: 16, h: 20 },
      weatherSensitivity: 1,
      rainfallSensitivity: 0.3,
      holidayLift: 0.45,
      trend: 0.015,
    },
    {
      id: "SKU-2090",
      name: "Herbal Tea Gift Set",
      channel: "B2C",
      criticality: "A",
      supplierId: "SUP-A",
      onHand: 190,
      inboundQty: 120,
      inboundEveryDays: 10,
      nextInboundInDays: 5,
      leadTimeMean: 6,
      leadTimeStd: 1,
      dim: { l: 28, w: 20, h: 15 },
      weatherSensitivity: 0.35,
      rainfallSensitivity: 0.1,
      holidayLift: 0.62,
      trend: 0.01,
    },
    {
      id: "SKU-3123",
      name: "Isotonic Drink 1L",
      channel: "B2B",
      criticality: "C",
      supplierId: "SUP-C",
      onHand: 640,
      inboundQty: 400,
      inboundEveryDays: 12,
      nextInboundInDays: 6,
      leadTimeMean: 7,
      leadTimeStd: 2,
      dim: { l: 30, w: 20, h: 25 },
      weatherSensitivity: 0.4,
      rainfallSensitivity: 0.12,
      holidayLift: 0.08,
      trend: 0.002,
    },
    {
      id: "SKU-4108",
      name: "Electrolyte Powder 20ct",
      channel: "B2C",
      criticality: "B",
      supplierId: "SUP-A",
      onHand: 320,
      inboundQty: 180,
      inboundEveryDays: 8,
      nextInboundInDays: 2,
      leadTimeMean: 6,
      leadTimeStd: 1.2,
      dim: { l: 12, w: 10, h: 8 },
      weatherSensitivity: 0.65,
      rainfallSensitivity: 0.2,
      holidayLift: 0.3,
      trend: 0.007,
    },
    {
      id: "SKU-5300",
      name: "Bulk Mineral Water Case",
      channel: "B2B",
      criticality: "C",
      supplierId: "SUP-C",
      onHand: 920,
      inboundQty: 600,
      inboundEveryDays: 14,
      nextInboundInDays: 7,
      leadTimeMean: 8,
      leadTimeStd: 1.5,
      dim: { l: 42, w: 28, h: 26 },
      weatherSensitivity: 0.2,
      rainfallSensitivity: 0.05,
      holidayLift: 0.02,
      trend: 0.001,
    },
    {
      id: "SKU-6122",
      name: "Coconut Hydration 330ml",
      channel: "B2C",
      criticality: "A",
      supplierId: "SUP-B",
      onHand: 160,
      inboundQty: 140,
      inboundEveryDays: 6,
      nextInboundInDays: 3,
      leadTimeMean: 9,
      leadTimeStd: 3,
      dim: { l: 22, w: 14, h: 18 },
      weatherSensitivity: 1.2,
      rainfallSensitivity: 0.25,
      holidayLift: 0.5,
      trend: 0.02,
    },
  ];

  const historyDays = 60;
  skus.forEach((sku, skuIndex) => {
    const history = [];
    for (let i = historyDays; i >= 1; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const weekday = date.getDay();
      const base = sku.channel === "B2C" ? 44 : 78;
      const weekendLift = sku.channel === "B2C" && (weekday === 0 || weekday === 6) ? 1.22 : 1;
      const step = 1 + (historyDays - i) * sku.trend;
      const wave = 1 + Math.sin((i + skuIndex * 4) / 7) * 0.12;
      const qty = Math.max(1, Math.round(base * weekendLift * step * wave));
      history.push({ date: date.toISOString().slice(0, 10), qty });
    }
    sku.history = history;
  });

  return {
    today,
    settings: {
      role: "executive",
      temperatureDelta: 2,
      rainfallIndex: 0.3,
      holiday: false,
      promoIntensity: 1.1,
      horizon: 14,
      selectedSku: "SKU-1042",
    },
    suppliers,
    skus,
    warehouse: {
      capacity: {
        bulk: 25,
        pick: 12,
        returns: 4.2,
        staging: 3.8,
      },
      threshold: {
        yellow: 80,
        red: 90,
        critical: 95,
      },
    },
    cases: [],
    audit: [
      {
        id: "A-1",
        at: today,
        actor: "System",
        action: "SynchroTower initialized with MVP data integration set",
      },
    ],
    lastCaseId: 3000,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = defaultState();
      saveState(seed);
      return seed;
    }
    return JSON.parse(raw);
  } catch (error) {
    const seed = defaultState();
    saveState(seed);
    return seed;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addAudit(state, actor, action) {
  const id = `A-${state.audit.length + 1}`;
  state.audit.unshift({ id, at: isoDay(state.today), actor, action });
  state.audit = state.audit.slice(0, 40);
}

function channelServiceZ(channel) {
  return channel === "B2C" ? 2.33 : 1.65;
}

function criticalityBoost(level) {
  if (level === "A") return 0.25;
  if (level === "B") return 0.12;
  return 0;
}

function getSupplier(state, supplierId) {
  return state.suppliers.find((supplier) => supplier.id === supplierId);
}

function forecastSku(state, sku, horizon = 14) {
  const recent = sku.history.slice(-14).map((point) => point.qty);
  const base = movingAverage(recent, recent.length) || 1;
  const sigma = Math.max(stdDev(recent), base * 0.12);
  const supplier = getSupplier(state, sku.supplierId);
  const reliability = supplier ? supplier.reliability : 0.9;

  const extFactor =
    1 +
    state.settings.temperatureDelta * sku.weatherSensitivity * 0.04 -
    state.settings.rainfallIndex * sku.rainfallSensitivity * 0.06 +
    (state.settings.holiday ? sku.holidayLift : 0) +
    (state.settings.promoIntensity - 1) * (sku.channel === "B2C" ? 0.7 : 0.25);

  const demandSeries = [];
  let inventory = sku.onHand;
  let stockoutDay = null;

  for (let i = 0; i < horizon; i += 1) {
    const dateText = isoDay(state.today, i + 1);
    const weekday = new Date(dateText).getDay();
    const dowFactor = sku.channel === "B2C" && (weekday === 5 || weekday === 6 || weekday === 0) ? 1.18 : 1;
    const shortWave = 1 + Math.sin((i + base) / 2.8) * 0.06;
    const demand = Math.max(1, Math.round(base * extFactor * dowFactor * shortWave));
    const lower = Math.max(0, Math.round(demand - sigma * 1.1));
    const upper = Math.round(demand + sigma * 1.1);

    if ((i + 1) === sku.nextInboundInDays || ((i + 1) > sku.nextInboundInDays && (i + 1 - sku.nextInboundInDays) % sku.inboundEveryDays === 0)) {
      inventory += sku.inboundQty;
    }

    inventory -= demand;

    demandSeries.push({
      day: i + 1,
      date: dateText,
      forecast: demand,
      lower,
      upper,
      projectedInventory: Math.max(0, Math.round(inventory)),
    });
  }

  const modeledMape = clamp(7 + (sigma / base) * 24 + (state.settings.holiday ? 2 : 0), 6, 28);
  const leadTimeBase = sku.leadTimeMean + sku.leadTimeStd * (reliability < 0.9 ? 1.5 : 1);
  let z = channelServiceZ(sku.channel) + criticalityBoost(sku.criticality);
  if (modeledMape > 15) z *= 1.1;
  const sigmaLt = Math.max(2, sigma * 0.9);
  const safetyStock = Math.round(z * sigmaLt * Math.sqrt(leadTimeBase));

  for (let i = 0; i < demandSeries.length; i += 1) {
    if (demandSeries[i].projectedInventory < safetyStock) {
      stockoutDay = i + 1;
      break;
    }
  }

  return {
    skuId: sku.id,
    skuName: sku.name,
    channel: sku.channel,
    demandSeries,
    baseDemand: base,
    sigma,
    mape: modeledMape,
    safetyStock,
    leadTimeEffective: leadTimeBase,
    reliability,
    stockoutDay,
  };
}

function computeCapacity(state, skuForecastMap, horizon = 14) {
  const days = [];
  const cap = state.warehouse.capacity;

  for (let i = 0; i < horizon; i += 1) {
    let bulk = 0;
    let pick = 0;
    let returns = 0;
    let staging = 0;

    state.skus.forEach((sku) => {
      const forecast = skuForecastMap[sku.id];
      const row = forecast.demandSeries[i];
      const packVolume = (sku.dim.l * sku.dim.w * sku.dim.h) / 1000000;
      const inv = row.projectedInventory;
      const demand = row.forecast;

      bulk += (sku.channel === "B2B" ? inv * 0.00009 : inv * 0.00004) * packVolume * 100;
      pick += (sku.channel === "B2C" ? inv * 0.00008 : inv * 0.00003) * packVolume * 100;
      returns += demand * (sku.channel === "B2C" ? 0.00042 : 0.00008) * packVolume * 100;
      staging += demand * 0.00025 * packVolume * 100;
    });

    const utilBulk = (bulk / cap.bulk) * 100;
    const utilPick = (pick / cap.pick) * 100;
    const utilReturns = (returns / cap.returns) * 100;
    const utilStaging = (staging / cap.staging) * 100;

    days.push({
      day: i + 1,
      date: isoDay(state.today, i + 1),
      zones: {
        bulk,
        pick,
        returns,
        staging,
      },
      util: {
        bulk: utilBulk,
        pick: utilPick,
        returns: utilReturns,
        staging: utilStaging,
      },
      topUtil: Math.max(utilBulk, utilPick, utilReturns, utilStaging),
    });
  }

  return days;
}

function detectExceptions(state, skuForecastMap, capacitySeries) {
  const alerts = [];

  Object.values(skuForecastMap).forEach((forecast) => {
    if (forecast.stockoutDay && forecast.stockoutDay <= 7) {
      alerts.push({
        type: "Stockout",
        severity: forecast.stockoutDay <= 3 ? "Critical" : "High",
        entity: forecast.skuId,
        title: `${forecast.skuId} below dynamic safety stock by Day ${forecast.stockoutDay}`,
        rootCause: "Demand spike + channel service level target + supplier lead time buffer",
        owner: "Procurement",
      });
    }

    if (forecast.reliability < 0.88) {
      alerts.push({
        type: "Inbound Delay",
        severity: forecast.reliability < 0.85 ? "High" : "Medium",
        entity: forecast.skuId,
        title: `${forecast.skuId} supplier reliability at ${(forecast.reliability * 100).toFixed(1)}%`,
        rootCause: "Lead time variance > threshold over rolling window",
        owner: "Procurement",
      });
    }
  });

  capacitySeries.forEach((day) => {
    if (day.topUtil >= state.warehouse.threshold.red) {
      alerts.push({
        type: "Space",
        severity: day.topUtil >= state.warehouse.threshold.critical ? "Critical" : "High",
        entity: fmtDate(day.date),
        title: `Warehouse utilization ${day.topUtil.toFixed(1)}% on ${fmtDate(day.date)}`,
        rootCause: "Mixed piece-pick + returns pressure + staging overlap",
        owner: "Warehouse",
      });
    } else if (day.util.returns >= state.warehouse.threshold.yellow) {
      alerts.push({
        type: "Putaway",
        severity: "Medium",
        entity: fmtDate(day.date),
        title: `Returns zone reaching ${day.util.returns.toFixed(1)}% utilization`,
        rootCause: "B2C return rate and quarantine backlog",
        owner: "Warehouse",
      });
    }
  });

  return alerts.slice(0, 24);
}

function exceptionSignature(alert) {
  return `${alert.type}|${alert.entity}|${alert.title}`;
}

function buildActions(alert) {
  if (alert.type === "Stockout") {
    return [
      { owner: "Procurement", task: "Issue emergency PO uplift", dueInHours: 2 },
      { owner: "Production", task: "Bring forward production slot", dueInHours: 4 },
      { owner: "Warehouse", task: "Pre-stage B2C pick faces", dueInHours: 6 },
    ];
  }
  if (alert.type === "Space") {
    return [
      { owner: "Warehouse", task: "Activate overflow and re-slot fast movers", dueInHours: 2 },
      { owner: "Production", task: "Sequence bulky SKUs outside peak window", dueInHours: 8 },
      { owner: "Procurement", task: "Shift inbound appointment windows", dueInHours: 12 },
    ];
  }
  if (alert.type === "Inbound Delay") {
    return [
      { owner: "Procurement", task: "Expedite at-risk supplier lanes", dueInHours: 4 },
      { owner: "Executive", task: "Approve air freight exception if needed", dueInHours: 6 },
      { owner: "Production", task: "Use substitute SKU run where possible", dueInHours: 10 },
    ];
  }
  return [
    { owner: alert.owner, task: "Review and assign immediate action", dueInHours: 2 },
    { owner: "Warehouse", task: "Update workflow case notes and evidence", dueInHours: 6 },
  ];
}

function syncCasesFromAlerts(state, alerts) {
  const existingOpenSignatures = new Set(
    state.cases
      .filter((entry) => entry.status !== "Closed" && entry.status !== "Rejected")
      .map((entry) => entry.signature)
  );

  let created = 0;

  alerts.forEach((alert) => {
    const signature = exceptionSignature(alert);
    if (existingOpenSignatures.has(signature)) return;

    state.lastCaseId += 1;
    const caseId = `ST-${state.lastCaseId}`;
    const createdAt = isoDay(state.today);
    const actions = buildActions(alert).map((action, index) => ({
      id: `${caseId}-A${index + 1}`,
      ...action,
      done: false,
    }));

    state.cases.unshift({
      id: caseId,
      signature,
      createdAt,
      status: "Open",
      severity: alert.severity,
      type: alert.type,
      entity: alert.entity,
      title: alert.title,
      rootCause: alert.rootCause,
      owner: roleOwner(alert.type),
      actions,
      approval: null,
      notes: "Auto-generated by rule-based RCA timeline.",
      expectedImpact: {
        stockoutReduction: alert.type === "Stockout" ? 28 : 8,
        leadTimeReduction: alert.type === "Inbound Delay" ? 35 : 18,
        spaceGain: alert.type === "Space" ? 17 : 6,
      },
    });

    existingOpenSignatures.add(signature);
    created += 1;
  });

  if (created > 0) {
    addAudit(state, "System", `${created} coordinated recommendation case(s) generated`);
  }
}

function setCaseStatus(state, caseId, status, actor) {
  const target = state.cases.find((entry) => entry.id === caseId);
  if (!target) return;
  target.status = status;
  if (status === "Approved") {
    target.approval = { by: actor, at: isoDay(state.today) };
  }
  addAudit(state, actor, `${caseId} moved to ${status}`);
  saveState(state);
}

function toggleActionDone(state, caseId, actionId, actor) {
  const target = state.cases.find((entry) => entry.id === caseId);
  if (!target) return;
  const action = target.actions.find((entry) => entry.id === actionId);
  if (!action) return;
  action.done = !action.done;

  const doneCount = target.actions.filter((entry) => entry.done).length;
  if (doneCount === target.actions.length && target.status === "Approved") {
    target.status = "Closed";
    addAudit(state, actor, `${caseId} closed after all actions completed`);
  } else if (doneCount > 0 && target.status === "Approved") {
    target.status = "In Progress";
    addAudit(state, actor, `${caseId} action progress updated (${doneCount}/${target.actions.length})`);
  }

  saveState(state);
}

function simulateDay(state) {
  const horizon = 7;
  const skuForecastMap = {};
  state.skus.forEach((sku) => {
    skuForecastMap[sku.id] = forecastSku(state, sku, horizon);
  });

  state.skus.forEach((sku) => {
    const forecastRow = skuForecastMap[sku.id].demandSeries[0];
    const noise = clamp(1 + (Math.random() - 0.5) * 0.22, 0.82, 1.2);
    const actual = Math.max(1, Math.round(forecastRow.forecast * noise));

    sku.onHand -= actual;
    if (sku.nextInboundInDays === 1) {
      sku.onHand += sku.inboundQty;
      sku.nextInboundInDays = sku.inboundEveryDays;
    } else {
      sku.nextInboundInDays -= 1;
    }

    sku.onHand = Math.max(0, sku.onHand);
    sku.history.push({ date: isoDay(state.today, 1), qty: actual });
    sku.history = sku.history.slice(-90);
  });

  state.today = isoDay(state.today, 1);
  addAudit(state, "System", "Simulation advanced by one day with refreshed demand and inventory");
  saveState(state);
}

function computeModel(state) {
  const horizon = state.settings.horizon || 14;
  const skuForecastMap = {};
  state.skus.forEach((sku) => {
    skuForecastMap[sku.id] = forecastSku(state, sku, horizon);
  });

  const capacitySeries = computeCapacity(state, skuForecastMap, horizon);
  const alerts = detectExceptions(state, skuForecastMap, capacitySeries);
  syncCasesFromAlerts(state, alerts);

  const b2c = state.skus.filter((sku) => sku.channel === "B2C");
  const b2b = state.skus.filter((sku) => sku.channel === "B2B");

  const stockoutSkuCount = Object.values(skuForecastMap).filter((entry) => entry.stockoutDay && entry.stockoutDay <= 7).length;
  const stockoutRate = (stockoutSkuCount / state.skus.length) * 100;

  const totalForecastDemand = Object.values(skuForecastMap)
    .flatMap((entry) => entry.demandSeries)
    .reduce((sum, row) => sum + row.forecast, 0);
  const avgInventory = state.skus.reduce((sum, sku) => sum + sku.onHand, 0) / state.skus.length;
  const inventoryTurnover = avgInventory > 0 ? (totalForecastDemand * (365 / horizon)) / avgInventory : 0;

  const avgTopUtil =
    capacitySeries.reduce((sum, day) => sum + day.topUtil, 0) / Math.max(1, capacitySeries.length);

  const openCases = state.cases.filter((entry) => !["Closed", "Rejected"].includes(entry.status));
  const approvedRate =
    state.cases.length > 0
      ? (state.cases.filter((entry) => entry.status === "Approved" || entry.status === "In Progress" || entry.status === "Closed").length / state.cases.length) * 100
      : 0;

  const serviceLevelB2C = clamp(99 - stockoutRate * 0.7, 92, 99.6);
  const serviceLevelB2B = clamp(97 - stockoutRate * 0.3, 93, 98.8);

  return {
    horizon,
    skuForecastMap,
    capacitySeries,
    alerts,
    kpis: {
      stockoutRate,
      inventoryTurnover,
      avgTopUtil,
      openCases: openCases.length,
      approvedRate,
      serviceLevelB2C,
      serviceLevelB2B,
      b2cSkuCount: b2c.length,
      b2bSkuCount: b2b.length,
    },
  };
}

function activeRole(state) {
  return ROLE_LABELS[state.settings.role] || "Executive";
}

function severityClass(severity) {
  if (severity === "Critical") return "danger";
  if (severity === "High") return "warn";
  return "good";
}

function topbar(activePage, state) {
  return `
    <header class="topbar rise">
      <div class="brand">
        <div class="brand-mark">ST</div>
        <div>
          <div style="font-size:15px;">SynchroTower</div>
          <div style="font-size:12px;color:var(--ink-soft);">AI Central Control Tower</div>
        </div>
      </div>
      <nav class="nav-links">
        <a class="nav-link ${activePage === "index" ? "active" : ""}" href="index.html">Control Tower</a>
        <a class="nav-link ${activePage === "forecast" ? "active" : ""}" href="forecast.html">Forecast Engine</a>
        <a class="nav-link ${activePage === "capacity" ? "active" : ""}" href="capacity.html">Capacity Planner</a>
        <a class="nav-link ${activePage === "recommendation" ? "active" : ""}" href="recommendation.html">Case Workflow</a>
      </nav>
      <div class="role-pill">Role: ${activeRole(state)}</div>
    </header>
  `;
}

function roleControls(state) {
  return `
    <div class="control">
      <label>Role-based lens</label>
      <select id="roleSelect">
        ${Object.entries(ROLE_LABELS)
          .map(([value, label]) => `<option value="${value}" ${state.settings.role === value ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    </div>
    <div class="control">
      <label>Temperature delta (degree C)</label>
      <input id="temperatureDelta" type="range" min="-2" max="6" step="1" value="${state.settings.temperatureDelta}">
      <div style="font-size:12px;color:var(--ink-soft);">Current: ${state.settings.temperatureDelta} degree C</div>
    </div>
    <div class="control">
      <label>Rainfall index</label>
      <input id="rainfallIndex" type="range" min="0" max="1" step="0.05" value="${state.settings.rainfallIndex}">
      <div style="font-size:12px;color:var(--ink-soft);">Current: ${state.settings.rainfallIndex.toFixed(2)}</div>
    </div>
    <div class="control">
      <label>Promotion intensity</label>
      <input id="promoIntensity" type="range" min="1" max="2" step="0.05" value="${state.settings.promoIntensity}">
      <div style="font-size:12px;color:var(--ink-soft);">Current: ${state.settings.promoIntensity.toFixed(2)}x</div>
    </div>
    <div class="control">
      <label>Public holiday effect</label>
      <select id="holidayFlag">
        <option value="0" ${state.settings.holiday ? "" : "selected"}>No</option>
        <option value="1" ${state.settings.holiday ? "selected" : ""}>Yes</option>
      </select>
    </div>
    <div class="row">
      <button id="applyScenario" class="primary">Apply Scenario</button>
      <button id="syncOpenData" class="ghost">Sync Open Data</button>
      <button id="simulateDay" class="ghost">Simulate +1 day</button>
      <button id="resetData" class="ghost">Reset Demo Data</button>
    </div>
  `;
}

async function syncOpenDataSignals(state) {
  const updates = [];

  try {
    const weatherResponse = await fetch("https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en");
    if (weatherResponse.ok) {
      const weather = await weatherResponse.json();
      const temp = weather && weather.temperature && Array.isArray(weather.temperature.data)
        ? weather.temperature.data[0] && weather.temperature.data[0].value
        : null;
      if (typeof temp === "number") {
        const delta = clamp(Math.round(temp - 28), -2, 6);
        state.settings.temperatureDelta = delta;
        updates.push(`weather delta set to ${delta} from HKO feed`);
      }
    }
  } catch (error) {
    updates.push("weather feed unavailable, kept current scenario value");
  }

  try {
    const year = new Date(state.today).getFullYear();
    const holidaysResponse = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/HK`);
    if (holidaysResponse.ok) {
      const holidays = await holidaysResponse.json();
      const now = new Date(state.today);
      const inNextThreeDays = holidays.some((holiday) => {
        const date = new Date(holiday.date);
        const diff = (date.getTime() - now.getTime()) / DAY_MS;
        return diff >= 0 && diff <= 3;
      });
      state.settings.holiday = inNextThreeDays;
      updates.push(`holiday flag ${inNextThreeDays ? "enabled" : "disabled"} from HK public calendar`);
    }
  } catch (error) {
    updates.push("holiday feed unavailable, kept current scenario value");
  }

  if (!updates.length) {
    updates.push("no external updates available");
  }

  addAudit(state, "System", `Open data sync: ${updates.join("; ")}`);
  saveState(state);
}

function attachGlobalControls(state) {
  const roleSelect = document.getElementById("roleSelect");
  const temp = document.getElementById("temperatureDelta");
  const rain = document.getElementById("rainfallIndex");
  const promo = document.getElementById("promoIntensity");
  const holiday = document.getElementById("holidayFlag");

  if (!roleSelect || !temp || !rain || !promo || !holiday) return;

  document.getElementById("applyScenario").addEventListener("click", () => {
    state.settings.role = roleSelect.value;
    state.settings.temperatureDelta = Number(temp.value);
    state.settings.rainfallIndex = Number(rain.value);
    state.settings.promoIntensity = Number(promo.value);
    state.settings.holiday = holiday.value === "1";
    addAudit(state, "Analyst", "Scenario controls updated");
    saveState(state);
    window.location.reload();
  });

  document.getElementById("simulateDay").addEventListener("click", () => {
    simulateDay(state);
    window.location.reload();
  });

  const syncOpenDataBtn = document.getElementById("syncOpenData");
  if (syncOpenDataBtn) {
    syncOpenDataBtn.addEventListener("click", async () => {
      syncOpenDataBtn.disabled = true;
      syncOpenDataBtn.textContent = "Syncing...";
      await syncOpenDataSignals(state);
      window.location.reload();
    });
  }

  document.getElementById("resetData").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

function renderIndex(state, model) {
  const focus = ROLE_FOCUS[state.settings.role] || ROLE_FOCUS.executive;
  const roleAlerts = model.alerts.filter((alert) => focus.includes(alert.type));

  const app = document.getElementById("app");
  app.innerHTML = `
    ${topbar("index", state)}
    <section class="hero rise">
      <h1>Operational truth, shared in real time</h1>
      <p>Unified procurement, production, warehouse and shipping intelligence with dynamic safety stock, space forecasting, rule-based RCA, and auditable cross-functional actions.</p>
    </section>

    <section class="grid rise">
      <article class="card kpi-card"><div class="kpi-label">B2C Service Level</div><div class="kpi-value">${fmtPct(model.kpis.serviceLevelB2C)}</div><div class="kpi-change good">Target: 99%</div></article>
      <article class="card kpi-card"><div class="kpi-label">Stockout Risk Rate</div><div class="kpi-value">${fmtPct(model.kpis.stockoutRate)}</div><div class="kpi-change ${model.kpis.stockoutRate > 25 ? "danger" : "warn"}">7-day horizon</div></article>
      <article class="card kpi-card"><div class="kpi-label">Inventory Turnover</div><div class="kpi-value">${model.kpis.inventoryTurnover.toFixed(1)}x</div><div class="kpi-change good">Goal: 8.0x+</div></article>
      <article class="card kpi-card"><div class="kpi-label">Open Cases</div><div class="kpi-value">${model.kpis.openCases}</div><div class="kpi-change warn">Approval rate ${fmtPct(model.kpis.approvedRate)}</div></article>

      <article class="card" style="grid-column: span 8;">
        <div class="panel-title">
          <h3>Exception Radar</h3>
          <span class="badge">${focus.join(" | ")}</span>
        </div>
        <div class="list">
          ${roleAlerts.slice(0, 8).map((alert) => `
            <div class="list-item">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
                <strong>${alert.title}</strong>
                <span class="${severityClass(alert.severity)}">${alert.severity}</span>
              </div>
              <div style="font-size:12px;color:var(--ink-soft);margin-top:4px;">RCA: ${alert.rootCause}</div>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="card" style="grid-column: span 4;">
        <div class="panel-title">
          <h3>Scenario Controls</h3>
          <span class="badge">Live</span>
        </div>
        <div class="controls">
          ${roleControls(state)}
        </div>
      </article>

      <article class="card" style="grid-column: span 7;">
        <div class="panel-title">
          <h3>Coordinated Case Queue</h3>
          <span class="badge">Workflow</span>
        </div>
        <table class="table">
          <thead>
            <tr><th>Case</th><th>Type</th><th>Owner</th><th>Status</th><th>Severity</th></tr>
          </thead>
          <tbody>
            ${state.cases.slice(0, 8).map((entry) => `
              <tr>
                <td>${entry.id}</td>
                <td>${entry.type}</td>
                <td>${entry.owner}</td>
                <td>${entry.status}</td>
                <td class="${severityClass(entry.severity)}">${entry.severity}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>

      <article class="card" style="grid-column: span 5;">
        <div class="panel-title">
          <h3>Audit Trail</h3>
          <span class="badge">Immutable-style log</span>
        </div>
        <div class="list">
          ${state.audit.slice(0, 9).map((entry) => `
            <div class="list-item">
              <div style="font-size:12px;color:var(--ink-soft);">${entry.at} • ${entry.actor}</div>
              <div style="margin-top:2px;">${entry.action}</div>
            </div>
          `).join("")}
        </div>
      </article>
    </section>

    <div class="footer-note">Data middle platform mode: Sponsor sample + synthetic event stream + configurable weather and holiday effects. Emergency fallback workflow included in Case Workflow page.</div>
  `;

  attachGlobalControls(state);
}

function drawForecastChart(canvas, series, safetyStock) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const left = 44;
  const right = 12;
  const top = 14;
  const bottom = 30;

  const maxY = Math.max(
    safetyStock,
    ...series.map((row) => row.upper),
    ...series.map((row) => row.projectedInventory)
  ) * 1.1;

  const x = (index) => left + (index / (series.length - 1 || 1)) * (width - left - right);
  const y = (value) => top + (1 - value / maxY) * (height - top - bottom);

  ctx.strokeStyle = "#eadfcd";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const yy = top + (i / 4) * (height - top - bottom);
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(width - right, yy);
    ctx.stroke();
  }

  ctx.strokeStyle = "#f59e0b";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(left, y(safetyStock));
  ctx.lineTo(width - right, y(safetyStock));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(217,119,6,0.16)";
  ctx.beginPath();
  series.forEach((row, index) => {
    const px = x(index);
    const py = y(row.upper);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const row = series[i];
    ctx.lineTo(x(i), y(row.lower));
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  series.forEach((row, index) => {
    const px = x(index);
    const py = y(row.forecast);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.strokeStyle = "#1f2933";
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((row, index) => {
    const px = x(index);
    const py = y(row.projectedInventory);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.fillStyle = "#566270";
  ctx.font = "12px Public Sans";
  ctx.fillText("Day 1", left, height - 8);
  ctx.fillText(`Day ${series.length}`, width - right - 52, height - 8);
  ctx.fillText("Forecast", left + 4, top + 12);
  ctx.fillText("Inventory", left + 70, top + 12);
  ctx.fillText("Safety Stock", width - 100, y(safetyStock) - 6);
}

function renderForecast(state, model) {
  const selected = state.settings.selectedSku || state.skus[0].id;
  const selectedSku = state.skus.find((sku) => sku.id === selected) || state.skus[0];
  const detail = model.skuForecastMap[selectedSku.id];

  const app = document.getElementById("app");
  app.innerHTML = `
    ${topbar("forecast", state)}
    <section class="hero rise">
      <h1>Demand forecast + dynamic safety stock</h1>
      <p>Forecast engine blends seasonality, weather delta, holiday effect, and promotion intensity. Safety stock recalculates using channel-specific service levels and lead-time variability.</p>
    </section>

    <section class="grid rise">
      <article class="card" style="grid-column: span 4;">
        <div class="panel-title"><h3>Forecast Controls</h3><span class="badge">Interactive</span></div>
        <div class="controls">
          <div class="control">
            <label>SKU</label>
            <select id="skuSelect">
              ${state.skus.map((sku) => `<option value="${sku.id}" ${sku.id === selectedSku.id ? "selected" : ""}>${sku.id} • ${sku.name}</option>`).join("")}
            </select>
          </div>
          <div class="control">
            <label>Horizon (days)</label>
            <select id="horizonSelect">
              <option value="7" ${model.horizon === 7 ? "selected" : ""}>7</option>
              <option value="14" ${model.horizon === 14 ? "selected" : ""}>14</option>
              <option value="30" ${model.horizon === 30 ? "selected" : ""}>30</option>
            </select>
          </div>
          ${roleControls(state)}
        </div>
      </article>

      <article class="card" style="grid-column: span 8;">
        <div class="panel-title"><h3>${selectedSku.id} forecast outlook</h3><span class="badge">Channel ${selectedSku.channel}</span></div>
        <div class="canvas-wrap">
          <canvas id="forecastCanvas" width="900" height="340" style="width:100%;height:340px;"></canvas>
        </div>
        <div class="row" style="margin-top:10px; font-size:13px; color:var(--ink-soft);">
          <span>MAPE: <strong>${detail.mape.toFixed(1)}%</strong></span>
          <span>Lead time effective: <strong>${detail.leadTimeEffective.toFixed(1)} days</strong></span>
          <span>Safety stock: <strong>${fmtNum(detail.safetyStock)}</strong></span>
          <span>Stockout risk day: <strong>${detail.stockoutDay ? detail.stockoutDay : "None in horizon"}</strong></span>
        </div>
      </article>

      <article class="card" style="grid-column: span 12;">
        <div class="panel-title"><h3>Daily projection</h3><span class="badge">7-30 day rolling</span></div>
        <table class="table">
          <thead><tr><th>Date</th><th>Forecast</th><th>Low</th><th>High</th><th>Projected Inventory</th></tr></thead>
          <tbody>
            ${detail.demandSeries.map((row) => `
              <tr>
                <td>${fmtDate(row.date)}</td>
                <td>${fmtNum(row.forecast)}</td>
                <td>${fmtNum(row.lower)}</td>
                <td>${fmtNum(row.upper)}</td>
                <td class="${row.projectedInventory < detail.safetyStock ? "danger" : "good"}">${fmtNum(row.projectedInventory)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    </section>
  `;

  drawForecastChart(document.getElementById("forecastCanvas"), detail.demandSeries, detail.safetyStock);

  const skuSelect = document.getElementById("skuSelect");
  const horizonSelect = document.getElementById("horizonSelect");

  skuSelect.addEventListener("change", () => {
    state.settings.selectedSku = skuSelect.value;
    saveState(state);
    window.location.reload();
  });

  horizonSelect.addEventListener("change", () => {
    state.settings.horizon = Number(horizonSelect.value);
    saveState(state);
    window.location.reload();
  });

  attachGlobalControls(state);
}

function drawCapacityBars(container, series, thresholds) {
  container.innerHTML = "";
  const maxUtil = Math.max(100, ...series.map((day) => day.topUtil));

  const zoneColor = {
    bulk: "#3f3f46",
    pick: "#d97706",
    returns: "#f59e0b",
    staging: "#fbbf24",
  };

  series.forEach((day) => {
    const totalHeight = 220;
    const bar = document.createElement("div");
    bar.style.flex = "1";
    bar.style.display = "flex";
    bar.style.flexDirection = "column";
    bar.style.alignItems = "center";
    bar.style.gap = "6px";

    const stack = document.createElement("div");
    stack.style.height = `${totalHeight}px`;
    stack.style.width = "30px";
    stack.style.border = "1px solid var(--line)";
    stack.style.borderRadius = "7px";
    stack.style.overflow = "hidden";
    stack.style.display = "flex";
    stack.style.flexDirection = "column-reverse";
    stack.style.background = "#fff";

    ["bulk", "pick", "returns", "staging"].forEach((zone) => {
      const seg = document.createElement("div");
      const h = (day.util[zone] / maxUtil) * totalHeight;
      seg.style.height = `${Math.max(2, h)}px`;
      seg.style.background = zoneColor[zone];
      seg.title = `${zone}: ${day.util[zone].toFixed(1)}%`;
      stack.appendChild(seg);
    });

    const date = document.createElement("div");
    date.style.fontSize = "11px";
    date.style.color = "var(--ink-soft)";
    date.textContent = day.day;

    const top = document.createElement("div");
    top.style.fontSize = "11px";
    top.className = day.topUtil >= thresholds.red ? "danger" : day.topUtil >= thresholds.yellow ? "warn" : "good";
    top.textContent = `${day.topUtil.toFixed(0)}%`;

    bar.appendChild(stack);
    bar.appendChild(top);
    bar.appendChild(date);
    container.appendChild(bar);
  });
}

function renderCapacity(state, model) {
  const latest = model.capacitySeries[0];
  const maxDay = [...model.capacitySeries].sort((a, b) => b.topUtil - a.topUtil)[0];

  const app = document.getElementById("app");
  app.innerHTML = `
    ${topbar("capacity", state)}
    <section class="hero rise">
      <h1>14-day warehouse capacity forecast</h1>
      <p>Zone-level volume projections for bulk, piece-pick, returns, and staging. Yellow and red thresholds trigger re-slotting and emergency overflow workflows.</p>
    </section>

    <section class="grid rise">
      <article class="card" style="grid-column: span 4;">
        <div class="panel-title"><h3>Current Snapshot</h3><span class="badge">Today ${fmtDate(model.capacitySeries[0].date)}</span></div>
        <div class="list">
          <div class="list-item">Bulk utilization: <strong>${fmtPct(latest.util.bulk)}</strong></div>
          <div class="list-item">Piece-pick utilization: <strong>${fmtPct(latest.util.pick)}</strong></div>
          <div class="list-item">Returns utilization: <strong>${fmtPct(latest.util.returns)}</strong></div>
          <div class="list-item">Staging utilization: <strong>${fmtPct(latest.util.staging)}</strong></div>
          <div class="list-item ${maxDay.topUtil >= state.warehouse.threshold.red ? "danger" : "warn"}">Peak day: <strong>${fmtDate(maxDay.date)} at ${fmtPct(maxDay.topUtil)}</strong></div>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--ink-soft);">Thresholds: Yellow ${state.warehouse.threshold.yellow}% | Red ${state.warehouse.threshold.red}% | Critical ${state.warehouse.threshold.critical}%</div>
      </article>

      <article class="card" style="grid-column: span 8;">
        <div class="panel-title"><h3>Stacked zone utilization by day</h3><span class="badge">Day 1 to ${model.horizon}</span></div>
        <div id="capacityBars" style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding:8px;border:1px solid var(--line);border-radius:12px;background:#fff;"></div>
        <div class="row" style="font-size:12px;color:var(--ink-soft);margin-top:8px;">
          <span><strong style="color:#3f3f46;">Bulk</strong></span>
          <span><strong style="color:#d97706;">Pick</strong></span>
          <span><strong style="color:#f59e0b;">Returns</strong></span>
          <span><strong style="color:#fbbf24;">Staging</strong></span>
        </div>
      </article>

      <article class="card" style="grid-column: span 6;">
        <div class="panel-title"><h3>Auto Slotting Recommendations</h3><span class="badge">Phase 1 logic</span></div>
        <div class="list">
          <div class="list-item">Move top 10 B2C A-items to near-pack aisles when piece-pick exceeds 80%.</div>
          <div class="list-item">Open overflow bay when projected top utilization exceeds 90% in next 72h.</div>
          <div class="list-item">Cross-dock ultra-fast SKUs when same-day cutoff risk appears.</div>
          <div class="list-item">Increase returns quarantine team when returns zone exceeds 75% for 2 days.</div>
        </div>
      </article>

      <article class="card" style="grid-column: span 6;">
        <div class="panel-title"><h3>Scenario Controls</h3><span class="badge">Live</span></div>
        <div class="controls">${roleControls(state)}</div>
      </article>

      <article class="card" style="grid-column: span 12;">
        <div class="panel-title"><h3>Capacity Table</h3><span class="badge">Auditable</span></div>
        <table class="table">
          <thead><tr><th>Date</th><th>Bulk</th><th>Pick</th><th>Returns</th><th>Staging</th><th>Max Utilization</th></tr></thead>
          <tbody>
            ${model.capacitySeries.map((day) => `
              <tr>
                <td>${fmtDate(day.date)}</td>
                <td>${fmtPct(day.util.bulk)}</td>
                <td>${fmtPct(day.util.pick)}</td>
                <td>${fmtPct(day.util.returns)}</td>
                <td>${fmtPct(day.util.staging)}</td>
                <td class="${day.topUtil >= state.warehouse.threshold.red ? "danger" : day.topUtil >= state.warehouse.threshold.yellow ? "warn" : "good"}">${fmtPct(day.topUtil)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    </section>
  `;

  drawCapacityBars(document.getElementById("capacityBars"), model.capacitySeries, state.warehouse.threshold);
  attachGlobalControls(state);
}

function renderRecommendation(state, model) {
  const filteredCases = [...state.cases];
  const selectedId = new URLSearchParams(window.location.search).get("case") || (filteredCases[0] && filteredCases[0].id);
  const selectedCase = filteredCases.find((entry) => entry.id === selectedId) || filteredCases[0];

  const app = document.getElementById("app");
  app.innerHTML = `
    ${topbar("recommendation", state)}
    <section class="hero rise">
      <h1>Coordinated recommendation workflow</h1>
      <p>Every exception becomes a case with RCA hypothesis, owner-specific actions, approvals, due-time targets, and an auditable lifecycle from detection to closure.</p>
    </section>

    <section class="grid rise">
      <article class="card" style="grid-column: span 4;">
        <div class="panel-title"><h3>Case Queue</h3><span class="badge">${filteredCases.length} cases</span></div>
        <div class="list" id="caseList">
          ${filteredCases.slice(0, 18).map((entry) => `
            <a class="list-item" href="recommendation.html?case=${entry.id}" style="display:block; ${selectedCase && selectedCase.id === entry.id ? "border-color:#d97706;background:#fff7e8;" : ""}">
              <div style="display:flex;justify-content:space-between;gap:8px;">
                <strong>${entry.id}</strong>
                <span class="${severityClass(entry.severity)}">${entry.severity}</span>
              </div>
              <div style="margin-top:3px;">${entry.type} • ${entry.status}</div>
              <div style="font-size:12px;color:var(--ink-soft);margin-top:4px;">${entry.title}</div>
            </a>
          `).join("")}
        </div>
      </article>

      <article class="card" style="grid-column: span 8;">
        ${selectedCase ? `
          <div class="panel-title"><h3>${selectedCase.id} • ${selectedCase.title}</h3><span class="badge">${selectedCase.status}</span></div>
          <div class="list">
            <div class="list-item"><strong>Root-cause hypothesis</strong><div style="margin-top:4px;color:var(--ink-soft);">${selectedCase.rootCause}</div></div>
            <div class="list-item"><strong>Owner</strong>: ${selectedCase.owner} | <strong>Entity</strong>: ${selectedCase.entity} | <strong>Created</strong>: ${selectedCase.createdAt}</div>
            <div class="list-item"><strong>Expected impact</strong>: Stockout reduction ${selectedCase.expectedImpact.stockoutReduction}% | Lead-time reduction ${selectedCase.expectedImpact.leadTimeReduction}% | Space gain ${selectedCase.expectedImpact.spaceGain}%</div>
          </div>

          <h4 style="margin:14px 0 8px;">Action checklist</h4>
          <div class="list">
            ${selectedCase.actions.map((action) => `
              <label class="list-item" style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">
                <input type="checkbox" data-action-id="${action.id}" ${action.done ? "checked" : ""} style="width:auto;margin-top:3px;">
                <div>
                  <div><strong>${action.task}</strong></div>
                  <div style="font-size:12px;color:var(--ink-soft);">Owner: ${action.owner} • Due in ${action.dueInHours}h</div>
                </div>
              </label>
            `).join("")}
          </div>

          <div class="row" style="margin-top:12px;">
            <button id="approveCase" class="primary">Approve</button>
            <button id="rejectCase" class="ghost">Reject</button>
            <button id="progressCase" class="ghost">Mark In Progress</button>
            <button id="closeCase" class="ghost">Close</button>
          </div>
        ` : `<div>No cases yet. Adjust scenario to trigger exceptions.</div>`}
      </article>

      <article class="card" style="grid-column: span 6;">
        <div class="panel-title"><h3>Manual Emergency Workflow</h3><span class="badge">Fallback</span></div>
        <div class="controls">
          <div class="control">
            <label>Emergency CSV upload (sku,onHand)</label>
            <input id="emergencyUpload" type="file" accept=".csv,text/csv">
          </div>
          <div class="control">
            <label>Emergency title</label>
            <input id="manualTitle" type="text" placeholder="Example: Carrier missed same-day cutoff">
          </div>
          <div class="control">
            <label>Type</label>
            <select id="manualType">
              <option value="Stockout">Stockout</option>
              <option value="Space">Space</option>
              <option value="Inbound Delay">Inbound Delay</option>
              <option value="Putaway">Putaway</option>
            </select>
          </div>
          <div class="control">
            <label>Root cause note</label>
            <textarea id="manualRca" rows="3" placeholder="Describe root cause and mitigation"></textarea>
          </div>
          <button id="createManualCase" class="primary">Create Emergency Case</button>
          <div style="font-size:12px;color:var(--ink-soft);">Supports interim Excel or messaging escalation paths while full ERP/WMS integration is pending.</div>
        </div>
      </article>

      <article class="card" style="grid-column: span 6;">
        <div class="panel-title"><h3>Recent Audit Events</h3><span class="badge">Governance</span></div>
        <div class="list">
          ${state.audit.slice(0, 10).map((entry) => `
            <div class="list-item">
              <div style="font-size:12px;color:var(--ink-soft);">${entry.at} • ${entry.actor}</div>
              <div>${entry.action}</div>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;

  if (selectedCase) {
    const actor = ROLE_LABELS[state.settings.role];

    document.querySelectorAll("input[data-action-id]").forEach((input) => {
      input.addEventListener("change", () => {
        toggleActionDone(state, selectedCase.id, input.getAttribute("data-action-id"), actor);
        window.location.reload();
      });
    });

    document.getElementById("approveCase").addEventListener("click", () => {
      setCaseStatus(state, selectedCase.id, "Approved", actor);
      window.location.reload();
    });

    document.getElementById("rejectCase").addEventListener("click", () => {
      setCaseStatus(state, selectedCase.id, "Rejected", actor);
      window.location.reload();
    });

    document.getElementById("progressCase").addEventListener("click", () => {
      setCaseStatus(state, selectedCase.id, "In Progress", actor);
      window.location.reload();
    });

    document.getElementById("closeCase").addEventListener("click", () => {
      setCaseStatus(state, selectedCase.id, "Closed", actor);
      window.location.reload();
    });
  }

  document.getElementById("createManualCase").addEventListener("click", () => {
    const title = document.getElementById("manualTitle").value.trim();
    const type = document.getElementById("manualType").value;
    const rca = document.getElementById("manualRca").value.trim();

    if (!title || !rca) {
      alert("Please provide both a title and root-cause note.");
      return;
    }

    state.lastCaseId += 1;
    const caseId = `ST-${state.lastCaseId}`;
    const owner = roleOwner(type);
    state.cases.unshift({
      id: caseId,
      signature: `${type}|manual|${title}`,
      createdAt: isoDay(state.today),
      status: "Open",
      severity: "High",
      type,
      entity: "Manual",
      title,
      rootCause: rca,
      owner,
      actions: buildActions({ type, owner }).map((action, index) => ({
        id: `${caseId}-A${index + 1}`,
        ...action,
        done: false,
      })),
      approval: null,
      notes: "Created via emergency fallback workflow.",
      expectedImpact: { stockoutReduction: 15, leadTimeReduction: 20, spaceGain: 10 },
    });

    addAudit(state, ROLE_LABELS[state.settings.role], `${caseId} created manually from emergency workflow`);
    saveState(state);
    window.location.href = `recommendation.html?case=${caseId}`;
  });

  const emergencyUpload = document.getElementById("emergencyUpload");
  emergencyUpload.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      alert("CSV needs at least one data row using columns sku,onHand");
      return;
    }

    let updated = 0;
    lines.slice(1).forEach((line) => {
      const [skuIdRaw, onHandRaw] = line.split(",");
      const skuId = (skuIdRaw || "").trim();
      const onHand = Number((onHandRaw || "").trim());
      const sku = state.skus.find((entry) => entry.id === skuId);
      if (sku && Number.isFinite(onHand)) {
        sku.onHand = Math.max(0, Math.round(onHand));
        updated += 1;
      }
    });

    addAudit(state, "Warehouse", `Emergency CSV uploaded: ${updated} SKU inventory value(s) updated`);
    saveState(state);
    window.location.reload();
  });
}

function run() {
  const page = document.body.dataset.page;
  const state = loadState();
  const model = computeModel(state);
  saveState(state);

  if (page === "forecast") {
    renderForecast(state, model);
  } else if (page === "capacity") {
    renderCapacity(state, model);
  } else if (page === "recommendation") {
    renderRecommendation(state, model);
  } else {
    renderIndex(state, model);
  }
}

run();
