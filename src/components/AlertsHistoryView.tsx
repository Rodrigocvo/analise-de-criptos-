import React from "react";
import { BellOff, Trash2, Zap } from "lucide-react";
import type { AlertLogEntry } from "../types/crypto";
import { formatPrice } from "../utils/quantEngine";

interface AlertsHistoryViewProps {
  alerts: AlertLogEntry[];
  onClearAlerts: () => void;
}

export const AlertsHistoryView: React.FC<AlertsHistoryViewProps> = ({
  alerts,
  onClearAlerts,
}) => {
  return (
    <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Histórico de Sinais & Alertas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registro automático das transições de sinal para compra ou realização parcial durante a sessão.
          </p>
        </div>

        {alerts.length > 0 && (
          <button
            onClick={onClearAlerts}
            className="h-9 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <BellOff className="w-7 h-7 text-slate-600 mx-auto" />
          <p className="text-sm font-medium text-slate-300">
            Nenhum alerta registrado ainda
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Quando qualquer uma das 9 criptomoedas atingir o gatilho de compra ou venda parcial, o evento será registrado automaticamente aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Horário</th>
                <th className="py-2.5 pr-4">Ativo</th>
                <th className="py-2.5 pr-4">Operação</th>
                <th className="py-2.5 pr-4 text-right">Preço</th>
                <th className="py-2.5 pr-4 text-right">RSI (14)</th>
                <th className="py-2.5 text-right">Fração / Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {alerts.map((item) => {
                const isBuy = item.action === "BUY";
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 pr-4 font-mono text-slate-400 whitespace-nowrap">
                      {item.time}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-slate-200 whitespace-nowrap">
                      {item.name}{" "}
                      <span className="font-mono text-slate-500">
                        {item.symbol}
                      </span>
                    </td>
                    <td
                      className={`py-3 pr-4 font-semibold whitespace-nowrap ${
                        isBuy ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isBuy ? "Compra Fracionada" : "Venda Parcial"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-right text-slate-200 whitespace-nowrap">
                      ${formatPrice(item.price)}
                    </td>
                    <td className="py-3 pr-4 font-mono text-right text-slate-300 whitespace-nowrap">
                      {item.rsi.toFixed(1)}
                    </td>
                    <td className="py-3 font-mono text-right font-semibold text-white whitespace-nowrap">
                      {item.suggestedPct}%
                      {item.dollarAmount > 0
                        ? ` ($${item.dollarAmount.toFixed(2)})`
                        : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
