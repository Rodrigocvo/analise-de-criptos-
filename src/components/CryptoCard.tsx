import React, { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, MessageSquare, Minus } from "lucide-react";
import type { AnalyzedCoin } from "../types/crypto";
import { buildSingleCoinWhatsAppUrl, formatPrice } from "../utils/quantEngine";
import { Sparkline } from "./Sparkline";

interface CryptoCardProps {
  coin: AnalyzedCoin;
  holdingUsd: number;
  holdingQty?: number;
  whatsappPhone: string;
  onUpdateHolding: (coinId: string, usdValue: number) => void;
}

export const CryptoCard: React.FC<CryptoCardProps> = ({
  coin,
  holdingUsd,
  holdingQty = 0,
  whatsappPhone,
  onUpdateHolding,
}) => {
  const [inputValue, setInputValue] = useState<string>(
    holdingUsd > 0 ? holdingUsd.toFixed(2) : ""
  );

  useEffect(() => {
    setInputValue(holdingUsd > 0 ? holdingUsd.toFixed(2) : "");
  }, [holdingUsd]);

  const handleCommit = () => {
    const parsed = parseFloat(inputValue);
    const sanitized = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (Math.abs(sanitized - holdingUsd) > 0.01) {
      onUpdateHolding(coin.id, sanitized);
    }
  };

  const isBuy = coin.action === "BUY";
  const isSell = coin.action === "SELL";

  const borderTone = isBuy
    ? "border-emerald-500/35 hover:border-emerald-500/60"
    : isSell
      ? "border-rose-500/35 hover:border-rose-500/60"
      : "border-slate-800/90 hover:border-slate-700";

  const signalTextClass = isBuy
    ? "text-emerald-400"
    : isSell
      ? "text-rose-400"
      : "text-amber-400";

  const whatsappHref = buildSingleCoinWhatsAppUrl(coin, whatsappPhone);

  return (
    <article
      className={`bg-[#0D1322] border ${borderTone} rounded-xl p-5 flex flex-col justify-between transition-colors duration-150`}
    >
      <div>
        {/* Header: Identity + Tabular Price */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-xs text-slate-950 shrink-0"
              style={{ backgroundColor: coin.color }}
            >
              {coin.symbol}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm">
                <h3 className="font-display font-bold text-slate-100 truncate">
                  {coin.name}
                </h3>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {coin.symbol}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs">
                <span className={`font-semibold tracking-tight ${signalTextClass}`}>
                  {coin.action === "WAIT"
                    ? "Esperar"
                    : `${coin.actionLabel} ${coin.suggestedPct}%`}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-slate-400">
                  RSI {coin.rsi.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono font-bold text-base text-white">
              ${formatPrice(coin.price)}
            </div>
            <div
              className={`inline-flex items-center justify-end gap-0.5 font-mono text-xs font-semibold mt-0.5 ${
                coin.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {coin.change24h > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : coin.change24h < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>
                {coin.change24h >= 0 ? "+" : ""}
                {coin.change24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Technical Metrics + 7d Sparkline */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Variação 7d</span>
              <span
                className={`font-mono font-semibold ${
                  coin.change7d >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {coin.change7d >= 0 ? "+" : ""}
                {coin.change7d.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Desvio SMA</span>
              <span className="font-mono font-medium text-slate-300">
                {coin.distFromSmaPct >= 0 ? "+" : ""}
                {coin.distFromSmaPct.toFixed(2)}%
              </span>
            </div>
          </div>

          <Sparkline
            prices={coin.sparkline}
            isPositive={coin.change7d >= 0}
            id={coin.id}
          />
        </div>

        {/* Fractional Recommendation (hairline-separated, no nested box) */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-1.5">
          {coin.action === "SELL" && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-rose-300">
                  {coin.effectiveUsd > 0
                    ? `Vender ${coin.suggestedPct}% da posição`
                    : `Realizar ${coin.suggestedPct}% do lucro`}
                </span>
                {coin.effectiveUsd > 0 && (
                  <span className="font-mono font-bold text-rose-200">
                    ${coin.dollarActionAmount.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Alvo de recompra</span>
                <span className="font-mono font-semibold text-emerald-400">
                  ${formatPrice(coin.targetPrice)}
                </span>
              </div>
            </>
          )}

          {coin.action === "BUY" && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-emerald-300">
                  {coin.effectiveUsd > 0
                    ? `Aportar +${coin.suggestedPct}% na posição`
                    : `Entrada fracionada de ${coin.suggestedPct}%`}
                </span>
                {coin.effectiveUsd > 0 && (
                  <span className="font-mono font-bold text-emerald-200">
                    +${coin.dollarActionAmount.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Alvo técnico</span>
                <span className="font-mono font-semibold text-cyan-300">
                  ${formatPrice(coin.targetPrice)}
                </span>
              </div>
            </>
          )}

          {coin.action === "WAIT" && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-amber-300">
                  Manter posição atual (0% de giro)
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Zona próxima de compra</span>
                <span className="font-mono text-slate-200">
                  ${formatPrice(coin.targetPrice)}
                </span>
              </div>
            </>
          )}

          <p className="text-xs text-slate-400 leading-relaxed pt-1">
            {coin.rationale}
          </p>
        </div>
      </div>

      {/* Footer: Holding Input + Direct WhatsApp Link */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
        {holdingQty > 0 && (
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Sincronizado da Carteira</span>
            <span className="text-slate-200">
              {holdingQty >= 1
                ? holdingQty.toFixed(4).replace(/\.?0+$/, "")
                : holdingQty.toFixed(6).replace(/\.?0+$/, "")}{" "}
              {coin.symbol}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 bg-[#070B14] border border-slate-800 focus-within:border-emerald-500 rounded-lg px-3 h-10 flex-1 min-w-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">
              Saldo $
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCommit();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="0.00"
              aria-label={`Saldo em USD para ${coin.name}`}
              className="bg-transparent font-mono text-xs font-semibold text-white w-full focus:outline-none"
            />
          </label>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-3.5 rounded-lg bg-slate-800/80 hover:bg-emerald-500/15 border border-slate-700/80 hover:border-emerald-500/40 text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title={`Enviar sinal de ${coin.symbol} para o WhatsApp`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
    </article>
  );
};
