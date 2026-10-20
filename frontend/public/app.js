const state = {
  kpis: {},
  products: [],
  accounts: [],
  deals: [],
  activityLogs: [],
  kanbanFilter: "ALL",
};

const STAGES = [
  { id: "DISCOVERY", label: "1. Discovery" },
  { id: "DEMO_TECNICA", label: "2. Demo Técnica" },
  { id: "SIMULACION_FINACTIONABLE", label: "3. Simulación FinActionable" },
  { id: "NEGOCIACION", label: "4. Negociación" },
  { id: "CERRADO_GANADO", label: "5. Cerrado Ganado" },
];

function fmtUsd(val) {
  return "$" + Math.round(Number(val || 0)).toLocaleString("en-US");
}

function showToast(msg) {
  const el = document.getElementById("toast-banner");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 3800);
}

function modalityBadge(mod) {
  if (mod === "VENTA_CAPEX") {
    return `<span class="badge badge-venta">VENTA CAPEX (Buyout)</span>`;
  }
  if (mod === "HIBRIDO_AAAS") {
    return `<span class="badge badge-hibrido">HÍBRIDO AaaS + IP</span>`;
  }
  return `<span class="badge badge-renta">RENTA MRR (SaaS)</span>`;
}

// Switch Views
window.switchView = function (viewId) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${viewId}`);
  });
  if (viewId === "studio") {
    runStudioSimulation(false);
  }
};

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => window.switchView(btn.dataset.view));
});

// Load All Data from Backend
async function loadDashboard() {
  try {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    state.kpis = data.kpis || {};
    state.products = data.products || [];
    state.accounts = data.accounts || [];
    state.deals = data.deals || [];
    state.activityLogs = data.activityLogs || [];

    renderDashboardView();
    renderSmartGridView();
    renderKanbanView();
    renderCatalogView();
    populateSimulatorSelect();
  } catch (err) {
    console.error("Failed loading dashboard:", err);
  }
}

// Render SVG Cashflow Comparison Chart (36 Months)
function renderDualCurveSvg(containerId, buyoutPrice, setupFee, mrr, maintFee) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const w = 720;
  const h = 250;
  const padL = 62;
  const padR = 24;
  const padT = 22;
  const padB = 34;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const pointsRent = [];
  const pointsBuyout = [];
  let maxVal = 1000;

  for (let m = 1; m <= 36; m++) {
    const rVal = setupFee + mrr * m;
    const bVal = buyoutPrice + maintFee * (m - 1);
    if (rVal > maxVal) maxVal = rVal;
    if (bVal > maxVal) maxVal = bVal;
    pointsRent.push({ m, val: rVal });
    pointsBuyout.push({ m, val: bVal });
  }

  const xPos = (m) => padL + ((m - 1) / 35) * plotW;
  const yPos = (v) => padT + plotH - (v / (maxVal * 1.08)) * plotH;

  const rentPath = pointsRent
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${xPos(p.m).toFixed(1)},${yPos(p.val).toFixed(1)}`)
    .join(" ");
  const buyoutPath = pointsBuyout
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${xPos(p.m).toFixed(1)},${yPos(p.val).toFixed(1)}`)
    .join(" ");

  const delta = mrr - maintFee;
  const breakevenM = delta > 0 ? (buyoutPrice - setupFee) / delta : null;
  let breakevenMarker = "";
  if (breakevenM && breakevenM >= 1 && breakevenM <= 36) {
    const bx = xPos(breakevenM);
    const by = yPos(setupFee + mrr * breakevenM);
    breakevenMarker = `
      <line x1="${bx}" y1="${padT}" x2="${bx}" y2="${padT + plotH}" stroke="#06b6d4" stroke-dasharray="4 4" stroke-width="1.5"/>
      <circle cx="${bx}" cy="${by}" r="6" fill="#06b6d4" stroke="#06090f" stroke-width="2"/>
      <rect x="${Math.min(bx - 58, w - 135)}" y="${Math.max(by - 34, 6)}" width="126" height="22" rx="5" fill="#0b101b" stroke="#06b6d4"/>
      <text x="${Math.min(bx + 5, w - 72)}" y="${Math.max(by - 19, 21)}" fill="#22d3ee" font-family="JetBrains Mono" font-size="10" text-anchor="middle">Break-even: Mes ${breakevenM.toFixed(1)}</text>
    `;
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:100%; overflow:visible;">
      <!-- Grid lines -->
      <line x1="${padL}" y1="${yPos(maxVal * 0.25)}" x2="${w - padR}" y2="${yPos(maxVal * 0.25)}" stroke="#1e293b" stroke-width="1"/>
      <line x1="${padL}" y1="${yPos(maxVal * 0.5)}" x2="${w - padR}" y2="${yPos(maxVal * 0.5)}" stroke="#1e293b" stroke-width="1"/>
      <line x1="${padL}" y1="${yPos(maxVal * 0.75)}" x2="${w - padR}" y2="${yPos(maxVal * 0.75)}" stroke="#1e293b" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#334155" stroke-width="1.2"/>

      <!-- Y Axis Labels -->
      <text x="${padL - 8}" y="${yPos(maxVal * 0.75) + 4}" fill="#64748b" font-family="JetBrains Mono" font-size="10" text-anchor="end">${fmtUsd(maxVal * 0.75)}</text>
      <text x="${padL - 8}" y="${yPos(maxVal * 0.5) + 4}" fill="#64748b" font-family="JetBrains Mono" font-size="10" text-anchor="end">${fmtUsd(maxVal * 0.5)}</text>
      <text x="${padL - 8}" y="${yPos(maxVal * 0.25) + 4}" fill="#64748b" font-family="JetBrains Mono" font-size="10" text-anchor="end">${fmtUsd(maxVal * 0.25)}</text>

      <!-- X Axis Labels -->
      <text x="${xPos(1)}" y="${h - 10}" fill="#94a3b8" font-family="JetBrains Mono" font-size="10">Mes 1</text>
      <text x="${xPos(12)}" y="${h - 10}" fill="#94a3b8" font-family="JetBrains Mono" font-size="10" text-anchor="middle">Mes 12 (Año 1)</text>
      <text x="${xPos(24)}" y="${h - 10}" fill="#94a3b8" font-family="JetBrains Mono" font-size="10" text-anchor="middle">Mes 24 (Año 2)</text>
      <text x="${xPos(36)}" y="${h - 10}" fill="#94a3b8" font-family="JetBrains Mono" font-size="10" text-anchor="end">Mes 36 (Año 3)</text>

      <!-- Curves -->
      <path d="${buyoutPath}" fill="none" stroke="#f59e0b" stroke-width="3"/>
      <path d="${rentPath}" fill="none" stroke="#10b981" stroke-width="3.5"/>

      ${breakevenMarker}

      <!-- Legend -->
      <circle cx="${padL + 14}" cy="14" r="5" fill="#10b981"/>
      <text x="${padL + 25}" y="18" fill="#f8fafc" font-family="Plus Jakarta Sans" font-size="11.5" font-weight="600">Renta Recurrente SaaS/AaaS (MRR Acumulado)</text>

      <circle cx="${padL + 310}" cy="14" r="5" fill="#f59e0b"/>
      <text x="${padL + 321}" y="18" fill="#f8fafc" font-family="Plus Jakarta Sans" font-size="11.5" font-weight="600">Venta Llave en Mano (CapEx + Soporte)</text>
    </svg>
  `;
}

function renderDashboardView() {
  const k = state.kpis;
  const totalMrr = Number(k.activeCatalogMrrUsd || 0) + Number(k.pipelineMrrUsd || 0);
  document.getElementById("kpi-mrr").textContent = fmtUsd(totalMrr) + "/m";
  document.getElementById("kpi-arr").textContent = fmtUsd(totalMrr * 12) + "/año";
  document.getElementById("kpi-buyout").textContent = fmtUsd(k.pipelineBuyoutCapexUsd || 0);
  document.getElementById("kpi-tenants").textContent = `${k.totalActiveTenants || 0} Tenants`;
  document.getElementById("kpi-margin").textContent = `${k.avgGrossMarginPct || 91.5}%`;
  document.getElementById("kpi-enriched").textContent = `${k.enrichedAccountsCount || 0} / ${k.totalAccountsCount || 0}`;

  renderDualCurveSvg("dashboard-chart-box", 21000, 2400, 980, 220);

  // Activity Feed
  const feedEl = document.getElementById("activity-feed-list");
  feedEl.innerHTML = state.activityLogs
    .map(
      (log) => `
      <div style="padding:10px 12px; background:var(--bg-elevated); border-radius:9px; border-left:3px solid var(--accent-cyan); font-size:12.5px;">
        <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted); margin-bottom:3px;">
          <span>${log.event_type}</span>
          <span>${new Date(log.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div style="color:var(--text-primary);">${log.summary}</div>
      </div>
    `
    )
    .join("");

  // Deals Table
  const tbody = document.getElementById("dashboard-deals-tbody");
  tbody.innerHTML = state.deals
    .map(
      (d) => `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--text-primary);">${d.title}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${d.company_name || "Cliente B2B"} · ${d.contact_name || ""}</div>
        </td>
        <td>
          <span class="brand-pill ${d.brand === "finanactionable.co" ? "fa" : "pf"}">${d.brand}</span>
        </td>
        <td>${modalityBadge(d.modality)}</td>
        <td style="font-family:var(--font-mono); color:var(--accent-emerald); font-weight:600;">
          ${fmtUsd(d.mrr_usd)}/mes <span style="color:var(--text-muted); font-size:11px;">(+${fmtUsd(d.setup_fee_usd)} setup)</span>
        </td>
        <td style="font-family:var(--font-mono); color:var(--accent-gold);">
          ${fmtUsd(d.buyout_dynamic_usd)}
        </td>
        <td style="font-family:var(--font-mono);">Mes ${d.breakeven_months}</td>
        <td style="font-family:var(--font-mono); font-weight:700;">${fmtUsd(d.ltv_24m_usd)}</td>
        <td><span class="badge" style="background:rgba(255,255,255,0.07);">${d.stage}</span></td>
      </tr>
    `
    )
    .join("");
}

// View 2: Smart Grid with Magic AI Columns
function renderSmartGridView() {
  const tbody = document.getElementById("smartgrid-tbody");
  tbody.innerHTML = state.accounts
    .map(
      (a) => `
      <tr>
        <td>
          <div style="font-weight:700; font-size:13.5px;">${a.company_name}</div>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan);">${a.domain}</div>
        </td>
        <td>
          <div>${a.industry}</div>
          <div style="font-size:11.5px; color:var(--text-muted);">${a.country} · ${a.employee_range} emp.</div>
        </td>
        <td>
          <div style="font-weight:600;">${a.contact_name}</div>
          <div style="font-size:11.5px; color:var(--text-secondary);">${a.contact_role}</div>
        </td>
        <td>
          ${
            a.ai_fit_score
              ? `<span class="badge badge-renta" style="font-size:12.5px;">${a.ai_fit_score} / 100</span>`
              : `<span style="color:var(--text-muted); font-family:var(--font-mono);">Pendiente IA</span>`
          }
        </td>
        <td style="font-weight:600; color:#38bdf8;">
          ${a.ai_recommended_product || "—"}
        </td>
        <td>
          ${
            a.ai_recommended_modality && a.ai_recommended_modality !== "SIMULACION_PENDIENTE"
              ? `<span class="badge ${a.ai_recommended_modality.includes("VENTA") ? "badge-venta" : "badge-renta"}">${a.ai_recommended_modality}</span>`
              : `<span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text-muted);">Por calcular</span>`
          }
        </td>
        <td style="font-size:12px; color:var(--text-secondary); max-width:250px;">
          ${a.ai_finactionable_insight || "Haz clic en '⚡ Magic AI' para ejecutar agente financiero y comercial."}
        </td>
        <td style="font-size:12px; color:var(--text-primary); max-width:260px; font-style:italic;">
          ${a.ai_personalized_icebreaker ? `"${a.ai_personalized_icebreaker}"` : "—"}
        </td>
        <td>
          <button class="btn btn-cyan" style="padding:6px 10px; font-size:11.5px;" onclick="enrichSingleAccount(${a.id})">
            ⚡ Magic AI
          </button>
        </td>
      </tr>
    `
    )
    .join("");
}

window.enrichSingleAccount = async function (accountId) {
  showToast(`⚡ Ejecutando Agente Magic AI (Claygent + FinActionable) para cuenta #${accountId}...`);
  await fetch(`/api/magic-enrich/${accountId}`, { method: "POST" });
  await loadDashboard();
  showToast(`✅ Cuenta #${accountId} enriquecida y persistida en PostgreSQL.`);
};

document.getElementById("btn-enrich-all").addEventListener("click", async () => {
  showToast("⚡ Ejecutando Magic AI en todas las cuentas del Smart Grid...");
  await fetch("/api/magic-enrich-all", { method: "POST" });
  await loadDashboard();
  window.switchView("smartgrid");
  showToast("✅ Todas las columnas mágicas han sido actualizadas con IA.");
});

document.getElementById("btn-grid-enrich-all").addEventListener("click", async () => {
  showToast("⚡ Ejecutando Magic AI en todas las filas...");
  await fetch("/api/magic-enrich-all", { method: "POST" });
  await loadDashboard();
  showToast("✅ Smart Grid B2B 100% enriquecido.");
});

// View 3: Dual Pipeline Kanban
window.filterKanban = function (filter) {
  state.kanbanFilter = filter;
  renderKanbanView();
};

function renderKanbanView() {
  const board = document.getElementById("kanban-board-container");
  const filteredDeals =
    state.kanbanFilter === "ALL"
      ? state.deals
      : state.deals.filter((d) => d.modality === state.kanbanFilter);

  board.innerHTML = STAGES.map((st, idx) => {
    const colDeals = filteredDeals.filter((d) => d.stage === st.id);
    const nextStage = STAGES[idx + 1] ? STAGES[idx + 1].id : null;

    return `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span>${st.label}</span>
          <span class="nav-tag">${colDeals.length}</span>
        </div>
        ${colDeals
          .map(
            (d) => `
            <div class="deal-card">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                ${modalityBadge(d.modality)}
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary);">${d.probability}%</span>
              </div>
              <div class="deal-card-title">${d.title}</div>
              <div class="deal-card-company">${d.company_name || ""} · <span style="color:var(--accent-cyan);">${d.brand}</span></div>

              <div class="deal-metrics-box">
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">Renta MRR:</span>
                  <strong style="color:var(--accent-emerald);">${fmtUsd(d.mrr_usd)}/m</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">Venta Buyout:</span>
                  <strong style="color:var(--accent-gold);">${fmtUsd(d.buyout_dynamic_usd)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed #1e293b;">
                  <span>LTV 24m: <strong>${fmtUsd(d.ltv_24m_usd)}</strong></span>
                  <span>Eq: <strong>${d.breakeven_months}m</strong></span>
                </div>
              </div>

              <div style="display:flex; gap:6px; justify-content:space-between;">
                <button class="btn" style="padding:5px 8px; font-size:11px;" onclick="openDealInStudio(${d.id})">📈 Simular</button>
                ${
                  nextStage
                    ? `<button class="btn btn-emerald" style="padding:5px 8px; font-size:11px;" onclick="advanceDealStage(${d.id}, '${nextStage}')">Avanzar →</button>`
                    : `<span class="badge badge-renta">✓ Ganado</span>`
                }
              </div>
            </div>
          `
          )
          .join("")}
      </div>
    `;
  }).join("");
}

window.advanceDealStage = async function (dealId, nextStage) {
  await fetch(`/api/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage: nextStage }),
  });
  await loadDashboard();
  showToast(`✅ Oportunidad #${dealId} movida a ${nextStage}.`);
};

window.openDealInStudio = function (dealId) {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return;
  window.switchView("studio");
  const selectEl = document.getElementById("sim-deal-select");
  selectEl.value = String(deal.id);
  document.getElementById("rng-buyout").value = Math.round(Number(deal.buyout_dynamic_usd));
  document.getElementById("rng-setup").value = Math.round(Number(deal.setup_fee_usd));
  document.getElementById("rng-mrr").value = Math.round(Number(deal.mrr_usd));
  document.getElementById("rng-infra").value = Math.round(Number(deal.infra_cost_monthly_usd));
  runStudioSimulation(false);
};

// View 4: FinActionable Deal Studio Simulator
function populateSimulatorSelect() {
  const sel = document.getElementById("sim-deal-select");
  if (!sel) return;
  sel.innerHTML = state.deals
    .map((d) => `<option value="${d.id}">#${d.id} — ${d.title} (${d.company_name || "B2B"})</option>`)
    .join("");
}

async function runStudioSimulation(saveToDb = false) {
  const buyoutPrice = Number(document.getElementById("rng-buyout").value);
  const setupFee = Number(document.getElementById("rng-setup").value);
  const monthlyRentMrr = Number(document.getElementById("rng-mrr").value);
  const infraCostMonthly = Number(document.getElementById("rng-infra").value);
  const maintenanceFeeBuyout = Number(document.getElementById("rng-maint").value);
  const dealId = document.getElementById("sim-deal-select").value;

  document.getElementById("val-buyout").textContent = fmtUsd(buyoutPrice);
  document.getElementById("val-setup").textContent = fmtUsd(setupFee);
  document.getElementById("val-mrr").textContent = `${fmtUsd(monthlyRentMrr)} / mes`;
  document.getElementById("val-infra").textContent = `${fmtUsd(infraCostMonthly)} / mes`;
  document.getElementById("val-maint").textContent = `${fmtUsd(maintenanceFeeBuyout)} / mes`;

  const res = await fetch("/api/simulate-pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyoutPrice,
      setupFee,
      monthlyRentMrr,
      infraCostMonthly,
      maintenanceFeeBuyout,
      dealId: saveToDb ? dealId : undefined,
    }),
  });
  const sim = await res.json();

  document.getElementById("sim-breakeven").textContent = `Mes ${sim.breakevenMonths}`;
  document.getElementById("sim-ltv24").textContent = fmtUsd(sim.ltv24mRent);
  document.getElementById("sim-ltv36").textContent = fmtUsd(sim.ltv36mRent);
  document.getElementById("sim-margin").textContent = `${sim.grossMarginRentPct}%`;
  document.getElementById("sim-narrative-box").innerHTML = `
    <strong>🤖 Dictamen Estratégico FinActionable.co:</strong> ${sim.narrative}
  `;

  renderDualCurveSvg("studio-svg-chart", buyoutPrice, setupFee, monthlyRentMrr, maintenanceFeeBuyout);

  if (saveToDb) {
    await loadDashboard();
    showToast("✅ Simulación FinActionable guardada en PostgreSQL para la oportunidad seleccionada.");
  }
}

["rng-buyout", "rng-setup", "rng-mrr", "rng-infra", "rng-maint"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => runStudioSimulation(false));
});

document.getElementById("sim-deal-select").addEventListener("change", (e) => {
  window.openDealInStudio(Number(e.target.value));
});

document.getElementById("btn-save-simulation").addEventListener("click", () => {
  runStudioSimulation(true);
});

// View 5: Digital Products Catalog
function renderCatalogView() {
  const container = document.getElementById("catalog-cards-container");
  container.innerHTML = state.products
    .map(
      (p) => `
      <div class="product-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="brand-pill ${p.brand === "finanactionable.co" ? "fa" : "pf"}">${p.brand}</span>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${p.code}</span>
          </div>
          <h3 style="font-family:var(--font-display); font-size:18px; margin-bottom:6px;">${p.name}</h3>
          <p style="font-size:12.5px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px;">
            ${p.description}
          </p>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan); margin-bottom:14px;">
            Stack: ${p.tech_stack}
          </div>
        </div>

        <div class="deal-metrics-box" style="margin-bottom:0;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Renta SaaS / AaaS:</span>
            <strong style="color:var(--accent-emerald);">${fmtUsd(p.monthly_rent_mrr_usd)}/mes (+${fmtUsd(p.setup_fee_usd)} setup)</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Venta Llave en Mano (IP):</span>
            <strong style="color:var(--accent-gold);">${fmtUsd(p.buyout_price_usd)} USD</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding-top:6px; border-top:1px solid var(--border-hairline);">
            <span>Tenants Activos en Renta: <strong>${p.active_tenants}</strong></span>
            <span>MRR Producto: <strong style="color:var(--accent-emerald);">${fmtUsd(Number(p.monthly_rent_mrr_usd) * Number(p.active_tenants))}/m</strong></span>
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

// View 6: MCP Server Interactive Runner
window.runMcpTool = async function (toolName, args) {
  const pre = document.getElementById("mcp-output-pre");
  pre.textContent = `// Ejecutando MCP Tool "${toolName}"...`;
  const res = await fetch("/api/mcp/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolName, arguments: args }),
  });
  const data = await res.json();
  pre.textContent = JSON.stringify(data, null, 2);
  await loadDashboard();
};

// Modal Ctrl+K Zero-Admin Ingest
const modal = document.getElementById("cmdk-modal");
function openZeroAdminModal() {
  modal.classList.add("open");
  document.getElementById("zero-admin-textarea").focus();
}
function closeZeroAdminModal() {
  modal.classList.remove("open");
}

document.getElementById("open-cmdk-btn").addEventListener("click", openZeroAdminModal);
document.getElementById("btn-open-zero-admin").addEventListener("click", openZeroAdminModal);
document.getElementById("close-cmdk-btn").addEventListener("click", closeZeroAdminModal);

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    modal.classList.toggle("open");
  } else if (e.key === "Escape") {
    closeZeroAdminModal();
  }
});

window.fillZeroAdminSample = function (num) {
  const samples = {
    1: "Hablé con Roberto Gómez de Grupo Agroindustrial del Valle, quieren rentar el motor de Conciliaciones y Exógenas por $950 al mes con setup de $2,400.",
    2: "Reunión con Diana Torres de Banco Finandina Digital, les interesa comprar llave en mano la plataforma FinActionable AI-CFO por $26,500 USD.",
    3: "Contacto con Andrés Mejía de EPS SaludTotal Regional, buscan rentar el Agente Autónomo PQRSD como servicio AaaS en $780 mensuales y $1,900 de implementación.",
  };
  document.getElementById("zero-admin-textarea").value = samples[num] || "";
};

document.getElementById("btn-submit-zero-admin").addEventListener("click", async () => {
  const rawText = document.getElementById("zero-admin-textarea").value;
  if (!rawText.trim()) return;

  const resBox = document.getElementById("zero-admin-result");
  resBox.style.display = "block";
  resBox.innerHTML = "⏳ Extrayendo entidades, calculando punto de equilibrio FinActionable y guardando en PostgreSQL...";

  const res = await fetch("/api/zero-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });
  const data = await res.json();

  if (data.ok) {
    const ex = data.extracted;
    resBox.innerHTML = `
      <div style="font-weight:700; color:var(--accent-emerald); margin-bottom:6px;">
        ✓ Cuenta y Oportunidad Creadas Automáticamente en PostgreSQL
      </div>
      <div><strong>Empresa:</strong> ${ex.companyName} · <strong>Contacto:</strong> ${ex.contactName}</div>
      <div><strong>Activo Digital:</strong> ${ex.productName} (${ex.brand})</div>
      <div><strong>Modalidad Detectada:</strong> ${ex.modality} — MRR: <strong>${fmtUsd(ex.mrrUsd)}/mes</strong> | Buyout: <strong>${fmtUsd(ex.buyoutUsd)}</strong></div>
      <div><strong>Punto de Equilibrio FinActionable:</strong> Mes ${ex.breakevenMonths} · LTV 24m: <strong>${fmtUsd(ex.ltv24mUsd)}</strong> (Margen ${ex.grossMarginPct}%)</div>
    `;
    await loadDashboard();
    showToast(`✅ Zero-Admin creó "${ex.companyName}" en PostgreSQL.`);
  } else {
    resBox.innerHTML = `<span style="color:var(--accent-rose);">Error: ${data.error}</span>`;
  }
});

// Initialize on load
loadDashboard();
