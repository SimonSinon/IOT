const chartInstances = {};
let latestScenario = null;
let safetyChannel = "B2C";

const modules = {
  executive: "Executive Overview",
  procurement: "Procurement",
  warehouse: "Warehouse Manager",
  production: "Production Planner",
  recommendations: "AI Recommendations",
  ai_agent: "AI Agent Ops",
  demand: "Demand Intelligence",
  safety: "Safety Stock",
  sku: "SKU Master"
};

const executive = {
  kpis: [
    ["B2C Service Level", "96.4%", "Target: 99%"],
    ["B2B Service Level", "98.1%", "Target: 95%"],
    ["Inventory Turnover", "9.7x", "Annualized"],
    ["SKUs At Risk", "54", "below safety stock"]
  ],
  demandLabels: ["W-6", "W-5", "W-4", "W-3", "W-2", "W-1", "W+1", "W+2"],
  b2b: [42000, 44000, 43000, 45500, 47000, 46500, 47200, 47800],
  b2c: [28000, 31000, 29500, 33800, 36100, 39000, 41200, 42600],
  exceptions: { labels: ["Stockout", "Inbound Delay", "Space Alert", "Returns"], values: [54, 8, 3, 5] },
  row2: [
    ["Revenue Protected", "$1.24M", "Month-to-date"],
    ["Decision Cycle Time", "4.2h", "vs 48h manual"],
    ["Monthly Throughput", "182K", "B2C share 46%"],
    ["Critical Alerts", "7", "requires action"]
  ],
  risks: [
    { sku: "MA61017F", category: "HK - Disney Snack", coverage: 36.2, risk: "CRITICAL" },
    { sku: "MA61014F", category: "HK - Juice", coverage: 44.1, risk: "HIGH" },
    { sku: "MA66050F", category: "HK - Beverage", coverage: 58.3, risk: "HIGH" },
    { sku: "MA66088F", category: "HK - Haircare", coverage: 72.4, risk: "MEDIUM" }
  ]
};

const procurement = {
  pipeline: [
    { label: "Confirmed", count: 23, sub: "POs" },
    { label: "In Transit", count: 12, sub: "ETA 3.2d" },
    { label: "Delayed", count: 8, sub: ">2 days late" },
    { label: "At Dock", count: 4, sub: "Receiving" },
    { label: "Putaway", count: 7, sub: "Today" }
  ],
  risks: [
    { sku: "MA61017F", coverage: 36.2, days: 2.4, risk: "CRITICAL" },
    { sku: "MA61014F", coverage: 44.1, days: 3.8, risk: "HIGH" },
    { sku: "MA66050F", coverage: 58.3, days: 5.1, risk: "HIGH" },
    { sku: "MA66088F", coverage: 72.4, days: 7.8, risk: "MEDIUM" }
  ],
  suppliers: { labels: ["Catering Imports", "Ocean Fresh", "APAC Food", "Delta Co"], otd: [62, 74, 88, 91] },
  gaps: [
    { sku: "MA61017F", onHand: 1240, actual: 3200, rec: 4100, gap: 2860, action: "INCREASE" },
    { sku: "MA61014F", onHand: 1750, actual: 2800, rec: 3400, gap: 1650, action: "INCREASE" },
    { sku: "MA66050F", onHand: 5100, actual: 3900, rec: 3600, gap: -1200, action: "DECREASE" },
    { sku: "MA66088F", onHand: 2250, actual: 2400, rec: 2600, gap: 350, action: "INCREASE" }
  ]
};

const warehouse = {
  zones: [
    { zone: "Bulk", util: 78, status: "OK" },
    { zone: "Piece Pick", util: 91, status: "RED" },
    { zone: "Returns", util: 83, status: "YELLOW" },
    { zone: "Staging", util: 69, status: "OK" }
  ],
  forecast: {
    labels: ["+1d", "+2d", "+3d", "+4d", "+5d", "+6d", "+7d"],
    piecePick: [90, 92, 93, 94, 92, 91, 89],
    returns: [82, 84, 86, 85, 83, 82, 81]
  },
  backlog: { lt4: 84, bt: 43, gt24: 128, avg: 26.4 },
  slotting: [
    { sku: "MA61017F", action: "Move to Front Pick Face" },
    { sku: "MA66050F", action: "Add Extra Pick Face" },
    { sku: "MA61014F", action: "Cross-Dock Candidate" },
    { sku: "MA66088F", action: "Re-slot Near Packing" }
  ]
};

const production = {
  kpis: [
    ["Active Lines", "3/4", "Line 3 maintenance"],
    ["Line 2 Utilization", "94%", "Bottleneck"],
    ["Throughput vs Plan", "87%", "daily plan"],
    ["Priority SKUs", "12", "below 70% coverage"]
  ],
  priority: [
    { p: 1, sku: "SKU-1008", days: 2.6, cov: 34.1 },
    { p: 2, sku: "SKU-2003", days: 3.1, cov: 41.8 },
    { p: 3, sku: "SKU-3012", days: 4.0, cov: 52.2 },
    { p: 4, sku: "SKU-4022", days: 6.5, cov: 68.5 }
  ],
  lines: { labels: ["Line 1", "Line 2", "Line 4"], vals: [82, 94, 71], target: 85 },
  drawdown: {
    labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
    s1: [3200, 2980, 2740, 2460, 2240, 1990, 1720],
    s2: [2900, 2710, 2520, 2310, 2100, 1960, 1780]
  },
  components: [
    { name: "Packaging bottles", status: "OK", availability: "95%" },
    { name: "Labels (Catering SKUs)", status: "REORDER", availability: "62%" },
    { name: "Raw ingredients — Juice", status: "OK", availability: "100%" },
    { name: "Gift box packaging", status: "ORDERED", availability: "78%" }
  ]
};

const recs = [
  {
    id: "rec_1", severity: "CRITICAL", risk_type: "STOCKOUT", icon: "🔴", channel: "B2C",
    title: "Emergency Replenishment for SKU-1008",
    root_cause: "Supplier delay plus heat-driven demand surge reduces projected cover to <3 days.",
    expected_impact: "Avoids stockout and protects estimated $152K of revenue.",
    revenue_impact: 152000,
    actions: [{ owner: "Procurement", description: "Create emergency PO with backup supplier", due_date: "Today" }]
  },
  {
    id: "rec_2", severity: "HIGH", risk_type: "CAPACITY", icon: "🏭", channel: "BOTH",
    title: "Piece-Pick Zone at 91% Utilization",
    root_cause: "B2C campaign prebuild and late putaway increase congestion.",
    expected_impact: "Reduce pick delays by 18% with re-slotting and labor shift.",
    revenue_impact: 42000,
    actions: [{ owner: "Warehouse", description: "Approve re-slotting queue for A-items", due_date: "Today" }]
  },
  {
    id: "rec_3", severity: "MEDIUM", risk_type: "SUPPLIER", icon: "🚚", channel: "B2B",
    title: "Supplier OTD Remediation Plan",
    root_cause: "Primary supplier OTD dropped to 62% over rolling 30 days.",
    expected_impact: "Improve reliability and lower safety stock overhead.",
    revenue_impact: 18000,
    actions: [{ owner: "Procurement", description: "Issue SLA notice and dual-source critical SKUs", due_date: "This week" }]
  }
];

const statsData = {
  emails_monitored_24h: 847,
  emails_flagged: 34,
  actions_automated: 18,
  avg_response_time_sec: 12,
  cost_savings_24h: 67800,
  issues_prevented: 11,
  uptime_pct: 99.8,
  monitors: [{}, {}, {}, {}, {}]
};

const activityData = [
  { time_ago: "3 min ago", source: "supplier@acme-chemicals.com", subject: "Urgent: Glycerin shipment delayed by 3 days", status: "action_taken", confidence: 0.94, decision: "Placed emergency PO #PO-2026-0847 with backup supplier" },
  { time_ago: "18 min ago", source: "logistics@dhl.com", subject: "Shipment #DHL-8847 arrived early — 2 days ahead", status: "action_taken", confidence: 0.98, decision: "Adjusted slotting plan and notified receiving team" },
  { time_ago: "42 min ago", source: "sales@aswatson.com", subject: "Flash sale alert: Skincare category +40% demand spike", status: "action_taken", confidence: 0.91, decision: "Raised production priority and replenishment queue" }
];

const rulesData = [
  { icon: "📦", name: "Supplier Delay Auto-Response", trigger: "keywords: delay, postpone", approval_required: false, executions_24h: 2 },
  { icon: "📈", name: "Demand Spike Handler", trigger: "flash sale, promotion, campaign", approval_required: false, executions_24h: 1 },
  { icon: "🔬", name: "Quality Failure Response", trigger: "QC failed, rejected", approval_required: true, executions_24h: 1 }
];

const scenarios = [
  { from: "supplier@chemtech-asia.com", subject: "Production capacity issue — Vitamin E delay", body: "Vitamin E production delayed by 5 days due to equipment maintenance.", detected_entities: ["Vitamin E", "delay", "5 days"], sentiment: "negative", urgency: "high", category: "supplier_delay", ai_analysis: { issue_type: "Supply Chain Delay", impact: "Stockout risk in 3 days", recommendation: "Switch to backup supplier", auto_action: "Generate emergency PO #PO-2026-0851", confidence: 0.93, savings: 15200 } },
  { from: "marketing@aswatson.com", subject: "Campaign: Buy 2 Get 1 Free — Haircare", body: "Expected 60% demand increase over 10 days.", detected_entities: ["promotion", "haircare", "60% increase"], sentiment: "positive", urgency: "medium", category: "demand_spike", ai_analysis: { issue_type: "Demand Spike Forecast", impact: "Need 60% more inventory", recommendation: "Increase production priority", auto_action: "Boost production queue", confidence: 0.89, savings: 22800 } }
];

const skuRows = [
  { id: "MA61017F", category: "HK - Disney Snack", storage: "Ambient", channel: "B2C" },
  { id: "MA61014F", category: "HK - Juice", storage: "Air-cond", channel: "MIXED" },
  { id: "MA66050F", category: "HK - Beverage", storage: "Ambient", channel: "B2B" },
  { id: "MA66088F", category: "HK - Haircare", storage: "Air-cond", channel: "B2C" }
];
let demandView = "overall";
let filteredSkuRows = [...skuRows];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("topbar-date").textContent = new Date().toLocaleString("en-HK", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  bindModuleNav();
  renderExecutive();
  renderProcurement();
  renderWarehouse();
  renderProduction();
  renderRecommendations();
  renderDemand();
  renderSafety();
  renderSKU();
  refreshAgentData();
  document.getElementById("simulate-btn").addEventListener("click", simulateIncomingEmail);
  document.getElementById("b2c-btn").addEventListener("click", () => setSafetyChannel("B2C"));
  document.getElementById("b2b-btn").addEventListener("click", () => setSafetyChannel("B2B"));
  document.getElementById("sigma-range").addEventListener("input", updateSafetyCalc);
  document.getElementById("sku-search").addEventListener("input", onSkuSearch);
  document.getElementById("demand-overall-btn").addEventListener("click", () => setDemandView("overall"));
  document.getElementById("demand-category-btn").addEventListener("click", () => setDemandView("category"));
  document.getElementById("demand-sku-btn").addEventListener("click", () => setDemandView("sku"));
  setDemandView("overall");
  updateSafetyCalc();
});

function bindModuleNav() {
  document.querySelectorAll(".module-nav").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const module = el.dataset.module;
      document.querySelectorAll(".module-nav").forEach((n) => n.classList.remove("active"));
      el.classList.add("active");
      document.querySelectorAll(".module").forEach((m) => m.classList.remove("active"));
      document.getElementById(`module-${module}`).classList.add("active");
      document.getElementById("module-title").textContent = modules[module];
    });
  });
}

function renderExecutive() {
  document.getElementById("executive-kpis").innerHTML = executive.kpis.map((k, i) => `
    <div class="kpi-card ${["purple","cyan","green","amber"][i]}"><div class="kpi-lbl">${k[0]}</div><div class="kpi-val">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>
  `).join("");
  document.getElementById("executive-kpis-row2").innerHTML = executive.row2.map((k, i) => `
    <div class="kpi-card ${["green","purple","cyan","red"][i]}"><div class="kpi-lbl">${k[0]}</div><div class="kpi-val">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>
  `).join("");
  createOrReplace("chart-exec-demand", "line", {
    labels: executive.demandLabels,
    datasets: [
      { label: "B2B", data: executive.b2b, borderColor: "#6366f1", tension: .35 },
      { label: "B2C", data: executive.b2c, borderColor: "#06b6d4", tension: .35 }
    ]
  });
  createOrReplace("chart-exec-exceptions", "bar", {
    labels: executive.exceptions.labels,
    datasets: [{ label: "Cases", data: executive.exceptions.values, backgroundColor: ["#ef4444","#f59e0b","#06b6d4","#8b5cf6"] }]
  });
  document.getElementById("exec-risk-table").innerHTML = executive.risks.map((r) =>
    `<tr><td>${r.sku}</td><td>${r.category.replace("HK - ","")}</td><td>${r.coverage.toFixed(1)}%</td><td><span class="badge ${r.risk === "CRITICAL" ? "b-warn" : "b-info"}">${r.risk}</span></td></tr>`
  ).join("");
}

function renderProcurement() {
  document.getElementById("po-pipeline").innerHTML = `<div class="pipeline">${procurement.pipeline.map((p) => `<div class="pl-step"><div class="pl-lbl">${p.label}</div><div class="pl-cnt">${p.count}</div><div class="pl-sub">${p.sub}</div></div>`).join("")}</div>`;
  document.getElementById("proc-risk-table").innerHTML = procurement.risks.map((r) => `<tr><td>${r.sku}</td><td>${r.coverage.toFixed(1)}%</td><td>${r.days.toFixed(1)}d</td><td><span class="badge ${r.risk==="CRITICAL"?"b-warn":"b-info"}">${r.risk}</span></td></tr>`).join("");
  createOrReplace("chart-proc-otd", "bar", {
    labels: procurement.suppliers.labels,
    datasets: [{ label: "OTD %", data: procurement.suppliers.otd, backgroundColor: ["#ef4444","#f59e0b","#10b981","#10b981"] }]
  });
  document.getElementById("proc-gap-table").innerHTML = procurement.gaps.map((g) =>
    `<tr><td>${g.sku}</td><td>${g.onHand.toLocaleString()}</td><td>${g.actual.toLocaleString()}</td><td>${g.rec.toLocaleString()}</td><td>${g.gap > 0 ? "+" : ""}${g.gap.toLocaleString()}</td><td><span class="mv ${g.action === "INCREASE" ? "mv-bad" : "mv-good"}">${g.action}</span></td></tr>`
  ).join("");
}

function renderWarehouse() {
  document.getElementById("warehouse-zones").innerHTML = warehouse.zones.map((z) => `<div class="sr"><span class="sr-lbl">${z.zone}</span><span class="sr-val">${z.util}% <span class="badge ${z.status==="RED"?"b-warn":"b-good"}">${z.status}</span></span></div>`).join("");
  createOrReplace("chart-wh-forecast", "line", {
    labels: warehouse.forecast.labels,
    datasets: [
      { label: "Piece Pick", data: warehouse.forecast.piecePick, borderColor: "#ef4444", tension: .35 },
      { label: "Returns", data: warehouse.forecast.returns, borderColor: "#f59e0b", tension: .35 }
    ]
  });
  document.getElementById("warehouse-backlog").innerHTML = `
    <div class="sr"><span class="sr-lbl">Waiting < 4h</span><span class="sr-val">${warehouse.backlog.lt4} cases</span></div>
    <div class="sr"><span class="sr-lbl">Waiting 4-24h</span><span class="sr-val">${warehouse.backlog.bt} cases</span></div>
    <div class="sr"><span class="sr-lbl">Waiting > 24h</span><span class="sr-val">${warehouse.backlog.gt24} cases</span></div>
    <div class="sr"><span class="sr-lbl">Avg putaway cycle</span><span class="sr-val">${warehouse.backlog.avg}h</span></div>
  `;
  document.getElementById("warehouse-slotting").innerHTML = warehouse.slotting.map((s) =>
    `<div class="sr"><span class="sr-lbl">${s.sku}</span><span class="sr-val"><span class="mv mv-good">${s.action}</span></span></div>`
  ).join("");
}

function renderProduction() {
  document.getElementById("production-kpis").innerHTML = production.kpis.map((k, i) => `<div class="kpi-card ${["green","amber","purple","red"][i]}"><div class="kpi-lbl">${k[0]}</div><div class="kpi-val">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join("");
  document.getElementById("prod-priority-table").innerHTML = production.priority.map((p) => `<tr><td>${p.p}</td><td>${p.sku}</td><td>${p.days.toFixed(1)}d</td><td>${p.cov.toFixed(1)}%</td></tr>`).join("");
  createOrReplace("chart-prod-lines", "bar", {
    labels: production.lines.labels,
    datasets: [
      { label: "Utilization %", data: production.lines.vals, backgroundColor: ["#10b981","#ef4444","#10b981"] },
      { type: "line", label: "Target", data: production.lines.labels.map(() => production.lines.target), borderColor: "#f59e0b", borderDash: [5, 4] }
    ]
  });
  createOrReplace("chart-prod-drawdown", "line", {
    labels: production.drawdown.labels,
    datasets: [
      { label: "SKU-1008", data: production.drawdown.s1, borderColor: "#ef4444", tension: .35 },
      { label: "SKU-2003", data: production.drawdown.s2, borderColor: "#f59e0b", tension: .35 }
    ]
  });
  document.getElementById("prod-components").innerHTML = production.components.map((c) =>
    `<div class="sr"><span class="sr-lbl">${c.name}</span><span class="sr-val"><span class="badge ${c.status === "REORDER" ? "b-warn" : "b-good"}">${c.availability} · ${c.status}</span></span></div>`
  ).join("");
}

function renderRecommendations() {
  const sevCount = {};
  recs.forEach((r) => { sevCount[r.severity] = (sevCount[r.severity] || 0) + 1; });
  document.getElementById("severity-summary").innerHTML = Object.entries(sevCount).map(([s, n]) => `<span class="badge b-info">${n} ${s}</span>`).join("");
  const left = recs.filter((_, i) => i % 2 === 0);
  const right = recs.filter((_, i) => i % 2 !== 0);
  document.getElementById("rec-col-left").innerHTML = left.map(renderRec).join("");
  document.getElementById("rec-col-right").innerHTML = right.map(renderRec).join("");
}

function renderRec(r) {
  return `<div class="rec" id="rec-${r.id}"><div class="rec-hd"><span>${r.icon}</span><div><div class="rec-title">${r.title}</div><div class="rec-meta">${r.risk_type} · ${r.channel}</div></div></div><div class="rec-body"><strong>Root Cause:</strong> ${r.root_cause}<br><strong>Impact:</strong> ${r.expected_impact}</div><div class="rec-ft"><button class="btn btn-pri" onclick="approveRec('${r.id}')">Approve</button><button class="btn btn-ghost" onclick="dismissRec('${r.id}')">Defer</button><span class="rec-impact">+$${Math.round(r.revenue_impact/1000)}K</span></div></div>`;
}

function approveRec(id) {
  const el = document.getElementById(`rec-${id}`);
  el.classList.add("approved");
}

function dismissRec(id) {
  const el = document.getElementById(`rec-${id}`);
  el.classList.add("dismissed");
}

function renderDemand() {
  const series = getDemandSeries(demandView);
  createOrReplace("chart-demand-intel", "line", {
    labels: series.labels,
    datasets: [
      { label: series.demandLabel, data: series.demand, borderColor: "#8b5cf6", tension: .35 },
      { label: "Inventory", data: series.inventory, borderColor: "#10b981", tension: .35 },
      { label: "Safety Stock", data: Array(series.labels.length).fill(series.ss), borderColor: "#ef4444", borderDash: [6,4] }
    ]
  });
  document.getElementById("demand-metrics").innerHTML = [
    ["Scope", demandView.toUpperCase(), "analysis view"],
    ["Skus below SS", series.below.toString(), "current scope"],
    ["On-Hand", `${Math.round(series.inventory[series.inventory.length - 1]).toLocaleString()}`, "latest"],
    ["Safety Stock", `${Math.round(series.ss).toLocaleString()}`, "threshold"]
  ].map((m, i) => `<div class="kpi-card ${["purple","red","green","amber"][i]}"><div class="kpi-lbl">${m[0]}</div><div class="kpi-val">${m[1]}</div><div class="kpi-sub">${m[2]}</div></div>`).join("");
}

function setDemandView(view) {
  demandView = view;
  ["overall", "category", "sku"].forEach((v) => {
    document.getElementById(`demand-${v}-btn`).className = v === view ? "btn btn-pri btn-sm" : "btn btn-ghost btn-sm";
  });
  renderDemand();
}

function getDemandSeries(view) {
  const labels = ["W-8","W-7","W-6","W-5","W-4","W-3","W-2","W-1","W+1","W+2","W+3","W+4"];
  if (view === "category") {
    return {
      labels,
      demand: [22000,22800,23500,24600,25200,26400,27300,28600,29200,30100,31200,32000],
      inventory: [34000,33500,32900,32300,31600,30800,29900,28800,27400,25800,23900,22100],
      ss: 25000,
      below: 11,
      demandLabel: "Category Demand"
    };
  }
  if (view === "sku") {
    return {
      labels,
      demand: [2800,2910,3020,3150,3280,3410,3580,3720,3860,4010,4160,4280],
      inventory: [5200,5010,4820,4650,4490,4300,4120,3910,3680,3410,3090,2720],
      ss: 3400,
      below: 1,
      demandLabel: "SKU Demand"
    };
  }
  return {
    labels,
    demand: [58000,60000,59200,62000,64000,63000,65000,68000,70000,71500,73000,74200],
    inventory: [92000,90000,87500,86000,84000,81000,79000,77000,73500,70000,66500,62000],
    ss: 70000,
    below: 54,
    demandLabel: "Total Demand"
  };
}

function renderSafety() {
  createOrReplace("chart-ss-sensitivity", "line", {
    labels: ["0.5w","1w","1.5w","2w","3w","4w","6w"],
    datasets: [
      { label: "B2C", data: [130,185,225,260,310,355,430], borderColor: "#06b6d4", tension: .35 },
      { label: "B2B", data: [92,128,152,176,210,242,295], borderColor: "#6366f1", tension: .35 }
    ]
  });
  const rows = [
    ["MA61017F", "B2C", 1240, 3200, 4100],
    ["MA61014F", "MIXED", 1750, 2800, 3400],
    ["MA66050F", "B2B", 5100, 3900, 3600],
    ["MA66088F", "B2C", 2250, 2400, 2600]
  ];
  document.getElementById("safety-table").innerHTML = rows.map((r) => {
    const cov = (r[2] / r[3]) * 100;
    return `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2].toLocaleString()}</td><td>${r[3].toLocaleString()}</td><td>${r[4].toLocaleString()}</td><td>${cov.toFixed(1)}%</td></tr>`;
  }).join("");
}

function setSafetyChannel(channel) {
  safetyChannel = channel;
  document.getElementById("b2c-btn").className = channel === "B2C" ? "btn btn-pri btn-sm" : "btn btn-ghost btn-sm";
  document.getElementById("b2b-btn").className = channel === "B2B" ? "btn btn-pri btn-sm" : "btn btn-ghost btn-sm";
  updateSafetyCalc();
}

function updateSafetyCalc() {
  const sigma = Number(document.getElementById("sigma-range").value);
  document.getElementById("sigma-val").textContent = sigma;
  const z = safetyChannel === "B2C" ? 2.33 : 1.65;
  const ss = Math.round(z * sigma * Math.sqrt(1));
  document.getElementById("ss-result").textContent = `Recommended Safety Stock: ${ss.toLocaleString()} units`;
}

function renderSKU() {
  document.getElementById("sku-table").innerHTML = filteredSkuRows.map((s) => `<tr><td>${s.id}</td><td>${s.category.replace("HK - ","")}</td><td>${s.storage}</td><td>${s.channel}</td></tr>`).join("");
  createOrReplace("chart-sku-mix", "doughnut", {
    labels: ["Disney Snack", "Juice", "Beverage", "Haircare"],
    datasets: [{ data: [37, 28, 24, 19], backgroundColor: ["#6366f1","#06b6d4","#10b981","#f59e0b"] }]
  }, { plugins: { legend: { position: "bottom" } } });
}

function onSkuSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  filteredSkuRows = !q ? [...skuRows] : skuRows.filter((s) =>
    s.id.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
  );
  renderSKU();
}

function refreshAgentData() {
  renderStats();
  renderActivity();
  renderRules();
  document.getElementById("email-preview").innerHTML = '<div class="loading"><div class="spinner"></div>Click "Simulate New Email" to start...</div>';
  document.getElementById("analysis-panel").innerHTML = '<div class="loading"><div class="spinner"></div>Waiting for scenario...</div>';
}

function renderStats() {
  const cards = [
    { cls: "purple", label: "Emails Monitored (24h)", value: formatNumber(statsData.emails_monitored_24h), sub: `${statsData.monitors.length} monitors active` },
    { cls: "cyan", label: "Flagged by AI", value: formatNumber(statsData.emails_flagged), sub: "4.0% flagged rate" },
    { cls: "green", label: "Automated Actions", value: formatNumber(statsData.actions_automated), sub: `${statsData.avg_response_time_sec}s avg response` },
    { cls: "amber", label: "Cost Savings (24h)", value: `$${formatNumber(statsData.cost_savings_24h)}`, sub: `${statsData.issues_prevented} disruptions prevented` }
  ];
  document.getElementById("stats-grid").innerHTML = cards.map((c) => `<div class="kpi-card ${c.cls}"><div class="kpi-lbl">${c.label}</div><div class="kpi-val">${c.value}</div><div class="kpi-sub">${c.sub}</div></div>`).join("");
}

function renderActivity() {
  document.getElementById("activity-feed").innerHTML = activityData.map((entry) => {
    const badge = entry.status === "pending_approval" ? '<span class="badge b-warn">Approval Required</span>' : '<span class="badge b-good">Auto Executed</span>';
    return `<div class="timeline-item"><div class="timeline-top"><div class="timeline-title">${entry.subject}</div><span class="mono">${entry.time_ago}</span></div><div class="timeline-sub">${entry.source} · confidence ${Math.round(entry.confidence * 100)}%</div><div style="margin-top:6px">${badge}</div><div class="timeline-decision"><strong>Decision:</strong> ${entry.decision}</div></div>`;
  }).join("");
}

function renderRules() {
  document.getElementById("rules-list").innerHTML = rulesData.map((rule) => `<div class="sr"><div style="flex:1;padding-right:10px"><div style="font-size:12px;font-weight:700;color:var(--text)">${rule.icon} ${rule.name}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">${rule.trigger}</div></div><div style="display:flex;gap:6px;align-items:center"><span class="badge ${rule.approval_required ? "b-warn" : "b-good"}">${rule.approval_required ? "Human Approval" : "Auto"}</span><span class="mono">${rule.executions_24h}/24h</span></div></div>`).join("");
}

function simulateIncomingEmail() {
  const preview = document.getElementById("email-preview");
  const panel = document.getElementById("analysis-panel");
  preview.innerHTML = '<div class="loading"><div class="spinner"></div>Detecting new email...</div>';
  panel.innerHTML = '<div class="loading"><div class="spinner"></div>Running AI analysis...</div>';
  window.setTimeout(() => {
    latestScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    renderEmailPreview(latestScenario);
    renderAnalysisPanel(latestScenario);
  }, 350);
}

function renderEmailPreview(scenario) {
  const urgencyPill = document.getElementById("email-urgency-pill");
  urgencyPill.className = `pill pill-${scenario.urgency}`;
  urgencyPill.textContent = `${scenario.urgency.toUpperCase()} urgency`;
  document.getElementById("email-preview").innerHTML = `<div class="email-header"><div class="lbl">From</div><div class="val">${scenario.from}</div><div class="lbl">Subject</div><div class="val">${scenario.subject}</div><div class="lbl">Category</div><div class="val">${prettyLabel(scenario.category)}</div></div><div class="email-body">${scenario.body}</div><div class="entity-row">${scenario.detected_entities.map((e) => `<span class="entity">${e}</span>`).join("")}<span class="entity">${scenario.sentiment} sentiment</span></div>`;
}

function renderAnalysisPanel(scenario) {
  const analysis = scenario.ai_analysis;
  const needsApproval = shouldRequireApproval(scenario, analysis);
  const policyOutcome = document.getElementById("policy-outcome-pill");
  policyOutcome.className = `pill ${needsApproval ? "pill-medium" : "pill-positive"}`;
  policyOutcome.textContent = needsApproval ? "Escalate for approval" : "Safe to auto execute";
  document.getElementById("analysis-panel").innerHTML = `<ul class="analysis-list"><li><strong>Issue Type:</strong> ${analysis.issue_type}</li><li><strong>Impact:</strong> ${analysis.impact}</li><li><strong>Recommendation:</strong> ${analysis.recommendation}</li><li><strong>Proposed Action:</strong> ${analysis.auto_action}</li><li><strong>Confidence:</strong> ${Math.round(analysis.confidence * 100)}%</li><li><strong>Estimated Savings:</strong> $${formatNumber(analysis.savings)}</li></ul><div class="row" style="margin-top:10px"><button class="btn btn-pri" id="auto-execute-btn" ${needsApproval ? "disabled" : ""}>${needsApproval ? "Approval Needed" : "Auto Execute Action"}</button><button class="btn btn-ghost" id="queue-btn">${needsApproval ? "Queue for Manager Approval" : "Escalate Anyway"}</button></div><div id="analysis-feedback"></div>`;
  document.getElementById("auto-execute-btn").addEventListener("click", executeDecision);
  document.getElementById("queue-btn").addEventListener("click", queueForApproval);
}

function shouldRequireApproval(scenario, analysis) {
  return scenario.category === "quality_update" || (analysis.savings || 0) >= 20000 || (analysis.confidence || 0) < 0.9;
}

function executeDecision() {
  if (!latestScenario) return;
  prependSyntheticActivity("action_taken", "Auto Executed");
  showFeedback("✓ Action executed and logged to audit trail.", "#2e7a58");
}

function queueForApproval() {
  if (!latestScenario) return;
  prependSyntheticActivity("pending_approval", "Queued for Approval");
  showFeedback("↗ Escalated to duty manager with AI context package.", "#a8741e");
}

function prependSyntheticActivity(status, statusText) {
  const confidence = Math.round((latestScenario.ai_analysis.confidence || 0) * 100);
  const badge = status === "pending_approval" ? '<span class="badge b-warn">Approval Required</span>' : '<span class="badge b-good">Auto Executed</span>';
  const newEntry = `<div class="timeline-item"><div class="timeline-top"><div class="timeline-title">${latestScenario.subject}</div><span class="mono">just now</span></div><div class="timeline-sub">${latestScenario.from} · confidence ${confidence}%</div><div style="margin-top:6px">${badge}</div><div class="timeline-decision"><strong>Decision:</strong> ${latestScenario.ai_analysis.auto_action} (${statusText})</div></div>`;
  document.getElementById("activity-feed").insertAdjacentHTML("afterbegin", newEntry);
}

function showFeedback(message, color) {
  document.getElementById("analysis-feedback").innerHTML = `<div style="margin-top:10px;font-size:11.5px;color:${color};font-weight:700">${message}</div>`;
}

function createOrReplace(canvasId, type, data, options = {}) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      ...options
    }
  });
}

function prettyLabel(text) {
  return text.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US");
}
