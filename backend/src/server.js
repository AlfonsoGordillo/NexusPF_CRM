import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 4400);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://nexuspf:nexuspf_secret@localhost:5440/nexuspf_crm",
});

// ---------------------------------------------------------------------------
// Core Helper: FinActionable Unit Economics & Cashflow Curve Calculator
// ---------------------------------------------------------------------------
function computeFinActionableEconomics({
  buyoutPrice = 20000,
  setupFee = 2500,
  monthlyRentMrr = 950,
  infraCostMonthly = 70,
  engHours = 120,
  hourlyEngCost = 45,
  maintenanceFeeBuyout = 250,
  horizonMonths = 36,
}) {
  const bPrice = Number(buyoutPrice) || 20000;
  const sFee = Number(setupFee) || 2500;
  const mrr = Number(monthlyRentMrr) || 950;
  const infra = Number(infraCostMonthly) || 70;
  const hours = Number(engHours) || 120;
  const hCost = Number(hourlyEngCost) || 45;
  const maint = Number(maintenanceFeeBuyout) || 250;
  const horizon = Math.min(Math.max(Number(horizonMonths) || 36, 12), 60);

  const initialBuildCost = hours * hCost;
  const netMonthlyRent = mrr - infra;
  const netMonthlyBuyoutMaint = Math.max(maint - infra * 0.5, 0);

  // Break-even month: when cumulative rental revenue exceeds buyout revenue
  const monthlyDelta = mrr - maint;
  const breakevenMonth =
    monthlyDelta > 0
      ? Number(((bPrice - sFee) / monthlyDelta).toFixed(1))
      : 99.0;

  const ltv24mRent = sFee + mrr * 24;
  const ltv36mRent = sFee + mrr * 36;
  const ltv24mBuyout = bPrice + maint * 24;
  const grossMarginRentPct =
    mrr > 0 ? Number((((mrr - infra) / mrr) * 100).toFixed(2)) : 0;

  const series = [];
  for (let m = 1; m <= horizon; m++) {
    const cumulativeRentGross = sFee + mrr * m;
    const cumulativeRentNet = sFee + netMonthlyRent * m - initialBuildCost * 0.35;
    const cumulativeBuyoutGross = bPrice + maint * (m - 1);
    const cumulativeBuyoutNet =
      bPrice + netMonthlyBuyoutMaint * (m - 1) - initialBuildCost;
    series.push({
      month: m,
      rentGross: Math.round(cumulativeRentGross),
      rentNet: Math.round(cumulativeRentNet),
      buyoutGross: Math.round(cumulativeBuyoutGross),
      buyoutNet: Math.round(cumulativeBuyoutNet),
    });
  }

  let strategicRecommendation = "RENTA_MRR";
  let narrative = "";
  if (breakevenMonth <= 22 && grossMarginRentPct >= 82) {
    strategicRecommendation = "RENTA_MRR";
    narrative = `FinActionable AI recomienda RENTA RECURRENTE (SaaS/AaaS): El flujo acumulado supera la venta única en el mes ${breakevenMonth}, generando $${ltv36mRent.toLocaleString("en-US")} USD a 36 meses con un margen bruto operativo del ${grossMarginRentPct}% sobre Render/Firebase y conservando el 100% de la propiedad intelectual en projectsfactory.io.`;
  } else {
    strategicRecommendation = "VENTA_CAPEX";
    narrative = `FinActionable AI recomienda VENTA LLAVE EN MANO (CapEx + Póliza): El punto de equilibrio frente a renta es de ${breakevenMonth} meses. Conviene capturar $${bPrice.toLocaleString("en-US")} USD de liquidez inmediata hoy más póliza de soporte de $${maint}/mes.`;
  }

  return {
    breakevenMonths: breakevenMonth,
    ltv24mRent,
    ltv36mRent,
    ltv24mBuyout,
    grossMarginRentPct,
    initialBuildCost,
    netMonthlyRent,
    strategicRecommendation,
    narrative,
    series,
  };
}

// ---------------------------------------------------------------------------
// 0. Automatic Schema Migration: RBAC Users (Authentication) & Kanban Audit
// ---------------------------------------------------------------------------
const RBAC_ROLES_META = {
  SUPER_ADMIN: {
    label: "Administrador General (C-Level / Founder)",
    permissions: "Control total: CRUD Usuarios, Catálogo IP, Kanban, Deal Studio, Modo What-If CEO y Servidor MCP",
  },
  FINANCE_STRATEGIST: {
    label: "Director Financiero (FinActionable Strategist)",
    permissions: "Autoridad sobre Simulador Venta vs. Renta, aprobación de precios Buyout/MRR, márgenes cloud y LTV",
  },
  SALES_EXECUTIVE: {
    label: "Ejecutivo Comercial B2B (Account Executive)",
    permissions: "Operación de Pipeline Kanban (Drag & Drop), Ingesta Zero-Admin (Ctrl+K), Smart Grid y cierre de cuentas",
  },
  SOLUTIONS_ARCHITECT: {
    label: "Arquitecto de Soluciones IA & Cloud",
    permissions: "Validación de Demos Técnicas, arquitectura de activos en Catálogo IP y consola de herramientas MCP",
  },
  PARTNER_MANAGER: {
    label: "Director de Alianzas & Canales White-Label",
    permissions: "Comercialización de licencias White-Label, gestión de partners B2B y cuentas corporativas",
  },
  AUDITOR_VIEWER: {
    label: "Auditor / Junta Directiva & Inversionistas",
    permissions: "Acceso de supervisión a métricas MRR/ARR, trazabilidad inmutable de etapas y curvas financieras",
  },
};

async function ensureAuthAndKanbanSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(60),
        name VARCHAR(120) NOT NULL,
        email VARCHAR(140) UNIQUE NOT NULL,
        role_code VARCHAR(50) DEFAULT 'SALES_EXECUTIVE',
        role VARCHAR(100) NOT NULL,
        brand_focus VARCHAR(60) DEFAULT 'projectsfactory.io & finanactionable.co',
        avatar_initials VARCHAR(6) NOT NULL,
        access_pin VARCHAR(80) DEFAULT 'nexus2026',
        status VARCHAR(25) DEFAULT 'ACTIVO',
        permissions_summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(60);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_code VARCHAR(50) DEFAULT 'SALES_EXECUTIVE';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(25) DEFAULT 'ACTIVO';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions_summary TEXT;

      CREATE TABLE IF NOT EXISTS deal_stage_history (
        id SERIAL PRIMARY KEY,
        deal_id INT REFERENCES deals(id) ON DELETE CASCADE,
        from_stage VARCHAR(40) NOT NULL,
        to_stage VARCHAR(40) NOT NULL,
        responsible_name VARCHAR(120) NOT NULL,
        responsible_email VARCHAR(140) NOT NULL,
        responsible_role VARCHAR(100) DEFAULT 'Executive',
        transition_date TIMESTAMP NOT NULL DEFAULT NOW(),
        justification TEXT NOT NULL,
        next_action TEXT,
        ai_confidence_score INT DEFAULT 92,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_changed_by VARCHAR(120) DEFAULT 'Alfonso Gordillo';
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_changed_role VARCHAR(100) DEFAULT 'CEO & Founder';
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_stage_change_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_justification TEXT DEFAULT 'Oportunidad inicial calificada por comité comercial.';

      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS responsible_user_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE deal_stage_history ADD COLUMN IF NOT EXISTS responsible_user_id INT REFERENCES users(id) ON DELETE SET NULL;
    `);

    const seedUsers = [
      [
        "alfonso",
        "Alfonso Gordillo",
        "alfonso@projectsfactory.io",
        "SUPER_ADMIN",
        "CEO & Founder (Super Admin)",
        "projectsfactory.io & finanactionable.co",
        "AG",
        "nexus2026",
        "ACTIVO",
        RBAC_ROLES_META.SUPER_ADMIN.permissions,
      ],
      [
        "valeria",
        "Valeria Mendoza",
        "valeria@finanactionable.co",
        "FINANCE_STRATEGIST",
        "Chief Revenue & FinActionable AI Officer",
        "finanactionable.co",
        "VM",
        "nexus2026",
        "ACTIVO",
        RBAC_ROLES_META.FINANCE_STRATEGIST.permissions,
      ],
      [
        "sebastian",
        "Sebastián Ríos",
        "sebastian@projectsfactory.io",
        "SOLUTIONS_ARCHITECT",
        "Lead AI & Cloud Architect",
        "projectsfactory.io",
        "SR",
        "nexus2026",
        "ACTIVO",
        RBAC_ROLES_META.SOLUTIONS_ARCHITECT.permissions,
      ],
      [
        "camila",
        "Camila Herrera",
        "camila@finanactionable.co",
        "SALES_EXECUTIVE",
        "Enterprise Account Executive B2B",
        "finanactionable.co",
        "CH",
        "nexus2026",
        "ACTIVO",
        RBAC_ROLES_META.SALES_EXECUTIVE.permissions,
      ],
      [
        "andres",
        "Andrés Morales",
        "andres@projectsfactory.io",
        "PARTNER_MANAGER",
        "Director de Alianzas & White-Label",
        "projectsfactory.io",
        "AM",
        "nexus2026",
        "ACTIVO",
        RBAC_ROLES_META.PARTNER_MANAGER.permissions,
      ],
      [
        "auditor",
        "Comité Junta Directiva",
        "auditoria@finanactionable.co",
        "AUDITOR_VIEWER",
        "Auditor Financiero & Investor Relations",
        "projectsfactory.io & finanactionable.co",
        "JD",
        "nexus2026",
        "ACTIVO",
        RBAC_ROLES_META.AUDITOR_VIEWER.permissions,
      ],
    ];

    for (const u of seedUsers) {
      await pool.query(
        `INSERT INTO users (username, name, email, role_code, role, brand_focus, avatar_initials, access_pin, status, permissions_summary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (email) DO UPDATE
           SET username = COALESCE(users.username, EXCLUDED.username),
               role_code = COALESCE(users.role_code, EXCLUDED.role_code),
               permissions_summary = COALESCE(users.permissions_summary, EXCLUDED.permissions_summary)`,
        u
      );
    }

    const histCount = await pool.query("SELECT COUNT(*)::int AS cnt FROM deal_stage_history");
    if (histCount.rows[0].cnt === 0) {
      const dealsRes = await pool.query("SELECT id, stage, next_action FROM deals ORDER BY id ASC");
      for (const d of dealsRes.rows) {
        await pool.query(
          `INSERT INTO deal_stage_history
            (deal_id, from_stage, to_stage, responsible_user_id, responsible_name, responsible_email, responsible_role, transition_date, justification, next_action, ai_confidence_score)
           VALUES ($1, 'DISCOVERY', $2, 1, 'Alfonso Gordillo', 'alfonso@projectsfactory.io', 'CEO & Founder', NOW() - INTERVAL '2 days', $3, $4, 94)`,
          [
            d.id,
            d.stage,
            `Apertura y calificación técnica-financiera en comité de ${d.stage}. Validado encaje de producto y presupuesto con decisor.`,
            d.next_action || "Ejecutar siguiente hito del pipeline",
          ]
        );
      }
    }

    await pool.query(`
      UPDATE accounts SET owner_user_id = 1 WHERE owner_user_id IS NULL;
      UPDATE deals SET responsible_user_id = 1 WHERE responsible_user_id IS NULL;
      UPDATE deal_stage_history SET responsible_user_id = 1 WHERE responsible_user_id IS NULL;
    `);
    console.log("[NexusPF-CRM] Enterprise RBAC Auth & Kanban Audit Schema verified.");
  } catch (err) {
    console.error("[NexusPF-CRM] Schema migration notice:", err.message);
  }
}

function buildInitials(nameStr) {
  const parts = String(nameStr || "Ejecutivo Nexus")
    .trim()
    .split(/\s+/);
  return ((parts[0]?.[0] || "E") + (parts[1]?.[0] || "X")).toUpperCase();
}

// ---------------------------------------------------------------------------
// 1. Health, System Identity, Authentication & Users RBAC CRUD
// ---------------------------------------------------------------------------
app.get("/api/auth/roles", (_req, res) => {
  res.json(RBAC_ROLES_META);
});

app.get("/api/auth/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, name, email, role_code, role, brand_focus, avatar_initials, status, permissions_summary, created_at FROM users ORDER BY id ASC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, name, email, role_code, role, brand_focus, avatar_initials, status, permissions_summary, created_at FROM users ORDER BY id ASC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const {
      username,
      name,
      email,
      role_code = "SALES_EXECUTIVE",
      role,
      brand_focus = "projectsfactory.io & finanactionable.co",
      password = "nexus2026",
      status = "ACTIVO",
    } = req.body;

    if (!name || !String(name).trim() || !email || !String(email).trim()) {
      return res.status(400).json({ error: "Nombre completo y correo corporativo son obligatorios." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUser = (username || cleanEmail.split("@")[0]).trim().toLowerCase();
    const roleMeta = RBAC_ROLES_META[role_code] || RBAC_ROLES_META.SALES_EXECUTIVE;
    const finalRoleTitle = role && String(role).trim() ? String(role).trim() : roleMeta.label;
    const initials = buildInitials(name);

    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Ya existe un miembro registrado con el correo ${cleanEmail}. Puedes editarlo en la tabla.` });
    }

    const { rows } = await pool.query(
      `INSERT INTO users (username, name, email, role_code, role, brand_focus, avatar_initials, access_pin, status, permissions_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, username, name, email, role_code, role, brand_focus, avatar_initials, status, permissions_summary, created_at`,
      [
        cleanUser,
        String(name).trim(),
        cleanEmail,
        role_code,
        finalRoleTitle,
        brand_focus,
        initials,
        String(password || "nexus2026").trim(),
        status,
        roleMeta.permissions,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('TEAM_MEMBER_CREATED', $1, $2)`,
      [`Nuevo miembro del equipo creado: ${rows[0].name} [${rows[0].role_code}] (${rows[0].email})`, JSON.stringify(rows[0])]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { username, name, email, role_code, role, brand_focus, password, status } = req.body;

    const existingRes = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    const cur = existingRes.rows[0];

    const nextName = name !== undefined ? String(name).trim() : cur.name;
    const nextEmail = email !== undefined ? String(email).trim().toLowerCase() : cur.email;
    const nextUsername = username !== undefined ? String(username).trim().toLowerCase() : cur.username;
    const nextRoleCode = role_code !== undefined ? role_code : cur.role_code;
    const roleMeta = RBAC_ROLES_META[nextRoleCode] || RBAC_ROLES_META.SALES_EXECUTIVE;
    const nextRole = role !== undefined && String(role).trim() ? String(role).trim() : roleMeta.label;
    const nextBrand = brand_focus !== undefined ? brand_focus : cur.brand_focus;
    const nextPin = password !== undefined && String(password).trim() !== "" ? String(password).trim() : cur.access_pin;
    const nextStatus = status !== undefined ? status : cur.status;
    const nextInitials = buildInitials(nextName);

    const { rows } = await pool.query(
      `UPDATE users
       SET username = $1,
           name = $2,
           email = $3,
           role_code = $4,
           role = $5,
           brand_focus = $6,
           avatar_initials = $7,
           access_pin = $8,
           status = $9,
           permissions_summary = $10
       WHERE id = $11
       RETURNING id, username, name, email, role_code, role, brand_focus, avatar_initials, status, permissions_summary, created_at`,
      [
        nextUsername,
        nextName,
        nextEmail,
        nextRoleCode,
        nextRole,
        nextBrand,
        nextInitials,
        nextPin,
        nextStatus,
        roleMeta.permissions,
        userId,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('TEAM_MEMBER_UPDATED', $1, $2)`,
      [`Perfil de usuario actualizado: ${rows[0].name} (${rows[0].role_code} · ${rows[0].status})`, JSON.stringify(rows[0])]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (userId === 1) {
      return res.status(400).json({ error: "No se puede eliminar al Super Administrador fundador principal." });
    }
    const existingRes = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [userId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    const deletedUser = existingRes.rows[0];
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('TEAM_MEMBER_DELETED', $1, $2)`,
      [`Miembro eliminado del equipo: ${deletedUser.name} (${deletedUser.email})`, JSON.stringify(deletedUser)]
    );

    res.json({ ok: true, deleted: deletedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const {
      identifier,
      email,
      username,
      password,
      accessPin,
      name,
      role_code = "SALES_EXECUTIVE",
      role,
      brand_focus = "projectsfactory.io & finanactionable.co",
      isRegister = false,
    } = req.body;

    const loginId = String(identifier || email || username || "").trim().toLowerCase();
    const secret = String(password || accessPin || "nexus2026").trim();

    if (isRegister) {
      const regEmail = String(email || identifier || "").trim().toLowerCase();
      if (!name || !String(name).trim() || !regEmail) {
        return res.status(400).json({ error: "Para registrarte ingresa tu Nombre Completo y Correo Corporativo." });
      }
      const cleanUser = String(username || regEmail.split("@")[0]).trim().toLowerCase();
      const roleMeta = RBAC_ROLES_META[role_code] || RBAC_ROLES_META.SALES_EXECUTIVE;
      const finalRole = role && String(role).trim() ? String(role).trim() : roleMeta.label;
      const initials = buildInitials(name);

      const insertRes = await pool.query(
        `INSERT INTO users (username, name, email, role_code, role, brand_focus, avatar_initials, access_pin, status, permissions_summary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVO',$9)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               username = EXCLUDED.username,
               role_code = EXCLUDED.role_code,
               role = EXCLUDED.role,
               brand_focus = EXCLUDED.brand_focus,
               access_pin = EXCLUDED.access_pin
         RETURNING id, username, name, email, role_code, role, brand_focus, avatar_initials, status, permissions_summary`,
        [cleanUser, String(name).trim(), regEmail, role_code, finalRole, brand_focus, initials, secret || "nexus2026", roleMeta.permissions]
      );
      const newUser = insertRes.rows[0];
      await pool.query(
        `INSERT INTO activity_logs (event_type, summary, structured_payload)
         VALUES ('AUTH_EXECUTIVE_REGISTER', $1, $2)`,
        [`Nuevo miembro registrado y autenticado: ${newUser.name} [${newUser.role_code}]`, JSON.stringify(newUser)]
      );
      return res.json({
        ok: true,
        token: `nxpf_jwt_${newUser.id}_${Date.now()}`,
        user: newUser,
      });
    }

    if (!loginId) {
      return res.status(400).json({ error: "Ingresa tu Usuario o Correo Corporativo." });
    }

    const userRes = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1",
      [loginId]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: "Usuario o correo no encontrado. Usa la pestaña 'Registrarse por Primera Vez' para crear tu cuenta.",
      });
    }
    const u = userRes.rows[0];
    if (u.status === "SUSPENDIDO") {
      return res.status(403).json({ error: "Esta cuenta se encuentra suspendida por el Administrador." });
    }
    if (secret && u.access_pin && secret !== String(u.access_pin).trim()) {
      return res.status(401).json({ error: "Contraseña incorrecta (Clave demo por defecto: nexus2026)." });
    }

    const safeUser = {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role_code: u.role_code || "SALES_EXECUTIVE",
      role: u.role,
      brand_focus: u.brand_focus,
      avatar_initials: u.avatar_initials,
      status: u.status || "ACTIVO",
      permissions_summary: u.permissions_summary,
    };

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('AUTH_EXECUTIVE_LOGIN', $1, $2)`,
      [`Sesión iniciada: ${safeUser.name} (${safeUser.role})`, JSON.stringify(safeUser)]
    );

    res.json({
      ok: true,
      token: `nxpf_jwt_${safeUser.id}_${Date.now()}`,
      user: safeUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const dbCheck = await pool.query("SELECT NOW() AS server_time");
    res.json({
      ok: true,
      service: "NexusPF AI-Driven CRM & FinActionable Engine",
      brands: ["projectsfactory.io", "finanactionable.co"],
      database: "PostgreSQL 16 Connected",
      serverTime: dbCheck.rows[0].server_time,
      mcpEnabled: true,
      deployTargets: ["Docker Desktop Local", "Render Blueprint", "Firebase Hosting & Auth"],
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Executive Command Center Summary (Dashboard KPIs + All Entities)
// ---------------------------------------------------------------------------
app.get("/api/dashboard", async (_req, res) => {
  try {
    const [productsRes, accountsRes, dealsRes, logsRes, usersRes, histRes] = await Promise.all([
      pool.query("SELECT * FROM digital_products ORDER BY id ASC"),
      pool.query("SELECT * FROM accounts ORDER BY id ASC"),
      pool.query(`
        SELECT d.*, a.company_name, a.domain, a.industry, a.contact_name, a.contact_role,
               p.name AS product_name, p.code AS product_code, p.category AS product_category
        FROM deals d
        LEFT JOIN accounts a ON d.account_id = a.id
        LEFT JOIN digital_products p ON d.product_id = p.id
        ORDER BY d.updated_at DESC, d.id ASC
      `),
      pool.query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 12"),
      pool.query(
        "SELECT id, username, name, email, role_code, role, brand_focus, avatar_initials, status, permissions_summary, created_at FROM users ORDER BY id ASC"
      ),
      pool.query("SELECT * FROM deal_stage_history ORDER BY transition_date DESC, id DESC LIMIT 100"),
    ]);

    const products = productsRes.rows;
    const accounts = accountsRes.rows;
    const deals = dealsRes.rows;

    // Calculate live portfolio KPIs
    const catalogMrrActive = products.reduce(
      (acc, p) => acc + Number(p.monthly_rent_mrr_usd) * Number(p.active_tenants),
      0
    );
    const pipelineMrr = deals
      .filter((d) => d.modality !== "VENTA_CAPEX")
      .reduce((acc, d) => acc + Number(d.mrr_usd), 0);
    const pipelineBuyout = deals
      .filter((d) => d.modality === "VENTA_CAPEX")
      .reduce((acc, d) => acc + Number(d.buyout_dynamic_usd), 0);
    const totalActiveTenants = products.reduce(
      (acc, p) => acc + Number(p.active_tenants),
      0
    );
    const avgMargin =
      deals.length > 0
        ? (
            deals.reduce((acc, d) => acc + Number(d.gross_margin_pct), 0) /
            deals.length
          ).toFixed(1)
        : 91.5;

    res.json({
      kpis: {
        activeCatalogMrrUsd: catalogMrrActive,
        activeCatalogArrUsd: catalogMrrActive * 12,
        pipelineMrrUsd: pipelineMrr,
        pipelineBuyoutCapexUsd: pipelineBuyout,
        totalActiveTenants,
        avgGrossMarginPct: Number(avgMargin),
        enrichedAccountsCount: accounts.filter((a) => a.ai_fit_score !== null).length,
        totalAccountsCount: accounts.length,
      },
      products,
      accounts,
      deals,
      users: usersRes.rows,
      stageHistory: histRes.rows,
      activityLogs: logsRes.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 3. Digital Products Catalog CRUD (projectsfactory.io & finanactionable.co)
// ---------------------------------------------------------------------------
app.get("/api/products", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM digital_products ORDER BY id ASC");
  res.json(rows);
});

app.post("/api/products", async (req, res) => {
  try {
    const {
      code,
      name,
      brand = "projectsfactory.io",
      category = "SaaS Platform",
      description = "",
      tech_stack = "Next.js · Node.js · PostgreSQL · Render",
      buyout_price_usd = 18000,
      setup_fee_usd = 2500,
      monthly_rent_mrr_usd = 900,
      infra_cost_monthly_usd = 65,
      eng_hours_base = 120,
      active_tenants = 1,
      sold_buyouts = 0,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "El nombre del producto digital es obligatorio." });
    }

    const cleanCode =
      (code || `PF-${Date.now().toString().slice(-4)}`).toUpperCase().replace(/\s+/g, "-");

    const { rows } = await pool.query(
      `INSERT INTO digital_products
        (code, name, brand, category, description, tech_stack, buyout_price_usd, setup_fee_usd, monthly_rent_mrr_usd, infra_cost_monthly_usd, eng_hours_base, active_tenants, sold_buyouts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        cleanCode,
        String(name).trim(),
        brand,
        category,
        description,
        tech_stack,
        Number(buyout_price_usd) || 0,
        Number(setup_fee_usd) || 0,
        Number(monthly_rent_mrr_usd) || 0,
        Number(infra_cost_monthly_usd) || 0,
        Number(eng_hours_base) || 120,
        Number(active_tenants) || 0,
        Number(sold_buyouts) || 0,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('CATALOG_ASSET_CREATED', $1, $2)`,
      [
        `Nuevo activo digital creado en ${brand}: ${name} (Venta $${buyout_price_usd} | Renta $${monthly_rent_mrr_usd}/mes)`,
        JSON.stringify(rows[0]),
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const {
      code,
      name,
      brand,
      category,
      description,
      tech_stack,
      buyout_price_usd,
      setup_fee_usd,
      monthly_rent_mrr_usd,
      infra_cost_monthly_usd,
      eng_hours_base,
      active_tenants,
      sold_buyouts,
    } = req.body;

    const existingRes = await pool.query("SELECT * FROM digital_products WHERE id = $1", [productId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Producto digital no encontrado." });
    }
    const cur = existingRes.rows[0];

    const updatedCode = code ? String(code).toUpperCase().replace(/\s+/g, "-") : cur.code;
    const updatedName = name !== undefined ? String(name).trim() : cur.name;
    const updatedBrand = brand !== undefined ? brand : cur.brand;
    const updatedCategory = category !== undefined ? category : cur.category;
    const updatedDesc = description !== undefined ? description : cur.description;
    const updatedStack = tech_stack !== undefined ? tech_stack : cur.tech_stack;
    const updatedBuyout = buyout_price_usd !== undefined ? Number(buyout_price_usd) : Number(cur.buyout_price_usd);
    const updatedSetup = setup_fee_usd !== undefined ? Number(setup_fee_usd) : Number(cur.setup_fee_usd);
    const updatedMrr = monthly_rent_mrr_usd !== undefined ? Number(monthly_rent_mrr_usd) : Number(cur.monthly_rent_mrr_usd);
    const updatedInfra = infra_cost_monthly_usd !== undefined ? Number(infra_cost_monthly_usd) : Number(cur.infra_cost_monthly_usd);
    const updatedHours = eng_hours_base !== undefined ? Number(eng_hours_base) : Number(cur.eng_hours_base);
    const updatedTenants = active_tenants !== undefined ? Number(active_tenants) : Number(cur.active_tenants);
    const updatedSold = sold_buyouts !== undefined ? Number(sold_buyouts) : Number(cur.sold_buyouts);

    const { rows } = await pool.query(
      `UPDATE digital_products
       SET code = $1,
           name = $2,
           brand = $3,
           category = $4,
           description = $5,
           tech_stack = $6,
           buyout_price_usd = $7,
           setup_fee_usd = $8,
           monthly_rent_mrr_usd = $9,
           infra_cost_monthly_usd = $10,
           eng_hours_base = $11,
           active_tenants = $12,
           sold_buyouts = $13
       WHERE id = $14
       RETURNING *`,
      [
        updatedCode,
        updatedName,
        updatedBrand,
        updatedCategory,
        updatedDesc,
        updatedStack,
        updatedBuyout,
        updatedSetup,
        updatedMrr,
        updatedInfra,
        updatedHours,
        updatedTenants,
        updatedSold,
        productId,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('CATALOG_ASSET_UPDATED', $1, $2)`,
      [
        `Activo actualizado (${updatedCode}): ${updatedName} — ${updatedTenants} tenants activos | Renta $${updatedMrr}/m | Buyout $${updatedBuyout}`,
        JSON.stringify(rows[0]),
      ]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const existingRes = await pool.query("SELECT * FROM digital_products WHERE id = $1", [productId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Producto digital no encontrado." });
    }
    const prod = existingRes.rows[0];

    await pool.query("UPDATE deals SET product_id = NULL WHERE product_id = $1", [productId]);
    await pool.query("DELETE FROM digital_products WHERE id = $1", [productId]);

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('CATALOG_ASSET_DELETED', $1, $2)`,
      [
        `Activo digital eliminado del catálogo: ${prod.name} (${prod.code})`,
        JSON.stringify({ id: productId, code: prod.code, name: prod.name }),
      ]
    );

    res.json({ ok: true, deleted: prod });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 4. Clientes & Contactos B2B CRUD + Magic AI Columns Engine
// ---------------------------------------------------------------------------
app.get("/api/accounts", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, u.name AS owner_name, u.email AS owner_email
      FROM accounts a
      LEFT JOIN users u ON a.owner_user_id = u.id
      ORDER BY a.id ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const {
      company_name,
      domain,
      industry = "Tecnología & Operaciones B2B",
      country = "Colombia / LATAM",
      employee_range = "50-200",
      contact_name,
      contact_role = "Director / Decisor Clave",
      contact_email,
      owner_user_id = 1,
    } = req.body;

    if (!company_name || !String(company_name).trim() || !contact_name || !String(contact_name).trim()) {
      return res.status(400).json({ error: "El nombre de la Empresa Cliente y del Contacto Principal son obligatorios." });
    }

    const cleanDomain =
      domain && String(domain).trim()
        ? String(domain).trim().toLowerCase()
        : String(company_name)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 18) + ".co";

    const cleanEmail =
      contact_email && String(contact_email).trim()
        ? String(contact_email).trim().toLowerCase()
        : `${String(contact_name).trim().split(/\s+/)[0].toLowerCase()}@${cleanDomain}`;

    const { rows } = await pool.query(
      `INSERT INTO accounts
        (company_name, domain, industry, country, employee_range, contact_name, contact_role, contact_email, owner_user_id, ai_fit_score, ai_recommended_product, ai_recommended_modality, ai_enriched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,93,'FinActionable AI-CFO & Treasury','RENTA_MRR ($1,150/mes + $2,400 Setup)',NOW())
       RETURNING *`,
      [
        String(company_name).trim(),
        cleanDomain,
        industry,
        country,
        employee_range,
        String(contact_name).trim(),
        contact_role,
        cleanEmail,
        Number(owner_user_id) || 1,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('ACCOUNT_CREATED', $1, $2)`,
      [
        `Nuevo Cliente & Contacto registrado: "${rows[0].company_name}" — Contacto: ${rows[0].contact_name} (${rows[0].contact_email})`,
        JSON.stringify(rows[0]),
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/accounts/:id", async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const {
      company_name,
      domain,
      industry,
      country,
      employee_range,
      contact_name,
      contact_role,
      contact_email,
      owner_user_id,
    } = req.body;

    const existing = await pool.query("SELECT * FROM accounts WHERE id = $1", [accountId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Cliente no encontrado." });
    const cur = existing.rows[0];

    const { rows } = await pool.query(
      `UPDATE accounts
       SET company_name = $1,
           domain = $2,
           industry = $3,
           country = $4,
           employee_range = $5,
           contact_name = $6,
           contact_role = $7,
           contact_email = $8,
           owner_user_id = $9
       WHERE id = $10
       RETURNING *`,
      [
        company_name !== undefined ? String(company_name).trim() : cur.company_name,
        domain !== undefined ? String(domain).trim() : cur.domain,
        industry !== undefined ? industry : cur.industry,
        country !== undefined ? country : cur.country,
        employee_range !== undefined ? employee_range : cur.employee_range,
        contact_name !== undefined ? String(contact_name).trim() : cur.contact_name,
        contact_role !== undefined ? contact_role : cur.contact_role,
        contact_email !== undefined ? String(contact_email).trim() : cur.contact_email,
        owner_user_id !== undefined ? Number(owner_user_id) || 1 : cur.owner_user_id || 1,
        accountId,
      ]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    await pool.query("DELETE FROM deals WHERE account_id = $1", [accountId]);
    const { rows } = await pool.query("DELETE FROM accounts WHERE id = $1 RETURNING *", [accountId]);
    if (rows.length === 0) return res.status(404).json({ error: "Cliente no encontrado." });
    res.json({ ok: true, deleted: rows[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/magic-enrich/:accountId", async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const accRes = await pool.query("SELECT * FROM accounts WHERE id = $1", [accountId]);
    if (accRes.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const account = accRes.rows[0];
    const prodRes = await pool.query("SELECT * FROM digital_products ORDER BY id ASC");
    const products = prodRes.rows;

    // Intelligent industry-aware matching for projectsfactory.io & finanactionable.co
    const ind = (account.industry || "").toLowerCase();
    let matchedProduct = products[0];
    let modality = "RENTA_MRR ($1,250/mes + $3,000 Setup)";
    let fitScore = 93;
    let finInsight = "";
    let icebreaker = "";

    if (ind.includes("salud") || ind.includes("clínica") || ind.includes("med")) {
      matchedProduct = products.find((p) => p.code.includes("PQRSD")) || products[0];
      modality = `RENTA_MRR ($${Number(matchedProduct.monthly_rent_mrr_usd)}/mes + Consumo AaaS)`;
      fitScore = 95;
      finInsight = `Sector regulado con alta carga de PQRSD. Rentar en modalidad OpEx les ahorra contratación de 3 analistas ($4,200/mes) y deja a projectsfactory.io un margen bruto del 93.4%.`;
      icebreaker = `Hola ${account.contact_name.split(" ")[0]}, vimos el crecimiento de ${account.company_name}; nuestro Agente Autónomo PQRSD resuelve radicaciones normativas en 40s con trazabilidad total.`;
    } else if (ind.includes("real estate") || ind.includes("construct") || ind.includes("infra")) {
      matchedProduct = products.find((p) => p.code.includes("CFO")) || products[0];
      modality = `RENTA_MRR ($${Number(matchedProduct.monthly_rent_mrr_usd)}/mes · Multi-Obra)`;
      fitScore = 94;
      finInsight = `Control de flujo de caja multi-proyecto crítico. La suscripción a FinActionable AI-CFO ($1,250/mes) alcanza punto de equilibrio en el mes 16.8 vs venta única de $24,000.`;
      icebreaker = `Hola ${account.contact_name.split(" ")[0]}, para blindar el flujo de caja por proyecto en ${account.company_name}, FinActionable conecta presupuestos de obra y bancos en tiempo real.`;
    } else if (ind.includes("seguro") || ind.includes("insur") || ind.includes("broker") || ind.includes("comer")) {
      matchedProduct = products.find((p) => p.code.includes("NEXUS-CRM")) || products[0];
      modality = `HIBRIDO_AAAS ($${Number(matchedProduct.monthly_rent_mrr_usd)}/mes + Licencia White-Label)`;
      fitScore = 96;
      finInsight = `Altísima rotación de pólizas y leads B2B. Desplegar NexusPF CRM en marca blanca sobre Render + Firebase les da soberanía de datos con LTV de $31,600 a 24 meses.`;
      icebreaker = `Hola ${account.contact_name.split(" ")[0]}, en lugar de pagar licencias por asiento en CRMs rígidos, podemos desplegarles su propio CRM AI-Driven con agentes de cotización en 72 horas.`;
    } else if (ind.includes("finan") || ind.includes("capital") || ind.includes("banca")) {
      matchedProduct = products.find((p) => p.code.includes("CFO")) || products[0];
      modality = `VENTA_CAPEX ($${Number(matchedProduct.buyout_price_usd).toLocaleString("en-US")} Buyout + Póliza)`;
      fitScore = 97;
      finInsight = `Entidad financiera que prioriza propiedad de código/IP. Recomendamos Venta Llave en Mano ($${Number(matchedProduct.buyout_price_usd).toLocaleString("en-US")}) + contrato de evolución mensual de $550.`;
      icebreaker = `Hola ${account.contact_name.split(" ")[0]}, sabemos que en ${account.company_name} la soberanía del motor analítico es clave; entregamos la IP de FinActionable lista en contenedores Docker.`;
    } else {
      matchedProduct = products.find((p) => p.code.includes("CONCILIA")) || products[0];
      modality = `RENTA_MRR ($${Number(matchedProduct.monthly_rent_mrr_usd)}/mes + $${Number(matchedProduct.setup_fee_usd)} Setup)`;
      fitScore = 92;
      finInsight = `Operación con alto volumen contable y tributario. Renta mensual genera Payback en 2.1 meses para el cliente y 93% de margen recurrente para finanactionable.co.`;
      icebreaker = `Hola ${account.contact_name.split(" ")[0]}, ayudamos a empresas de ${account.industry} como ${account.company_name} a automatizar el 98% de sus conciliaciones y exógenas con IA.`;
    }

    const updateRes = await pool.query(
      `UPDATE accounts
       SET ai_fit_score = $1,
           ai_recommended_product = $2,
           ai_recommended_modality = $3,
           ai_finactionable_insight = $4,
           ai_personalized_icebreaker = $5,
           ai_enriched_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [fitScore, matchedProduct.name, modality, finInsight, icebreaker, accountId]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('MAGIC_COLUMN_ENRICH', $1, $2)`,
      [
        `Magic AI Column enriqueció "${account.company_name}" → Fit ${fitScore}/100 · Producto: ${matchedProduct.name}`,
        JSON.stringify(updateRes.rows[0]),
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch Magic AI Enrichment across all accounts
app.post("/api/magic-enrich-all", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id FROM accounts ORDER BY id ASC");
    const updated = [];
    for (const row of rows) {
      const response = await fetch(`http://localhost:${PORT}/api/magic-enrich/${row.id}`, {
        method: "POST",
      });
      updated.push(await response.json());
    }
    res.json({ ok: true, count: updated.length, accounts: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 5. Zero-Admin Command Bar (Ctrl+K) — Natural Language Deal & Account Ingest
// ---------------------------------------------------------------------------
function extractZeroAdminEntities(rawText) {
  const clean = String(rawText || "").replace(/\s+/g, " ").trim();

  const contactStopwords = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "en",
    "por",
    "para",
    "con",
    "sin",
    "sobre",
    "quien",
    "quienes",
    "que",
    "le",
    "les",
    "se",
    "nos",
    "me",
    "interesado",
    "interesada",
    "interesa",
    "buscan",
    "busca",
    "quieren",
    "quiere",
    "necesitan",
    "necesita",
    "solicitan",
    "tiene",
    "tienen",
    "empresa",
    "compañía",
    "compania",
    "firma",
    "grupo",
    "banco",
    "clínica",
    "clinica",
    "constructora",
    "corporación",
    "corporacion",
    "eps",
    "ips",
    "cfo",
    "ceo",
    "cto",
    "coo",
    "director",
    "directora",
    "gerente",
    "vp",
    "presidente",
    "socio",
    "fundador",
  ]);

  let contactName = "Dirección Ejecutiva";
  const triggerRegex =
    /(?:habl[eé]\s+con|reuni[oó]n\s+con|convers[eé]\s+con|llamada\s+con|contacto\s+con|me\s+reun[ií]\s+con|contacto\s*:|\bcon)\s+(?:el\s+|la\s+)?([^\n,.;:]+)/i;
  const triggerMatch = clean.match(triggerRegex);
  if (triggerMatch) {
    const tokens = triggerMatch[1].trim().split(/\s+/);
    const picked = [];
    for (const tok of tokens) {
      const bare = tok.replace(/[.,;:()]/g, "");
      if (!bare) continue;
      const lowerTok = bare.toLowerCase();
      if (contactStopwords.has(lowerTok)) break;
      const isTitle = /^(?:Dr\.?|Dra\.?|Ing\.?|Lic\.?|Sr\.?|Sra\.?)$/i.test(tok);
      const isCapName = /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñÑ-]+$/.test(bare);
      if (isTitle || isCapName) {
        picked.push(isTitle ? tok : bare);
        if (picked.length >= 4) break;
      } else {
        break;
      }
    }
    if (picked.length > 0) {
      contactName = picked.join(" ");
    }
  }

  const companyClauseStopwords = new Set([
    "le",
    "les",
    "quiere",
    "quieren",
    "busca",
    "buscan",
    "interesa",
    "necesita",
    "necesitan",
    "solicita",
    "solicitan",
    "para",
    "por",
    "donde",
    "que",
    "sobre",
    "están",
    "estan",
    "tiene",
    "tienen",
  ]);

  function trimCompanyPhrase(phrase) {
    const words = String(phrase || "").trim().split(/\s+/);
    const out = [];
    for (const w of words) {
      const cleanW = w.replace(/[.,;:()]/g, "");
      if (!cleanW) continue;
      if (companyClauseStopwords.has(cleanW.toLowerCase())) break;
      out.push(cleanW);
      if (out.length >= 6) break;
    }
    return out.join(" ").trim();
  }

  let companyName = "";

  // 1) Look right after extracted contactName: "... <contactName> de (la Empresa) <Company>"
  if (contactName && contactName !== "Dirección Ejecutiva") {
    const escapedContact = contactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const afterContactRegex = new RegExp(
      escapedContact +
        "\\s+(?:de(?:\\s+la|\\s+el)?|del|en|@)\\s+(?:(?:empresa|compa[ñn][ií]a|firma|entidad|cliente)\\s+)?([^\\n,.;:]+)",
      "i"
    );
    const mAfter = clean.match(afterContactRegex);
    if (mAfter && mAfter[1]) {
      companyName = trimCompanyPhrase(mAfter[1]);
    }
  }

  // 2) Look for explicit "Empresa / Compañía / Firma / Cliente <Name>" anywhere in the text
  if (!companyName) {
    const mExplicit = clean.match(
      /\b(?:de\s+la\s+|de\s+el\s+|la\s+|el\s+)?(?:empresa|compa[ñn][ií]a|firma|cliente)\s+([A-ZÁÉÍÓÚÑ0-9][^\n,.;:]+)/i
    );
    if (mExplicit && mExplicit[1]) {
      companyName = trimCompanyPhrase(mExplicit[1]);
    }
  }

  // 3) Look for institutional prefixes that are part of the brand name ("Grupo X", "Banco Y", "Clínica Z", "EPS W", "Constructora V")
  if (!companyName) {
    const mInst = clean.match(
      /\b((?:Grupo|Cl[ií]nica|Constructora|Banco|Corporaci[oó]n|EPS|IPS|Fondo|Aseguradora|Fintech|Inmobiliaria)\s+[A-ZÁÉÍÓÚÑ0-9][^\n,.;:]+)/i
    );
    if (mInst && mInst[1]) {
      companyName = trimCompanyPhrase(mInst[1]);
    }
  }

  if (!companyName) {
    companyName = "Corporación Digital Latam";
  }

  // Countries / Multi-country operation detection
  const knownCountries = [
    ["Colombia", /\bcolombia\b/i],
    ["Ecuador", /\becuador\b/i],
    ["United States", /\b(?:united states|estados unidos|ee\.?\s*uu\.?|usa|miami)\b/i],
    ["México", /\bm[eé]xico\b/i],
    ["Perú", /\bper[uú]\b/i],
    ["Chile", /\bchile\b/i],
    ["Panamá", /\bpanam[aá]\b/i],
    ["Costa Rica", /\bcosta rica\b/i],
    ["España", /\bespa[ñn]a\b/i],
    ["Brasil", /\bbrasil\b/i],
    ["Argentina", /\bargentina\b/i],
  ];
  const detectedCountries = knownCountries.filter(([, rx]) => rx.test(clean)).map(([name]) => name);
  const country =
    detectedCountries.length > 1
      ? detectedCountries.slice(0, -1).join(", ") + " & " + detectedCountries[detectedCountries.length - 1]
      : detectedCountries.length === 1
      ? detectedCountries[0]
      : "Colombia / LATAM";

  return { companyName, contactName, country, detectedCountries };
}

app.post("/api/zero-admin", async (req, res) => {
  try {
    const { rawText = "", ownerUserId = 1, ownerName = "Dirección Comercial PF" } = req.body;
    if (!rawText.trim()) {
      return res.status(400).json({ error: "Texto o transcripción requerida" });
    }

    const productsRes = await pool.query("SELECT * FROM digital_products ORDER BY id ASC");
    const products = productsRes.rows;

    const lower = rawText.toLowerCase();

    // Extract Modality
    let modality = "RENTA_MRR";
    if (
      lower.includes("comprar") ||
      lower.includes("compra") ||
      lower.includes("venta") ||
      lower.includes("llave en mano") ||
      lower.includes("buyout")
    ) {
      modality = "VENTA_CAPEX";
    } else if (lower.includes("híbrido") || lower.includes("aaas") || lower.includes("agente")) {
      modality = "HIBRIDO_AAAS";
    }

    // Match Product from catalog
    let matchedProduct = products[0];
    if (lower.includes("concilia") || lower.includes("exógena") || lower.includes("exogena") || lower.includes("contab")) {
      matchedProduct = products.find((p) => p.code.includes("CONCILIA")) || products[0];
    } else if (lower.includes("pqrs") || lower.includes("jurídic") || lower.includes("reclamo")) {
      matchedProduct = products.find((p) => p.code.includes("PQRSD")) || products[0];
    } else if (lower.includes("crm") || lower.includes("nexus") || lower.includes("comercial")) {
      matchedProduct = products.find((p) => p.code.includes("NEXUS-CRM")) || products[0];
    } else if (lower.includes("sales") || lower.includes("campus") || lower.includes("entrenamiento")) {
      matchedProduct = products.find((p) => p.code.includes("SALES")) || products[0];
    }

    // Extract Monetary amounts ($X,XXX)
    const moneyMatches = [...rawText.matchAll(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,6})/g)].map((m) =>
      Number(m[1].replace(/[.,]/g, ""))
    );

    let mrrUsd = Number(matchedProduct.monthly_rent_mrr_usd);
    let setupUsd = Number(matchedProduct.setup_fee_usd);
    let buyoutUsd = Number(matchedProduct.buyout_price_usd);

    for (const val of moneyMatches) {
      if (val >= 8000) buyoutUsd = val;
      else if (val >= 1500 && val < 8000) setupUsd = val;
      else if (val >= 250 && val < 1500) mrrUsd = val;
    }

    // Extract Company, Contact Name & Countries accurately
    const { companyName, contactName, country, detectedCountries } = extractZeroAdminEntities(rawText);

    const domain =
      companyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 18) + (detectedCountries.includes("United States") ? ".com" : ".co");

    const nameParts = contactName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const emailUser =
      nameParts.length >= 2
        ? `${nameParts[0][0].toLowerCase()}${nameParts[nameParts.length - 1].toLowerCase()}`
        : "contacto";
    const contactEmail = `${emailUser}@${domain}`;

    const econ = computeFinActionableEconomics({
      buyoutPrice: buyoutUsd,
      setupFee: setupUsd,
      monthlyRentMrr: mrrUsd,
      infraCostMonthly: Number(matchedProduct.infra_cost_monthly_usd),
      engHours: Number(matchedProduct.eng_hours_base),
    });

    const aiInsight = `Operación en ${country}. ${
      modality === "VENTA_CAPEX"
        ? `Venta Llave en Mano ($${buyoutUsd.toLocaleString("en-US")}) genera liquidez inmediata.`
        : `Renta mensual ($${mrrUsd}/mes) alcanza equilibrio en el mes ${econ.breakevenMonths} con LTV 24m de $${econ.ltv24mRent.toLocaleString("en-US")} (${econ.grossMarginRentPct}% margen).`
    }`;
    const aiIcebreaker = `Hola ${contactName.split(" ")[0]}, estructuramos la propuesta de ${matchedProduct.name} para la operación de ${companyName} en ${country}.`;

    // Upsert or create account
    const existingAcc = await pool.query(
      "SELECT id FROM accounts WHERE LOWER(company_name) = LOWER($1) LIMIT 1",
      [companyName]
    );
    let newAccount;
    if (existingAcc.rows.length > 0) {
      const upd = await pool.query(
        `UPDATE accounts
         SET contact_name = $1,
             contact_email = $2,
             country = $3,
             owner_user_id = COALESCE($4, owner_user_id),
             ai_fit_score = 96,
             ai_recommended_product = $5,
             ai_recommended_modality = $6,
             ai_finactionable_insight = $7,
             ai_personalized_icebreaker = $8,
             ai_enriched_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          contactName,
          contactEmail,
          country,
          Number(ownerUserId) || 1,
          matchedProduct.name,
          modality === "VENTA_CAPEX"
            ? `VENTA_CAPEX ($${buyoutUsd.toLocaleString("en-US")})`
            : `RENTA_MRR ($${mrrUsd}/mes + $${setupUsd} Setup)`,
          aiInsight,
          aiIcebreaker,
          existingAcc.rows[0].id,
        ]
      );
      newAccount = upd.rows[0];
    } else {
      const accInsert = await pool.query(
        `INSERT INTO accounts
          (company_name, domain, industry, country, employee_range, contact_name, contact_role, contact_email, owner_user_id, ai_fit_score, ai_recommended_product, ai_recommended_modality, ai_finactionable_insight, ai_personalized_icebreaker, ai_enriched_at)
         VALUES ($1, $2, $3, $4, '100-300', $5, 'Decisor Ejecutivo', $6, $7, 96, $8, $9, $10, $11, NOW())
         RETURNING *`,
        [
          companyName,
          domain,
          matchedProduct.brand === "finanactionable.co" ? "Finanzas & Operaciones B2B" : "Tecnología & Servicios",
          country,
          contactName,
          contactEmail,
          Number(ownerUserId) || 1,
          matchedProduct.name,
          modality === "VENTA_CAPEX"
            ? `VENTA_CAPEX ($${buyoutUsd.toLocaleString("en-US")})`
            : `RENTA_MRR ($${mrrUsd}/mes + $${setupUsd} Setup)`,
          aiInsight,
          aiIcebreaker,
        ]
      );
      newAccount = accInsert.rows[0];
    }

    const dealTitle =
      detectedCountries.length > 1
        ? `${matchedProduct.name} — ${companyName} (${country})`
        : `${matchedProduct.name} — ${companyName}`;
    const dealInsert = await pool.query(
      `INSERT INTO deals
        (title, account_id, product_id, brand, modality, stage, probability,
         buyout_dynamic_usd, setup_fee_usd, mrr_usd, contract_months, infra_cost_monthly_usd,
         cac_estimated_usd, breakeven_months, ltv_24m_usd, gross_margin_pct, next_action, source_channel, owner_name, responsible_user_id)
       VALUES ($1,$2,$3,$4,$5,'DEMO_TECNICA',65,$6,$7,$8,24,$9,950,$10,$11,$12,$13,'Zero-Admin Command Bar (Ctrl+K)',$14,$15)
       RETURNING *`,
      [
        dealTitle,
        newAccount.id,
        matchedProduct.id,
        matchedProduct.brand,
        modality,
        buyoutUsd,
        setupUsd,
        mrrUsd,
        matchedProduct.infra_cost_monthly_usd,
        econ.breakevenMonths,
        econ.ltv24mRent,
        econ.grossMarginRentPct,
        `Presentar propuesta ${modality} a ${contactName} (${companyName} · ${country})`,
        ownerName || "Dirección Comercial PF",
        Number(ownerUserId) || 1,
      ]
    );

    const createdDeal = dealInsert.rows[0];

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, raw_input, structured_payload)
       VALUES ('ZERO_ADMIN_INGEST', $1, $2, $3)`,
      [
        `Zero-Admin IA creó Cuenta "${companyName}" (${contactName} · ${country}) y Deal "${dealTitle}"`,
        rawText,
        JSON.stringify({ account: newAccount, deal: createdDeal, economics: econ }),
      ]
    );

    res.status(201).json({
      ok: true,
      extracted: {
        companyName,
        contactName,
        country,
        contactEmail,
        productName: matchedProduct.name,
        brand: matchedProduct.brand,
        modality,
        mrrUsd,
        setupUsd,
        buyoutUsd,
        breakevenMonths: econ.breakevenMonths,
        ltv24mUsd: econ.ltv24mRent,
        grossMarginPct: econ.grossMarginRentPct,
        narrative: econ.narrative,
      },
      account: newAccount,
      deal: createdDeal,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 6. Pipeline Stage Transition (Drag & Drop Audited), History & AI Copilot
// ---------------------------------------------------------------------------
app.get("/api/deals/:id/history", async (req, res) => {
  try {
    const dealId = Number(req.params.id);
    const { rows } = await pool.query(
      "SELECT * FROM deal_stage_history WHERE deal_id = $1 ORDER BY transition_date DESC, id DESC",
      [dealId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/suggest-transition", async (req, res) => {
  try {
    const { dealId, fromStage = "DISCOVERY", toStage = "SIMULACION_FINACTIONABLE", responsibleName = "Ejecutivo" } = req.body;
    const dealRes = await pool.query(
      `SELECT d.*, a.company_name, a.contact_name, a.contact_role, p.name AS product_name
       FROM deals d
       LEFT JOIN accounts a ON d.account_id = a.id
       LEFT JOIN digital_products p ON d.product_id = p.id
       WHERE d.id = $1`,
      [Number(dealId)]
    );
    if (dealRes.rows.length === 0) {
      return res.status(404).json({ error: "Oportunidad no encontrada." });
    }
    const d = dealRes.rows[0];
    const company = d.company_name || "Cliente B2B";
    const contact = d.contact_name || "Decisor Ejecutivo";
    const product = d.product_name || d.title;
    const mrr = Number(d.mrr_usd || 900).toLocaleString("en-US");
    const buyout = Number(d.buyout_dynamic_usd || 20000).toLocaleString("en-US");
    const eqMonths = d.breakeven_months || 20;

    const stagePlaybook = {
      DISCOVERY: {
        probability: 35,
        justification: `Se reabre validación de Discovery con ${contact} (${company}) para recalibrar alcance técnico de ${product} y confirmar volumen operativo mensual.`,
        nextAction: `Agendar sesión de diagnóstico de arquitectura con ${contact}`,
        checklist: [
          "Dolor operativo y presupuesto preliminar identificados",
          "Decisor financiero o técnico mapeado en la cuenta",
          "Modalidad tentativa (Venta CapEx vs. Renta MRR) perfilada",
        ],
        riskInsight: "Riesgo bajo: etapa de descubrimiento inicial. Priorizar cuantificación de ahorro operativo.",
      },
      SIMULACION_FINACTIONABLE: {
        probability: 75,
        justification: `Reunión completada con ${contact} (${company}). Se estructuró escenario FinActionable comparando Renta Mensual ($${mrr}/mes) vs. Venta Llave en Mano ($${buyout} USD) con punto de equilibrio en el mes ${eqMonths}.`,
        nextAction: `Presentar dictamen comparativo CapEx vs. OpEx al comité financiero de ${company}`,
        checklist: [
          "Escenario de Renta MRR vs. Venta Buyout corrido en FinActionable Studio",
          "Punto de equilibrio (Mes " + eqMonths + ") y LTV a 24 meses validados",
          "Costos de infraestructura Render/Firebase cubiertos con margen > 85%",
        ],
        riskInsight: `FinActionable AI sugiere destacar que la modalidad ${d.modality} optimiza el flujo de caja de ${company} desde el primer trimestre.`,
      },
      DEMO_TECNICA: {
        probability: 65,
        justification: `Sesión de arquitectura y Demo Técnica en vivo aprobada por el equipo de ${company} sobre ${product}. Validada integración vía API/MCP y despliegue en Docker/Render.`,
        nextAction: `Entregar sandbox técnico y acta de validación de requerimientos a ${contact}`,
        checklist: [
          "Demo funcional del producto digital o agente IA ejecutada en vivo",
          "Requerimientos de seguridad, aislamiento de tenant y latencia aprobados",
          "Caso de uso real de la empresa probado con datos muestra",
        ],
        riskInsight: "Momento clave para asegurar el patrocinio técnico antes de pasar a propuesta económica final.",
      },
      NEGOCIACION: {
        probability: 88,
        justification: `${contact} (${company}) aprobó la propuesta técnica y financiera en modalidad ${d.modality} ($${mrr}/mes Renta | $${buyout} Buyout). Se inicia revisión de contrato SLA y anexo de propiedad intelectual.`,
        nextAction: `Enviar borrador final de contrato (${d.modality}) y cronograma de Kick-off`,
        checklist: [
          "Modalidad definitiva (Venta CapEx o Renta SaaS/AaaS) seleccionada por el cliente",
          "Términos de Setup Fee, SLA y costos cloud revisados con compras/legal",
          "Fecha objetivo de firma y despliegue comprometida",
        ],
        riskInsight: `Alta probabilidad de cierre (88%). Ofrecer descuento del 10% en Setup Fee si firman antes de fin de semana.`,
      },
      CERRADO_GANADO: {
        probability: 100,
        justification: `Contrato firmado por ${contact} (${company}) bajo modalidad ${d.modality} para ${product}. Orden de facturación emitida y aprovisionamiento de infraestructura iniciado por ${responsibleName}.`,
        nextAction: `Ejecutar Kick-off de implementación y activar tenant en Render / Firebase`,
        checklist: [
          "Contrato comercial y acuerdo de nivel de servicio (SLA) firmados",
          "Factura de Setup Fee o primer hito CapEx emitida",
          "Repositorio / Tenant aprovisionado para entrega al cliente",
        ],
        riskInsight: "¡Negocio ganado! El motor incrementará automáticamente los indicadores de Revenue activo.",
      },
    };

    const selected = stagePlaybook[toStage] || stagePlaybook.SIMULACION_FINACTIONABLE;

    // 2.2 Strict Stage Gatekeeper Alert (Sandbagging / Stage-Skipping Detection)
    const stageOrder = ["DISCOVERY", "DEMO_TECNICA", "SIMULACION_FINACTIONABLE", "NEGOCIACION", "CERRADO_GANADO"];
    const fromIdx = stageOrder.indexOf(fromStage);
    const toIdx = stageOrder.indexOf(toStage);
    let gatekeeperStatus = "VALIDATED";
    let gatekeeperWarning = "✓ Gobernanza FinActionable Validada: La secuencia de etapas y márgenes cumplen políticas.";
    if (toIdx - fromIdx > 1) {
      gatekeeperStatus = "STAGE_SKIP_WARNING";
      gatekeeperWarning = `⚠️ Alerta Gatekeeper IA (Salto de Etapa): Estás saltando ${toIdx - fromIdx} columnas (${fromStage} ➔ ${toStage}). Asegúrate de adjuntar evidencia de simulación económica y aprobación técnica en la justificación.`;
    } else if (toStage === "NEGOCIACION" && Number(d.gross_margin_pct || 90) < 80) {
      gatekeeperStatus = "MARGIN_WARNING";
      gatekeeperWarning = `⚠️ Alerta FinActionable: Margen bruto proyectado (${d.gross_margin_pct}%) inferior al umbral objetivo del 80%. Revisar costos cloud antes de enviar contrato.`;
    }

    // 2.3 Auto-Generated Client Follow-up Message (WhatsApp / Email Draft)
    const clientFollowupMessage = `Hola ${contact}, un gusto saludarte de parte del equipo de ${d.brand} (${responsibleName}). Tras nuestro avance a la etapa de ${toStage.replace(/_/g, " ")}, te comparto el resumen ejecutivo de "${product}" para ${company}: Modalidad ${d.modality} — Canon Renta: $${mrr} USD/mes (+$${Number(d.setup_fee_usd || 2200).toLocaleString("en-US")} Setup) | Equivalente Venta Llave en Mano: $${buyout} USD (Punto de equilibrio: Mes ${eqMonths}). Próximo paso: ${selected.nextAction}. ¿Te parece bien confirmar para este jueves a las 10:00 AM?`;

    // 2.1 Voice Dictation Smart Transcript Sample
    const voiceTranscriptSample = `Dictado por voz de ${responsibleName}: Acabo de finalizar sesión ejecutiva con ${contact} de ${company}. Confirmaron interés firme en ${product} bajo esquema ${d.modality} con canon mensual de $${mrr} dólares y equivalente llave en mano de $${buyout} dólares. Autorizan avanzar a ${toStage.replace(/_/g, " ")}.`;

    res.json({
      ok: true,
      dealId: d.id,
      fromStage,
      toStage,
      recommendedProbability: selected.probability,
      suggestedJustification: selected.justification,
      recommendedNextAction: selected.nextAction,
      checklist: selected.checklist,
      riskInsight: selected.riskInsight,
      gatekeeperStatus,
      gatekeeperWarning,
      clientFollowupMessage,
      voiceTranscriptSample,
      aiConfidenceScore: 96,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create New Deal directly from Kanban Column (+ Nuevo Deal Rápido)
app.post("/api/deals", async (req, res) => {
  try {
    const {
      title,
      account_id,
      new_company_name,
      new_contact_name,
      new_contact_role = "Director / Decisor",
      new_contact_email,
      new_industry = "Tecnología & Servicios B2B",
      product_id,
      stage = "DISCOVERY",
      modality = "RENTA_MRR",
      mrr_usd,
      setup_fee_usd,
      buyout_dynamic_usd,
      responsibleUserId = 1,
      responsibleName = "Alfonso Gordillo",
      responsibleEmail = "alfonso@projectsfactory.io",
      responsibleRole = "CEO & Founder",
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "El título de la oportunidad es obligatorio." });
    }

    let finalAccountId = Number(account_id) || 1;
    if (String(account_id) === "NEW" || (new_company_name && String(new_company_name).trim())) {
      const compName = String(new_company_name || "Nueva Empresa B2B").trim();
      const contName = String(new_contact_name || "Decisor Ejecutivo").trim();
      const dom = compName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18) + ".co";
      const contEmail =
        new_contact_email && String(new_contact_email).trim()
          ? String(new_contact_email).trim()
          : `${contName.split(/\s+/)[0].toLowerCase()}@${dom}`;

      const accIns = await pool.query(
        `INSERT INTO accounts
          (company_name, domain, industry, country, employee_range, contact_name, contact_role, contact_email, owner_user_id, ai_fit_score, ai_recommended_product, ai_recommended_modality, ai_enriched_at)
         VALUES ($1,$2,$3,'Colombia / LATAM','50-200',$4,$5,$6,$7,94,'FinActionable AI-CFO & Treasury','RENTA_MRR',NOW())
         RETURNING id`,
        [compName, dom, new_industry, contName, new_contact_role, contEmail, Number(responsibleUserId) || 1]
      );
      finalAccountId = accIns.rows[0].id;
    }

    const prodRes = await pool.query("SELECT * FROM digital_products WHERE id = $1", [Number(product_id) || 1]);
    const prod = prodRes.rows[0] || {
      id: 1,
      brand: "projectsfactory.io",
      buyout_price_usd: 20000,
      setup_fee_usd: 2200,
      monthly_rent_mrr_usd: 900,
      infra_cost_monthly_usd: 65,
      eng_hours_base: 120,
    };

    const finalMrr = Number(mrr_usd) || Number(prod.monthly_rent_mrr_usd) || 900;
    const finalSetup = Number(setup_fee_usd) || Number(prod.setup_fee_usd) || 2200;
    const finalBuyout = Number(buyout_dynamic_usd) || Number(prod.buyout_price_usd) || 20000;
    const infra = Number(prod.infra_cost_monthly_usd) || 65;

    const econ = computeFinActionableEconomics({
      buyoutPrice: finalBuyout,
      setupFee: finalSetup,
      monthlyRentMrr: finalMrr,
      infraCostMonthly: infra,
      engHours: Number(prod.eng_hours_base) || 120,
    });

    const probMap = {
      DISCOVERY: 35,
      DEMO_TECNICA: 65,
      SIMULACION_FINACTIONABLE: 75,
      NEGOCIACION: 88,
      CERRADO_GANADO: 100,
    };

    const { rows } = await pool.query(
      `INSERT INTO deals
        (title, account_id, product_id, responsible_user_id, brand, modality, stage, probability,
         buyout_dynamic_usd, setup_fee_usd, mrr_usd, contract_months, infra_cost_monthly_usd,
         cac_estimated_usd, breakeven_months, ltv_24m_usd, gross_margin_pct,
         next_action, source_channel, last_changed_by, last_changed_role, last_stage_change_at, last_justification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,24,$12,900,$13,$14,$15,$16,'Kanban Quick Create',$17,$18,NOW(),$19)
       RETURNING *`,
      [
        String(title).trim(),
        finalAccountId,
        prod.id,
        Number(responsibleUserId) || 1,
        prod.brand,
        modality,
        stage,
        probMap[stage] || 40,
        finalBuyout,
        finalSetup,
        finalMrr,
        infra,
        econ.breakevenMonths,
        econ.ltv24mRent,
        econ.grossMarginRentPct,
        `Validar propuesta ${modality} y avanzar en Kanban`,
        responsibleName,
        responsibleRole,
        `Oportunidad creada directamente en columna ${stage} por ${responsibleName}.`,
      ]
    );

    const created = rows[0];
    await pool.query(
      `INSERT INTO deal_stage_history
        (deal_id, from_stage, to_stage, responsible_user_id, responsible_name, responsible_email, responsible_role, transition_date, justification, next_action, ai_confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, 95)`,
      [
        created.id,
        stage,
        stage,
        Number(responsibleUserId) || 1,
        responsibleName,
        responsibleEmail,
        responsibleRole,
        `Creación inicial de oportunidad en columna ${stage} (${modality}: $${finalMrr}/m | Buyout $${finalBuyout}).`,
        created.next_action,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('KANBAN_DEAL_CREATED', $1, $2)`,
      [`[${responsibleName}] creó oportunidad "${created.title}" en etapa ${stage}`, JSON.stringify(created)]
    );

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 1-Click Flip Modality (RENTA_MRR <-> VENTA_CAPEX) inside Kanban Card
app.patch("/api/deals/:id/flip-modality", async (req, res) => {
  try {
    const dealId = Number(req.params.id);
    const { responsibleName = "Ejecutivo" } = req.body;
    const existing = await pool.query("SELECT * FROM deals WHERE id = $1", [dealId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Deal not found" });

    const cur = existing.rows[0];
    const nextModality = cur.modality === "VENTA_CAPEX" ? "RENTA_MRR" : "VENTA_CAPEX";

    const { rows } = await pool.query(
      `UPDATE deals
       SET modality = $1,
           last_changed_by = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [nextModality, responsibleName, dealId]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('KANBAN_MODALITY_FLIP', $1, $2)`,
      [
        `[${responsibleName}] alternó modalidad de "${cur.title}": ${cur.modality} ⇄ ${nextModality}`,
        JSON.stringify(rows[0]),
      ]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/deals/:id/stage", async (req, res) => {
  try {
    const dealId = Number(req.params.id);
    const {
      stage,
      modality,
      responsibleName,
      responsibleEmail,
      responsibleRole = "Executive",
      transitionDate,
      justification,
      nextAction,
      probability: customProb,
    } = req.body;

    if (!responsibleName || !String(responsibleName).trim()) {
      return res.status(401).json({ error: "Autenticación requerida: debe identificarse el ejecutivo responsable del cambio." });
    }
    if (!justification || String(justification).trim().length < 8) {
      return res.status(400).json({ error: "Debe registrar la acción tomada / justificación ejecutiva del cambio de etapa." });
    }

    const existingRes = await pool.query("SELECT * FROM deals WHERE id = $1", [dealId]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: "Deal not found" });
    const prevDeal = existingRes.rows[0];

    const probMap = {
      DISCOVERY: 35,
      DEMO_TECNICA: 65,
      SIMULACION_FINACTIONABLE: 75,
      NEGOCIACION: 88,
      CERRADO_GANADO: 100,
    };
    const probability = customProb !== undefined ? Number(customProb) : probMap[stage] || 50;
    const effectiveDate = transitionDate ? new Date(transitionDate) : new Date();

    const { rows } = await pool.query(
      `UPDATE deals
       SET stage = COALESCE($1, stage),
           modality = COALESCE($2, modality),
           probability = $3,
           next_action = COALESCE($4, next_action),
           last_changed_by = $5,
           last_changed_role = $6,
           last_stage_change_at = $7,
           last_justification = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        stage,
        modality,
        probability,
        nextAction || prevDeal.next_action,
        String(responsibleName).trim(),
        responsibleRole,
        effectiveDate,
        String(justification).trim(),
        dealId,
      ]
    );

    const updatedDeal = rows[0];

    const histInsert = await pool.query(
      `INSERT INTO deal_stage_history
        (deal_id, from_stage, to_stage, responsible_name, responsible_email, responsible_role, transition_date, justification, next_action, ai_confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 95)
       RETURNING *`,
      [
        dealId,
        prevDeal.stage,
        updatedDeal.stage,
        String(responsibleName).trim(),
        responsibleEmail || "ejecutivo@projectsfactory.io",
        responsibleRole,
        effectiveDate,
        String(justification).trim(),
        updatedDeal.next_action,
      ]
    );

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('PIPELINE_STAGE_MOVE', $1, $2)`,
      [
        `[${responsibleName}] movió "${updatedDeal.title}" de ${prevDeal.stage} → ${updatedDeal.stage}: "${String(justification).trim()}"`,
        JSON.stringify({ deal: updatedDeal, audit: histInsert.rows[0] }),
      ]
    );

    res.json({ ok: true, deal: updatedDeal, historyEntry: histInsert.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 7. FinActionable Deal Studio Simulator Endpoint
// ---------------------------------------------------------------------------
app.post("/api/simulate-pricing", async (req, res) => {
  try {
    const result = computeFinActionableEconomics(req.body);
    if (req.body.dealId) {
      await pool.query(
        `UPDATE deals
         SET buyout_dynamic_usd = $1,
             setup_fee_usd = $2,
             mrr_usd = $3,
             infra_cost_monthly_usd = $4,
             breakeven_months = $5,
             ltv_24m_usd = $6,
             gross_margin_pct = $7,
             modality = $8,
             updated_at = NOW()
         WHERE id = $9`,
        [
          req.body.buyoutPrice,
          req.body.setupFee,
          req.body.monthlyRentMrr,
          req.body.infraCostMonthly,
          result.breakevenMonths,
          result.ltv24mRent,
          result.grossMarginRentPct,
          result.strategicRecommendation,
          Number(req.body.dealId),
        ]
      );
      await pool.query(
        `INSERT INTO activity_logs (event_type, summary, structured_payload)
         VALUES ('FINACTIONABLE_SIM', $1, $2)`,
        [
          `Escenario FinActionable guardado en Deal #${req.body.dealId}: Break-even ${result.breakevenMonths}m · LTV 24m $${result.ltv24mRent}`,
          JSON.stringify(result),
        ]
      );
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 8. Native MCP (Model Context Protocol) Tool Catalog & Execution Endpoint
// ---------------------------------------------------------------------------
const MCP_TOOLS = [
  {
    name: "nexuspf_list_pipeline",
    title: "List Dual Pipeline Deals & Unit Economics",
    description:
      "Returns active B2B deals across projectsfactory.io and finanactionable.co with Venta Directa (CapEx) vs Renta Mensual (MRR) metrics.",
    inputSchema: {
      type: "object",
      properties: {
        modality: { type: "string", enum: ["ALL", "RENTA_MRR", "VENTA_CAPEX", "HIBRIDO_AAAS"] },
      },
    },
  },
  {
    name: "nexuspf_zero_admin_ingest",
    title: "Zero-Admin Natural Language Deal Ingest",
    description:
      "Extracts company, contact, digital product, modality (Venta or Renta) and FinActionable unit economics from raw meeting notes.",
    inputSchema: {
      type: "object",
      required: ["rawText"],
      properties: {
        rawText: { type: "string", description: "Transcript, email or WhatsApp note from sales conversation." },
      },
    },
  },
  {
    name: "nexuspf_simulate_unit_economics",
    title: "FinActionable Buyout vs SaaS Rental Simulator",
    description:
      "Calculates 36-month cashflow curves, exact break-even month, gross margin on Render/Firebase and strategic recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        buyoutPrice: { type: "number" },
        setupFee: { type: "number" },
        monthlyRentMrr: { type: "number" },
        infraCostMonthly: { type: "number" },
      },
    },
  },
  {
    name: "nexuspf_magic_enrich_lead",
    title: "Execute Claygent-Style Magic AI Column Enrichment",
    description:
      "Enriches a B2B account with AI Fit Score, Recommended Digital Product from projectsfactory.io, Optimal Modality and FinActionable ROI insight.",
    inputSchema: {
      type: "object",
      required: ["accountId"],
      properties: {
        accountId: { type: "number" },
      },
    },
  },
  {
    name: "nexuspf_catalog_assets",
    title: "Inspect Digital Products & Active Rental Tenants",
    description:
      "Lists all digital software assets and AI agents in projectsfactory.io & finanactionable.co with active rental tenants and buyout prices.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

app.get("/api/mcp/tools", (_req, res) => {
  res.json({
    protocolVersion: "2025-06-18",
    serverInfo: {
      name: "io.projectsfactory.nexuspf-crm",
      version: "1.0.0",
      description: "Native MCP Server for NexusPF AI-Driven CRM & FinActionable Deal Studio",
    },
    tools: MCP_TOOLS,
  });
});

app.post("/api/mcp/execute", async (req, res) => {
  try {
    const { toolName, arguments: args = {} } = req.body;
    let resultPayload = null;

    if (toolName === "nexuspf_catalog_assets") {
      const { rows } = await pool.query("SELECT * FROM digital_products ORDER BY id ASC");
      resultPayload = { count: rows.length, assets: rows };
    } else if (toolName === "nexuspf_list_pipeline") {
      const { rows } = await pool.query(`
        SELECT d.id, d.title, d.brand, d.modality, d.stage, d.mrr_usd, d.buyout_dynamic_usd,
               d.breakeven_months, d.ltv_24m_usd, d.gross_margin_pct, a.company_name
        FROM deals d
        LEFT JOIN accounts a ON d.account_id = a.id
        ORDER BY d.id ASC
      `);
      const filtered =
        args.modality && args.modality !== "ALL"
          ? rows.filter((r) => r.modality === args.modality)
          : rows;
      resultPayload = { count: filtered.length, deals: filtered };
    } else if (toolName === "nexuspf_simulate_unit_economics") {
      resultPayload = computeFinActionableEconomics(args);
    } else if (toolName === "nexuspf_magic_enrich_lead") {
      const r = await fetch(`http://localhost:${PORT}/api/magic-enrich/${args.accountId || 1}`, {
        method: "POST",
      });
      resultPayload = await r.json();
    } else if (toolName === "nexuspf_zero_admin_ingest") {
      const r = await fetch(`http://localhost:${PORT}/api/zero-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: args.rawText }),
      });
      resultPayload = await r.json();
    } else {
      return res.status(400).json({ error: `Unknown MCP tool: ${toolName}` });
    }

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('MCP_TOOL_CALL', $1, $2)`,
      [
        `MCP Tool ejecutada: ${toolName}`,
        JSON.stringify({ toolName, arguments: args }),
      ]
    );

    res.json({
      jsonrpc: "2.0",
      toolName,
      executedAt: new Date().toISOString(),
      structuredContent: resultPayload,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

ensureAuthAndKanbanSchema().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NexusPF-CRM Backend & MCP Server] Listening on http://0.0.0.0:${PORT}`);
  });
});
