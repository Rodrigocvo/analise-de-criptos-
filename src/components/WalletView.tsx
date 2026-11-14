import React, { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  AnalyzedCoin,
  ChartTimeframe,
  PortfolioTransaction,
} from "../types/crypto";
import {
  buildHoldingsChartSeries,
  buildPerformanceComparisonSeries,
  buildWalletWhatsAppUrl,
  computeCoinPortfolioStats,
  formatQuantity,
  generatePortfolioCsv,
} from "../utils/portfolioMath";
import { formatPrice } from "../utils/quantEngine";

interface WalletViewProps {
  analyzedCoins: AnalyzedCoin[];
  transactions: PortfolioTransaction[];
  portfolioName: string;
  whatsappPhone: string;
  onUpdatePortfolioName: (name: string) => void;
  onUpdateWhatsappPhone: (phone: string) => void;
  onOpenAddTransaction: (coinId?: string) => void;
  onDeleteTransaction: (txId: string) => void;
  onNotify: (message: string, tone?: "success" | "warning" | "info") => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  analyzedCoins,
  transactions,
  portfolioName,
  whatsappPhone,
  onUpdatePortfolioName,
  onUpdateWhatsappPhone,
  onOpenAddTransaction,
  onDeleteTransaction,
  onNotify,
}) => {
  const [hideBalances, setHideBalances] = useState(false);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("24h");
  const [holdingsMode, setHoldingsMode] = useState<"history" | "allocation">(
    "history"
  );
  const [subTab, setSubTab] = useState<"assets" | "transactions">("assets");
  const [showZeroAssets, setShowZeroAssets] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [perfHoverIdx, setPerfHoverIdx] = useState<number | null>(null);

  const { assetStats, summary } = useMemo(
    () => computeCoinPortfolioStats(analyzedCoins, transactions),
    [analyzedCoins, transactions]
  );

  const holdingsSeries = useMemo(
    () => buildHoldingsChartSeries(assetStats, summary, timeframe),
    [assetStats, summary, timeframe]
  );

  const perfSeries = useMemo(
    () => buildPerformanceComparisonSeries(analyzedCoins, summary),
    [analyzedCoins, summary]
  );

  const whatsappUrl = useMemo(
    () =>
      buildWalletWhatsAppUrl(summary, assetStats, analyzedCoins, whatsappPhone),
    [summary, assetStats, analyzedCoins, whatsappPhone]
  );

  const handleExportCsv = () => {
    if (transactions.length === 0) {
      onNotify("Adicione transações antes de exportar.", "warning");
      return;
    }
    const csv = generatePortfolioCsv(transactions, analyzedCoins);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carteira_rg_crypto.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify("Carteira exportada em CSV.", "success");
  };

  const maskVal = (formatted: string) => (hideBalances ? "••••••" : formatted);

  // Holdings SVG Chart Geometry
  const hValues = holdingsSeries.map((p) => p.value);
  const hMin = Math.min(...hValues, 0);
  const hMax = Math.max(...hValues, 1);
  const hSpan = hMax - hMin || 1;
  const chartW = 620;
  const chartH = 190;
  const hCoords = holdingsSeries.map((pt, i) => {
    const x =
      holdingsSeries.length > 1
        ? (i / (holdingsSeries.length - 1)) * chartW
        : chartW / 2;
    const y = chartH - ((pt.value - hMin) / hSpan) * (chartH - 28) - 14;
    return { ...pt, x, y };
  });
  const hLinePath = hCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const hAreaPath = `0,${chartH} ${hLinePath} ${chartW},${chartH}`;
  const isHoldingsDown = summary.change24hPct < 0;
  const hStroke = isHoldingsDown ? "#F43F5E" : "#10B981";

  // Performance Comparison SVG Chart Geometry
  const pValues = perfSeries.flatMap((p) => [p.portfolioPct, p.btcPct]);
  const pMin = Math.min(...pValues, -10);
  const pMax = Math.max(...pValues, 10);
  const pSpan = pMax - pMin || 1;
  const perfW = 420;
  const perfH = 190;
  const pCoords = perfSeries.map((pt, i) => {
    const x =
      perfSeries.length > 1
        ? (i / (perfSeries.length - 1)) * perfW
        : perfW / 2;
    const yPort =
      perfH - ((pt.portfolioPct - pMin) / pSpan) * (perfH - 28) - 14;
    const yBtc = perfH - ((pt.btcPct - pMin) / pSpan) * (perfH - 28) - 14;
    return { ...pt, x, yPort, yBtc };
  });
  const portLine = pCoords.map((p) => `${p.x.toFixed(1)},${p.yPort.toFixed(1)}`).join(" ");
  const btcLine = pCoords.map((p) => `${p.x.toFixed(1)},${p.yBtc.toFixed(1)}`).join(" ");
  const zeroLineY = perfH - ((0 - pMin) / pSpan) * (perfH - 28) - 14;

  const visibleAssets = showZeroAssets
    ? assetStats
    : assetStats.filter((a) => a.quantity > 0 || a.costBasisUsd > 0);

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const activeHoverPoint =
    hoverIdx !== null && hCoords[hoverIdx] ? hCoords[hoverIdx] : null;
  const activePerfHover =
    perfHoverIdx !== null && pCoords[perfHoverIdx]
      ? pCoords[perfHoverIdx]
      : null;

  return (
    <div className="space-y-6">
      {/* Portfolio Top Summary Header (CoinMarketCap style) */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              value={portfolioName}
              onChange={(e) => onUpdatePortfolioName(e.target.value)}
              aria-label="Nome da carteira"
              className="bg-transparent font-display text-xs font-semibold text-slate-300 uppercase tracking-wider focus:outline-none focus:text-white border-b border-transparent focus:border-slate-700 w-44"
            />
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-400">
              {summary.activeAssetsCount} ativos com saldo
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-white">
              {maskVal(
                `$${summary.totalHoldingsUsd.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </span>

            <span
              className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${
                summary.change24hPct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {summary.change24hPct >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{Math.abs(summary.change24hPct).toFixed(2)}% (24h)</span>
            </span>

            <button
              onClick={() => setHideBalances((v) => !v)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
              title={hideBalances ? "Mostrar valores" : "Ocultar valores"}
              aria-label={hideBalances ? "Mostrar valores" : "Ocultar valores"}
            >
              {hideBalances ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Right Actions: WhatsApp Number + Send Wallet Analysis + Add Transaction + Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 bg-[#070B14] border border-slate-800 focus-within:border-emerald-500 rounded-lg px-3 h-10">
            <span className="text-xs text-slate-400 whitespace-nowrap">
              WhatsApp:
            </span>
            <input
              type="text"
              value={whatsappPhone}
              onChange={(e) =>
                onUpdateWhatsappPhone(e.target.value.replace(/\D/g, ""))
              }
              placeholder="5538999999999"
              className="bg-transparent font-mono text-xs text-white w-32 focus:outline-none"
            />
          </label>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold text-emerald-300 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Enviar Análise no WhatsApp</span>
          </a>

          <button
            onClick={() => onOpenAddTransaction()}
            className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Transação</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="h-10 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>
      </section>

      {/* Main Analytics Split: Holdings Chart + Performance Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Holdings History / Allocation */}
        <section className="lg:col-span-7 bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-sm font-bold text-white">
                Holdings
              </h2>
              {activeHoverPoint && holdingsMode === "history" && (
                <span className="font-mono text-xs text-slate-300">
                  {activeHoverPoint.label}:{" "}
                  <strong className="text-white">
                    {maskVal(`$${activeHoverPoint.value.toFixed(2)}`)}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {holdingsMode === "history" && (
                <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#070B14] border border-slate-800 rounded-lg">
                  {(["24h", "7d", "30d", "90d", "All"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`h-7 px-2.5 rounded-md font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                        timeframe === tf
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}

              <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#070B14] border border-slate-800 rounded-lg">
                <button
                  onClick={() => setHoldingsMode("history")}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    holdingsMode === "history"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Histórico
                </button>
                <button
                  onClick={() => setHoldingsMode("allocation")}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    holdingsMode === "allocation"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Alocação
                </button>
              </div>
            </div>
          </div>

          {holdingsMode === "history" ? (
            <div className="relative pt-2">
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                <span>{maskVal(`$${hMax.toFixed(2)}`)}</span>
                <span>{maskVal(`$${hMin.toFixed(2)}`)}</span>
              </div>
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-48 overflow-visible"
                onMouseLeave={() => setHoverIdx(null)}
              >
                <defs>
                  <linearGradient id="holdingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hStroke} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={hStroke} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal gridlines */}
                {[0.2, 0.5, 0.8].map((ratio) => (
                  <line
                    key={ratio}
                    x1="0"
                    y1={chartH * ratio}
                    x2={chartW}
                    y2={chartH * ratio}
                    stroke="#1E293B"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                ))}
                <polygon points={hAreaPath} fill="url(#holdingsFill)" />
                <polyline
                  fill="none"
                  stroke={hStroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={hLinePath}
                />
                {activeHoverPoint && (
                  <>
                    <line
                      x1={activeHoverPoint.x}
                      y1="0"
                      x2={activeHoverPoint.x}
                      y2={chartH}
                      stroke="#475569"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={activeHoverPoint.x}
                      cy={activeHoverPoint.y}
                      r="4"
                      fill={hStroke}
                      stroke="#070B14"
                      strokeWidth="2"
                    />
                  </>
                )}
                {/* Invisible hover hit targets */}
                {hCoords.map((pt, idx) => {
                  const segW = chartW / Math.max(1, hCoords.length);
                  return (
                    <rect
                      key={`${pt.label}-${idx}`}
                      x={Math.max(0, pt.x - segW / 2)}
                      y="0"
                      width={segW}
                      height={chartH}
                      fill="transparent"
                      onMouseEnter={() => setHoverIdx(idx)}
                    />
                  );
                })}
              </svg>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>{holdingsSeries[0]?.label || ""}</span>
                <span>
                  {holdingsSeries[Math.floor(holdingsSeries.length / 2)]?.label || ""}
                </span>
                <span>{holdingsSeries[holdingsSeries.length - 1]?.label || "Agora"}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {summary.totalHoldingsUsd <= 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  Adicione transações para visualizar a distribuição percentual da carteira.
                </div>
              ) : (
                <>
                  {/* Stacked Allocation Bar */}
                  <div className="w-full h-4 rounded-md overflow-hidden flex bg-slate-900">
                    {assetStats
                      .filter((s) => s.allocationPct > 0)
                      .map((s) => (
                        <div
                          key={s.coin.id}
                          style={{
                            width: `${s.allocationPct}%`,
                            backgroundColor: s.coin.color,
                          }}
                          title={`${s.coin.symbol}: ${s.allocationPct.toFixed(1)}%`}
                        />
                      ))}
                  </div>
                  {/* Allocation Breakdown List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {assetStats
                      .filter((s) => s.holdingsUsd > 0)
                      .map((s) => (
                        <div
                          key={s.coin.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: s.coin.color }}
                            />
                            <span className="font-semibold text-slate-200">
                              {s.coin.name}
                            </span>
                            <span className="font-mono text-slate-500">
                              {s.coin.symbol}
                            </span>
                          </div>
                          <div className="font-mono text-right">
                            <span className="text-white font-semibold">
                              {s.allocationPct.toFixed(1)}%
                            </span>
                            <span className="text-slate-500 ml-2">
                              {maskVal(`$${s.holdingsUsd.toFixed(2)}`)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Right: Performance vs BTC Trend */}
        <section className="lg:col-span-5 bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                Performance
              </h2>
              <div className="flex items-center gap-4 text-xs mt-1">
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Lucro acumulado</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Tendência BTC</span>
                </span>
              </div>
            </div>
            {activePerfHover && (
              <div className="text-right font-mono text-[11px]">
                <div className="text-blue-400">
                  Carteira: {activePerfHover.portfolioPct >= 0 ? "+" : ""}
                  {activePerfHover.portfolioPct.toFixed(1)}%
                </div>
                <div className="text-amber-400">
                  BTC: {activePerfHover.btcPct >= 0 ? "+" : ""}
                  {activePerfHover.btcPct.toFixed(1)}%
                </div>
              </div>
            )}
          </div>

          <div className="relative pt-2">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
              <span>{pMax >= 0 ? `+${pMax.toFixed(0)}%` : `${pMax.toFixed(0)}%`}</span>
              <span>{pMin >= 0 ? `+${pMin.toFixed(0)}%` : `${pMin.toFixed(0)}%`}</span>
            </div>
            <svg
              viewBox={`0 0 ${perfW} ${perfH}`}
              className="w-full h-48 overflow-visible"
              onMouseLeave={() => setPerfHoverIdx(null)}
            >
              {/* Zero baseline */}
              <line
                x1="0"
                y1={zeroLineY}
                x2={perfW}
                y2={zeroLineY}
                stroke="#334155"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={btcLine}
              />
              <polyline
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={portLine}
              />
              {activePerfHover && (
                <>
                  <line
                    x1={activePerfHover.x}
                    y1="0"
                    x2={activePerfHover.x}
                    y2={perfH}
                    stroke="#475569"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={activePerfHover.x}
                    cy={activePerfHover.yPort}
                    r="3.5"
                    fill="#3B82F6"
                  />
                  <circle
                    cx={activePerfHover.x}
                    cy={activePerfHover.yBtc}
                    r="3.5"
                    fill="#F59E0B"
                  />
                </>
              )}
              {pCoords.map((pt, idx) => {
                const segW = perfW / Math.max(1, pCoords.length);
                return (
                  <rect
                    key={idx}
                    x={Math.max(0, pt.x - segW / 2)}
                    y="0"
                    width={segW}
                    height={perfH}
                    fill="transparent"
                    onMouseEnter={() => setPerfHoverIdx(idx)}
                  />
                );
              })}
            </svg>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>Início</span>
              <span>Atual</span>
            </div>
          </div>
        </section>
      </div>

      {/* Middle 3-Card Summary Row: All-time Profit, Cost Basis, Best & Worst Performer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between">
          <div className="text-xs text-slate-400">Lucro Total (All-time profit)</div>
          <div className="mt-2 space-y-1">
            <div
              className={`font-mono text-2xl font-bold ${
                summary.allTimeProfitUsd >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {maskVal(
                `${summary.allTimeProfitUsd >= 0 ? "+" : "-"}$${Math.abs(
                  summary.allTimeProfitUsd
                ).toFixed(2)}`
              )}
            </div>
            <div
              className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
                summary.allTimeProfitPct >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {summary.allTimeProfitPct >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{Math.abs(summary.allTimeProfitPct).toFixed(2)}%</span>
            </div>
          </div>
        </section>

        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between">
          <div className="text-xs text-slate-400">Custo Base (Cost Basis)</div>
          <div className="mt-2 space-y-1">
            <div className="font-mono text-2xl font-bold text-white">
              {maskVal(`$${summary.totalCostBasisUsd.toFixed(2)}`)}
            </div>
            <div className="text-xs text-slate-500">
              Capital líquido investido nas posições atuais
            </div>
          </div>
        </section>

        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 grid grid-cols-2 divide-x divide-slate-800/80">
          <div className="pr-3 space-y-1.5">
            <div className="text-xs text-slate-400">Melhor Desempenho</div>
            {summary.bestPerformer ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-slate-950 shrink-0"
                    style={{ backgroundColor: summary.bestPerformer.coin.color }}
                  >
                    {summary.bestPerformer.coin.symbol}
                  </span>
                  <span className="font-display font-bold text-sm text-white">
                    {summary.bestPerformer.coin.symbol}
                  </span>
                </div>
                <div
                  className={`font-mono text-xs font-semibold ${
                    summary.bestPerformer.totalPnlUsd >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {maskVal(
                    `${summary.bestPerformer.totalPnlUsd >= 0 ? "+" : "-"}$${Math.abs(
                      summary.bestPerformer.totalPnlUsd
                    ).toFixed(2)}`
                  )}{" "}
                  <span className="block text-[11px]">
                    {summary.bestPerformer.totalPnlPct >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(summary.bestPerformer.totalPnlPct).toFixed(2)}%
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 pt-1">--</div>
            )}
          </div>

          <div className="pl-4 space-y-1.5">
            <div className="text-xs text-slate-400">Pior Desempenho</div>
            {summary.worstPerformer ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-slate-950 shrink-0"
                    style={{ backgroundColor: summary.worstPerformer.coin.color }}
                  >
                    {summary.worstPerformer.coin.symbol}
                  </span>
                  <span className="font-display font-bold text-sm text-white">
                    {summary.worstPerformer.coin.symbol}
                  </span>
                </div>
                <div
                  className={`font-mono text-xs font-semibold ${
                    summary.worstPerformer.totalPnlUsd >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {maskVal(
                    `${summary.worstPerformer.totalPnlUsd >= 0 ? "+" : "-"}$${Math.abs(
                      summary.worstPerformer.totalPnlUsd
                    ).toFixed(2)}`
                  )}{" "}
                  <span className="block text-[11px]">
                    {summary.worstPerformer.totalPnlPct >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(summary.worstPerformer.totalPnlPct).toFixed(2)}%
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 pt-1">--</div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Sub-Tabs: Assets | Transactions */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="inline-flex items-center gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-lg">
            <button
              onClick={() => setSubTab("assets")}
              className={`h-8 px-3.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                subTab === "assets"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ativos ({visibleAssets.length})
            </button>
            <button
              onClick={() => setSubTab("transactions")}
              className={`h-8 px-3.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                subTab === "transactions"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Transações ({transactions.length})
            </button>
          </div>

          {subTab === "assets" && (
            <button
              onClick={() => setShowZeroAssets((v) => !v)}
              className="text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showZeroAssets
                ? "Ocultar ativos zerados"
                : "Mostrar todos os 9 ativos"}
            </button>
          )}
        </div>

        {subTab === "assets" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Nome</th>
                  <th className="py-2.5 px-3 text-right">Preço</th>
                  <th className="py-2.5 px-3 text-right">1h%</th>
                  <th className="py-2.5 px-3 text-right">24h%</th>
                  <th className="py-2.5 px-3 text-right">7d%</th>
                  <th className="py-2.5 px-3 text-right">Holdings</th>
                  <th className="py-2.5 px-3 text-right">Preço Médio</th>
                  <th className="py-2.5 px-3 text-right">Lucro/Prejuízo</th>
                  <th className="py-2.5 px-3 text-right">Tendência / Sinal IA</th>
                  <th className="py-2.5 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {visibleAssets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-slate-400"
                    >
                      Nenhum ativo com saldo na carteira. Clique em{" "}
                      <button
                        onClick={() => onOpenAddTransaction()}
                        className="text-cyan-400 hover:underline font-semibold cursor-pointer"
                      >
                        + Adicionar Transação
                      </button>{" "}
                      para começar.
                    </td>
                  </tr>
                ) : (
                  visibleAssets.map((item) => {
                    const c = item.coin;
                    const signalColor =
                      c.action === "BUY"
                        ? "text-emerald-400"
                        : c.action === "SELL"
                          ? "text-rose-400"
                          : "text-amber-400";
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-800/25 transition-colors"
                      >
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-[10px] text-slate-950 shrink-0"
                              style={{ backgroundColor: c.color }}
                            >
                              {c.symbol}
                            </div>
                            <div>
                              <span className="font-semibold text-white">
                                {c.name}
                              </span>{" "}
                              <span className="font-mono text-slate-500">
                                {c.symbol}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-right text-slate-200 whitespace-nowrap">
                          ${formatPrice(c.price)}
                        </td>
                        <td
                          className={`py-3.5 px-3 font-mono text-right whitespace-nowrap ${
                            c.change1h >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {c.change1h >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(c.change1h).toFixed(2)}%
                        </td>
                        <td
                          className={`py-3.5 px-3 font-mono text-right whitespace-nowrap ${
                            c.change24h >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {c.change24h >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(c.change24h).toFixed(2)}%
                        </td>
                        <td
                          className={`py-3.5 px-3 font-mono text-right whitespace-nowrap ${
                            c.change7d >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {c.change7d >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(c.change7d).toFixed(2)}%
                        </td>
                        <td className="py-3.5 px-3 font-mono text-right whitespace-nowrap">
                          <div className="font-semibold text-white">
                            {maskVal(`$${item.holdingsUsd.toFixed(2)}`)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {maskVal(
                              `${formatQuantity(item.quantity)} ${c.symbol}`
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-right text-slate-300 whitespace-nowrap">
                          {item.avgBuyPrice > 0
                            ? maskVal(`$${formatPrice(item.avgBuyPrice)}`)
                            : "--"}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-right whitespace-nowrap">
                          {item.costBasisUsd > 0 || item.realizedPnlUsd !== 0 ? (
                            <>
                              <div
                                className={`font-semibold ${
                                  item.totalPnlUsd >= 0
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {maskVal(
                                  `${item.totalPnlUsd >= 0 ? "+" : "-"}$${Math.abs(
                                    item.totalPnlUsd
                                  ).toFixed(2)}`
                                )}
                              </div>
                              <div
                                className={`text-[11px] ${
                                  item.totalPnlPct >= 0
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {item.totalPnlPct >= 0 ? "▲" : "▼"}{" "}
                                {Math.abs(item.totalPnlPct).toFixed(2)}%
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-500">--</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className={`font-semibold ${signalColor}`}>
                            {c.action === "WAIT"
                              ? "Esperar"
                              : `${c.actionLabel} ${c.suggestedPct}%`}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            RSI {c.rsi.toFixed(1)}
                          </div>
                        </td>
                        <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => onOpenAddTransaction(c.id)}
                            className="h-8 w-8 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center transition-colors cursor-pointer"
                            title={`Adicionar transação de ${c.symbol}`}
                            aria-label={`Adicionar transação de ${c.symbol}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {sortedTransactions.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm text-slate-300 font-medium">
                  Nenhuma transação registrada ainda
                </p>
                <p className="text-xs text-slate-500">
                  Registre suas compras e vendas para calcular preço médio, lucro/prejuízo e recomendações automáticas.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">Data</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Ativo</th>
                    <th className="py-2.5 px-3 text-right">Quantidade</th>
                    <th className="py-2.5 px-3 text-right">Preço ($)</th>
                    <th className="py-2.5 px-3 text-right">Taxa ($)</th>
                    <th className="py-2.5 px-3 text-right">Total ($)</th>
                    <th className="py-2.5 px-3">Obs.</th>
                    <th className="py-2.5 pl-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {sortedTransactions.map((tx) => {
                    const coin = analyzedCoins.find((c) => c.id === tx.coinId);
                    const total =
                      tx.quantity * tx.pricePerCoin + (tx.feeUsd || 0);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-800/25 transition-colors"
                      >
                        <td className="py-3 pr-4 font-mono text-slate-400 whitespace-nowrap">
                          {tx.date.replace("T", " ")}
                        </td>
                        <td
                          className={`py-3 px-3 font-semibold whitespace-nowrap ${
                            tx.type === "BUY"
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {tx.type === "BUY" ? "Compra" : "Venda"}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                          {coin?.name ?? tx.coinId}{" "}
                          <span className="font-mono text-slate-500">
                            {coin?.symbol ?? ""}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-right text-slate-200 whitespace-nowrap">
                          {maskVal(
                            `${formatQuantity(tx.quantity)} ${coin?.symbol ?? ""}`
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-right text-slate-300 whitespace-nowrap">
                          ${formatPrice(tx.pricePerCoin)}
                        </td>
                        <td className="py-3 px-3 font-mono text-right text-slate-400 whitespace-nowrap">
                          ${(tx.feeUsd || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-mono text-right font-semibold text-white whitespace-nowrap">
                          {maskVal(`$${total.toFixed(2)}`)}
                        </td>
                        <td className="py-3 px-3 text-slate-400 max-w-[160px] truncate">
                          {tx.note || "--"}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Excluir transação"
                            aria-label="Excluir transação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
