const savedAuthUser = (() => {
  try {
    const raw = localStorage.getItem("nexuspf_auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const state = {
  kpis: {},
  products: [],
  accounts: [],
  deals: [],
  users: [],
  stageHistory: [],
  activityLogs: [],
  kanbanFilter: "ALL",
  draggedDealId: null,
  lastAiSuggestion: null,
  currentUser: savedAuthUser || {
    id: 1,
    name: "Alfonso Gordillo",
    email: "alfonso@projectsfactory.io",
    role: "CEO & Founder",
    brand_focus: "projectsfactory.io & finanactionable.co",
    avatar_initials: "AG",
  },
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
    state.users = data.users || [];
    state.stageHistory = data.stageHistory || [];
    state.activityLogs = data.activityLogs || [];

    renderAuthUserUI();
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

// View 3: Dual Pipeline Kanban (Drag & Drop + Column Totals Renta/Venta + Audited Stage Transitions + Auth)
window.filterKanban = function (filter) {
  state.kanbanFilter = filter;
  renderKanbanView();
};

function fmtDateShort(dtStr) {
  if (!dtStr) return "Hoy";
  const d = new Date(dtStr);
  if (Number.isNaN(d.getTime())) return "Hoy";
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLocalDatetimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderKanbanView() {
  const board = document.getElementById("kanban-board-container");
  const summaryBox = document.getElementById("kanban-global-summary");
  const filteredDeals =
    state.kanbanFilter === "ALL"
      ? state.deals
      : state.deals.filter((d) => d.modality === state.kanbanFilter);

  // Global Kanban Totals Bar
  if (summaryBox) {
    const totalMrrAll = filteredDeals.reduce((acc, d) => acc + Number(d.mrr_usd || 0), 0);
    const totalBuyoutAll = filteredDeals.reduce((acc, d) => acc + Number(d.buyout_dynamic_usd || 0), 0);
    const totalCombinedAll = filteredDeals.reduce(
      (acc, d) =>
        acc + (d.modality === "VENTA_CAPEX" ? Number(d.buyout_dynamic_usd || 0) : Number(d.ltv_24m_usd || 0)),
      0
    );
    const weightedAll = filteredDeals.reduce(
      (acc, d) =>
        acc +
        (d.modality === "VENTA_CAPEX" ? Number(d.buyout_dynamic_usd || 0) : Number(d.ltv_24m_usd || 0)) *
          (Number(d.probability || 50) / 100),
      0
    );

    summaryBox.innerHTML = `
      <div class="kpi-card emerald-top" style="padding:12px 16px;">
        <div class="kpi-label">Total Renta Mensual (Pipeline MRR)</div>
        <div class="kpi-value" style="font-size:21px; color:var(--accent-emerald);">${fmtUsd(totalMrrAll)}/mes</div>
        <div class="kpi-sub">ARR Potencial: <strong>${fmtUsd(totalMrrAll * 12)}/año</strong></div>
      </div>
      <div class="kpi-card gold-top" style="padding:12px 16px;">
        <div class="kpi-label">Total Venta Directa (Equiv. Buyout CapEx)</div>
        <div class="kpi-value" style="font-size:21px; color:var(--accent-gold);">${fmtUsd(totalBuyoutAll)}</div>
        <div class="kpi-sub">Valor Llave en Mano Acumulado</div>
      </div>
      <div class="kpi-card cyan-top" style="padding:12px 16px;">
        <div class="kpi-label">Valor Total Pipeline (Renta 24m + Venta)</div>
        <div class="kpi-value" style="font-size:21px; color:var(--accent-cyan);">${fmtUsd(totalCombinedAll)}</div>
        <div class="kpi-sub">${filteredDeals.length} oportunidades activas en tablero</div>
      </div>
      <div class="kpi-card" style="padding:12px 16px;">
        <div class="kpi-label">Forecast Ponderado por Probabilidad IA</div>
        <div class="kpi-value" style="font-size:21px;">${fmtUsd(weightedAll)}</div>
        <div class="kpi-sub">Ejecutivo Activo: <strong style="color:var(--accent-emerald);">${state.currentUser.name}</strong></div>
      </div>
    `;
  }

  board.innerHTML = STAGES.map((st) => {
    const colDeals = filteredDeals.filter((d) => d.stage === st.id);

    // Per-column Renta & Venta Totals
    const colRentMrr = colDeals.reduce((acc, d) => acc + Number(d.mrr_usd || 0), 0);
    const colSaleBuyout = colDeals.reduce((acc, d) => acc + Number(d.buyout_dynamic_usd || 0), 0);
    const colCombinedValue = colDeals.reduce(
      (acc, d) =>
        acc + (d.modality === "VENTA_CAPEX" ? Number(d.buyout_dynamic_usd || 0) : Number(d.ltv_24m_usd || 0)),
      0
    );

    return `
      <div class="kanban-col"
           data-stage="${st.id}"
           ondragover="handleKanbanDragOver(event)"
           ondragleave="handleKanbanDragLeave(event)"
           ondrop="handleKanbanDrop(event, '${st.id}')">
        <div class="kanban-col-header">
          <span>${st.label}</span>
          <span class="nav-tag">${colDeals.length}</span>
        </div>

        <div class="kanban-totals-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
            <span style="color:var(--text-muted);">Total Etapa:</span>
            <strong style="font-size:12px; color:var(--text-primary);">${fmtUsd(colCombinedValue)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--accent-emerald);">
            <span>● Renta MRR:</span>
            <strong>${fmtUsd(colRentMrr)}/m</strong>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--accent-gold);">
            <span>● Venta CapEx:</span>
            <strong>${fmtUsd(colSaleBuyout)}</strong>
          </div>
        </div>

        ${
          colDeals.length === 0
            ? `<div style="border:1px dashed #1e293b; border-radius:8px; padding:22px 10px; text-align:center; font-size:11.5px; color:var(--text-muted);">
                 Arrastra una tarjeta aquí para mover a <strong>${st.label}</strong>
               </div>`
            : ""
        }

        ${colDeals
          .map((d) => {
            const histCount = state.stageHistory.filter((h) => Number(h.deal_id) === Number(d.id)).length;
            const lastBy = d.last_changed_by || "Alfonso Gordillo";
            const lastAt = fmtDateShort(d.last_stage_change_at || d.updated_at);

            return `
            <div class="deal-card"
                 draggable="true"
                 data-deal-id="${d.id}"
                 ondragstart="handleKanbanDragStart(event, ${d.id})"
                 ondragend="handleKanbanDragEnd(event)">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                ${modalityBadge(d.modality)}
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan); font-weight:700;">${d.probability}% prob.</span>
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

              <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:8px; padding:5px 7px; background:rgba(15,23,42,0.7); border-radius:6px; border-left:2px solid var(--accent-emerald);">
                <div>👤 <strong>${lastBy}</strong> · ${lastAt}</div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-secondary);" title="${(d.last_justification || d.next_action || "").replace(/"/g, "&quot;")}">
                  📝 ${d.last_justification || d.next_action || "Calificación inicial"}
                </div>
              </div>

              <div style="display:flex; gap:6px; justify-content:space-between; align-items:center;">
                <button class="btn" style="padding:5px 8px; font-size:11px;" onclick="openDealInStudio(${d.id})">📈 Simular</button>
                <button class="btn btn-cyan" style="padding:5px 8px; font-size:11px;" onclick="openDealHistoryModal(${d.id})" title="Ver auditoría de cambios de etapa">
                  📜 Historial (${histCount || 1})
                </button>
                <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);" title="Arrastra con el mouse a otra columna">⠿ Drag</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }).join("");
}

// HTML5 Drag & Drop Handlers for Kanban
window.handleKanbanDragStart = function (event, dealId) {
  state.draggedDealId = Number(dealId);
  event.dataTransfer.setData("text/plain", String(dealId));
  event.dataTransfer.effectAllowed = "move";
  setTimeout(() => {
    if (event.target && event.target.classList) {
      event.target.classList.add("dragging");
    }
  }, 0);
};

window.handleKanbanDragEnd = function (event) {
  if (event.target && event.target.classList) {
    event.target.classList.remove("dragging");
  }
  document.querySelectorAll(".kanban-col.drag-over").forEach((col) => col.classList.remove("drag-over"));
};

window.handleKanbanDragOver = function (event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  const col = event.currentTarget;
  if (col && !col.classList.contains("drag-over")) {
    col.classList.add("drag-over");
  }
};

window.handleKanbanDragLeave = function (event) {
  const col = event.currentTarget;
  if (col) {
    col.classList.remove("drag-over");
  }
};

window.handleKanbanDrop = function (event, targetStage) {
  event.preventDefault();
  const col = event.currentTarget;
  if (col) col.classList.remove("drag-over");

  const dealId = Number(event.dataTransfer.getData("text/plain") || state.draggedDealId);
  const deal = state.deals.find((d) => Number(d.id) === dealId);
  if (!deal) return;

  if (deal.stage === targetStage) {
    showToast(`ℹ️ La oportunidad ya se encuentra en la columna ${targetStage}.`);
    return;
  }

  openStageTransitionModal(deal, deal.stage, targetStage);
};

// Stage Transition Audit Modal & AI Copilot
const stageModal = document.getElementById("stage-transition-modal");

async function openStageTransitionModal(deal, fromStage, toStage) {
  if (!stageModal) return;

  const fromLabel = STAGES.find((s) => s.id === fromStage)?.label || fromStage;
  const toLabel = STAGES.find((s) => s.id === toStage)?.label || toStage;

  document.getElementById("st-deal-id").value = String(deal.id);
  document.getElementById("st-from-stage").value = fromStage;
  document.getElementById("st-to-stage").value = toStage;

  document.getElementById("st-modal-title").textContent = `${deal.title} (${deal.company_name || "Cliente B2B"})`;
  document.getElementById("st-route-banner").innerHTML = `
    <div>
      <div style="font-size:11px; font-family:var(--font-mono); color:var(--text-secondary);">TRANSICIÓN SOLICITADA EN KANBAN</div>
      <div style="font-size:15px; font-weight:700; margin-top:2px;">
        <span style="color:var(--text-muted);">${fromLabel}</span>
        <span style="color:var(--accent-emerald); margin:0 8px;">➔</span>
        <span style="color:var(--accent-emerald);">${toLabel}</span>
      </div>
    </div>
    <div style="text-align:right; font-family:var(--font-mono); font-size:11.5px;">
      <div>Renta: <strong style="color:var(--accent-emerald);">${fmtUsd(deal.mrr_usd)}/m</strong></div>
      <div>Venta: <strong style="color:var(--accent-gold);">${fmtUsd(deal.buyout_dynamic_usd)}</strong></div>
    </div>
  `;

  // Populate Authenticated Responsible Executive & Current DateTime
  document.getElementById("st-responsible-name").value = `${state.currentUser.name} (${state.currentUser.role})`;
  document.getElementById("st-responsible-email").value = state.currentUser.email;
  document.getElementById("st-responsible-role").value = state.currentUser.role;
  document.getElementById("st-transition-date").value = getLocalDatetimeInputValue(new Date());
  document.getElementById("st-justification").value = "";
  document.getElementById("st-next-action").value = deal.next_action || "";
  updateJustificationQualityBadge("");

  document.getElementById("st-ai-checklist").innerHTML =
    "⏳ Consultando al Copiloto IA FinActionable para generar checklist de gobernanza y sugerencia...";

  stageModal.classList.add("open");
  document.getElementById("st-justification").focus();

  // Fetch AI suggestion for this deal & stage transition
  try {
    const res = await fetch("/api/ai/suggest-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: deal.id,
        fromStage,
        toStage,
        responsibleName: state.currentUser.name,
      }),
    });
    const suggestion = await res.json();
    state.lastAiSuggestion = suggestion;

    if (suggestion && suggestion.ok) {
      document.getElementById("st-probability").value = suggestion.recommendedProbability;
      document.getElementById("st-next-action").value = suggestion.recommendedNextAction;
      document.getElementById("st-ai-checklist").innerHTML = `
        <div style="margin-bottom:6px; color:var(--text-primary); font-weight:600;">
          Checklist Gatekeeper sugerido por IA para validar el pase a <em>${toLabel}</em>:
        </div>
        <ul style="margin:0 0 8px 18px; padding:0;">
          ${(suggestion.checklist || []).map((item) => `<li>${item}</li>`).join("")}
        </ul>
        <div style="padding:6px 10px; border-radius:6px; background:rgba(16,185,129,0.1); border-left:3px solid var(--accent-emerald); color:var(--accent-emerald); font-size:11.5px;">
          💡 <strong>Insight IA:</strong> ${suggestion.riskInsight}
        </div>
      `;
    }
  } catch (err) {
    console.error("AI suggest transition error:", err);
  }
}

function updateJustificationQualityBadge(text) {
  const badge = document.getElementById("st-quality-badge");
  if (!badge) return;
  const len = (text || "").trim().length;
  if (len === 0) {
    badge.style.color = "var(--accent-rose)";
    badge.textContent = "Calidad de Evidencia IA: Obligatoria (0%)";
  } else if (len < 30) {
    badge.style.color = "var(--accent-gold)";
    badge.textContent = "Calidad de Evidencia IA: Básica (65%) — Agrega más contexto";
  } else {
    badge.style.color = "var(--accent-emerald)";
    badge.textContent = "✓ Calidad de Evidencia IA: Óptima (96% Audit-Ready)";
  }
}

const stJustificationEl = document.getElementById("st-justification");
if (stJustificationEl) {
  stJustificationEl.addEventListener("input", (e) => updateJustificationQualityBadge(e.target.value));
}

window.applyAiTransitionSuggestion = function () {
  if (!state.lastAiSuggestion) return;
  const justEl = document.getElementById("st-justification");
  const nextEl = document.getElementById("st-next-action");
  const probEl = document.getElementById("st-probability");

  justEl.value = state.lastAiSuggestion.suggestedJustification || "";
  if (state.lastAiSuggestion.recommendedNextAction) {
    nextEl.value = state.lastAiSuggestion.recommendedNextAction;
  }
  if (state.lastAiSuggestion.recommendedProbability) {
    probEl.value = state.lastAiSuggestion.recommendedProbability;
  }
  updateJustificationQualityBadge(justEl.value);
  showToast("✨ Copiloto IA redactó la justificación ejecutiva y el próximo hito.");
};

window.cancelStageTransition = function () {
  if (stageModal) stageModal.classList.remove("open");
  state.draggedDealId = null;
  renderKanbanView();
};

window.confirmStageTransition = async function () {
  const dealId = Number(document.getElementById("st-deal-id").value);
  const toStage = document.getElementById("st-to-stage").value;
  const transitionDate = document.getElementById("st-transition-date").value;
  const justification = document.getElementById("st-justification").value.trim();
  const nextAction = document.getElementById("st-next-action").value.trim();
  const probability = Number(document.getElementById("st-probability").value || 75);

  if (!justification || justification.length < 8) {
    showToast("⚠️ Por favor ingresa la acción tomada que justifica el cambio (o pulsa el botón de IA).");
    document.getElementById("st-justification").focus();
    return;
  }

  const res = await fetch(`/api/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stage: toStage,
      responsibleName: state.currentUser.name,
      responsibleEmail: state.currentUser.email,
      responsibleRole: state.currentUser.role,
      transitionDate: transitionDate ? new Date(transitionDate).toISOString() : new Date().toISOString(),
      justification,
      nextAction,
      probability,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "Error al guardar el cambio de etapa"}`);
    return;
  }

  if (stageModal) stageModal.classList.remove("open");
  await loadDashboard();
  showToast(`✅ Etapa actualizada a ${toStage} y firmada por ${state.currentUser.name}.`);
};

// Deal Audit History Modal
const historyModal = document.getElementById("deal-history-modal");

window.openDealHistoryModal = async function (dealId) {
  if (!historyModal) return;
  const deal = state.deals.find((d) => Number(d.id) === Number(dealId));
  document.getElementById("dh-modal-title").textContent = deal
    ? `Auditoría de Movimientos: ${deal.title}`
    : `Historial de Oportunidad #${dealId}`;

  const container = document.getElementById("dh-list-container");
  container.innerHTML = "<div style='font-size:12.5px; color:var(--text-secondary);'>Cargando historial desde PostgreSQL...</div>";
  historyModal.classList.add("open");

  const res = await fetch(`/api/deals/${dealId}/history`);
  const rows = await res.json();

  if (!rows || rows.length === 0) {
    container.innerHTML = "<div style='font-size:12.5px; color:var(--text-muted);'>Sin movimientos registrados aún.</div>";
    return;
  }

  container.innerHTML = rows
    .map(
      (h) => `
      <div style="padding:12px 14px; background:var(--bg-elevated); border:1px solid var(--border-hairline); border-left:3px solid var(--accent-emerald); border-radius:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-family:var(--font-mono); font-size:11.5px; font-weight:700; color:var(--accent-emerald);">
            ${h.from_stage} ➔ ${h.to_stage}
          </span>
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
            📅 ${new Date(h.transition_date).toLocaleString("es-CO")}
          </span>
        </div>
        <div style="font-size:12px; color:var(--accent-cyan); margin-bottom:6px;">
          👤 <strong>${h.responsible_name}</strong> (${h.responsible_role || "Ejecutivo"}) · <code>${h.responsible_email}</code>
        </div>
        <div style="font-size:13px; color:var(--text-primary); line-height:1.45; margin-bottom:6px;">
          <strong>Acción Tomada / Justificación:</strong> ${h.justification}
        </div>
        ${
          h.next_action
            ? `<div style="font-size:11.5px; color:var(--text-secondary);">🚀 <strong>Próximo Paso:</strong> ${h.next_action}</div>`
            : ""
        }
      </div>
    `
    )
    .join("");
};

window.closeDealHistoryModal = function () {
  if (historyModal) historyModal.classList.remove("open");
};

// Authentication Modal & Session Management
const authModal = document.getElementById("auth-modal");

function renderAuthUserUI() {
  const u = state.currentUser;
  const badge = document.getElementById("auth-avatar-badge");
  const label = document.getElementById("auth-user-label");
  if (badge) badge.textContent = u.avatar_initials || "AG";
  if (label) {
    label.innerHTML = `${u.name} · <strong style="color:var(--accent-emerald);">${u.role}</strong>`;
  }

  // Also update modal fields if open
  const stResp = document.getElementById("st-responsible-name");
  if (stResp) {
    stResp.value = `${u.name} (${u.role})`;
    document.getElementById("st-responsible-email").value = u.email;
    document.getElementById("st-responsible-role").value = u.role;
  }

  const grid = document.getElementById("auth-quick-users-grid");
  if (grid && state.users.length > 0) {
    grid.innerHTML = state.users
      .map((usr) => {
        const isCurrent = usr.email.toLowerCase() === u.email.toLowerCase();
        return `
          <div onclick="switchActiveExecutive(${usr.id})"
               style="padding:10px 12px; border-radius:10px; cursor:pointer; border:1px solid ${
                 isCurrent ? "var(--accent-emerald)" : "var(--border-hairline)"
               }; background:${isCurrent ? "rgba(16,185,129,0.12)" : "var(--bg-elevated)"}; display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:50%; background:${
              isCurrent ? "var(--accent-emerald)" : "#1e293b"
            }; color:${isCurrent ? "#03150e" : "#f8fafc"}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">
              ${usr.avatar_initials}
            </div>
            <div style="flex:1; overflow:hidden;">
              <div style="font-size:12.5px; font-weight:700; color:var(--text-primary);">${usr.name} ${
          isCurrent ? "✓" : ""
        }</div>
              <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
                usr.role
              }</div>
              <div style="font-family:var(--font-mono); font-size:10px; color:var(--accent-cyan);">${usr.email}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

window.openAuthModal = function () {
  if (!authModal) return;
  renderAuthUserUI();
  document.getElementById("auth-input-name").value = state.currentUser.name || "";
  document.getElementById("auth-input-email").value = state.currentUser.email || "";
  document.getElementById("auth-input-role").value = state.currentUser.role || "";
  authModal.classList.add("open");
};

window.closeAuthModal = function () {
  if (authModal) authModal.classList.remove("open");
};

window.switchActiveExecutive = async function (userId) {
  const found = state.users.find((u) => Number(u.id) === Number(userId));
  if (!found) return;
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: found.email, accessPin: "nexus2026" }),
  });
  const data = await res.json();
  if (res.ok && data.user) {
    state.currentUser = data.user;
    localStorage.setItem("nexuspf_auth_user", JSON.stringify(data.user));
    renderAuthUserUI();
    renderKanbanView();
    closeAuthModal();
    showToast(`🔐 Sesión ejecutiva activa: ${data.user.name} (${data.user.role}).`);
  }
};

window.submitAuthForm = async function (isRegister = false) {
  const name = document.getElementById("auth-input-name").value.trim();
  const email = document.getElementById("auth-input-email").value.trim();
  const role = document.getElementById("auth-input-role").value.trim();
  const accessPin = document.getElementById("auth-input-pin").value.trim();

  if (!email) {
    showToast("⚠️ Ingresa el correo corporativo del ejecutivo.");
    return;
  }

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, accessPin, name, role, isRegister }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "Error de autenticación"}`);
    return;
  }

  state.currentUser = data.user;
  localStorage.setItem("nexuspf_auth_user", JSON.stringify(data.user));
  await loadDashboard();
  closeAuthModal();
  showToast(`🔐 Autenticado como ${data.user.name} (${data.user.role}).`);
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

// View 5: Digital Products Catalog (Full CRUD: Create, Read, Update, Scale Tenants, Delete)
function renderCatalogView() {
  const container = document.getElementById("catalog-cards-container");
  const productCards = state.products
    .map(
      (p) => `
      <div class="product-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="brand-pill ${p.brand === "finanactionable.co" ? "fa" : "pf"}">${p.brand}</span>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${p.code}</span>
          </div>
          <div style="font-family:var(--font-mono); font-size:10.5px; color:var(--accent-emerald); text-transform:uppercase; margin-bottom:4px;">
            ${p.category || "SaaS / AI Asset"}
          </div>
          <h3 style="font-family:var(--font-display); font-size:18px; margin-bottom:6px;">${p.name}</h3>
          <p style="font-size:12.5px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px;">
            ${p.description || "Activo digital listo para licenciamiento SaaS/AaaS o venta llave en mano."}
          </p>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan); margin-bottom:14px;">
            Stack: ${p.tech_stack}
          </div>
        </div>

        <div>
          <div class="deal-metrics-box" style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Renta SaaS / AaaS:</span>
              <strong style="color:var(--accent-emerald);">${fmtUsd(p.monthly_rent_mrr_usd)}/mes (+${fmtUsd(p.setup_fee_usd)} setup)</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Venta Llave en Mano (IP):</span>
              <strong style="color:var(--accent-gold);">${fmtUsd(p.buyout_price_usd)} USD</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Costo Cloud / Tenant:</span>
              <span style="font-family:var(--font-mono); color:var(--text-secondary);">${fmtUsd(p.infra_cost_monthly_usd)}/mes</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding-top:6px; border-top:1px solid var(--border-hairline);">
              <span>Tenants en Renta: <strong>${p.active_tenants}</strong></span>
              <span>MRR Activo: <strong style="color:var(--accent-emerald);">${fmtUsd(Number(p.monthly_rent_mrr_usd) * Number(p.active_tenants))}/m</strong></span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; gap:6px;">
            <button class="btn btn-emerald" style="padding:6px 10px; font-size:11.5px; flex:1; justify-content:center;" onclick="incrementProductTenant(${p.id})">
              +1 Tenant Renta
            </button>
            <button class="btn btn-cyan" style="padding:6px 10px; font-size:11.5px;" onclick="openProductModal(${p.id})">
              ✏️ Editar
            </button>
            <button class="btn" style="padding:6px 10px; font-size:11.5px; color:var(--accent-rose); border-color:rgba(244,63,94,0.35);" onclick="deleteProductCrud(${p.id})">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  const addNewCard = `
    <div class="product-card" onclick="openProductModal()" style="border:2px dashed rgba(16,185,129,0.45); background:rgba(16,185,129,0.03); cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; min-height:290px;">
      <div style="width:52px; height:52px; border-radius:50%; background:rgba(16,185,129,0.15); border:1px solid var(--accent-emerald); display:flex; align-items:center; justify-content:center; font-size:26px; color:var(--accent-emerald); margin-bottom:12px;">
        +
      </div>
      <h3 style="font-family:var(--font-display); font-size:18px; margin-bottom:6px; color:var(--text-primary);">
        Crear Nuevo Producto Digital o Agente IA
      </h3>
      <p style="font-size:12.5px; color:var(--text-secondary); max-width:290px; line-height:1.5;">
        Registra un nuevo software o agente de <strong>projectsfactory.io</strong> o <strong>finanactionable.co</strong> con sus precios de Venta CapEx y Renta MRR.
      </p>
    </div>
  `;

  container.innerHTML = productCards + addNewCard;
}

const productModal = document.getElementById("product-modal");

window.openProductModal = function (productId = null) {
  if (!productModal) return;
  const titleEl = document.getElementById("product-modal-title");
  const badgeEl = document.getElementById("product-modal-badge");

  if (productId) {
    const p = state.products.find((item) => item.id === Number(productId));
    if (!p) return;
    titleEl.textContent = `Editar Activo Digital: ${p.name}`;
    badgeEl.textContent = `EDITANDO ID #${p.id} · ${p.code}`;
    document.getElementById("prod-id").value = String(p.id);
    document.getElementById("prod-brand").value = p.brand || "projectsfactory.io";
    document.getElementById("prod-code").value = p.code || "";
    document.getElementById("prod-category").value = p.category || "SaaS / FinTech Engine";
    document.getElementById("prod-name").value = p.name || "";
    document.getElementById("prod-stack").value = p.tech_stack || "";
    document.getElementById("prod-desc").value = p.description || "";
    document.getElementById("prod-buyout").value = Math.round(Number(p.buyout_price_usd) || 18000);
    document.getElementById("prod-mrr").value = Math.round(Number(p.monthly_rent_mrr_usd) || 900);
    document.getElementById("prod-setup").value = Math.round(Number(p.setup_fee_usd) || 2200);
    document.getElementById("prod-infra").value = Math.round(Number(p.infra_cost_monthly_usd) || 65);
    document.getElementById("prod-tenants").value = Number(p.active_tenants) || 0;
    document.getElementById("prod-sold").value = Number(p.sold_buyouts) || 0;
  } else {
    titleEl.textContent = "Registrar Nuevo Producto Digital / Agente IA";
    badgeEl.textContent = "NUEVO ACTIVO EN CATÁLOGO · POSTGRESQL 16";
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-brand").value = "projectsfactory.io";
    document.getElementById("prod-code").value = `PF-AI-${Math.floor(100 + Math.random() * 899)}`;
    document.getElementById("prod-category").value = "Agent-as-a-Service (AaaS)";
    document.getElementById("prod-name").value = "";
    document.getElementById("prod-stack").value = "Next.js · FastAPI · PostgreSQL · Render · Firebase";
    document.getElementById("prod-desc").value = "";
    document.getElementById("prod-buyout").value = 19500;
    document.getElementById("prod-mrr").value = 890;
    document.getElementById("prod-setup").value = 2200;
    document.getElementById("prod-infra").value = 60;
    document.getElementById("prod-tenants").value = 1;
    document.getElementById("prod-sold").value = 0;
  }

  productModal.classList.add("open");
  document.getElementById("prod-name").focus();
};

window.closeProductModal = function () {
  if (productModal) productModal.classList.remove("open");
};

window.fillProductAiTemplate = function () {
  const templates = [
    {
      brand: "finanactionable.co",
      code: "FA-TREASURY-FX",
      category: "SaaS / FinTech Engine",
      name: "FinActionable Autonomous Treasury & FX Hedging Copilot",
      tech_stack: "Python · FastAPI · PostgreSQL 16 · Render · Firebase",
      description:
        "Motor predictivo de tesorería corporativa y cobertura cambiaria multimoneda con alertas automáticas de liquidez para CFOs.",
      buyout_price_usd: 26000,
      monthly_rent_mrr_usd: 1150,
      setup_fee_usd: 2800,
      infra_cost_monthly_usd: 75,
      active_tenants: 6,
      sold_buyouts: 1,
    },
    {
      brand: "projectsfactory.io",
      code: "PF-WHATSAPP-ERP",
      category: "Agent-as-a-Service (AaaS)",
      name: "Autonomous B2B Order & Billing Agent (WhatsApp + ERP)",
      tech_stack: "Node.js · LangGraph · PostgreSQL · Render · Firebase Auth",
      description:
        "Agente transaccional que toma pedidos B2B por WhatsApp, valida inventario/cupo de cartera y emite facturación electrónica.",
      buyout_price_usd: 17500,
      monthly_rent_mrr_usd: 790,
      setup_fee_usd: 1900,
      infra_cost_monthly_usd: 55,
      active_tenants: 11,
      sold_buyouts: 2,
    },
  ];
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  document.getElementById("prod-brand").value = tpl.brand;
  document.getElementById("prod-code").value = `${tpl.code}-${Math.floor(10 + Math.random() * 89)}`;
  document.getElementById("prod-category").value = tpl.category;
  document.getElementById("prod-name").value = tpl.name;
  document.getElementById("prod-stack").value = tpl.tech_stack;
  document.getElementById("prod-desc").value = tpl.description;
  document.getElementById("prod-buyout").value = tpl.buyout_price_usd;
  document.getElementById("prod-mrr").value = tpl.monthly_rent_mrr_usd;
  document.getElementById("prod-setup").value = tpl.setup_fee_usd;
  document.getElementById("prod-infra").value = tpl.infra_cost_monthly_usd;
  document.getElementById("prod-tenants").value = tpl.active_tenants;
  document.getElementById("prod-sold").value = tpl.sold_buyouts;
};

window.saveProductCrud = async function () {
  const id = document.getElementById("prod-id").value;
  const payload = {
    brand: document.getElementById("prod-brand").value,
    code: document.getElementById("prod-code").value.trim(),
    category: document.getElementById("prod-category").value,
    name: document.getElementById("prod-name").value.trim(),
    tech_stack: document.getElementById("prod-stack").value.trim(),
    description: document.getElementById("prod-desc").value.trim(),
    buyout_price_usd: Number(document.getElementById("prod-buyout").value),
    monthly_rent_mrr_usd: Number(document.getElementById("prod-mrr").value),
    setup_fee_usd: Number(document.getElementById("prod-setup").value),
    infra_cost_monthly_usd: Number(document.getElementById("prod-infra").value),
    active_tenants: Number(document.getElementById("prod-tenants").value),
    sold_buyouts: Number(document.getElementById("prod-sold").value),
  };

  if (!payload.name) {
    showToast("⚠️ Ingresa el nombre del Producto Digital o Agente IA.");
    return;
  }

  const url = id ? `/api/products/${id}` : "/api/products";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok) {
    showToast(`⚠️ Error: ${data.error || "No se pudo guardar"}`);
    return;
  }

  closeProductModal();
  await loadDashboard();
  showToast(
    id
      ? `✅ Producto "${data.name}" actualizado en PostgreSQL.`
      : `✅ Nuevo producto "${data.name}" agregado al Catálogo.`
  );
};

window.incrementProductTenant = async function (productId) {
  const p = state.products.find((item) => item.id === Number(productId));
  if (!p) return;
  const nextTenants = Number(p.active_tenants || 0) + 1;
  const res = await fetch(`/api/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active_tenants: nextTenants }),
  });
  if (res.ok) {
    await loadDashboard();
    showToast(`🚀 +1 Tenant activo en "${p.name}" (${nextTenants} tenants rentando).`);
  }
};

window.deleteProductCrud = async function (productId) {
  const p = state.products.find((item) => item.id === Number(productId));
  if (!p) return;
  if (!window.confirm(`¿Eliminar el producto "${p.name}" (${p.code}) del catálogo?`)) return;

  const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
  if (res.ok) {
    await loadDashboard();
    showToast(`🗑️ Producto "${p.name}" eliminado del catálogo.`);
  }
};

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
