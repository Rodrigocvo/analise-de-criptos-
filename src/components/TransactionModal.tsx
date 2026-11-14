import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import type {
  AnalyzedCoin,
  PortfolioTransaction,
  TransactionType,
} from "../types/crypto";
import { formatPrice } from "../utils/quantEngine";

interface TransactionModalProps {
  isOpen: boolean;
  initialCoinId?: string;
  analyzedCoins: AnalyzedCoin[];
  onClose: () => void;
  onAddTransaction: (tx: Omit<PortfolioTransaction, "id">) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  initialCoinId,
  analyzedCoins,
  onClose,
  onAddTransaction,
}) => {
  const [type, setType] = useState<TransactionType>("BUY");
  const [coinId, setCoinId] = useState<string>(initialCoinId || "bitcoin");
  const [priceStr, setPriceStr] = useState<string>("");
  const [qtyStr, setQtyStr] = useState<string>("");
  const [totalStr, setTotalStr] = useState<string>("");
  const [feeStr, setFeeStr] = useState<string>("0");
  const [dateStr, setDateStr] = useState<string>(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string>("");

  const selectedCoin =
    analyzedCoins.find((c) => c.id === coinId) ?? analyzedCoins[0];

  useEffect(() => {
    if (!isOpen) return;
    const targetId = initialCoinId || "bitcoin";
    setCoinId(targetId);
    const found = analyzedCoins.find((c) => c.id === targetId);
    if (found) {
      setPriceStr(String(found.price));
    }
    setQtyStr("");
    setTotalStr("");
    setFeeStr("0");
    setNote("");
    setError("");
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setDateStr(local.toISOString().slice(0, 16));
  }, [isOpen, initialCoinId, analyzedCoins]);

  if (!isOpen || !selectedCoin) return null;

  const handleCoinChange = (nextId: string) => {
    setCoinId(nextId);
    const found = analyzedCoins.find((c) => c.id === nextId);
    if (found) {
      const nextPrice = found.price;
      setPriceStr(String(nextPrice));
      const qty = parseFloat(qtyStr);
      if (Number.isFinite(qty) && qty > 0) {
        setTotalStr((qty * nextPrice).toFixed(2));
      }
    }
  };

  const handlePriceChange = (val: string) => {
    setPriceStr(val);
    const p = parseFloat(val);
    const q = parseFloat(qtyStr);
    if (Number.isFinite(p) && p > 0 && Number.isFinite(q) && q > 0) {
      setTotalStr((p * q).toFixed(2));
    }
  };

  const handleQtyChange = (val: string) => {
    setQtyStr(val);
    const q = parseFloat(val);
    const p = parseFloat(priceStr);
    if (Number.isFinite(q) && q > 0 && Number.isFinite(p) && p > 0) {
      setTotalStr((q * p).toFixed(2));
    } else if (!val) {
      setTotalStr("");
    }
  };

  const handleTotalChange = (val: string) => {
    setTotalStr(val);
    const tot = parseFloat(val);
    const p = parseFloat(priceStr);
    if (Number.isFinite(tot) && tot > 0 && Number.isFinite(p) && p > 0) {
      setQtyStr((tot / p).toFixed(6).replace(/\.?0+$/, ""));
    } else if (!val) {
      setQtyStr("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseFloat(qtyStr);
    const pricePerCoin = parseFloat(priceStr);
    const feeUsd = parseFloat(feeStr) || 0;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Informe uma quantidade válida maior que zero.");
      return;
    }
    if (!Number.isFinite(pricePerCoin) || pricePerCoin <= 0) {
      setError("Informe um preço por moeda válido.");
      return;
    }

    onAddTransaction({
      coinId,
      type,
      quantity,
      pricePerCoin,
      feeUsd: Math.max(0, feeUsd),
      date: dateStr,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="bg-[#0D1322] border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <h2
            id="tx-modal-title"
            className="font-display text-base font-bold text-white"
          >
            Adicionar Transação
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buy / Sell Segmented Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setType("BUY")}
              className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                type === "BUY"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Compra
            </button>
            <button
              type="button"
              onClick={() => setType("SELL")}
              className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                type === "SELL"
                  ? "bg-rose-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Venda
            </button>
          </div>

          {/* Asset Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="txCoinSelect"
              className="block text-xs font-medium text-slate-400"
            >
              Criptomoeda
            </label>
            <select
              id="txCoinSelect"
              value={coinId}
              onChange={(e) => handleCoinChange(e.target.value)}
              className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 text-xs font-semibold text-white focus:outline-none"
            >
              {analyzedCoins.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.symbol}) — ${formatPrice(c.price)}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity + Price per Coin */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="txQtyInput"
                className="block text-xs font-medium text-slate-400"
              >
                Quantidade ({selectedCoin.symbol})
              </label>
              <input
                id="txQtyInput"
                type="number"
                step="any"
                min="0"
                value={qtyStr}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 font-mono text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="txPriceInput"
                  className="block text-xs font-medium text-slate-400"
                >
                  Preço por moeda ($)
                </label>
                <button
                  type="button"
                  onClick={() => handlePriceChange(String(selectedCoin.price))}
                  className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  Atual
                </button>
              </div>
              <input
                id="txPriceInput"
                type="number"
                step="any"
                min="0"
                value={priceStr}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 font-mono text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Total USD + Fee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="txTotalInput"
                className="block text-xs font-medium text-slate-400"
              >
                Total em USD ($)
              </label>
              <input
                id="txTotalInput"
                type="number"
                step="any"
                min="0"
                value={totalStr}
                onChange={(e) => handleTotalChange(e.target.value)}
                placeholder="Ex: 50.00"
                className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 font-mono text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="txFeeInput"
                className="block text-xs font-medium text-slate-400"
              >
                Taxa ($)
              </label>
              <input
                id="txFeeInput"
                type="number"
                step="any"
                min="0"
                value={feeStr}
                onChange={(e) => setFeeStr(e.target.value)}
                className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 font-mono text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Date + Note */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="txDateInput"
                className="block text-xs font-medium text-slate-400"
              >
                Data e Hora
              </label>
              <input
                id="txDateInput"
                type="datetime-local"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 font-mono text-[11px] text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="txNoteInput"
                className="block text-xs font-medium text-slate-400"
              >
                Observação
              </label>
              <input
                id="txNoteInput"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opcional"
                className="w-full h-10 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              Salvar Transação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
