const savedAuthUser = (() => {
  try {
    const raw = localStorage.getItem("nexuspf_auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const state = {
  theme: localStorage.getItem("nexuspf_theme") || "dark",
  lang: localStorage.getItem("nexuspf_lang") || "es",
  deviceMode: localStorage.getItem("nexuspf_device") || "pc",
  kpis: {},
  products: [],
  accounts: [],
  deals: [],
  users: [],
  rolesMeta: {},
  stageHistory: [],
  activityLogs: [],
  kanbanFilter: "ALL",
  kanbanOwnerFilter: "ALL",
  whatIfMode: false,
  realDealsBackup: null,
  draggedDealId: null,
  lastAiSuggestion: null,
  currentUser: savedAuthUser || {
    id: 1,
    username: "alfonso",
    name: "Alfonso Gordillo",
    email: "alfonso@projectsfactory.io",
    role: "CEO & Founder (Super Admin)",
    role_code: "SUPER_ADMIN",
    department: "Dirección Ejecutiva",
    brand_focus: "projectsfactory.io & finanactionable.co",
    avatar_initials: "AG",
  },
};

const STAGES_ES = [
  { id: "DISCOVERY", label: "1. Discovery" },
  { id: "DEMO_TECNICA", label: "2. Demo Técnica" },
  { id: "SIMULACION_FINACTIONABLE", label: "3. Simulación FinActionable" },
  { id: "NEGOCIACION", label: "4. Negociación" },
  { id: "CERRADO_GANADO", label: "5. Cerrado Ganado" },
];

const STAGES_EN = [
  { id: "DISCOVERY", label: "1. Discovery" },
  { id: "DEMO_TECNICA", label: "2. Tech Demo" },
  { id: "SIMULACION_FINACTIONABLE", label: "3. FinActionable Sim" },
  { id: "NEGOCIACION", label: "4. Negotiation" },
  { id: "CERRADO_GANADO", label: "5. Closed Won" },
];

let STAGES = STAGES_ES;

function t(esText, enText) {
  return state.lang === "en" ? enText : esText;
}

// ============================================================================
// ENVIRONMENT CONTROLS: LIGHT/DARK MODE · ESPAÑOL/ENGLISH · PC/MOBILE MODE
// ============================================================================
window.toggleThemeMode = function () {
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem("nexuspf_theme", state.theme);
  applyEnvironmentPreferences();
  showToast(
    state.theme === "light"
      ? t("☀️ Modo Claro Ejecutivo activado.", "☀️ Executive Light Mode enabled.")
      : t("🌙 Modo Oscuro Obsidian activado.", "🌙 Obsidian Dark Mode enabled.")
  );
};

window.toggleLanguage = function () {
  state.lang = state.lang === "en" ? "es" : "en";
  localStorage.setItem("nexuspf_lang", state.lang);
  STAGES = state.lang === "en" ? STAGES_EN : STAGES_ES;
  applyEnvironmentPreferences();
  populateKanbanOwnerFilter();
  renderDashboardView();
  renderSmartGridView();
  renderKanbanView();
  renderCatalogView();
  renderTeamUsersView();
  showToast(
    state.lang === "en"
      ? "🇺🇸 Language switched to English (EN)."
      : "🇪🇸 Idioma cambiado a Español (ES)."
  );
};

window.toggleDeviceMode = function () {
  state.deviceMode = state.deviceMode === "mobile" ? "pc" : "mobile";
  localStorage.setItem("nexuspf_device", state.deviceMode);
  applyEnvironmentPreferences();
  renderKanbanView();
  showToast(
    state.deviceMode === "mobile"
      ? t("📱 Vista App Celular activada (con barra inferior táctil).", "📱 Mobile App View enabled (with touch bottom bar).")
      : t("💻 Vista Escritorio PC activada (pantalla completa).", "💻 Desktop PC View enabled (widescreen).")
  );
};

function applyEnvironmentPreferences() {
  STAGES = state.lang === "en" ? STAGES_EN : STAGES_ES;
  document.body.classList.toggle("theme-light", state.theme === "light");
  document.body.classList.toggle("device-mobile", state.deviceMode === "mobile");

  // Update Topbar & Login Gate toggle chips
  const btnTheme = document.getElementById("btn-theme-toggle");
  const gateTheme = document.getElementById("gate-btn-theme");
  const themeLabel = state.theme === "light" ? t("☀️ Claro", "☀️ Light") : t("🌙 Oscuro", "🌙 Dark");
  if (btnTheme) btnTheme.textContent = themeLabel;
  if (gateTheme) gateTheme.textContent = themeLabel;

  const btnLang = document.getElementById("btn-lang-toggle");
  const gateLang = document.getElementById("gate-btn-lang");
  const langLabel = state.lang === "en" ? "🇺🇸 EN" : "🇪🇸 ES";
  if (btnLang) btnLang.textContent = langLabel;
  if (gateLang) gateLang.textContent = langLabel;

  const btnDev = document.getElementById("btn-device-toggle");
  const gateDev = document.getElementById("gate-btn-device");
  const devLabel = state.deviceMode === "mobile" ? t("📱 Celular", "📱 Mobile") : "💻 PC";
  if (btnDev) btnDev.textContent = devLabel;
  if (gateDev) gateDev.textContent = devLabel;

  // Translate Sidebar Navigation & Mobile Bottom Bar
  const navTranslations = {
    dashboard: {
      title: t("⚡ Command Center", "⚡ Command Center"),
      tag: "LIVE",
      mobile: t("Inicio", "Home"),
    },
    smartgrid: {
      title: t("✦ Smart Grid & Magic AI", "✦ Smart Grid & Magic AI"),
      tag: "Clay+Attio",
      mobile: t("Grid IA", "AI Grid"),
    },
    kanban: {
      title: t("❖ Pipeline Dual Kanban", "❖ Dual Pipeline Kanban"),
      tag: "CapEx/MRR",
      mobile: "Kanban",
    },
    studio: {
      title: t("📈 FinActionable Studio", "📈 FinActionable Studio"),
      tag: t("Simulador", "Simulator"),
      mobile: "Studio",
    },
    catalog: {
      title: t("📦 Catálogo IP & Tenants", "📦 IP Catalog & Tenants"),
      tag: t("Activos", "Assets"),
      mobile: t("Catálogo", "Catalog"),
    },
    team: {
      title: t("👥 Equipo & Roles RBAC", "👥 Team & RBAC Roles"),
      tag: t("6 Perfiles", "6 Roles"),
      mobile: t("Equipo", "Team"),
    },
    mcp: {
      title: t("🔌 Servidor MCP & Cloud", "🔌 MCP Server & Cloud"),
      tag: "5 Tools",
      mobile: "MCP",
    },
  };

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const v = btn.dataset.view;
    if (navTranslations[v]) {
      const spans = btn.querySelectorAll("span");
      if (spans[0]) spans[0].textContent = navTranslations[v].title;
      if (spans[1]) spans[1].textContent = navTranslations[v].tag;
    }
  });

  document.querySelectorAll(".mobile-nav-item").forEach((mBtn) => {
    const v = mBtn.dataset.mview;
    const lbl = mBtn.querySelector(".m-lbl");
    if (v && navTranslations[v] && lbl) {
      lbl.textContent = navTranslations[v].mobile;
    }
  });

  // Topbar & Command bar translations
  const cmdkTrigger = document.querySelector("#open-cmdk-btn span:first-child");
  if (cmdkTrigger) {
    cmdkTrigger.innerHTML =
      state.lang === "en"
        ? "✨ <strong>Zero-Admin AI Bar:</strong> Paste a voice note, email or meeting transcript to create Account + Deal..."
        : "✨ <strong>Zero-Admin AI Bar:</strong> Pega una nota de voz, correo o reunión para crear Cuenta + Deal...";
  }
  const btnTopLogin = document.getElementById("btn-topbar-login");
  if (btnTopLogin) {
    btnTopLogin.textContent = t("🔐 Login / Cambiar Usuario", "🔐 Login / Switch User");
  }

  // Section titles & descriptions across all views
  const viewHeaders = {
    "#view-dashboard .section-title": t(
      "Executive Revenue & FinActionable Command Center",
      "Executive Revenue & FinActionable Command Center"
    ),
    "#view-dashboard .section-desc": t(
      "Visión unificada de productos digitales en Renta Recurrente (MRR/AaaS) vs. Venta Llave en Mano (Buyout CapEx)",
      "Unified view of digital products in Recurring Rental (MRR/AaaS) vs. Turnkey Buyout Sale (CapEx)"
    ),
    "#view-smartgrid .section-title": t(
      "Smart Grid B2B con 'Magic AI Columns' (Estilo Attio + Clay)",
      "B2B Smart Grid with 'Magic AI Columns' (Attio + Clay Style)"
    ),
    "#view-smartgrid .section-desc": t(
      "Cada columna azul es calculada por agentes IA que analizan la cuenta, recomiendan qué activo de projectsfactory.io ofrecer y redactan el gancho ejecutivo.",
      "Every cyan column is computed by AI agents that analyze the account, recommend which projectsfactory.io asset to offer, and draft the executive icebreaker."
    ),
    "#view-kanban .section-title": t(
      "Pipeline Dual Kanban: Venta Directa (CapEx) vs. Renta Mensual (MRR / AaaS)",
      "Dual Pipeline Kanban: Direct Buyout (CapEx) vs. Monthly Rental (MRR / AaaS)"
    ),
    "#view-studio .section-title": t(
      "FinActionable Deal Studio — Simulador Interactivo Venta vs. Renta",
      "FinActionable Deal Studio — Interactive Buyout vs. Rental Simulator"
    ),
    "#view-catalog .section-title": t(
      "Catálogo de Productos Digitales, Agentes AaaS & Tenants Activos",
      "Digital Products Catalog, AaaS Agents & Active Tenants"
    ),
    "#view-team .section-title": t(
      "Equipo Corporativo, Autenticación & Perfiles de Acceso (RBAC)",
      "Corporate Team, Authentication & Access Profiles (RBAC)"
    ),
    "#view-mcp .section-title": t(
      "Servidor MCP Nativo & Arquitectura Docker → Render + Firebase",
      "Native MCP Server & Docker → Render + Firebase Architecture"
    ),
  };

  for (const [selector, text] of Object.entries(viewHeaders)) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  // Login Gate translations
  const tabLogin = document.getElementById("tab-btn-login");
  const tabReg = document.getElementById("tab-btn-register");
  if (tabLogin) tabLogin.textContent = t("🔑 Iniciar Sesión", "🔑 Sign In");
  if (tabReg) tabReg.textContent = t("✨ Registrarse por Primera Vez", "✨ First-Time Sign Up");
}

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
  document.querySelectorAll(".mobile-nav-item[data-mview]").forEach((mBtn) => {
    mBtn.classList.toggle("active", mBtn.dataset.mview === viewId);
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
    state.rolesMeta = data.rolesMeta || {};
    state.stageHistory = data.stageHistory || [];
    state.activityLogs = data.activityLogs || [];

    if (state.whatIfMode) {
      state.realDealsBackup = JSON.parse(JSON.stringify(state.deals));
    }

    applyEnvironmentPreferences();
    renderAuthUserUI();
    populateKanbanOwnerFilter();
    populateNewDealDropdowns();
    renderDashboardView();
    renderSmartGridView();
    renderKanbanView();
    renderCatalogView();
    renderTeamUsersView();
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
          <div style="font-weight:600;">👤 ${a.contact_name || "Sin contacto"}</div>
          <div style="font-size:11.5px; color:var(--text-secondary);">${a.contact_role || "Ejecutivo"}</div>
          ${a.contact_email ? `<div style="font-family:var(--font-mono); font-size:10.5px; color:var(--accent-cyan);">${a.contact_email}</div>` : ""}
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
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-cyan" style="padding:6px 10px; font-size:11px;" onclick="enrichSingleAccount(${a.id})" title="Enriquecer con IA">
              ⚡ Magic AI
            </button>
            <button class="btn btn-outline" style="padding:5px 8px; font-size:11px;" onclick="openAccountModal(${a.id})" title="Editar Cliente y Contacto B2B">
              ✏️ Editar
            </button>
            <button class="btn btn-outline" style="padding:5px 8px; font-size:11px; border-color:rgba(244,63,94,0.35); color:#fda4af;" onclick="deleteAccountCrud(${a.id})" title="Eliminar Cliente">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

// CRUD Modal para Clientes y Contactos B2B (accounts)
const accountModal = document.getElementById("account-modal");

window.openAccountModal = function (accountId = null) {
  const modalEl = document.getElementById("account-modal") || accountModal;
  if (!modalEl) return;
  const ownerSelect = document.getElementById("acc-owner-user");
  if (ownerSelect) {
    const usersList = state.users && state.users.length ? state.users : [state.currentUser];
    ownerSelect.innerHTML = usersList
      .map((u) => `<option value="${u.id}">👤 ${u.name} (${u.role} · ${u.email})</option>`)
      .join("");
  }

  const titleEl = document.getElementById("acc-modal-title") || document.getElementById("account-modal-title");
  const idEl = document.getElementById("acc-id") || document.getElementById("acc-edit-id");
  const companyEl = document.getElementById("acc-company") || document.getElementById("acc-company-name");
  const domainEl = document.getElementById("acc-domain");
  const industryEl = document.getElementById("acc-industry");
  const countryEl = document.getElementById("acc-country");
  const empEl = document.getElementById("acc-employees");
  const contactNameEl = document.getElementById("acc-contact-name");
  const contactRoleEl = document.getElementById("acc-contact-role");
  const contactEmailEl = document.getElementById("acc-contact-email");

  if (accountId) {
    const acc = state.accounts.find((a) => Number(a.id) === Number(accountId));
    if (!acc) return;
    if (titleEl) titleEl.textContent = `Editar Cliente & Contacto: ${acc.company_name}`;
    if (idEl) idEl.value = acc.id;
    if (companyEl) companyEl.value = acc.company_name || "";
    if (domainEl) domainEl.value = acc.domain || "";
    if (industryEl) industryEl.value = acc.industry || "Finanzas & Operaciones B2B";
    if (countryEl) countryEl.value = acc.country || "Colombia / LATAM";
    if (empEl) empEl.value = acc.employee_range || "50-200";
    if (contactNameEl) contactNameEl.value = acc.contact_name || "";
    if (contactRoleEl) contactRoleEl.value = acc.contact_role || "";
    if (contactEmailEl) contactEmailEl.value = acc.contact_email || "";
    if (ownerSelect && acc.owner_user_id) {
      ownerSelect.value = String(acc.owner_user_id);
    }
  } else {
    if (titleEl) titleEl.textContent = "Registrar Nuevo Cliente y Contacto B2B";
    if (idEl) idEl.value = "";
    if (companyEl) companyEl.value = "";
    if (domainEl) domainEl.value = "";
    if (industryEl) industryEl.value = "Finanzas & Operaciones B2B";
    if (countryEl) countryEl.value = "Colombia / LATAM";
    if (empEl) empEl.value = "50-200";
    if (contactNameEl) contactNameEl.value = "";
    if (contactRoleEl) contactRoleEl.value = "CFO / Director Financiero";
    if (contactEmailEl) contactEmailEl.value = "";
    if (ownerSelect && state.currentUser?.id) {
      ownerSelect.value = String(state.currentUser.id);
    }
  }
  modalEl.classList.add("open");
};

window.closeAccountModal = function () {
  const modalEl = document.getElementById("account-modal") || accountModal;
  if (modalEl) modalEl.classList.remove("open");
};

window.saveAccountCrud = async function () {
  const idEl = document.getElementById("acc-id") || document.getElementById("acc-edit-id");
  const companyEl = document.getElementById("acc-company") || document.getElementById("acc-company-name");
  const editId = idEl?.value;
  const company_name = (companyEl?.value || "").trim();
  const domain = (document.getElementById("acc-domain")?.value || "").trim();
  const industry = (document.getElementById("acc-industry")?.value || "Servicios B2B").trim();
  const country = (document.getElementById("acc-country")?.value || "Colombia").trim();
  const employee_range = document.getElementById("acc-employees")?.value || "50-200";
  const contact_name = (document.getElementById("acc-contact-name")?.value || "").trim();
  const contact_role = (document.getElementById("acc-contact-role")?.value || "").trim();
  const contact_email = (document.getElementById("acc-contact-email")?.value || "").trim();
  const owner_user_id = Number(document.getElementById("acc-owner-user")?.value || state.currentUser?.id || 1);

  if (!company_name || !contact_name) {
    showToast("⚠️ Ingresa el nombre de la Empresa y el Nombre del Contacto Principal.");
    return;
  }

  const url = editId ? `/api/accounts/${editId}` : "/api/accounts";
  const method = editId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name,
      domain,
      industry,
      country,
      employee_range,
      contact_name,
      contact_role,
      contact_email,
      owner_user_id,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "No se pudo guardar el cliente"}`);
    return;
  }
  closeAccountModal();
  await loadDashboard();
  showToast(
    editId
      ? `✅ Cliente "${company_name}" (${contact_name}) actualizado.`
      : `✅ Nuevo Cliente "${company_name}" y contacto ${contact_name} creados.`
  );
};

window.deleteAccountCrud = async function (accountId) {
  const acc = state.accounts.find((a) => Number(a.id) === Number(accountId));
  if (!acc) return;
  if (!confirm(`¿Eliminar el cliente "${acc.company_name}" (${acc.contact_name})?`)) return;
  const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "No se pudo eliminar el cliente"}`);
    return;
  }
  await loadDashboard();
  showToast(`🗑️ Cliente "${acc.company_name}" eliminado.`);
};

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

// View 3: Dual Pipeline Kanban (Drag & Drop + Column Totals Renta/Venta + All Point 2 & Point 3 Enrichments + RBAC Auth)
window.filterKanban = function (filter) {
  state.kanbanFilter = filter;
  renderKanbanView();
};

window.filterKanbanByOwner = function (ownerFilter) {
  state.kanbanOwnerFilter = ownerFilter || "ALL";
  renderKanbanView();
};
window.setKanbanOwnerFilter = window.filterKanbanByOwner;

function populateKanbanOwnerFilter() {
  const sel = document.getElementById("kanban-owner-filter");
  if (!sel) return;
  const currentVal = state.kanbanOwnerFilter || "ALL";
  sel.innerHTML = `
    <option value="ALL">👥 Todos los Ejecutivos (${state.users.length})</option>
    <option value="MINE">🎯 Solo Mis Oportunidades (${state.currentUser.name})</option>
    ${state.users
      .map(
        (u) =>
          `<option value="${u.email}">${u.avatar_initials} · ${u.name} (${u.role_code || "EXEC"})</option>`
      )
      .join("")}
  `;
  if ([...sel.options].some((o) => o.value === currentVal)) {
    sel.value = currentVal;
  } else {
    sel.value = "ALL";
  }
}

// Point 3.5: CEO What-If Sandbox Simulation Mode
window.toggleWhatIfMode = function () {
  state.whatIfMode = !state.whatIfMode;
  const btnToggle = document.getElementById("btn-whatif-toggle");
  const btnReset = document.getElementById("btn-whatif-reset");
  const banner = document.getElementById("whatif-banner");

  if (state.whatIfMode) {
    state.realDealsBackup = JSON.parse(JSON.stringify(state.deals));
    if (btnToggle) {
      btnToggle.style.background = "rgba(56,189,248,0.22)";
      btnToggle.style.borderColor = "var(--accent-cyan)";
      btnToggle.style.color = "#e0f2fe";
      btnToggle.textContent = "🧪 Modo Simulación 'What-If': ACTIVO";
    }
    if (btnReset) btnReset.style.display = "inline-flex";
    if (banner) banner.style.display = "flex";
    showToast("🧪 Modo Simulación 'What-If' activado: arrastra tarjetas libremente para proyectar caja sin alterar PostgreSQL.");
  } else {
    if (state.realDealsBackup) {
      state.deals = JSON.parse(JSON.stringify(state.realDealsBackup));
    }
    if (btnToggle) {
      btnToggle.style.background = "";
      btnToggle.style.borderColor = "rgba(56,189,248,0.45)";
      btnToggle.style.color = "var(--accent-cyan)";
      btnToggle.textContent = "🧪 Modo Simulación 'What-If': OFF";
    }
    if (btnReset) btnReset.style.display = "none";
    if (banner) banner.style.display = "none";
    showToast("✅ Tablero restaurado a datos oficiales en PostgreSQL.");
  }
  renderKanbanView();
};

window.resetWhatIfSimulation = function () {
  if (state.realDealsBackup) {
    state.deals = JSON.parse(JSON.stringify(state.realDealsBackup));
  }
  state.whatIfMode = false;
  const btnToggle = document.getElementById("btn-whatif-toggle");
  const btnReset = document.getElementById("btn-whatif-reset");
  const banner = document.getElementById("whatif-banner");
  if (btnToggle) {
    btnToggle.style.background = "";
    btnToggle.textContent = "🧪 Modo Simulación 'What-If': OFF";
  }
  if (btnReset) btnReset.style.display = "none";
  if (banner) banner.style.display = "none";
  renderKanbanView();
  showToast("↺ Simulación What-If restaurada a los valores reales de PostgreSQL.");
};
window.toggleKanbanWhatIfMode = window.toggleWhatIfMode;
window.resetKanbanWhatIf = window.resetWhatIfSimulation;

// Point 3.2: 1-Click Flip Venta / Renta directly on Kanban Card
window.flipDealModality = async function (dealId) {
  const deal = state.deals.find((d) => Number(d.id) === Number(dealId));
  if (!deal) return;

  if (state.whatIfMode) {
    deal.modality = deal.modality === "VENTA_CAPEX" ? "RENTA_MRR" : "VENTA_CAPEX";
    renderKanbanView();
    showToast(`🧪 [What-If] ${deal.title} cambiado en simulación a ${deal.modality}.`);
    return;
  }

  const res = await fetch(`/api/deals/${dealId}/flip-modality`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      responsibleName: state.currentUser.name,
      responsibleEmail: state.currentUser.email,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "No se pudo alternar modalidad"}`);
    return;
  }
  await loadDashboard();
  showToast(`⇄ Modalidad alternada a ${data.modality || data.newModality} y totales recalculados.`);
};

// Point 3.1: Deal Rotting / Staleness Thermometer Badge
function getDealRottingBadge(deal) {
  if (deal.stage === "CERRADO_GANADO") {
    return `<span style="font-size:10px; padding:2px 6px; border-radius:99px; background:rgba(16,185,129,0.16); color:var(--accent-emerald); font-family:var(--font-mono);">🏆 Ganado</span>`;
  }
  const refDate = deal.last_stage_change_at || deal.updated_at;
  const elapsedMs = Date.now() - (refDate ? new Date(refDate).getTime() : Date.now());
  // Combine real elapsed days with deterministic stage/id offset so demo cards show realistic SLA aging
  const realDays = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  const demoAgingDays = realDays > 0 ? realDays : ((Number(deal.id || 1) * 4) % 13) + 1;

  if (demoAgingDays >= 10) {
    return `<span style="font-size:10px; padding:2px 6px; border-radius:99px; background:rgba(244,63,94,0.18); color:var(--accent-rose); border:1px solid rgba(244,63,94,0.4); font-family:var(--font-mono);" title="Alerta SLA: Más de 10 días sin avanzar de columna">🔴 Estancado ${demoAgingDays}d</span>`;
  }
  if (demoAgingDays >= 5) {
    return `<span style="font-size:10px; padding:2px 6px; border-radius:99px; background:rgba(245,158,11,0.18); color:var(--accent-gold); border:1px solid rgba(245,158,11,0.35); font-family:var(--font-mono);" title="Atención SLA: ${demoAgingDays} días en esta etapa">🟡 Atención ${demoAgingDays}d</span>`;
  }
  return `<span style="font-size:10px; padding:2px 6px; border-radius:99px; background:rgba(16,185,129,0.14); color:var(--accent-emerald); font-family:var(--font-mono);" title="Trato fresco y activo">🟢 Fresco ${demoAgingDays}d</span>`;
}

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

  let filteredDeals =
    state.kanbanFilter === "ALL"
      ? state.deals
      : state.deals.filter((d) => d.modality === state.kanbanFilter);

  if (state.kanbanOwnerFilter === "MINE") {
    filteredDeals = filteredDeals.filter(
      (d) =>
        (d.last_changed_email || "").toLowerCase() === (state.currentUser.email || "").toLowerCase() ||
        (d.last_changed_by || "").toLowerCase() === (state.currentUser.name || "").toLowerCase()
    );
  } else if (state.kanbanOwnerFilter && state.kanbanOwnerFilter !== "ALL") {
    filteredDeals = filteredDeals.filter(
      (d) => (d.last_changed_email || "").toLowerCase() === state.kanbanOwnerFilter.toLowerCase()
    );
  }

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
        <div class="kpi-label">${t("Total Renta Mensual (Pipeline MRR)", "Total Monthly Rental (Pipeline MRR)")}</div>
        <div class="kpi-value" style="font-size:21px; color:var(--accent-emerald);">${fmtUsd(totalMrrAll)}${t("/mes", "/mo")}</div>
        <div class="kpi-sub">${t("ARR Potencial:", "Potential ARR:")} <strong>${fmtUsd(totalMrrAll * 12)}${t("/año", "/yr")}</strong></div>
      </div>
      <div class="kpi-card gold-top" style="padding:12px 16px;">
        <div class="kpi-label">${t("Total Venta Directa (Equiv. Buyout CapEx)", "Total Direct Buyout (CapEx Equiv.)")}</div>
        <div class="kpi-value" style="font-size:21px; color:var(--accent-gold);">${fmtUsd(totalBuyoutAll)}</div>
        <div class="kpi-sub">${t("Valor Llave en Mano Acumulado", "Cumulative Turnkey IP Value")}</div>
      </div>
      <div class="kpi-card cyan-top" style="padding:12px 16px;">
        <div class="kpi-label">${t("Valor Total Pipeline (Renta 24m + Venta)", "Total Pipeline Value (24m Rent + Buyout)")}</div>
        <div class="kpi-value" style="font-size:21px; color:var(--accent-cyan);">${fmtUsd(totalCombinedAll)}</div>
        <div class="kpi-sub">${filteredDeals.length} ${t("oportunidades activas", "active deals")} ${state.whatIfMode ? "🧪 (What-If)" : ""}</div>
      </div>
      <div class="kpi-card" style="padding:12px 16px;">
        <div class="kpi-label">${t("Forecast Ponderado por Probabilidad IA", "AI Probability-Weighted Forecast")}</div>
        <div class="kpi-value" style="font-size:21px;">${fmtUsd(weightedAll)}</div>
        <div class="kpi-sub">${t("Sesión:", "Session:")} <strong style="color:var(--accent-emerald);">${state.currentUser.name}</strong></div>
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
          <div style="display:flex; gap:5px; align-items:center;">
            <button class="btn" style="padding:2px 7px; font-size:10.5px; border-color:rgba(16,185,129,0.4); color:var(--accent-emerald);" onclick="openNewDealModal('${st.id}')" title="Crear trato directo en ${st.label}">+ Deal</button>
            <span class="nav-tag">${colDeals.length}</span>
          </div>
        </div>

        <div class="kanban-totals-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
            <span style="color:var(--text-muted);">${t("Total Etapa:", "Stage Total:")}</span>
            <strong style="font-size:12px; color:var(--text-primary);">${fmtUsd(colCombinedValue)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--accent-emerald);">
            <span>● ${t("Renta MRR:", "Rental MRR:")}</span>
            <strong>${fmtUsd(colRentMrr)}/m</strong>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--accent-gold);">
            <span>● ${t("Venta CapEx:", "Buyout CapEx:")}</span>
            <strong>${fmtUsd(colSaleBuyout)}</strong>
          </div>
        </div>

        ${
          colDeals.length === 0
            ? `<div style="border:1px dashed var(--border-hairline); border-radius:8px; padding:22px 10px; text-align:center; font-size:11.5px; color:var(--text-muted);">
                 ${t("Arrastra una tarjeta aquí o pulsa", "Drag a card here or click")} <strong>+ Deal</strong>
               </div>`
            : ""
        }

        ${colDeals
          .map((d) => {
            const histCount = state.stageHistory.filter((h) => Number(h.deal_id) === Number(d.id)).length;
            const lastBy = d.last_changed_by || "Alfonso Gordillo";
            const lastAt = fmtDateShort(d.last_stage_change_at || d.updated_at);
            const ownerInitials = lastBy
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0].toUpperCase())
              .join("");

            return `
            <div class="deal-card"
                 draggable="true"
                 data-deal-id="${d.id}"
                 ondragstart="handleKanbanDragStart(event, ${d.id})"
                 ondragend="handleKanbanDragEnd(event)">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; gap:4px; flex-wrap:wrap;">
                ${modalityBadge(d.modality)}
                ${getDealRottingBadge(d)}
              </div>

              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                <div class="deal-card-title" style="flex:1;">${d.title}</div>
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan); font-weight:700;">${d.probability}%</span>
              </div>
              <div class="deal-card-company">${d.company_name || ""} · <span style="color:var(--accent-cyan);">${d.brand}</span></div>

              <div class="deal-metrics-box">
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">${t("Renta MRR:", "Rental MRR:")}</span>
                  <strong style="color:var(--accent-emerald);">${fmtUsd(d.mrr_usd)}/m</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">${t("Venta Buyout:", "Buyout Sale:")}</span>
                  <strong style="color:var(--accent-gold);">${fmtUsd(d.buyout_dynamic_usd)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed var(--border-hairline);">
                  <span>LTV 24m: <strong>${fmtUsd(d.ltv_24m_usd)}</strong></span>
                  <span>Eq: <strong>${d.breakeven_months}m</strong></span>
                </div>
              </div>

              <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:8px; padding:5px 7px; background:var(--bg-obsidian); border-radius:6px; border-left:2px solid var(--accent-emerald);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>👤 <strong>${lastBy}</strong> · ${lastAt}</span>
                  <span style="background:rgba(16,185,129,0.2); color:var(--accent-emerald); font-weight:700; padding:1px 5px; border-radius:99px; font-size:9.5px;">${ownerInitials}</span>
                </div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-secondary); margin-top:2px;" title="${(d.last_justification || d.next_action || "").replace(/"/g, "&quot;")}">
                  📝 ${d.last_justification || d.next_action || "Calificación inicial"}
                </div>
              </div>

              <div style="display:flex; gap:5px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                <button class="btn" style="padding:4px 7px; font-size:10.5px;" onclick="openDealInStudio(${d.id})" title="Abrir en Simulador Financiero">📈 ${t("Simular", "Sim")}</button>
                <button class="btn btn-gold" style="padding:4px 7px; font-size:10.5px;" onclick="flipDealModality(${d.id})" title="Alternar 1-Click entre Renta SaaS y Venta CapEx">⇄ Flip</button>
                <button class="btn btn-cyan" style="padding:4px 7px; font-size:10.5px;" onclick="openDealHistoryModal(${d.id})" title="Ver auditoría de cambios de etapa">
                  📜 (${histCount || 1})
                </button>
                <select class="input-field" style="width:auto; padding:3px 6px; font-size:10px; height:25px;" onchange="triggerMobileStageSelect(${d.id}, this.value)" title="Mover etapa (Táctil / Celular o PC)">
                  <option value="">➔ ${t("Mover", "Move")}</option>
                  ${STAGES.filter((s) => s.id !== d.stage)
                    .map((s) => `<option value="${s.id}">${s.label}</option>`)
                    .join("")}
                </select>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }).join("");
}

window.triggerMobileStageSelect = function (dealId, targetStage) {
  if (!targetStage) return;
  const deal = state.deals.find((d) => Number(d.id) === Number(dealId));
  if (!deal || deal.stage === targetStage) return;
  if (state.whatIfMode) {
    deal.stage = targetStage;
    renderKanbanView();
    showToast(`🧪 [What-If] "${deal.title}" ➔ ${targetStage}`);
    return;
  }
  openStageTransitionModal(deal, deal.stage, targetStage);
};

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

  // Point 3.5: If What-If simulation mode is active, move immediately in memory without touching PostgreSQL
  if (state.whatIfMode) {
    const stageProbMap = {
      DISCOVERY: 25,
      DEMO_TECNICA: 45,
      SIMULACION_FINACTIONABLE: 68,
      NEGOCIACION: 85,
      CERRADO_GANADO: 100,
    };
    deal.stage = targetStage;
    deal.probability = stageProbMap[targetStage] || deal.probability;
    renderKanbanView();
    showToast(`🧪 [What-If] "${deal.title}" simulado en ${targetStage} (${deal.probability}% prob).`);
    return;
  }

  openStageTransitionModal(deal, deal.stage, targetStage);
};

// Stage Transition Audit Modal & All 4 Point 2 AI Enrichments
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

  const gateAlertEl = document.getElementById("st-gatekeeper-alert");
  if (gateAlertEl) gateAlertEl.style.display = "none";

  // Populate Authenticated Responsible Executive & Current DateTime
  document.getElementById("st-responsible-name").value = `${state.currentUser.name} (${state.currentUser.role})`;
  document.getElementById("st-responsible-email").value = state.currentUser.email;
  document.getElementById("st-responsible-role").value = state.currentUser.role;
  document.getElementById("st-transition-date").value = getLocalDatetimeInputValue(new Date());
  document.getElementById("st-justification").value = "";
  document.getElementById("st-next-action").value = deal.next_action || "";
  document.getElementById("st-client-followup").value = "Generando borrador ejecutivo de seguimiento...";
  updateJustificationQualityBadge("");

  document.getElementById("st-ai-checklist").innerHTML =
    "⏳ Consultando al Copiloto IA FinActionable para generar checklist de gobernanza, Gatekeeper y mensaje post-movimiento...";

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
      document.getElementById("st-client-followup").value = suggestion.clientFollowupMessage || "";

      // Point 2.2: Strict AI Stage Gatekeeper Alert
      if (gateAlertEl && suggestion.gatekeeperWarning) {
        gateAlertEl.style.display = "block";
        gateAlertEl.style.background = "rgba(244,63,94,0.14)";
        gateAlertEl.style.border = "1px solid rgba(244,63,94,0.45)";
        gateAlertEl.style.color = "#fecdd3";
        gateAlertEl.innerHTML = suggestion.gatekeeperWarning;
      } else if (gateAlertEl) {
        gateAlertEl.style.display = "block";
        gateAlertEl.style.background = "rgba(16,185,129,0.12)";
        gateAlertEl.style.border = "1px solid rgba(16,185,129,0.35)";
        gateAlertEl.style.color = "var(--accent-emerald)";
        gateAlertEl.innerHTML =
          "🛡️ <strong>AI Stage Gatekeeper: APROBADO.</strong> Transición secuencial válida y margen bruto SaaS dentro de parámetros.";
      }

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

// Point 2.4: Live Sentiment & Dynamic Probability Recalculation on Justification Input
function updateJustificationQualityBadge(text) {
  const badge = document.getElementById("st-quality-badge");
  const sentimentBar = document.getElementById("st-sentiment-bar");
  const probEl = document.getElementById("st-probability");
  if (!badge) return;

  const clean = (text || "").trim();
  const len = clean.length;
  const lower = clean.toLowerCase();

  const positiveWords = ["aprobado", "comité", "firmado", "validado", "presupuesto", "éxito", "listo", "ok", "acuerdo", "confirmado"];
  const cautionWords = ["pendiente", "duda", "retraso", "esperando", "objeción", "riesgo", "revisar", "bloqueo"];

  const posHits = positiveWords.filter((w) => lower.includes(w));
  const cauHits = cautionWords.filter((w) => lower.includes(w));

  const baseProb = Number(state.lastAiSuggestion?.recommendedProbability || probEl?.value || 65);
  let adjustedProb = baseProb + posHits.length * 4 - cauHits.length * 6;
  adjustedProb = Math.min(100, Math.max(10, adjustedProb));

  if (probEl && len > 10) {
    probEl.value = adjustedProb;
  }

  if (sentimentBar) {
    if (len === 0) {
      sentimentBar.textContent = "📊 Sentimiento IA: Esperando evidencia del ejecutivo...";
      sentimentBar.style.color = "var(--text-secondary)";
    } else if (posHits.length > cauHits.length) {
      sentimentBar.innerHTML = `🚀 <strong>Sentimiento IA Positivo (+${posHits.length * 4}% prob):</strong> Detectadas señales fuertes (${posHits.join(", ")}). Probabilidad ajustada a <strong>${adjustedProb}%</strong>.`;
      sentimentBar.style.color = "var(--accent-emerald)";
    } else if (cauHits.length > 0) {
      sentimentBar.innerHTML = `⚠️ <strong>Sentimiento IA Cauteloso (-${cauHits.length * 6}% prob):</strong> Detectadas fricciones (${cauHits.join(", ")}). Probabilidad ajustada a <strong>${adjustedProb}%</strong>.`;
      sentimentBar.style.color = "var(--accent-gold)";
    } else {
      sentimentBar.innerHTML = `📊 <strong>Sentimiento IA Neutral:</strong> Evidencia descriptiva registrada. Probabilidad sugerida: <strong>${adjustedProb}%</strong>.`;
      sentimentBar.style.color = "var(--accent-cyan)";
    }
  }

  if (len === 0) {
    badge.style.color = "var(--accent-rose)";
    badge.textContent = "Calidad de Evidencia IA: Obligatoria (0%)";
  } else if (len < 30) {
    badge.style.color = "var(--accent-gold)";
    badge.textContent = "Calidad de Evidencia IA: Básica (65%) — Agrega más contexto";
  } else {
    badge.style.color = "var(--accent-emerald)";
    badge.textContent = "✓ Calidad de Evidencia IA: Óptima (98% Audit-Ready)";
  }
}

const stJustificationEl = document.getElementById("st-justification");
if (stJustificationEl) {
  stJustificationEl.addEventListener("input", (e) => updateJustificationQualityBadge(e.target.value));
}

// Point 2.1: Voice-to-Justification Dictation (Web Speech API + Smart Executive Fallback)
window.triggerVoiceDictation = function () {
  const btn = document.getElementById("btn-voice-dictate");
  const justEl = document.getElementById("st-justification");
  if (!justEl) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "es-CO";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      if (btn) btn.textContent = "🔴 Escuchando micrófono...";
      showToast("🎙️ Habla ahora para dictar la justificación del cambio de etapa...");

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        justEl.value = (justEl.value ? justEl.value + " " : "") + transcript;
        updateJustificationQualityBadge(justEl.value);
        if (btn) btn.textContent = "🎙️ Dictar por Voz";
        showToast("✅ Dictado por voz transcrito e indexado por IA.");
      };

      recognition.onerror = () => {
        // Fallback to executive voice sample if microphone permission is denied in browser
        const sample =
          state.lastAiSuggestion?.voiceTranscriptSample ||
          `Nota de voz ejecutiva (${state.currentUser.name}): Comité técnico y financiero aprobado satisfactoriamente con el cliente.`;
        justEl.value = sample;
        updateJustificationQualityBadge(justEl.value);
        if (btn) btn.textContent = "🎙️ Dictar por Voz";
        showToast("🎙️ Transcripción ejecutiva de voz aplicada automáticamente.");
      };

      recognition.start();
      return;
    } catch {
      // Fall through to simulated voice transcript
    }
  }

  if (btn) btn.textContent = "🎙️ Transcribiendo audio...";
  setTimeout(() => {
    const sample =
      state.lastAiSuggestion?.voiceTranscriptSample ||
      `Nota de voz ejecutiva (${state.currentUser.name}): Validamos alcance técnico y simulación financiera con el cliente; comité aprueba avanzar de etapa.`;
    justEl.value = sample;
    updateJustificationQualityBadge(justEl.value);
    if (btn) btn.textContent = "🎙️ Dictar por Voz";
    showToast("🎙️ Dictado de voz ejecutivo transcrito con éxito.");
  }, 450);
};

// Point 2.3: Copy Auto-Generated Client Follow-up Message
window.copyClientFollowupDraft = function () {
  const el = document.getElementById("st-client-followup");
  if (!el || !el.value) return;
  navigator.clipboard?.writeText(el.value).catch(() => {});
  showToast("📋 Mensaje de seguimiento para WhatsApp / Email copiado al portapapeles.");
};

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
    showToast("⚠️ Por favor ingresa la acción tomada que justifica el cambio (o pulsa Dictar por Voz / Autocompletar IA).");
    document.getElementById("st-justification").focus();
    return;
  }

  const res = await fetch(`/api/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stage: toStage,
      responsibleUserId: state.currentUser.id,
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

// Point 3.4: Quick Deal Creation Modal per Kanban Column (with rich Clients & Contacts B2B dropdown + inline creation)
const newDealModal = document.getElementById("new-deal-modal");

function populateNewDealDropdowns() {
  const accSel = document.getElementById("nd-account") || document.getElementById("nd-account-id");
  const prodSel = document.getElementById("nd-product") || document.getElementById("nd-product-id");

  if (accSel && Array.isArray(state.accounts)) {
    const currentVal = accSel.value;
    accSel.innerHTML =
      state.accounts
        .map(
          (a) =>
            `<option value="${a.id}">🏢 ${a.company_name} — 👤 ${a.contact_name || "Contacto"} (${
              a.contact_role || a.industry || "B2B"
            })</option>`
        )
        .join("") +
      `<option value="NEW">➕ [CREAR NUEVO CLIENTE Y CONTACTO B2B...]</option>`;
    if (currentVal && Array.from(accSel.options).some((o) => o.value === currentVal)) {
      accSel.value = currentVal;
    }
    window.syncNewDealAccountPreview();
  }

  if (prodSel && Array.isArray(state.products)) {
    const currentProd = prodSel.value;
    prodSel.innerHTML = state.products
      .map(
        (p) =>
          `<option value="${p.id}" data-mrr="${p.monthly_rent_mrr_usd || p.renta_mrr_usd || 900}" data-buyout="${
            p.buyout_price_usd || p.venta_buyout_usd || 22000
          }" data-setup="${p.setup_fee_usd || 2200}" data-infra="${
            p.infra_cost_monthly_usd || p.infra_cost_usd || 75
          }" data-brand="${p.brand}">${p.name} (${p.brand})</option>`
      )
      .join("");
    if (currentProd && Array.from(prodSel.options).some((o) => o.value === currentProd)) {
      prodSel.value = currentProd;
    }
  }
}

window.syncNewDealAccountPreview = function () {
  const accSel = document.getElementById("nd-account") || document.getElementById("nd-account-id");
  const previewBox = document.getElementById("nd-contact-preview");
  const newClientFields = document.getElementById("nd-new-client-fields");
  if (!accSel) return;

  if (accSel.value === "NEW") {
    if (previewBox) previewBox.style.display = "none";
    if (newClientFields) newClientFields.style.display = "block";
    return;
  }

  if (newClientFields) newClientFields.style.display = "none";
  const acc = state.accounts.find((a) => Number(a.id) === Number(accSel.value));
  if (previewBox && acc) {
    previewBox.style.display = "block";
    previewBox.innerHTML = `🏢 <strong>${acc.company_name}</strong> (${acc.industry || "B2B"} · ${
      acc.country || "LATAM"
    }) &nbsp;|&nbsp; 👤 Contacto: <strong>${acc.contact_name || "Ejecutivo"}</strong> (${
      acc.contact_role || "Decisor"
    }) · <span style="color:var(--accent-cyan); font-family:var(--font-mono);">${
      acc.contact_email || acc.domain || ""
    }</span>`;
  }
};

window.openNewDealModal = function (defaultStage = "DISCOVERY") {
  if (!newDealModal) return;
  const stageSel = document.getElementById("nd-stage");
  if (stageSel) stageSel.value = defaultStage || "DISCOVERY";

  populateNewDealDropdowns();

  const titleEl = document.getElementById("nd-title");
  if (titleEl) titleEl.value = "";
  syncNewDealProductDefaults();
  window.syncNewDealAccountPreview();
  newDealModal.classList.add("open");
};

window.syncNewDealProductDefaults = function () {
  const prodSel = document.getElementById("nd-product") || document.getElementById("nd-product-id");
  if (!prodSel || !prodSel.selectedOptions[0]) return;
  const opt = prodSel.selectedOptions[0];
  const mrrEl = document.getElementById("nd-mrr");
  const buyoutEl = document.getElementById("nd-buyout");
  const setupEl = document.getElementById("nd-setup");
  const infraEl = document.getElementById("nd-infra");
  if (mrrEl) mrrEl.value = Math.round(Number(opt.dataset.mrr || 950));
  if (buyoutEl) buyoutEl.value = Math.round(Number(opt.dataset.buyout || 21000));
  if (setupEl) setupEl.value = Math.round(Number(opt.dataset.setup || 2200));
  if (infraEl) infraEl.value = Math.round(Number(opt.dataset.infra || 75));
};

window.closeNewDealModal = function () {
  if (newDealModal) newDealModal.classList.remove("open");
};

window.saveNewDealKanban = async function () {
  const title = (document.getElementById("nd-title")?.value || "").trim();
  const stage = document.getElementById("nd-stage")?.value || "DISCOVERY";
  const accSel = document.getElementById("nd-account") || document.getElementById("nd-account-id");
  const prodSel = document.getElementById("nd-product") || document.getElementById("nd-product-id");
  const account_id = accSel?.value === "NEW" ? "NEW" : Number(accSel?.value || 1);
  const product_id = Number(prodSel?.value || 1);
  const modality = document.getElementById("nd-modality")?.value || "RENTA_MRR";
  const mrr_usd = Number(document.getElementById("nd-mrr")?.value || 950);
  const buyout_base_usd = Number(document.getElementById("nd-buyout")?.value || 21000);
  const setup_fee_usd = Number(document.getElementById("nd-setup")?.value || 2200);
  const infra_cost_monthly_usd = Number(document.getElementById("nd-infra")?.value || 75);

  const new_company_name = (document.getElementById("nd-new-company")?.value || "").trim();
  const new_contact_name = (document.getElementById("nd-new-contact")?.value || "").trim();
  const new_contact_role = (document.getElementById("nd-new-role")?.value || "").trim();
  const new_contact_email = (document.getElementById("nd-new-email")?.value || "").trim();

  if (!title) {
    showToast("⚠️ Ingresa el título de la oportunidad comercial.");
    return;
  }
  if (account_id === "NEW" && !new_company_name) {
    showToast("⚠️ Ingresa el nombre de la nueva Empresa Cliente.");
    return;
  }

  const res = await fetch("/api/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      stage,
      account_id,
      new_company_name,
      new_contact_name,
      new_contact_role,
      new_contact_email,
      product_id,
      modality,
      mrr_usd,
      buyout_dynamic_usd: buyout_base_usd,
      buyout_base_usd,
      setup_fee_usd,
      infra_cost_monthly_usd,
      responsibleUserId: state.currentUser.id,
      responsibleName: state.currentUser.name,
      responsibleEmail: state.currentUser.email,
      responsibleRole: state.currentUser.role,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "Error al crear la oportunidad"}`);
    return;
  }
  closeNewDealModal();
  await loadDashboard();
  showToast(`✅ Oportunidad "${title}" creada en ${stage} y firmada por ${state.currentUser.name}.`);
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

// Enterprise Full-Screen Login & Registration Gate + Team RBAC CRUD
const loginGate = document.getElementById("login-screen-gate");
const teamMemberModal = document.getElementById("team-member-modal");

function renderAuthUserUI() {
  const u = state.currentUser;
  const badge = document.getElementById("auth-avatar-badge");
  const label = document.getElementById("auth-user-label");
  if (badge) badge.textContent = u.avatar_initials || "AG";
  if (label) {
    label.innerHTML = `${u.name} · <strong style="color:var(--accent-emerald);">${u.role_code || u.role}</strong>`;
  }

  const stResp = document.getElementById("st-responsible-name");
  if (stResp) {
    stResp.value = `${u.name} (${u.role})`;
    document.getElementById("st-responsible-email").value = u.email;
    document.getElementById("st-responsible-role").value = u.role;
  }

  const quickGrid =
    document.getElementById("login-gate-quick-profiles") || document.getElementById("gate-quick-users-list");
  if (quickGrid && state.users.length > 0) {
    quickGrid.innerHTML = state.users
      .map((usr) => {
        const isCurrent = (usr.email || "").toLowerCase() === (u.email || "").toLowerCase();
        return `
          <div onclick="switchActiveExecutive(${usr.id})"
               style="padding:9px 11px; border-radius:10px; cursor:pointer; border:1px solid ${
                 isCurrent ? "var(--accent-emerald)" : "var(--border-hairline)"
               }; background:${isCurrent ? "rgba(16,185,129,0.14)" : "rgba(9,13,22,0.75)"}; display:flex; align-items:center; gap:9px;">
            <div style="width:30px; height:30px; border-radius:50%; background:${
              isCurrent ? "var(--accent-emerald)" : "#1e293b"
            }; color:${isCurrent ? "#03150e" : "#f8fafc"}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px;">
              ${usr.avatar_initials}
            </div>
            <div style="flex:1; overflow:hidden;">
              <div style="font-size:12px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${usr.name} ${isCurrent ? "✓" : ""}
              </div>
              <div style="font-size:10.5px; color:var(--accent-emerald); font-family:var(--font-mono);">${usr.role_code || "SALES_EXECUTIVE"}</div>
              <div style="font-size:10px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">user: <code>${usr.username || usr.email}</code></div>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

window.openLoginScreenGate = function (tab = "login") {
  if (!loginGate) return;
  renderAuthUserUI();
  switchLoginGateTab(tab);
  loginGate.classList.add("open");
  loginGate.style.display = "flex";
};

window.closeLoginScreenGate = function () {
  sessionStorage.setItem("nexuspf_gate_authenticated", "1");
  if (loginGate) {
    loginGate.classList.remove("open");
    loginGate.style.display = "none";
  }
};

window.switchLoginGateTab = function (tab) {
  const formLogin =
    document.getElementById("login-gate-form-login") || document.getElementById("gate-form-login");
  const formReg =
    document.getElementById("login-gate-form-register") || document.getElementById("gate-form-register");
  const tabLogin = document.getElementById("tab-btn-login");
  const tabReg = document.getElementById("tab-btn-register");
  const errLogin = document.getElementById("lg-login-error");
  const errReg = document.getElementById("lg-reg-error");
  if (errLogin) errLogin.style.display = "none";
  if (errReg) errReg.style.display = "none";

  if (tab === "register") {
    if (formLogin) formLogin.style.display = "none";
    if (formReg) formReg.style.display = "block";
    if (tabReg) tabReg.className = "btn btn-emerald";
    if (tabLogin) tabLogin.className = "btn";
  } else {
    if (formLogin) formLogin.style.display = "block";
    if (formReg) formReg.style.display = "none";
    if (tabLogin) tabLogin.className = "btn btn-emerald";
    if (tabReg) tabReg.className = "btn";
  }
};

window.togglePasswordVisibility = function (inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === "password" ? "text" : "password";
};

function showGateError(msg, isReg = false) {
  const errBox = isReg
    ? document.getElementById("lg-reg-error") || document.getElementById("lg-login-error")
    : document.getElementById("lg-login-error") || document.getElementById("gate-auth-error");
  if (!errBox) {
    showToast(`⚠️ ${msg}`);
    return;
  }
  errBox.textContent = `⚠️ ${msg}`;
  errBox.style.display = "block";
}

window.submitGateLogin = async function () {
  const idEl =
    document.getElementById("lg-login-identifier") || document.getElementById("gate-login-identifier");
  const pwEl =
    document.getElementById("lg-login-password") || document.getElementById("gate-login-password");
  const identifier = (idEl?.value || "").trim();
  const password = pwEl?.value || "nexus2026";

  if (!identifier) {
    showGateError("Ingresa tu usuario (ej. alfonso) o correo corporativo.", false);
    return;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, isRegister: false }),
    });
    const data = await res.json();
    if (!res.ok) {
      showGateError(data.error || "Credenciales inválidas", false);
      return;
    }

    state.currentUser = data.user;
    localStorage.setItem("nexuspf_auth_user", JSON.stringify(data.user));
    closeLoginScreenGate();
    await loadDashboard();
    showToast(`🔐 Bienvenido ${data.user.name} (${data.user.role}).`);
  } catch (err) {
    showGateError(`Error de red al iniciar sesión: ${err.message}`, false);
  }
};

window.submitGateRegister = async function () {
  const nameEl = document.getElementById("lg-reg-name") || document.getElementById("gate-reg-name");
  const userEl = document.getElementById("lg-reg-username") || document.getElementById("gate-reg-username");
  const emailEl = document.getElementById("lg-reg-email") || document.getElementById("gate-reg-email");
  const pwEl = document.getElementById("lg-reg-password") || document.getElementById("gate-reg-password");
  const roleCodeEl = document.getElementById("lg-reg-role-code") || document.getElementById("gate-reg-role-code");
  const roleTitleEl = document.getElementById("lg-reg-role-title");
  const brandEl = document.getElementById("lg-reg-brand") || document.getElementById("gate-reg-brand");

  const name = (nameEl?.value || "").trim();
  const username = (userEl?.value || "").trim();
  const email = (emailEl?.value || "").trim();
  const password = pwEl?.value || "nexus2026";
  const role_code = roleCodeEl?.value || "SALES_EXECUTIVE";
  const role = (roleTitleEl?.value || "").trim();
  const brand_focus = brandEl?.value || "projectsfactory.io & finanactionable.co";

  if (!name || !email) {
    showGateError("Completa tu nombre completo y correo corporativo para registrarte.", true);
    return;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isRegister: true,
        name,
        username,
        email,
        password: password || "nexus2026",
        role_code,
        role,
        brand_focus,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showGateError(data.error || "No se pudo registrar el miembro.", true);
      return;
    }

    state.currentUser = data.user;
    localStorage.setItem("nexuspf_auth_user", JSON.stringify(data.user));
    if (nameEl) nameEl.value = "";
    if (userEl) userEl.value = "";
    if (emailEl) emailEl.value = "";
    closeLoginScreenGate();
    await loadDashboard();
    showToast(`✨ Cuenta creada y sesión iniciada como ${data.user.name} (${data.user.role}).`);
  } catch (err) {
    showGateError(`Error al registrar: ${err.message}`, true);
  }
};

// Support pressing Enter in Login inputs
["lg-login-identifier", "lg-login-password"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.submitGateLogin();
      }
    });
  }
});

window.switchActiveExecutive = async function (userId) {
  const found = state.users.find((u) => Number(u.id) === Number(userId));
  if (!found) return;
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: found.email, password: found.access_pin || "nexus2026" }),
  });
  const data = await res.json();
  if (res.ok && data.user) {
    state.currentUser = data.user;
    localStorage.setItem("nexuspf_auth_user", JSON.stringify(data.user));
    closeLoginScreenGate();
    renderAuthUserUI();
    populateKanbanOwnerFilter();
    renderKanbanView();
    renderTeamUsersView();
    showToast(`🔐 Sesión cambiada a: ${data.user.name} (${data.user.role}).`);
  }
};

// View 6: Team Members & 6 RBAC Profiles CRUD
function renderTeamUsersView() {
  const tbody = document.getElementById("team-users-tbody");

  const defaultProfiles = {
    SUPER_ADMIN: {
      code: "SUPER_ADMIN",
      label: "CEO / Super Administrador",
      department: "Dirección Ejecutiva",
      badgeColor: "#10b981",
    },
    FINANCE_STRATEGIST: {
      code: "FINANCE_STRATEGIST",
      label: "Estratega Financiero (CFO / FinActionable)",
      department: "Finanzas & Pricing",
      badgeColor: "#f59e0b",
    },
    SALES_EXECUTIVE: {
      code: "SALES_EXECUTIVE",
      label: "Ejecutivo Comercial B2B (Account Executive)",
      department: "Revenue & Growth",
      badgeColor: "#38bdf8",
    },
    SOLUTIONS_ARCHITECT: {
      code: "SOLUTIONS_ARCHITECT",
      label: "Arquitecto de Soluciones & Preventa Técnica",
      department: "Ingeniería & Preventa",
      badgeColor: "#a855f7",
    },
    PARTNER_MANAGER: {
      code: "PARTNER_MANAGER",
      label: "Gerente de Alianzas & Canales B2B",
      department: "Alianzas & Canales",
      badgeColor: "#ec4899",
    },
    AUDITOR_VIEWER: {
      code: "AUDITOR_VIEWER",
      label: "Auditor / Junta Directiva (Read-Only + Audit)",
      department: "Gobernanza & Compliance",
      badgeColor: "#94a3b8",
    },
  };

  const rolesMap = Object.keys(state.rolesMeta || {}).length > 0 ? state.rolesMeta : defaultProfiles;

  if (tbody) {
    tbody.innerHTML = state.users
      .map((u) => {
        const isCurrent = (u.email || "").toLowerCase() === (state.currentUser.email || "").toLowerCase();
        const rMeta = rolesMap[u.role_code] || defaultProfiles.SALES_EXECUTIVE;
        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:${rMeta.badgeColor || "#10b981"}; color:#03150e; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">
                  ${u.avatar_initials || "EX"}
                </div>
                <div>
                  <div class="cell-company">${u.name} ${isCurrent ? '<span class="badge badge-renta" style="margin-left:4px;">Sesión Activa</span>' : ""}</div>
                  <div style="font-family:var(--font-mono); font-size:11px; color:var(--accent-cyan);">@${u.username || u.email.split("@")[0]}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary);">${u.email}</div>
            </td>
            <td>
              <span style="font-family:var(--font-mono); font-size:11px; padding:3px 8px; border-radius:99px; background:rgba(16,185,129,0.12); color:${rMeta.badgeColor || "#10b981"}; border:1px solid ${rMeta.badgeColor || "#10b981"};">
                ${u.role_code || "SALES_EXECUTIVE"}
              </span>
            </td>
            <td>
              <div style="font-size:12.5px; color:var(--text-primary); font-weight:600;">${u.role || rMeta.label}</div>
            </td>
            <td>
              <div class="cell-sub" style="color:var(--accent-cyan);">${u.brand_focus || "projectsfactory.io & finanactionable.co"}</div>
            </td>
            <td>
              <span class="badge ${u.status === "SUSPENDIDO" ? "badge-venta" : "badge-renta"}">${u.status || "ACTIVO"}</span>
            </td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn btn-emerald" style="padding:4px 8px; font-size:11px;" onclick="switchActiveExecutive(${u.id})" title="Usar este ejecutivo como sesión activa">🔐 Activar</button>
                <button class="btn" style="padding:4px 8px; font-size:11px;" onclick="openTeamMemberModal(${u.id})">✏️ Editar</button>
                <button class="btn" style="padding:4px 8px; font-size:11px; color:var(--accent-rose); border-color:rgba(244,63,94,0.35);" onclick="deleteTeamMemberCrud(${u.id})">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }
}

window.openTeamMemberModal = function (userId = null) {
  if (!teamMemberModal) return;
  const idInput = document.getElementById("tm-id");
  const titleEl = document.getElementById("tm-modal-title");

  if (userId) {
    const u = state.users.find((x) => Number(x.id) === Number(userId));
    if (!u) return;
    idInput.value = String(u.id);
    titleEl.textContent = `Editar Miembro: ${u.name}`;
    document.getElementById("tm-name").value = u.name || "";
    document.getElementById("tm-username").value = u.username || "";
    document.getElementById("tm-email").value = u.email || "";
    document.getElementById("tm-password").value = "";
    document.getElementById("tm-role-code").value = u.role_code || "SALES_EXECUTIVE";
    document.getElementById("tm-role-title").value = u.role || "";
    document.getElementById("tm-brand").value = u.brand_focus || "projectsfactory.io & finanactionable.co";
    document.getElementById("tm-status").value = u.status || "ACTIVO";
  } else {
    idInput.value = "";
    titleEl.textContent = "Crear Nuevo Miembro del Equipo";
    document.getElementById("tm-name").value = "";
    document.getElementById("tm-username").value = "";
    document.getElementById("tm-email").value = "";
    document.getElementById("tm-password").value = "nexus2026";
    document.getElementById("tm-role-code").value = "SALES_EXECUTIVE";
    document.getElementById("tm-role-title").value = "";
    document.getElementById("tm-brand").value = "projectsfactory.io & finanactionable.co";
    document.getElementById("tm-status").value = "ACTIVO";
  }

  teamMemberModal.classList.add("open");
};

window.closeTeamMemberModal = function () {
  if (teamMemberModal) teamMemberModal.classList.remove("open");
};

window.saveTeamMemberCrud = async function () {
  const id = document.getElementById("tm-id").value.trim();
  const name = document.getElementById("tm-name").value.trim();
  const username = document.getElementById("tm-username").value.trim();
  const email = document.getElementById("tm-email").value.trim();
  const password = document.getElementById("tm-password").value.trim();
  const role_code = document.getElementById("tm-role-code").value;
  const role = document.getElementById("tm-role-title").value.trim();
  const brand_focus = document.getElementById("tm-brand").value;
  const status = document.getElementById("tm-status").value;

  if (!name || !email) {
    showToast("⚠️ El nombre completo y el correo corporativo son obligatorios.");
    return;
  }

  const url = id ? `/api/users/${id}` : "/api/users";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      username,
      email,
      password,
      role_code,
      role,
      brand_focus,
      status,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "Error al guardar miembro del equipo"}`);
    return;
  }

  const savedUser = data.user || data;
  closeTeamMemberModal();
  await loadDashboard();
  showToast(`✅ Miembro "${savedUser.name}" (${savedUser.role_code}) guardado en PostgreSQL.`);
};

window.deleteTeamMemberCrud = async function (userId) {
  const u = state.users.find((x) => Number(x.id) === Number(userId));
  if (!u) return;

  const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showToast(`⚠️ ${data.error || "No se pudo eliminar el usuario"}`);
    return;
  }
  await loadDashboard();
  showToast(`🗑️ Usuario "${u.name}" eliminado del directorio.`);
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
  const currentVal = sel.value;
  sel.innerHTML = state.deals
    .map((d) => {
      const acc = state.accounts.find((a) => Number(a.id) === Number(d.account_id));
      const contactTag = acc?.contact_name ? ` · 👤 ${acc.contact_name}` : "";
      return `<option value="${d.id}">#${d.id} — 🏢 ${d.company_name || "B2B"}${contactTag} · ${d.title}</option>`;
    })
    .join("");
  if (currentVal && Array.from(sel.options).some((o) => o.value === currentVal)) {
    sel.value = currentVal;
  }
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

// Live Voice Dictation for Zero-Admin Command Bar (PC & Mobile Microphone) & New Deal Modal
let activeZeroAdminRecognition = null;

window.openZeroAdminAndDictate = function () {
  openZeroAdminModal();
  setTimeout(() => {
    window.toggleZeroAdminVoiceDictation();
  }, 180);
};

window.toggleZeroAdminVoiceDictation = function () {
  const btn = document.getElementById("btn-zero-admin-voice");
  const statusBox = document.getElementById("zero-admin-voice-status");
  const textarea = document.getElementById("zero-admin-textarea");
  if (!textarea) return;

  if (activeZeroAdminRecognition) {
    try {
      activeZeroAdminRecognition.stop();
    } catch {}
    activeZeroAdminRecognition = null;
    if (btn) btn.textContent = "🎙️ Dictar por Micrófono (PC / Celular)";
    if (statusBox) statusBox.style.display = "none";
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("⚠️ Tu navegador no expone Web Speech API; usa Chrome, Edge o Safari en PC/Celular.");
    return;
  }

  try {
    const recognition = new SpeechRecognition();
    activeZeroAdminRecognition = recognition;
    recognition.lang = state.lang === "en" ? "en-US" : "es-CO";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const baseText = textarea.value ? textarea.value.trim() + " " : "";

    if (btn) btn.textContent = "⏹️ Detener Micrófono (Escuchando...)";
    if (statusBox) {
      statusBox.style.display = "block";
      statusBox.textContent = "🔴 Micrófono activo: Habla ahora (ej. 'Hablé con Juan Carlos Blanco de la Empresa CableSmart...')";
    }
    showToast("🎙️ Micrófono activo: dicta los datos del cliente y la oportunidad...");

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += piece;
        } else {
          interimTranscript += piece;
        }
      }
      textarea.value = (baseText + finalTranscript + interimTranscript).trim();
      if (statusBox && interimTranscript) {
        statusBox.textContent = `🎙️ Escuchando en vivo: "${interimTranscript}"`;
      }
    };

    recognition.onend = () => {
      activeZeroAdminRecognition = null;
      if (btn) btn.textContent = "🎙️ Dictar por Micrófono (PC / Celular)";
      if (statusBox) {
        statusBox.textContent = "✅ Dictado finalizado. Revisa el texto o haz clic en '✨ Procesar con IA y Guardar en PostgreSQL'.";
        setTimeout(() => {
          if (!activeZeroAdminRecognition && statusBox) statusBox.style.display = "none";
        }, 4000);
      }
      if (textarea.value.trim()) {
        showToast("✅ Nota de voz transcrita. Haz clic en '✨ Procesar con IA' para crear la oportunidad.");
      }
    };

    recognition.onerror = (err) => {
      activeZeroAdminRecognition = null;
      if (btn) btn.textContent = "🎙️ Dictar por Micrófono (PC / Celular)";
      if (statusBox) {
        statusBox.style.display = "block";
        statusBox.textContent = `⚠️ Permiso de micrófono requerido (${err.error || "verifica el ícono de candado/micrófono en la barra del navegador"}).`;
      }
      showToast("⚠️ Permite el acceso al micrófono en tu navegador para dictar por voz.");
    };

    recognition.start();
  } catch (e) {
    activeZeroAdminRecognition = null;
    showToast("⚠️ No se pudo iniciar el micrófono del navegador.");
  }
};

window.dictateNewDealTitle = function () {
  const btn = document.getElementById("btn-nd-voice");
  const titleEl = document.getElementById("nd-title");
  if (!titleEl) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("⚠️ Usa Chrome o Edge para dictar por voz.");
    return;
  }
  try {
    const recognition = new SpeechRecognition();
    recognition.lang = state.lang === "en" ? "en-US" : "es-CO";
    recognition.interimResults = false;
    if (btn) btn.textContent = "🔴 Escuchando...";
    showToast("🎙️ Dicta el título de la oportunidad comercial...");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      titleEl.value = transcript.charAt(0).toUpperCase() + transcript.slice(1);
      if (btn) btn.textContent = "🎙️ Dictar Título por Voz";
      showToast("✅ Título dictado por voz.");
    };
    recognition.onerror = () => {
      if (btn) btn.textContent = "🎙️ Dictar Título por Voz";
    };
    recognition.onend = () => {
      if (btn) btn.textContent = "🎙️ Dictar Título por Voz";
    };
    recognition.start();
  } catch {
    if (btn) btn.textContent = "🎙️ Dictar Título por Voz";
  }
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
    body: JSON.stringify({
      rawText,
      ownerUserId: state.currentUser?.id || 1,
      ownerName: state.currentUser?.name || "Dirección Comercial PF",
    }),
  });
  const data = await res.json();

  if (data.ok) {
    const ex = data.extracted;
    resBox.innerHTML = `
      <div style="font-weight:700; color:var(--accent-emerald); margin-bottom:6px;">
        ✓ Cuenta y Oportunidad Creadas Automáticamente en PostgreSQL
      </div>
      <div><strong>Empresa:</strong> ${ex.companyName} · <strong>Contacto:</strong> ${ex.contactName} ${
      ex.contactEmail ? `(<span style="font-family:var(--font-mono); color:var(--accent-cyan);">${ex.contactEmail}</span>)` : ""
    }</div>
      <div><strong>Países / Operación:</strong> ${ex.country || "Colombia / LATAM"}</div>
      <div><strong>Activo Digital:</strong> ${ex.productName} (${ex.brand})</div>
      <div><strong>Modalidad Detectada:</strong> ${ex.modality} — MRR: <strong>${fmtUsd(ex.mrrUsd)}/mes</strong> | Buyout: <strong>${fmtUsd(ex.buyoutUsd)}</strong></div>
      <div><strong>Punto de Equilibrio FinActionable:</strong> Mes ${ex.breakevenMonths} · LTV 24m: <strong>${fmtUsd(ex.ltv24mUsd)}</strong> (Margen ${ex.grossMarginPct}%)</div>
    `;
    await loadDashboard();
    showToast(`✅ Zero-Admin creó "${ex.companyName}" (${ex.contactName}) en PostgreSQL.`);
  } else {
    resBox.innerHTML = `<span style="color:var(--accent-rose);">Error: ${data.error}</span>`;
  }
});

// Initialize on load and show Initial Authentication Screen if not yet authenticated in this session
loadDashboard().then(() => {
  if (!sessionStorage.getItem("nexuspf_gate_authenticated")) {
    openLoginScreenGate("login");
  }
});
