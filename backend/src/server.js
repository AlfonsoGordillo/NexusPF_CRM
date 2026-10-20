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
// 1. Health & System Identity
// ---------------------------------------------------------------------------
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
    const [productsRes, accountsRes, dealsRes, logsRes] = await Promise.all([
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
// 4. Magic AI Columns Engine (Estilo Claygent + Folk + FinActionable)
// ---------------------------------------------------------------------------
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
app.post("/api/zero-admin", async (req, res) => {
  try {
    const { rawText = "" } = req.body;
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

    // Extract Company & Contact Name heuristics
    const companyMatch = rawText.match(
      /(?:empresa|grupo|clínica|constructora|banco|corporación|compañía|de)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s.&-]{2,35})/
    );
    const contactMatch = rawText.match(
      /(?:con|hablé con|reunión con|contacto|director|cfo|ceo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i
    );

    const companyName = companyMatch
      ? companyMatch[1].trim().replace(/[,.].*$/, "")
      : " Corporación Digital Latam";
    const contactName = contactMatch ? contactMatch[1].trim() : "Dirección Ejecutiva";
    const domain =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 18) + ".co";

    // Create or find account
    const accInsert = await pool.query(
      `INSERT INTO accounts
        (company_name, domain, industry, country, employee_range, contact_name, contact_role, contact_email, ai_fit_score, ai_recommended_product, ai_recommended_modality, ai_enriched_at)
       VALUES ($1, $2, $3, 'Colombia / LATAM', '100-300', $4, 'Decisor Ejecutivo', $5, 95, $6, $7, NOW())
       RETURNING *`,
      [
        companyName,
        domain,
        matchedProduct.brand === "finanactionable.co" ? "Finanzas & Operaciones B2B" : "Tecnología & Servicios",
        contactName,
        `contacto@${domain}`,
        matchedProduct.name,
        modality === "VENTA_CAPEX"
          ? `VENTA_CAPEX ($${buyoutUsd.toLocaleString("en-US")})`
          : `RENTA_MRR ($${mrrUsd}/mes + $${setupUsd} Setup)`,
      ]
    );
    const newAccount = accInsert.rows[0];

    const econ = computeFinActionableEconomics({
      buyoutPrice: buyoutUsd,
      setupFee: setupUsd,
      monthlyRentMrr: mrrUsd,
      infraCostMonthly: Number(matchedProduct.infra_cost_monthly_usd),
      engHours: Number(matchedProduct.eng_hours_base),
    });

    const dealTitle = `${matchedProduct.name} — ${companyName}`;
    const dealInsert = await pool.query(
      `INSERT INTO deals
        (title, account_id, product_id, brand, modality, stage, probability,
         buyout_dynamic_usd, setup_fee_usd, mrr_usd, contract_months, infra_cost_monthly_usd,
         cac_estimated_usd, breakeven_months, ltv_24m_usd, gross_margin_pct, next_action, source_channel)
       VALUES ($1,$2,$3,$4,$5,'DEMO_TECNICA',65,$6,$7,$8,24,$9,950,$10,$11,$12,$13,'Zero-Admin Command Bar (Ctrl+K)')
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
        `Presentar propuesta ${modality} y demo interactiva FinActionable`,
      ]
    );

    const createdDeal = dealInsert.rows[0];

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, raw_input, structured_payload)
       VALUES ('ZERO_ADMIN_INGEST', $1, $2, $3)`,
      [
        `Zero-Admin IA creó Cuenta "${companyName}" y Deal "${dealTitle}" (${modality}: $${mrrUsd}/mes | Buyout $${buyoutUsd})`,
        rawText,
        JSON.stringify({ account: newAccount, deal: createdDeal, economics: econ }),
      ]
    );

    res.status(201).json({
      ok: true,
      extracted: {
        companyName,
        contactName,
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
// 6. Pipeline Stage Transition & Deal Updates
// ---------------------------------------------------------------------------
app.patch("/api/deals/:id/stage", async (req, res) => {
  try {
    const dealId = Number(req.params.id);
    const { stage, modality } = req.body;
    const probMap = {
      DISCOVERY: 35,
      DEMO_TECNICA: 60,
      SIMULACION_FINACTIONABLE: 75,
      NEGOCIACION: 88,
      CERRADO_GANADO: 100,
    };
    const probability = probMap[stage] || 50;

    const { rows } = await pool.query(
      `UPDATE deals
       SET stage = COALESCE($1, stage),
           modality = COALESCE($2, modality),
           probability = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [stage, modality, probability, dealId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Deal not found" });

    await pool.query(
      `INSERT INTO activity_logs (event_type, summary, structured_payload)
       VALUES ('PIPELINE_STAGE_MOVE', $1, $2)`,
      [
        `Deal "${rows[0].title}" avanzó a etapa ${rows[0].stage} (${rows[0].probability}% prob.)`,
        JSON.stringify(rows[0]),
      ]
    );

    res.json(rows[0]);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[NexusPF-CRM Backend & MCP Server] Listening on http://0.0.0.0:${PORT}`);
});
