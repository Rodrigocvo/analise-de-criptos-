import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const COIN_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "ripple",
  "polygon-ecosystem-token",
  "dogecoin",
  "tron",
  "litecoin",
].join(",");

interface CachedMarketData {
  timestamp: number;
  data: unknown[];
}

let marketCache: CachedMarketData | null = null;
const CACHE_TTL_MS = 20_000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Live CoinGecko market proxy with 20s cache to respect rate limits
  app.get("/api/market", async (_req, res) => {
    const now = Date.now();
    if (marketCache && now - marketCache.timestamp < CACHE_TTL_MS) {
      return res.json({
        source: "coingecko",
        cached: true,
        updatedAt: marketCache.timestamp,
        coins: marketCache.data,
      });
    }

    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "rg-crypto-copilot/1.0",
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`CoinGecko HTTP ${response.status}`);
      }

      const data = (await response.json()) as unknown[];
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Empty response from CoinGecko");
      }

      marketCache = { timestamp: now, data };
      return res.json({
        source: "coingecko",
        cached: false,
        updatedAt: now,
        coins: data,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Market fetch failed";
      if (marketCache) {
        return res.json({
          source: "coingecko-stale",
          cached: true,
          updatedAt: marketCache.timestamp,
          coins: marketCache.data,
        });
      }
      return res.status(502).json({
        source: "fallback",
        error: message,
        coins: [],
      });
    }
  });

  // Server-side Gemini AI Strategic Portfolio Analysis
  app.post("/api/ai/analyze", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { summaryLines, profile, totalUsd, fearGreed } = req.body as {
      summaryLines?: string;
      profile?: string;
      totalUsd?: number;
      fearGreed?: number;
    };

    if (!summaryLines || typeof summaryLines !== "string") {
      return res.status(400).json({ error: "Dados da carteira ausentes para análise." });
    }

    if (!apiKey) {
      return res.status(503).json({
        fallback: true,
        error: "Chave GEMINI_API_KEY não configurada no servidor.",
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Você é um estrategista quantitativo de criptomoedas falando em português do Brasil com o investidor.
Perfil de risco selecionado: ${profile ?? "moderate"}
Patrimônio total monitorado: $${typeof totalUsd === "number" ? totalUsd.toFixed(2) : "0.00"} USD
Termômetro dinâmico do mercado (RSI médio): ${fearGreed ?? 50}/100

Dados técnicos atuais dos 9 ativos monitorados:
${summaryLines}

Entregue um plano tático conciso, estruturado em tópicos objetivos:
1. Leitura macro da carteira e nível de risco atual.
2. Onde comprar fracionado agora (com valores exatos em USD se houver saldo informado e alvos técnicos).
3. Onde realizar lucro parcial para recomprar mais barato (com preços-alvo de recompra).
4. Ativos em consolidação que devem ser mantidos sem giro desnecessário.
Seja direto, técnico e prático, sem avisos genéricos longos.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "Responda sempre em português do Brasil claro e estruturado, sem markdown excessivo de código, focando em gestão fracionada de risco.",
        },
      });

      const text = response.text;
      if (!text) {
        return res.status(502).json({ fallback: true, error: "Resposta vazia do modelo." });
      }

      return res.json({
        source: "gemini",
        model: "gemini-4-hydrogen",
        analysis: text,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao consultar Gemini API";
      return res.status(500).json({
        fallback: true,
        error: message,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RG Crypto AI Copilot server running on http://localhost:${PORT}`);
  });
}

startServer();
