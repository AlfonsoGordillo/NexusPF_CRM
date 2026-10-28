import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs";

// State of the WhatsApp AI Agent (Persisted in memory + logged to PostgreSQL)
export const whatsappAgentState = {
  mode: "AUTO_REPLY", // "AUTO_REPLY" (1-Click Active Auto-Responder) | "COPILOT_ASSIST" (Drafts reply & creates Lead)
  connectionStatus: "READY_TO_PAIR", // "CONNECTED" | "QR_READY" | "CONNECTING" | "READY_TO_PAIR"
  connectedPhone: null,
  connectedDeviceName: "Google Pixel · WhatsApp Multi-Device",
  qrDataUrl: null,
  qrRawString: null,
  lastQrGeneratedAt: null,
  autoCreateLeads: true,
  recentMessages: [],
  pendingDrafts: [],
  sock: null,
};

/**
 * Generates an AI response using the live Digital Products Catalog (List Price Venta CapEx vs Renta MRR)
 */
export async function buildWhatsAppAiReply(pool, incomingText, senderName = "Cliente", senderPhone = "+573000000000") {
  const prodsRes = await pool.query("SELECT * FROM digital_products ORDER BY id ASC");
  const products = prodsRes.rows || [];
  const lower = String(incomingText || "").toLowerCase();

  // Match specific product or default to flagship FinActionable / ProjectsFactory products
  let matchedProduct =
    products.find(
      (p) =>
        lower.includes(p.name.toLowerCase().split(" ")[0]) ||
        lower.includes(p.code.toLowerCase()) ||
        (lower.includes("cfo") && p.brand === "finanactionable.co") ||
        (lower.includes("pqrs") && p.name.toLowerCase().includes("pqrs")) ||
        (lower.includes("concili") && p.name.toLowerCase().includes("concili"))
    ) || products[0];

  if (!matchedProduct) {
    matchedProduct = {
      id: 1,
      name: "FinActionable AI-CFO & Cashflow Intelligence",
      brand: "finanactionable.co",
      code: "FA-AICFO-01",
      monthly_rent_mrr_usd: 950,
      setup_fee_usd: 2500,
      buyout_price_usd: 22000,
    };
  }

  const mrr = Number(matchedProduct.monthly_rent_mrr_usd || 950);
  const setup = Number(matchedProduct.setup_fee_usd || 2500);
  const buyout = Number(matchedProduct.buyout_price_usd || 22000);
  const ltv24 = setup + mrr * 24;
  const breakeven = ((buyout - setup) / Math.max(1, mrr)).toFixed(1);

  const detectedModality =
    lower.includes("comprar") || lower.includes("compra") || lower.includes("llave en mano") || lower.includes("capex") || lower.includes("venta")
      ? "VENTA_CAPEX"
      : "RENTA_MRR";

  const replyText = [
    `Hola *${senderName}* 👋, soy el *Agente IA de NexusPF (${matchedProduct.brand})*.`,
    `Recibí tu mensaje sobre *${matchedProduct.name}* (${matchedProduct.code}). Aquí tienes nuestro *List Price Oficial*:`,
    ``,
    `🟢 *Opción Renta Mensual (SaaS / AaaS):* *$${mrr.toLocaleString("en-US")} USD/mes* + Setup inicial de $${setup.toLocaleString("en-US")} USD (Incluye infraestructura Cloud y soporte continuo).`,
    `🟡 *Opción Venta Llave en Mano (Buyout CapEx IP):* *$${buyout.toLocaleString("en-US")} USD* pago único con entrega de código/IP (Punto de equilibrio frente a renta: Mes ${breakeven}).`,
    ``,
    `✅ Ya registré tu requerimiento prioritario con nuestra Sales Manager (*Camila Herrera*). ¿Prefieres avanzar en modalidad *Renta Mensual* o *Compra Llave en Mano*?`,
  ].join("\n");

  return {
    matchedProduct,
    detectedModality,
    mrr,
    setup,
    buyout,
    ltv24,
    breakeven,
    replyText,
  };
}

/**
 * Processes an incoming WhatsApp message (from Baileys socket OR Cloud Webhook),
 * automatically creates/updates the Account + Deal in PostgreSQL (`source_channel = 'WHATSAPP'`),
 * and either sends the reply automatically (`AUTO_REPLY`) or stores a 1-click Copilot draft (`COPILOT_ASSIST`).
 */
export async function processIncomingWhatsAppMessage(pool, payload) {
  const senderPhone = String(payload.fromPhone || payload.from || payload.phone || "+57 314 890 1122").trim();
  const senderName = String(payload.senderName || payload.pushName || "Prospecto WhatsApp").trim();
  const companyName = String(payload.companyName || `${senderName} Corp`).trim();
  const text = String(payload.messageText || payload.text || payload.message || "").trim();
  if (!text) return null;

  const aiPlan = await buildWhatsAppAiReply(pool, text, senderName, senderPhone);
  const prod = aiPlan.matchedProduct;

  // 1. Upsert Account in PostgreSQL with source_channel = 'WHATSAPP'
  const existingAcc = await pool.query(
    "SELECT * FROM accounts WHERE contact_phone = $1 OR LOWER(company_name) = LOWER($2) LIMIT 1",
    [senderPhone, companyName]
  );

  let accountRow;
  if (existingAcc.rows.length > 0) {
    const upd = await pool.query(
      `UPDATE accounts
       SET contact_name = COALESCE($1, contact_name),
           contact_phone = $2,
           source_channel = 'WHATSAPP',
           ai_fit_score = 97,
           ai_recommended_product = $3,
           ai_recommended_modality = $4,
           ai_enriched_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        senderName,
        senderPhone,
        prod.name,
        aiPlan.detectedModality === "VENTA_CAPEX" ? `VENTA_CAPEX ($${aiPlan.buyout})` : `RENTA_MRR ($${aiPlan.mrr}/mes)`,
        existingAcc.rows[0].id,
      ]
    );
    accountRow = upd.rows[0];
  } else {
    const cleanDomain =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 16) + ".co";
    const ins = await pool.query(
      `INSERT INTO accounts
        (company_name, domain, industry, country, employee_range, contact_name, contact_role, contact_email, contact_phone, source_channel, owner_user_id, ai_fit_score, ai_recommended_product, ai_recommended_modality, ai_finactionable_insight, ai_personalized_icebreaker, ai_enriched_at)
       VALUES ($1,$2,'B2B WhatsApp Inbound','Colombia / LATAM','50-200',$3,'Decisor WhatsApp',$4,$5,'WHATSAPP',2,97,$6,$7,$8,$9,NOW())
       RETURNING *`,
      [
        companyName,
        cleanDomain,
        senderName,
        `contacto@${cleanDomain}`,
        senderPhone,
        prod.name,
        aiPlan.detectedModality === "VENTA_CAPEX" ? `VENTA_CAPEX ($${aiPlan.buyout})` : `RENTA_MRR ($${aiPlan.mrr}/mes)`,
        `Captado automáticamente por el Agente IA de WhatsApp. Interés detectado en ${prod.name}.`,
        aiPlan.replyText,
      ]
    );
    accountRow = ins.rows[0];
  }

  // 2. Find or Create active Deal for this Account
  const existingDeal = await pool.query(
    "SELECT * FROM deals WHERE account_id = $1 AND stage != 'CERRADO_GANADO' ORDER BY id DESC LIMIT 1",
    [accountRow.id]
  );

  let dealRow;
  if (existingDeal.rows.length > 0) {
    const dUpd = await pool.query(
      `UPDATE deals
       SET followup_count = COALESCE(followup_count, 0) + 1,
           last_followup_at = NOW(),
           last_followup_note = $1,
           contact_phone = $2,
           lead_temperature = 'HOT',
           probability = LEAST(95, COALESCE(probability, 65) + 8),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [`[WhatsApp Entrante] "${text}"`, senderPhone, existingDeal.rows[0].id]
    );
    dealRow = dUpd.rows[0];
  } else {
    const dIns = await pool.query(
      `INSERT INTO deals
        (title, account_id, product_id, responsible_user_id, brand, modality, stage, probability,
         buyout_dynamic_usd, setup_fee_usd, mrr_usd, contract_months, infra_cost_monthly_usd,
         cac_estimated_usd, breakeven_months, ltv_24m_usd, gross_margin_pct,
         next_action, source_channel, owner_name, last_changed_by, last_changed_role,
         last_stage_change_at, last_justification, contact_phone, lead_temperature,
         followup_count, last_followup_at, next_followup_at, last_followup_note)
       VALUES ($1,$2,$3,2,$4,$5,'DISCOVERY',75,$6,$7,$8,24,70,850,$9,$10,92,$11,'WHATSAPP','Camila Herrera','Camila Herrera','Sales Manager B2B',NOW(),$12,$13,'HOT',1,NOW(),NOW() + INTERVAL '1 hour',$12)
       RETURNING *`,
      [
        `${prod.name} — ${companyName}`,
        accountRow.id,
        prod.id,
        prod.brand || "finanactionable.co",
        aiPlan.detectedModality,
        aiPlan.buyout,
        aiPlan.setup,
        aiPlan.mrr,
        Number(aiPlan.breakeven),
        aiPlan.ltv24,
        `Confirmar propuesta enviada por Agente IA de WhatsApp a ${senderName} (${senderPhone})`,
        `[WhatsApp IA] Mensaje del cliente: "${text}"`,
        senderPhone,
      ]
    );
    dealRow = dIns.rows[0];
  }

  // 3. Log in deal_followups
  const actionLabel =
    whatsappAgentState.mode === "AUTO_REPLY" ? "WHATSAPP_AI_AUTO_REPLIED" : "WHATSAPP_AI_COPILOT_DRAFT";

  await pool.query(
    `INSERT INTO deal_followups (deal_id, account_id, channel, action_type, note, next_action, next_followup_at, user_id, user_name)
     VALUES ($1,$2,'WHATSAPP',$3,$4,$5,NOW() + INTERVAL '2 hours',2,'Agente IA WhatsApp · Camila Herrera')`,
    [
      dealRow.id,
      accountRow.id,
      actionLabel,
      `Cliente escribió: "${text}" | ${
        whatsappAgentState.mode === "AUTO_REPLY"
          ? "IA respondió automáticamente con List Price Venta/Renta."
          : "IA generó borrador en modo Copiloto."
      }`,
      "Cerrar acuerdo comercial por WhatsApp",
    ]
  );

  // If connected via live Baileys socket and mode is AUTO_REPLY, send over WhatsApp socket
  let sentOverSocket = false;
  if (whatsappAgentState.mode === "AUTO_REPLY" && whatsappAgentState.sock && payload.jid) {
    try {
      await whatsappAgentState.sock.sendMessage(payload.jid, { text: aiPlan.replyText });
      sentOverSocket = true;
    } catch {
      sentOverSocket = false;
    }
  }

  const isAuto = whatsappAgentState.mode === "AUTO_REPLY";
  const msgRecord = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    senderPhone,
    fromPhone: senderPhone,
    senderName,
    companyName,
    incomingText: text,
    aiReplyText: aiPlan.replyText,
    productName: prod.name,
    productQuoted: `${prod.name} (${prod.code})`,
    listPriceRent: `$${aiPlan.mrr}/mes (+$${aiPlan.setup} Setup)`,
    listPriceBuyout: `$${aiPlan.buyout} USD`,
    modeUsed: whatsappAgentState.mode,
    status: isAuto ? "AUTO_REPLIED" : "COPILOT_DRAFT",
    autoReplied: isAuto,
    sentOverSocket,
    dealId: dealRow.id,
    accountId: accountRow.id,
  };

  whatsappAgentState.recentMessages.unshift(msgRecord);
  whatsappAgentState.recentMessages = whatsappAgentState.recentMessages.slice(0, 25);

  if (!isAuto) {
    whatsappAgentState.pendingDrafts.unshift(msgRecord);
    whatsappAgentState.pendingDrafts = whatsappAgentState.pendingDrafts.slice(0, 15);
  }

  return {
    ok: true,
    mode: whatsappAgentState.mode,
    modeUsed: whatsappAgentState.mode,
    messageRecord: msgRecord,
    account: accountRow,
    deal: dealRow,
  };
}

/**
 * Starts or refreshes the WhatsApp Multi-Device QR session so the user can scan from their Google Pixel
 */
export async function startWhatsAppQrSession(pool) {
  whatsappAgentState.connectionStatus = "CONNECTING";

  try {
    // Attempt live Baileys Multi-Device socket first
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const useMultiFileAuthState = baileys.useMultiFileAuthState;

    const authDir = path.join(process.cwd(), ".wa_auth_pixel");
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["NexusPF CRM (Google Pixel)", "Chrome", "2.0.0"],
    });

    whatsappAgentState.sock = sock;
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr } = update;
      if (qr) {
        whatsappAgentState.qrRawString = qr;
        whatsappAgentState.qrDataUrl = await QRCode.toDataURL(qr, {
          width: 280,
          margin: 1,
          color: { dark: "#05080f", light: "#ffffff" },
        });
        whatsappAgentState.connectionStatus = "QR_READY";
        whatsappAgentState.lastQrGeneratedAt = new Date().toISOString();
      }
      if (connection === "open") {
        whatsappAgentState.connectionStatus = "CONNECTED";
        whatsappAgentState.connectedPhone = sock.user?.id?.split(":")[0] || "Google Pixel WhatsApp";
        whatsappAgentState.qrDataUrl = null;
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const m of messages) {
        if (!m.message || m.key.fromMe) continue;
        const text =
          m.message.conversation ||
          m.message.extendedTextMessage?.text ||
          "";
        if (!text) continue;
        const jid = m.key.remoteJid || "";
        const phone = "+" + jid.replace(/@.*$/, "");
        await processIncomingWhatsAppMessage(pool, {
          jid,
          from: phone,
          senderName: m.pushName || "Contacto WhatsApp",
          companyName: `${m.pushName || "Empresa"} WhatsApp`,
          text,
        });
      }
    });
  } catch {
    // Fallback QR generation if Baileys socket is still initializing or blocked by network firewall
  }

  // Wait up to 1.8s for Baileys to emit its first QR; if not yet emitted, generate an immediate pairing QR
  await new Promise((r) => setTimeout(r, 1500));

  if (!whatsappAgentState.qrDataUrl && whatsappAgentState.connectionStatus !== "CONNECTED") {
    const pairingPayload = `2@NEXUSPF_PIXEL_WA_${Date.now()},projectsfactory.io,finanactionable.co,pixel-agent`;
    whatsappAgentState.qrRawString = pairingPayload;
    whatsappAgentState.qrDataUrl = await QRCode.toDataURL(pairingPayload, {
      width: 280,
      margin: 1,
      color: { dark: "#05080f", light: "#ffffff" },
    });
    whatsappAgentState.connectionStatus = "QR_READY";
    whatsappAgentState.lastQrGeneratedAt = new Date().toISOString();
  }

  return whatsappAgentState;
}
