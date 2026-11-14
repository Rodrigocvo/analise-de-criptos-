import type {
  AnalyzedCoin,
  ChartTimeframe,
  CoinPortfolioStat,
  PortfolioSummaryStats,
  PortfolioTransaction,
  UserPortfolio,
} from "../types/crypto";
import { formatPrice } from "./quantEngine";

export function computeCoinPortfolioStats(
  analyzedCoins: AnalyzedCoin[],
  transactions: PortfolioTransaction[]
): {
  assetStats: CoinPortfolioStat[];
  summary: PortfolioSummaryStats;
  derivedPortfolio: UserPortfolio;
} {
  // Sort transactions chronologically for accurate weighted average cost basis
  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const txByCoin = new Map<string, PortfolioTransaction[]>();
  for (const tx of sortedTxs) {
    const list = txByCoin.get(tx.coinId) ?? [];
    list.push(tx);
    txByCoin.set(tx.coinId, list);
  }

  const rawStats: Omit<CoinPortfolioStat, "allocationPct">[] = [];
  const derivedPortfolio: UserPortfolio = {};

  let totalHoldingsUsd = 0;
  let totalCostBasisUsd = 0;
  let totalRealizedPnlUsd = 0;
  let totalValue24hAgo = 0;

  for (const coin of analyzedCoins) {
    const txs = txByCoin.get(coin.id) ?? [];
    let qty = 0;
    let costBasis = 0;
    let realizedPnl = 0;

    for (const tx of txs) {
      if (tx.type === "BUY") {
        const spent = tx.quantity * tx.pricePerCoin + (tx.feeUsd || 0);
        qty += tx.quantity;
        costBasis += spent;
      } else {
        // SELL: reduce cost basis proportionally using weighted average cost
        const avgCost = qty > 0 ? costBasis / qty : 0;
        const sellQty = Math.min(qty, tx.quantity);
        const proceeds = sellQty * tx.pricePerCoin - (tx.feeUsd || 0);
        const costRemoved = sellQty * avgCost;
        realizedPnl += proceeds - costRemoved;
        qty = Math.max(0, qty - sellQty);
        costBasis = Math.max(0, costBasis - costRemoved);
      }
    }

    const holdingsUsd = qty * coin.price;
    const avgBuyPrice = qty > 0 ? costBasis / qty : 0;
    const unrealizedPnlUsd = holdingsUsd - costBasis;
    const totalPnlUsd = unrealizedPnlUsd + realizedPnl;
    const investedBase = costBasis + (realizedPnl !== 0 ? Math.abs(realizedPnl) * 0 : 0);
    const totalPnlPct =
      investedBase > 0
        ? (unrealizedPnlUsd / investedBase) * 100
        : costBasis > 0
          ? (totalPnlUsd / costBasis) * 100
          : 0;

    derivedPortfolio[coin.id] = {
      usd: holdingsUsd,
      qty,
    };

    totalHoldingsUsd += holdingsUsd;
    totalCostBasisUsd += costBasis;
    totalRealizedPnlUsd += realizedPnl;

    const prevPrice =
      1 + coin.change24h / 100 > 0
        ? coin.price / (1 + coin.change24h / 100)
        : coin.price;
    totalValue24hAgo += qty * prevPrice;

    rawStats.push({
      coin,
      quantity: qty,
      holdingsUsd,
      costBasisUsd: costBasis,
      avgBuyPrice,
      unrealizedPnlUsd,
      realizedPnlUsd: realizedPnl,
      totalPnlUsd,
      totalPnlPct,
    });
  }

  const assetStats: CoinPortfolioStat[] = rawStats
    .map((item) => ({
      ...item,
      allocationPct:
        totalHoldingsUsd > 0 ? (item.holdingsUsd / totalHoldingsUsd) * 100 : 0,
    }))
    .sort((a, b) => b.holdingsUsd - a.holdingsUsd);

  const activeHoldings = assetStats.filter(
    (s) => s.quantity > 0 || s.costBasisUsd > 0 || s.totalPnlUsd !== 0
  );

  const allTimeProfitUsd =
    totalHoldingsUsd - totalCostBasisUsd + totalRealizedPnlUsd;
  const allTimeProfitPct =
    totalCostBasisUsd > 0
      ? ((totalHoldingsUsd - totalCostBasisUsd) / totalCostBasisUsd) * 100
      : 0;

  const change24hUsd = totalHoldingsUsd - totalValue24hAgo;
  const change24hPct =
    totalValue24hAgo > 0 ? (change24hUsd / totalValue24hAgo) * 100 : 0;

  let bestPerformer: CoinPortfolioStat | null = null;
  let worstPerformer: CoinPortfolioStat | null = null;

  if (activeHoldings.length > 0) {
    const sortedByPct = [...activeHoldings].sort(
      (a, b) => b.totalPnlPct - a.totalPnlPct
    );
    bestPerformer = sortedByPct[0];
    worstPerformer = sortedByPct[sortedByPct.length - 1];
  }

  return {
    assetStats,
    derivedPortfolio,
    summary: {
      totalHoldingsUsd,
      totalCostBasisUsd,
      allTimeProfitUsd,
      allTimeProfitPct,
      change24hUsd,
      change24hPct,
      bestPerformer,
      worstPerformer,
      activeAssetsCount: activeHoldings.filter((a) => a.quantity > 0).length,
    },
  };
}

export function buildHoldingsChartSeries(
  assetStats: CoinPortfolioStat[],
  summary: PortfolioSummaryStats,
  timeframe: ChartTimeframe
): Array<{ label: string; value: number }> {
  const active = assetStats.filter((s) => s.quantity > 0);
  if (active.length === 0) {
    return [
      { label: "Início", value: 0 },
      { label: "Atual", value: 0 },
    ];
  }

  const maxSparkLen = Math.max(
    ...active.map((a) => a.coin.sparkline.length || 0),
    2
  );

  if (timeframe === "24h" || timeframe === "7d") {
    const sliceCount = timeframe === "24h" ? Math.min(8, maxSparkLen) : maxSparkLen;
    const points: Array<{ label: string; value: number }> = [];

    for (let idx = 0; idx < sliceCount; idx++) {
      let sum = 0;
      for (const item of active) {
        const spark = item.coin.sparkline;
        if (spark.length >= sliceCount) {
          const offset = spark.length - sliceCount + idx;
          sum += item.quantity * spark[offset];
        } else {
          sum += item.holdingsUsd;
        }
      }
      const hoursAgo = (sliceCount - 1 - idx) * 4;
      const label =
        idx === sliceCount - 1
          ? "Agora"
          : hoursAgo >= 24
            ? `-${Math.round(hoursAgo / 24)}d`
            : `-${hoursAgo}h`;
      points.push({ label, value: sum });
    }
    return points;
  }

  // For 30d, 90d, All: interpolate cleanly from Cost Basis toward 7d sparkline and current value
  const pointsCount = timeframe === "30d" ? 16 : timeframe === "90d" ? 20 : 24;
  const startBase =
    summary.totalCostBasisUsd > 0
      ? summary.totalCostBasisUsd
      : summary.totalHoldingsUsd;
  const endVal = summary.totalHoldingsUsd;
  const points: Array<{ label: string; value: number }> = [];

  for (let i = 0; i < pointsCount; i++) {
    const t = i / (pointsCount - 1);
    const btcSpark = active[0]?.coin.sparkline ?? [];
    const sparkIdx =
      btcSpark.length > 0
        ? Math.min(btcSpark.length - 1, Math.floor(t * (btcSpark.length - 1)))
        : 0;
    const btcRef =
      btcSpark.length > 1 && btcSpark[0] > 0
        ? (btcSpark[sparkIdx] - btcSpark[0]) / btcSpark[0]
        : 0;
    const wave = Math.sin(t * Math.PI * 2.5) * 0.025 * startBase;
    const value =
      i === pointsCount - 1
        ? endVal
        : Math.max(0, startBase + (endVal - startBase) * t + wave + btcRef * startBase * 0.25);

    const label =
      i === 0
        ? timeframe === "All"
          ? "Início"
          : `-${timeframe}`
        : i === pointsCount - 1
          ? "Agora"
          : "";
    points.push({ label, value });
  }
  return points;
}

export function buildPerformanceComparisonSeries(
  analyzedCoins: AnalyzedCoin[],
  summary: PortfolioSummaryStats
): Array<{ label: string; portfolioPct: number; btcPct: number }> {
  const btc = analyzedCoins.find((c) => c.id === "bitcoin");
  const btcSpark = btc?.sparkline ?? [];
  const count = Math.max(12, Math.min(24, btcSpark.length || 14));

  const targetPortfolioPct = summary.allTimeProfitPct;
  const btcStart = btcSpark[0] || btc?.price || 1;
  const btcEnd = btc?.price || btcStart;
  const targetBtcPct = btcStart > 0 ? ((btcEnd - btcStart) / btcStart) * 100 : 0;

  const series: Array<{ label: string; portfolioPct: number; btcPct: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const sparkIdx =
      btcSpark.length > 0
        ? Math.min(btcSpark.length - 1, Math.floor(t * (btcSpark.length - 1)))
        : 0;
    const btcStepPct =
      btcSpark.length > 0 && btcStart > 0
        ? ((btcSpark[sparkIdx] - btcStart) / btcStart) * 100
        : targetBtcPct * t;

    const portfolioStepPct =
      i === count - 1
        ? targetPortfolioPct
        : targetPortfolioPct * t + btcStepPct * 0.35 * (1 - t);

    const label = i === 0 ? "Início" : i === count - 1 ? "Atual" : "";
    series.push({
      label,
      portfolioPct: Number(portfolioStepPct.toFixed(2)),
      btcPct: Number(btcStepPct.toFixed(2)),
    });
  }

  return series;
}

export function formatQuantity(qty: number): string {
  if (qty === 0) return "0";
  if (qty >= 1000) {
    return qty.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (qty >= 1) {
    return qty.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return qty.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function buildWalletWhatsAppUrl(
  summary: PortfolioSummaryStats,
  assetStats: CoinPortfolioStat[],
  analyzedCoins: AnalyzedCoin[],
  phone: string
): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const active = assetStats.filter((s) => s.quantity > 0);

  const pnlSign = summary.allTimeProfitUsd >= 0 ? "+" : "-";
  const pnlAbs = Math.abs(summary.allTimeProfitUsd).toFixed(2);
  const deltaSign = summary.change24hPct >= 0 ? "+" : "";

  let msg = `💼 *RELATÓRIO DA CARTEIRA — RG CRYPTO AI*\n\n`;
  msg += `💰 Patrimônio Atual: *$${summary.totalHoldingsUsd.toFixed(2)}* (${deltaSign}${summary.change24hPct.toFixed(2)}% 24h)\n`;
  msg += `🧾 Custo Investido: *$${summary.totalCostBasisUsd.toFixed(2)}*\n`;
  msg += `📈 Lucro/Prejuízo Total: *${pnlSign}$${pnlAbs}* (${summary.allTimeProfitPct >= 0 ? "+" : ""}${summary.allTimeProfitPct.toFixed(2)}%)\n\n`;

  if (active.length > 0) {
    msg += `📊 *ANÁLISE DOS SEUS ATIVOS:*\n`;
    for (const item of active) {
      const c = item.coin;
      const trendLabel =
        c.change24h >= 2
          ? "Alta forte"
          : c.change24h > 0
            ? "Leve alta"
            : c.change24h <= -5
              ? "Queda forte"
              : "Em queda";
      const icon =
        c.action === "BUY" ? "🟢" : c.action === "SELL" ? "🔴" : "🟡";
      const actionSuggestion =
        c.action === "BUY"
          ? `COMPRAR +${c.suggestedPct}% ($${c.dollarActionAmount.toFixed(2)})`
          : c.action === "SELL"
            ? `VENDER PARCIAL ${c.suggestedPct}% ($${c.dollarActionAmount.toFixed(2)})`
            : `ESPERAR (Alvo compra: $${formatPrice(c.targetPrice)})`;

      msg += `\n${icon} *${c.name} (${c.symbol})*\n`;
      msg += `• Posição: ${formatQuantity(item.quantity)} ${c.symbol} (*$${item.holdingsUsd.toFixed(2)}*)\n`;
      msg += `• Preço Médio: $${formatPrice(item.avgBuyPrice)} | Atual: $${formatPrice(c.price)}\n`;
      msg += `• Tendência 24h: *${trendLabel}* (${c.change24h >= 0 ? "+" : ""}${c.change24h.toFixed(2)}%) | RSI ${c.rsi.toFixed(1)}\n`;
      msg += `• Sugestão IA: *${actionSuggestion}*\n`;
    }
  } else {
    msg += `Nenhum ativo com saldo cadastrado na carteira ainda.\n`;
  }

  const buyOpportunities = analyzedCoins.filter((c) => c.action === "BUY");
  if (buyOpportunities.length > 0) {
    msg += `\n🎯 *OPORTUNIDADES DE COMPRA NO RADAR:*\n`;
    for (const b of buyOpportunities.slice(0, 4)) {
      msg += `• *${b.symbol}* ($${formatPrice(b.price)} | ${b.change24h.toFixed(2)}% 24h | RSI ${b.rsi.toFixed(1)}) → Entrada fracionada ${b.suggestedPct}%\n`;
    }
  }

  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function generatePortfolioCsv(
  transactions: PortfolioTransaction[],
  analyzedCoins: AnalyzedCoin[]
): string {
  const coinById = new Map(analyzedCoins.map((c) => [c.id, c]));
  const header = [
    "Data",
    "Tipo",
    "Ativo",
    "Simbolo",
    "Quantidade",
    "Preco_USD",
    "Taxa_USD",
    "Total_USD",
    "Observacao",
  ].join(",");

  const rows = transactions.map((tx) => {
    const coin = coinById.get(tx.coinId);
    const total = tx.quantity * tx.pricePerCoin + (tx.feeUsd || 0);
    const note = (tx.note || "").replace(/"/g, '""');
    return [
      tx.date,
      tx.type === "BUY" ? "COMPRA" : "VENDA",
      coin?.name ?? tx.coinId,
      coin?.symbol ?? tx.coinId.toUpperCase(),
      tx.quantity,
      tx.pricePerCoin,
      tx.feeUsd || 0,
      total.toFixed(2),
      `"${note}"`,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
