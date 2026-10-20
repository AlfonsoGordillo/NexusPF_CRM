-- ============================================================================
-- NexusPF CRM — AI-Driven Revenue & Asset OS
-- Designed for projectsfactory.io & finanactionable.co
-- PostgreSQL 16 Schema + Seed Data
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Catálogo de Productos Digitales e IP (projectsfactory.io & finanactionable.co)
CREATE TABLE IF NOT EXISTS digital_products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(160) NOT NULL,
    brand VARCHAR(60) NOT NULL DEFAULT 'projectsfactory.io', -- 'projectsfactory.io' | 'finanactionable.co'
    category VARCHAR(80) NOT NULL, -- 'AI Agent (AaaS)' | 'SaaS Platform' | 'Fintech Engine' | 'Custom IP'
    description TEXT NOT NULL,
    tech_stack VARCHAR(200) NOT NULL,
    buyout_price_usd NUMERIC(12,2) NOT NULL DEFAULT 15000.00,
    setup_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 2500.00,
    monthly_rent_mrr_usd NUMERIC(12,2) NOT NULL DEFAULT 850.00,
    infra_cost_monthly_usd NUMERIC(12,2) NOT NULL DEFAULT 65.00,
    eng_hours_base INTEGER NOT NULL DEFAULT 120,
    active_tenants INTEGER NOT NULL DEFAULT 0,
    sold_buyouts INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PRODUCTION_READY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Cuentas / Empresas B2B con Columnas Mágicas IA (Estilo Attio + Clay)
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(160) NOT NULL,
    domain VARCHAR(140) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    country VARCHAR(80) NOT NULL DEFAULT 'Colombia / LATAM',
    employee_range VARCHAR(50) NOT NULL DEFAULT '50-200',
    contact_name VARCHAR(140) NOT NULL,
    contact_role VARCHAR(120) NOT NULL,
    contact_email VARCHAR(160) NOT NULL,
    -- Magic AI Columns (Claygent / Folk style)
    ai_fit_score INTEGER DEFAULT NULL,
    ai_recommended_product VARCHAR(160) DEFAULT NULL,
    ai_recommended_modality VARCHAR(60) DEFAULT NULL,
    ai_finactionable_insight TEXT DEFAULT NULL,
    ai_personalized_icebreaker TEXT DEFAULT NULL,
    ai_enriched_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Oportunidades / Pipeline Dual (Venta Directa CapEx vs Renta Recurrente OpEx)
CREATE TABLE IF NOT EXISTS deals (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES digital_products(id) ON DELETE SET NULL,
    brand VARCHAR(60) NOT NULL DEFAULT 'projectsfactory.io',
    modality VARCHAR(30) NOT NULL DEFAULT 'RENTA_MRR', -- 'RENTA_MRR' | 'VENTA_CAPEX' | 'HIBRIDO_AAAS'
    stage VARCHAR(50) NOT NULL DEFAULT 'DISCOVERY', -- 'DISCOVERY' | 'DEMO_TECNICA' | 'SIMULACION_FINACTIONABLE' | 'NEGOCIACION' | 'CERRADO_GANADO'
    probability INTEGER NOT NULL DEFAULT 40,
    -- Parámetros Financieros (FinActionable Inside)
    buyout_Dynamic_usd NUMERIC(12,2) NOT NULL DEFAULT 18000.00,
    setup_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 2500.00,
    mrr_usd NUMERIC(12,2) NOT NULL DEFAULT 950.00,
    contract_months INTEGER NOT NULL DEFAULT 24,
    infra_cost_monthly_usd NUMERIC(12,2) NOT NULL DEFAULT 75.00,
    cac_estimated_usd NUMERIC(12,2) NOT NULL DEFAULT 1200.00,
    -- Métricas Derivadas FinActionable
    breakeven_months NUMERIC(6,1) NOT NULL DEFAULT 16.5,
    ltv_24m_usd NUMERIC(12,2) NOT NULL DEFAULT 25300.00,
    gross_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 88.50,
    next_action TEXT NOT NULL DEFAULT 'Enviar simulación comparativa Venta vs Renta',
    source_channel VARCHAR(60) NOT NULL DEFAULT 'Zero-Admin AI Ingest',
    owner_name VARCHAR(100) NOT NULL DEFAULT 'Dirección Comercial PF',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Registro de Actividad Zero-Admin y Auditoría MCP
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(60) NOT NULL, -- 'ZERO_ADMIN_INGEST' | 'MAGIC_COLUMN_ENRICH' | 'FINACTIONABLE_SIM' | 'MCP_TOOL_CALL'
    summary TEXT NOT NULL,
    raw_input TEXT,
    structured_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED DATA: Portafolio Realista de projectsfactory.io & finanactionable.co
-- ============================================================================

INSERT INTO digital_products (
    code, name, brand, category, description, tech_stack,
    buyout_price_usd, setup_fee_usd, monthly_rent_mrr_usd, infra_cost_monthly_usd,
    eng_hours_base, active_tenants, sold_buyouts, status
) VALUES
(
    'FA-CFO-SUITE',
    'FinActionable AI-CFO & Cashflow Intelligence',
    'finanactionable.co',
    'Fintech Engine',
    'Motor ejecutivo de inteligencia financiera accionable, proyecciones de flujo de caja, alertas de liquidez y unit economics automatizados.',
    'Python FastAPI · Next.js · PostgreSQL · Render',
    24000.00, 3000.00, 1250.00, 85.00,
    160, 14, 3, 'PRODUCTION_READY'
),
(
    'PF-CONCILIA-AI',
    'Smart Conciliaciones & Exógenas Tributarias Engine',
    'finanactionable.co',
    'SaaS Platform',
    'Plataforma automatizada de cruce bancario, conciliación contable masiva y generación de información exógena con validación IA.',
    'Node.js · Python · PostgreSQL · Docker · Firebase',
    19500.00, 2200.00, 890.00, 60.00,
    140, 19, 4, 'PRODUCTION_READY'
),
(
    'PF-AGENT-PQRSD',
    'Autonomous PQRSD & Legal Triage Agent (AaaS)',
    'projectsfactory.io',
    'AI Agent (AaaS)',
    'Agente autónomo para radicación, análisis jurídico/operativo y respuesta de PQRSD con trazabilidad SLA y firma digital.',
    'TypeScript · Gemini API · LangGraph · Redis · Render',
    14500.00, 1800.00, 680.00, 45.00,
    95, 11, 2, 'PRODUCTION_READY'
),
(
    'PF-SALES-CAMPUS',
    'AI Revenue & B2B Enablement Platform',
    'projectsfactory.io',
    'SaaS Platform',
    'Ecosistema de aceleración comercial con playbooks interactivos, scoring predictivo y entrenamiento asistido por IA.',
    'Next.js · Node.js · PostgreSQL · Firebase Auth',
    16800.00, 2000.00, 790.00, 55.00,
    110, 8, 5, 'PRODUCTION_READY'
),
(
    'PF-NEXUS-CRM',
    'NexusPF AI-Driven CRM (White-Label Edition)',
    'projectsfactory.io',
    'Custom IP',
    'CRM AI-Driven con Magic Columns, Zero-Admin Command Bar, servidor MCP nativo y simulador Venta vs Renta FinActionable.',
    'Node.js · PostgreSQL · Docker · Render · Firebase',
    22000.00, 2500.00, 990.00, 70.00,
    150, 6, 1, 'PRODUCTION_READY'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO accounts (
    company_name, domain, industry, country, employee_range,
    contact_name, contact_role, contact_email,
    ai_fit_score, ai_recommended_product, ai_recommended_modality,
    ai_finactionable_insight, ai_personalized_icebreaker, ai_enriched_at
) VALUES
(
    'Grupo Logístico Andino S.A.S.',
    'logisticaandina.co',
    'Logística & Supply Chain',
    'Colombia',
    '200-500',
    'Valentina Mendoza',
    'VP Financiera (CFO)',
    'vmendoza@logisticaandina.co',
    96,
    'Smart Conciliaciones & Exógenas Tributarias Engine',
    'RENTA_MRR ($890/mes + $2,200 Setup)',
    'Procesan +45,000 transacciones mensuales. Rentar en modalidad OpEx les ahorra $14,200 en año 1 y genera un LTV de $23,560 a 24 meses con margen del 93%.',
    'Hola Valentina, vi que Grupo Logístico Andino expandió su flota en Q3; nuestro motor automatiza el 98% de conciliaciones de fletes y exógenas sin carga operativa.',
    NOW() - INTERVAL '2 hours'
),
(
    'Fintech Capital Partners',
    'fintechcapital.io',
    'Servicios Financieros & Crédito B2B',
    'México / EE.UU.',
    '50-200',
    'Alejandro Ríos',
    'Chief Product Officer',
    'arios@fintechcapital.io',
    94,
    'FinActionable AI-CFO & Cashflow Intelligence',
    'VENTA_CAPEX ($24,000 Buyout + Licencia IP)',
    'Buscan ser dueños del código para integrarlo en su core bancario. Venta llave en mano de $24,000 + póliza mensual de $450 maximiza liquidez inmediata.',
    'Alejandro, para acelerar el módulo de Cashflow Intelligence de sus clientes PyME, podemos entregarles la IP completa de FinActionable lista en Docker/Render en 3 semanas.',
    NOW() - INTERVAL '1 hour'
),
(
    'Clínica MediRed Internacional',
    'medired.com.co',
    'Salud & Aseguramiento',
    'Colombia',
    '500+',
    'Dr. Camilo Soto',
    'Director de Transformación Digital',
    'csoto@medired.com.co',
    91,
    'Autonomous PQRSD & Legal Triage Agent (AaaS)',
    'RENTA_MRR ($680/mes + Consumo AaaS)',
    'Alto volumen regulatorio ante Superintendencia. El modelo de Renta AaaS tiene un Payback de 2.4 meses y margen bruto del 91% sobre infraestructura Render.',
    'Dr. Camilo, sabemos que el cumplimiento de tiempos en PQRSD médicas es crítico; nuestro agente autónomo clasifica y redacta respuestas normativas en menos de 40 segundos.',
    NOW() - INTERVAL '45 minutes'
),
(
    'Constructora NovaUrbana',
    'novaurbana.pe',
    'Real Estate & Infraestructura',
    'Perú / LATAM',
    '200-500',
    'Mariana Paredes',
    'Gerente Corporativa de Finanzas',
    'mparedes@novaurbana.pe',
    88,
    'FinActionable AI-CFO & Cashflow Intelligence',
    'SIMULACION_PENDIENTE',
    NULL,
    NULL,
    NULL
),
(
    'InsurTech Global Broker',
    'insurtechbroker.com',
    'Seguros Digitales',
    'Chile / Miami',
    '50-200',
    'Sebastián Vega',
    'CEO & Co-Founder',
    'svega@insurtechbroker.com',
    92,
    'NexusPF AI-Driven CRM (White-Label Edition)',
    'SIMULACION_PENDIENTE',
    NULL,
    NULL,
    NULL
);

INSERT INTO deals (
    title, account_id, product_id, brand, modality, stage, probability,
    buyout_Dynamic_usd, setup_fee_usd, mrr_usd, contract_months,
    infra_cost_monthly_usd, cac_estimated_usd, breakeven_months,
    ltv_24m_usd, gross_margin_pct, next_action, source_channel, owner_name
) VALUES
(
    'Licenciamiento SaaS Conciliaciones & Exógenas Multi-Bodega',
    1, 2, 'finanactionable.co', 'RENTA_MRR', 'SIMULACION_FINACTIONABLE', 75,
    19500.00, 2200.00, 890.00, 24,
    60.00, 950.00, 20.8,
    23560.00, 93.26,
    'Presentar comparativa FinActionable a Comité Financiero el jueves 10:00 AM',
    'Zero-Admin AI Ingest', 'Alfonso G. · FinActionable'
),
(
    'Adquisición Llave en Mano Motor FinActionable AI-CFO (White-Label)',
    2, 1, 'finanactionable.co', 'VENTA_CAPEX', 'NEGOCIACION', 85,
    24000.00, 3500.00, 450.00, 24,
    85.00, 1400.00, 17.2,
    34800.00, 86.40,
    'Firma de contrato de cesión de licencia no exclusiva + despliegue en Render',
    'Direct Executive Outbound', 'Alfonso G. · ProjectsFactory'
),
(
    'Agente Autónomo PQRSD Salud (Renta Mensual AaaS)',
    3, 3, 'projectsfactory.io', 'RENTA_MRR', 'DEMO_TECNICA', 65,
    14500.00, 1800.00, 680.00, 24,
    45.00, 800.00, 20.0,
    18120.00, 93.38,
    'Ejecutar prueba técnica con 200 casos históricos anonimizados',
    'Zero-Admin AI Ingest', 'Equipo AaaS · ProjectsFactory'
),
(
    'Torre de Control Financiera Multi-Proyecto (AI-CFO)',
    4, 1, 'finanactionable.co', 'RENTA_MRR', 'DISCOVERY', 45,
    24000.00, 3000.00, 1250.00, 24,
    85.00, 1100.00, 18.0,
    33000.00, 93.20,
    'Ejecutar Magic AI Column para personalizar propuesta de flujo de caja por obra',
    'Inbound finanactionable.co', 'Alfonso G. · FinActionable'
),
(
    'CRM Marca Blanca AI-Driven para Red de Brokers',
    5, 5, 'projectsfactory.io', 'HIBRIDO_AAAS', 'CERRADO_GANADO', 100,
    22000.00, 4000.00, 1150.00, 36,
    70.00, 1050.00, 16.7,
    31600.00, 93.91,
    'Tenant en producción sobre Render + Firebase Auth activo',
    'Partner Referral', 'Alfonso G. · ProjectsFactory'
);

INSERT INTO activity_logs (event_type, summary, raw_input, structured_payload) VALUES
(
    'ZERO_ADMIN_INGEST',
    'Agente Zero-Admin extrajo oportunidad de Grupo Logístico Andino ($890 MRR + $2,200 Setup)',
    'Reunión con Valentina Mendoza CFO de Grupo Logístico Andino: quieren rentar el motor de conciliaciones y exógenas por $890 al mes con setup de $2,200 por 24 meses.',
    '{"company":"Grupo Logístico Andino S.A.S.","modality":"RENTA_MRR","mrr":890,"setup":2200}'::jsonb
),
(
    'FINACTIONABLE_SIM',
    'Simulación FinActionable ejecutada: Renta 24m ($23,560 LTV) supera Venta Directa ($19,500) en el mes 20.8',
    NULL,
    '{"breakevenMonth":20.8,"ltv24":23560,"buyout":19500,"recommendation":"RENTA_MRR"}'::jsonb
),
(
    'MCP_TOOL_CALL',
    'Agente externo consultó catálogo de activos digitales vía MCP (nexuspf_catalog_assets)',
    NULL,
    '{"tool":"nexuspf_catalog_assets","caller":"antigravity-agent","assetsReturned":5}'::jsonb
);
