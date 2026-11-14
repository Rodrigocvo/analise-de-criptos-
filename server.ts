import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface CoinSpec {
  id: string;
  symbol: string;
  name: string;
  paprikaId: string;
  okxInstId: string;
}

const COINS: CoinSpec[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    paprikaId: "btc-bitcoin",
    okxInstId: "BTC-USDT",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    paprikaId: "eth-ethereum",
    okxInstId: "ETH-USDT",
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    paprikaId: "sol-solana",
    okxInstId: "SOL-USDT",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    paprikaId: "bnb-binance-coin",
    okxInstId: "BNB-USDT",
  },
  {
    id: "ripple",
    symbol: "XRP",
    name: "XRP",
    paprikaId: "xrp-xrp",
    okxInstId: "XRP-USDT",
  },
  {
    id: "polygon-ecosystem-token",
    symbol: "POL",
    name: "Polygon",
    paprikaId: "pol-polygon-ecosystem-token",
    okxInstId: "POL-USDT",
  },
  {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    paprikaId: "doge-dogecoin",
    okxInstId: "DOGE-USDT",
  },
  {
    id: "tron",
    symbol: "TRX",
    name: "TRON",
    paprikaId: "trx-tron",
    okxInstId: "TRX-USDT",
  },
  {
    id: "litecoin",
    symbol: "LTC",
    name: "Litecoin",
    paprikaId: "ltc-litecoin",
    okxInstId: "LTC-USDT",
  },
];

interface NormalizedCoinItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  high_24h: number;
  low_24h: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] };
}

interface CachedMarketData {
  timestamp: number;
  source: string;
  coins: NormalizedCoinItem[];
}

interface SparklineCache {
  timestamp: number;
  byId: Record<string, { prices: number[]; change7d: number; change1h: number }>;
}

interface OkxTicker {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
}

interface PaprikaTicker {
  id: string;
  quotes?: {
    USD?: {
      price: number;
      volume_24h: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
    };
  };
}

let marketCache: CachedMarketData | null = null;
let sparkCache: SparklineCache = { timestamp: 0, byId: {} };

const SPOT_CACHE_TTL_MS = 5_000;
const SPARK_CACHE_TTL_MS = 180_000;

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "rg-crypto-copilot/1.0",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function getSparklinesAnd7d(): Promise<SparklineCache["byId"]> {
  const now = Date.now();
  if (
    Object.keys(sparkCache.byId).length === COINS.length &&
    now - sparkCache.timestamp < SPARK_CACHE_TTL_MS
  ) {
    return sparkCache.byId;
  }

  const byId: SparklineCache["byId"] = { ...sparkCache.byId };

  // Fetch 4H candles (42 candles = 7 days) from OKX in parallel for true OHLC RSI-14
  await Promise.all(
    COINS.map(async (coin) => {
      try {
        const res = await fetchJsonWithTimeout<{ code: string; data: string[][] }>(
          `https://www.okx.com/api/v5/market/candles?instId=${coin.okxInstId}&bar=4H&limit=42`,
          5000
        );
        if (res.code === "0" && Array.isArray(res.data) && res.data.length >= 15) {
          // OKX returns newest first; reverse to chronological order and take close price [4]
          const closes = res.data
            .slice()
            .reverse()
            .map((row) => parseFloat(row[4]))
            .filter((v) => Number.isFinite(v) && v > 0);
          if (closes.length >= 15) {
            const first = closes[0];
            const latest = closes[closes.length - 1];
            const prev4h = closes[closes.length - 2] || latest;
            byId[coin.id] = {
              prices: closes,
              change7d: first > 0 ? ((latest - first) / first) * 100 : 0,
              change1h: prev4h > 0 ? ((latest - prev4h) / prev4h) * 25 : 0,
            };
          }
        }
      } catch {
        // Ignore single candle failure; preserve previous sparkline if available
      }
    })
  );

  if (Object.keys(byId).length > 0) {
    sparkCache = { timestamp: now, byId };
  }
  return byId;
}

async function fetchFromOkxAndCandles(): Promise<NormalizedCoinItem[]> {
  const [tickerPayload, sparkById] = await Promise.all([
    fetchJsonWithTimeout<{ code: string; data: OkxTicker[] }>(
      "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
      6000
    ),
    getSparklinesAnd7d(),
  ]);

  if (tickerPayload.code !== "0" || !Array.isArray(tickerPayload.data)) {
    throw new Error("OKX ticker error");
  }

  const tickerMap = new Map<string, OkxTicker>();
  for (const t of tickerPayload.data) {
    tickerMap.set(t.instId, t);
  }

  const results: NormalizedCoinItem[] = [];
  for (const coin of COINS) {
    const t = tickerMap.get(coin.okxInstId);
    if (!t) continue;
    const price = parseFloat(t.last);
    const open24 = parseFloat(t.open24h);
    const high24 = parseFloat(t.high24h);
    const low24 = parseFloat(t.low24h);
    const vol24 = parseFloat(t.volCcy24h);
    if (!Number.isFinite(price) || price <= 0) continue;

    const change24h =
      Number.isFinite(open24) && open24 > 0
        ? ((price - open24) / open24) * 100
        : 0;

    const sparkEntry = sparkById[coin.id];
    const sparkPrices = sparkEntry ? [...sparkEntry.prices] : [price];
    if (sparkPrices.length > 0) {
      sparkPrices[sparkPrices.length - 1] = price;
    }

    const first7d = sparkPrices[0] || price;
    const change7d =
      sparkPrices.length > 1 && first7d > 0
        ? ((price - first7d) / first7d) * 100
        : sparkEntry?.change7d ?? 0;

    results.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      current_price: price,
      price_change_percentage_1h_in_currency: sparkEntry?.change1h ?? change24h / 12,
      price_change_percentage_24h: change24h,
      price_change_percentage_7d_in_currency: change7d,
      high_24h: Number.isFinite(high24) ? Math.max(high24, price) : price * 1.02,
      low_24h: Number.isFinite(low24) ? Math.min(low24, price) : price * 0.98,
      total_volume: Number.isFinite(vol24) ? vol24 : 0,
      sparkline_in_7d: { price: sparkPrices },
    });
  }

  if (results.length < COINS.length) {
    throw new Error(`OKX returned only ${results.length}/${COINS.length} coins`);
  }

  return results;
}

async function fetchFromCoinPaprika(): Promise<NormalizedCoinItem[]> {
  const [tickers, sparkById] = await Promise.all([
    fetchJsonWithTimeout<PaprikaTicker[]>(
      "https://api.coinpaprika.com/v1/tickers",
      7000
    ),
    getSparklinesAnd7d(),
  ]);

  const byPaprikaId = new Map<string, PaprikaTicker>();
  for (const t of tickers) {
    byPaprikaId.set(t.id, t);
  }

  const results: NormalizedCoinItem[] = [];
  for (const coin of COINS) {
    const t = byPaprikaId.get(coin.paprikaId);
    const q = t?.quotes?.USD;
    if (!q || !Number.isFinite(q.price) || q.price <= 0) continue;

    const sparkEntry = sparkById[coin.id];
    const sparkPrices = sparkEntry ? [...sparkEntry.prices] : [q.price];
    sparkPrices[sparkPrices.length - 1] = q.price;

    results.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      current_price: q.price,
      price_change_percentage_1h_in_currency: q.percent_change_1h ?? 0,
      price_change_percentage_24h: q.percent_change_24h ?? 0,
      price_change_percentage_7d_in_currency: q.percent_change_7d ?? 0,
      high_24h: q.price * 1.025,
      low_24h: q.price * 0.975,
      total_volume: q.volume_24h ?? 0,
      sparkline_in_7d: { price: sparkPrices },
    });
  }

  if (results.length < COINS.length) {
    throw new Error(`CoinPaprika returned ${results.length}/${COINS.length}`);
  }
  return results;
}

async function fetchFromCoinGecko(): Promise<NormalizedCoinItem[]> {
  const ids = COINS.map((c) => c.id).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`;
  const data = await fetchJsonWithTimeout<NormalizedCoinItem[]>(url, 7000);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("CoinGecko empty response");
  }
  return data;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Multi-source real-time market endpoint (OKX Spot -> CoinPaprika -> CoinGecko)
  app.get("/api/market", async (req, res) => {
    const now = Date.now();
    const forceFresh = req.query.fresh === "1";

    if (
      !forceFresh &&
      marketCache &&
      now - marketCache.timestamp < SPOT_CACHE_TTL_MS
    ) {
      return res.json({
        source: marketCache.source,
        cached: true,
        updatedAt: marketCache.timestamp,
        coins: marketCache.coins,
      });
    }

    const providers: Array<{ name: string; fn: () => Promise<NormalizedCoinItem[]> }> = [
      { name: "okx-spot", fn: fetchFromOkxAndCandles },
      { name: "coinpaprika", fn: fetchFromCoinPaprika },
      { name: "coingecko", fn: fetchFromCoinGecko },
    ];

    for (const provider of providers) {
      try {
        const coins = await provider.fn();
        marketCache = {
          timestamp: Date.now(),
          source: provider.name,
          coins,
        };
        return res.json({
          source: provider.name,
          cached: false,
          updatedAt: marketCache.timestamp,
          coins,
        });
      } catch {
        // Try next live provider
      }
    }

    if (marketCache) {
      return res.json({
        source: `${marketCache.source}-stale`,
        cached: true,
        updatedAt: marketCache.timestamp,
        coins: marketCache.coins,
      });
    }

    return res.status(502).json({
      source: "fallback",
      error: "All live market providers temporarily unavailable.",
      coins: [],
    });
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
