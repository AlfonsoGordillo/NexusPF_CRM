# NexusPF CRM — AI-Driven Revenue & FinActionable OS

**Diseñado para [`projectsfactory.io`](https://projectsfactory.io) y [`finanactionable.co`](https://finanactionable.co)**

**NexusPF CRM** es un sistema operativo comercial **AI-Driven** de última generación creado específicamente para fábricas de software, estudios de productos digitales y plataformas de Agentes como Servicio (**AaaS**) que comercializan sus activos bajo esquemas de **Venta Llave en Mano (Buyout CapEx)** o **Renta Recurrente (MRR SaaS / AaaS OpEx)**.

---

## Características Únicas (Inspiradas en Attio, Clay, Day.ai, Twenty y FinActionable)

1. **Zero-Admin Command Bar (`Ctrl + K`)**:
   - Ingesta conversacional sin formularios: pega una transcripción de reunión, correo o nota de WhatsApp y el agente extrae automáticamente **Empresa, Contacto, Producto Digital del Catálogo, Modalidad (Venta vs. Renta), Setup Fee, MRR, Punto de Equilibrio y LTV a 24 meses**, guardándolo directamente en PostgreSQL 16.
2. **Smart Grid B2B con *Magic AI Columns* (Estilo Attio + Clay)**:
   - Tabla de alta densidad con columnas calculadas por agentes IA (*AI Fit Score*, *Activo Digital Recomendado*, *Modalidad Comercial Óptima*, *Dictamen Financiero FinActionable* e *Icebreaker Ejecutivo*).
3. **FinActionable Deal Studio (Simulador Interactivo Venta vs. Renta)**:
   - Simulador financiero en tiempo real integrado en cada oportunidad que grafica las curvas de flujo acumulado a 36 meses (**Renta Recurrente MRR** vs. **Venta Directa Buyout**), calcula el **Mes Exacto de Punto de Equilibrio (Break-Even)** y el margen bruto descontando costos de infraestructura en **Render** y **Firebase**.
4. **Pipeline Dual Kanban (CapEx vs. MRR OpEx)**:
   - Gestión visual por etapas (*Discovery, Demo Técnica, Simulación FinActionable, Negociación, Cerrado Ganado*) con filtros por modalidad y métricas financieras en cada tarjeta.
5. **Catálogo Vivo de Activos Digitales & Tenants**:
   - Control centralizado del portafolio IP de `projectsfactory.io` y `finanactionable.co`, monitoreando tenants activos en renta, licencias vendidas y costos cloud por instancia.
6. **Servidor MCP (Model Context Protocol) Nativo**:
   - Expone 5 herramientas JSON-RPC/MCP (`nexuspf_catalog_assets`, `nexuspf_list_pipeline`, `nexuspf_simulate_unit_economics`, `nexuspf_magic_enrich_lead`, `nexuspf_zero_admin_ingest`) para que agentes externos como **Antigravity**, **Claude Code** o **Gemini CLI** operen el CRM autónomamente.

---

## Ejecución Local en Docker Desktop

```bash
docker compose up -d --build
```

- **Frontend Web (`nexuspf-web`)**: [http://localhost:3400](http://localhost:3400)
- **Backend API & MCP Server (`nexuspf-api`)**: [http://localhost:4400/api/health](http://localhost:4400/api/health)
- **Base de Datos PostgreSQL 16 (`nexuspf-db`)**: `localhost:5440` (`nexuspf` / `nexuspf_secret` / `nexuspf_crm`)

---

## Publicación en Render y Firebase

- **Render (`render.yaml`)**: Incluye Blueprint listo para desplegar `nexuspf-crm-api`, `nexuspf-crm-web` y la base de datos administrada `nexuspf-crm-db` (PostgreSQL 16).
- **Firebase (`firebase.json`)**: Configurado para servir el frontend en **Firebase Hosting** con rewrites hacia el motor API y soporte para **Firebase Auth / Firestore**.
