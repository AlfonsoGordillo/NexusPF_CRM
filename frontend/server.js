import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3400);
const API_UPSTREAM = process.env.API_INTERNAL_URL || "http://localhost:4400";

app.use(express.json({ limit: "2mb" }));

// Seamless reverse proxy for /api/* to the Backend container
app.use("/api", async (req, res) => {
  try {
    const targetUrl = `${API_UPSTREAM}/api${req.url}`;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
    });
    const data = await response.text();
    res.status(response.status).type("application/json").send(data);
  } catch (error) {
    res.status(502).json({ error: `Backend upstream error: ${error.message}` });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[NexusPF-CRM Frontend] Running on http://0.0.0.0:${PORT} -> API: ${API_UPSTREAM}`);
});
