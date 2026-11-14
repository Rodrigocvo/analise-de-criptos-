import React, { useState } from "react";
import { Brain, RefreshCw, Sparkles } from "lucide-react";
import type {
  AnalyzedCoin,
  BacktestMetrics,
  CalibrationLogEntry,
  UserSettings,
} from "../types/crypto";
import {
  formatPrice,
  generateLocalHeuristicReport,
  getProfileLabel,
} from "../utils/quantEngine";

interface BrainCalibrationViewProps {
  analyzedCoins: AnalyzedCoin[];
  totalPortfolioUsd: number;
  fearGreed: number;
  settings: UserSettings;
  backtestMetrics: BacktestMetrics;
  calibrationLogs: CalibrationLogEntry[];
  onRunAutoCalibration: () => void;
  isCalibrating: boolean;
}

export const BrainCalibrationView: React.FC<BrainCalibrationViewProps> = ({
  analyzedCoins,
  totalPortfolioUsd,
  fearGreed,
  settings,
  backtestMetrics,
  calibrationLogs,
  onRunAutoCalibration,
  isCalibrating,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReportText, setAiReportText] = useState<string | null>(null);
  const [reportSource, setReportSource] = useState<"gemini" | "local" | null>(
    null
  );
  const [localSnapshot, setLocalSnapshot] = useState<ReturnType<
    typeof generateLocalHeuristicReport
  > | null>(null);

  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiReportText(null);
    setLocalSnapshot(null);

    const summaryLines = analyzedCoins
      .map(
        (a) =>
          `- ${a.name} (${a.symbol}): Preço $${formatPrice(a.price)}, 24h ${a.change24h.toFixed(2)}%, RSI ${a.rsi.toFixed(1)}, Sinal: ${a.actionLabel} (${a.suggestedPct}%), Saldo usuário: $${a.effectiveUsd.toFixed(2)} (Ação sugerida: $${a.dollarActionAmount.toFixed(2)})`
      )
      .join("\n");

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryLines,
          profile: settings.profile,
          totalUsd: totalPortfolioUsd,
          fearGreed,
        }),
      });

      const data = (await res.json()) as {
        source?: string;
        analysis?: string;
        fallback?: boolean;
      };

      if (res.ok && data.analysis) {
        setAiReportText(data.analysis);
        setReportSource("gemini");
        setIsAnalyzing(false);
        return;
      }
    } catch {
      // Fallback to local quantitative heuristic engine
    }

    setLocalSnapshot(
      generateLocalHeuristicReport(analyzedCoins, settings.profile)
    );
    setReportSource("local");
    setIsAnalyzing(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Strategic AI Copilot Panel */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>Copiloto Cognitivo & Parecer da Carteira</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Cruza RSI, desvio da média de 7 dias e seus saldos para gerar um plano de execução fracionado.
            </p>
          </div>

          <button
            onClick={handleRunAIAnalysis}
            disabled={isAnalyzing}
            className="h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isAnalyzing ? "Analisando..." : "Analisar Carteira"}
            </span>
          </button>
        </div>

        <div className="min-h-[260px] text-sm text-slate-300 leading-relaxed">
          {!reportSource && !isAnalyzing && (
            <p className="text-slate-400 text-sm">
              Clique em <strong className="text-slate-200">Analisar Carteira</strong> para gerar o diagnóstico estratégico completo com recomendações fracionadas de compra, realização parcial e manutenção.
            </p>
          )}

          {isAnalyzing && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-5/6" />
              <div className="h-3 bg-slate-800 rounded w-4/6" />
            </div>
          )}

          {reportSource === "gemini" && aiReportText && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-cyan-400">
                Parecer Estratégico · Gemini AI ({getProfileLabel(settings.profile)})
              </div>
              <div className="whitespace-pre-line text-sm text-slate-200 leading-relaxed">
                {aiReportText}
              </div>
            </div>
          )}

          {reportSource === "local" && localSnapshot && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-emerald-400">
                Diagnóstico Quantitativo · Perfil {localSnapshot.profileLabel}
              </div>

              {localSnapshot.sells.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <h3 className="text-xs font-bold text-rose-400">
                    Realização Parcial de Lucro (Vender para recomprar abaixo)
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {localSnapshot.sells.map((s) => (
                      <li key={s.id} className="leading-relaxed">
                        <strong className="text-white">
                          {s.name} ({s.symbol})
                        </strong>{" "}
                        variação{" "}
                        <span className="font-mono text-rose-300">
                          +{s.change24h.toFixed(2)}%
                        </span>{" "}
                        (RSI{" "}
                        <span className="font-mono">{s.rsi.toFixed(1)}</span>).
                        Realizar{" "}
                        <span className="font-mono font-semibold text-white">
                          {s.suggestedPct}%
                        </span>
                        {s.dollarActionAmount > 0 && (
                          <>
                            {" "}
                            (
                            <span className="font-mono text-rose-300">
                              ${s.dollarActionAmount.toFixed(2)}
                            </span>
                            )
                          </>
                        )}{" "}
                        com alvo de recompra em{" "}
                        <span className="font-mono text-emerald-400">
                          ${formatPrice(s.targetPrice)}
                        </span>
                        .
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {localSnapshot.buys.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <h3 className="text-xs font-bold text-emerald-400">
                    Zona de Acumulação Fracionada (Oportunidade de Compra)
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {localSnapshot.buys.map((b) => (
                      <li key={b.id} className="leading-relaxed">
                        <strong className="text-white">
                          {b.name} ({b.symbol})
                        </strong>{" "}
                        desconto de{" "}
                        <span className="font-mono text-emerald-300">
                          {b.change24h.toFixed(2)}%
                        </span>{" "}
                        (RSI{" "}
                        <span className="font-mono">{b.rsi.toFixed(1)}</span>).
                        Aporte fracionado de{" "}
                        <span className="font-mono font-semibold text-white">
                          {b.suggestedPct}%
                        </span>
                        {b.dollarActionAmount > 0 && (
                          <>
                            {" "}
                            (
                            <span className="font-mono text-emerald-300">
                              +${b.dollarActionAmount.toFixed(2)}
                            </span>
                            )
                          </>
                        )}{" "}
                        mirando{" "}
                        <span className="font-mono text-cyan-300">
                          ${formatPrice(b.targetPrice)}
                        </span>
                        .
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                <strong className="text-amber-300">
                  Em Consolidação ({localSnapshot.waits.length} ativos):
                </strong>{" "}
                {localSnapshot.waits.length > 0
                  ? `${localSnapshot.waits.map((w) => w.symbol).join(", ")} operam dentro da banda neutra de volatilidade. Evite giro desnecessário.`
                  : "Todos os ativos apresentam assimetria ativa no ciclo atual."}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Auto-Calibration & 30d Backtest */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Auto-Calibragem & Backtest (30 Dias)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ajusta os limiares de RSI conforme a volatilidade média atual dos 9 ativos.
            </p>
          </div>

          <button
            onClick={onRunAutoCalibration}
            disabled={isCalibrating}
            className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-400 ${
                isCalibrating ? "animate-spin" : ""
              }`}
            />
            <span>
              {isCalibrating ? "Calibrando..." : "Executar Auto-Calibragem"}
            </span>
          </button>
        </div>

        {/* 3 Flat Metric Columns separated by hairline dividers */}
        <div className="grid grid-cols-3 divide-x divide-slate-800/80 border-b border-slate-800/80 pb-5">
          <div className="pr-4">
            <div className="text-xs text-slate-400">Gatilho Compra</div>
            <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
              RSI &lt; {settings.rsiBuyThreshold}
            </div>
          </div>
          <div className="px-4">
            <div className="text-xs text-slate-400">Gatilho Venda</div>
            <div className="font-mono text-lg font-bold text-rose-400 mt-1">
              RSI &gt; {settings.rsiSellThreshold}
            </div>
          </div>
          <div className="pl-4">
            <div className="text-xs text-slate-400">Retorno Simulado 30d</div>
            <div className="font-mono text-lg font-bold text-cyan-400 mt-1">
              +{backtestMetrics.simulatedReturn}%
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Registro de Otimização
            </span>
            <span className="font-mono text-slate-400">
              Acurácia {backtestMetrics.accuracy}% · Volatilidade{" "}
              {backtestMetrics.avgVolatility}%
            </span>
          </div>

          <div className="font-mono text-xs text-slate-400 space-y-2 max-h-56 overflow-y-auto pr-1">
            {calibrationLogs.map((log) => {
              const colorClass =
                log.type === "success"
                  ? "text-emerald-400"
                  : log.type === "accent"
                    ? "text-cyan-400"
                    : "text-slate-400";
              return (
                <div
                  key={log.id}
                  className={`leading-relaxed ${colorClass}`}
                >
                  <span className="text-slate-600 mr-2">{log.time}</span>
                  <span>{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
