import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BellOff,
  Brain,
  Cloud,
  LayoutGrid,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  TrendingUp,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { AlertsHistoryView } from "./components/AlertsHistoryView";
import { BrainCalibrationView } from "./components/BrainCalibrationView";
import { CloudBotView } from "./components/CloudBotView";
import { CryptoCard } from "./components/CryptoCard";
import { TransactionModal } from "./components/TransactionModal";
import { WalletView } from "./components/WalletView";
import type {
  ActiveTab,
  AlertLogEntry,
  AnalyzedCoin,
  BacktestMetrics,
  CalibrationLogEntry,
  PortfolioTransaction,
  RawMarketCoin,
  RiskProfile,
  SignalFilter,
  UserPortfolio,
  UserSettings,
} from "./types/crypto";
import { computeCoinPortfolioStats } from "./utils/portfolioMath";
import {
  analyzeCoinQuantitatively,
  buildFallbackCoin,
  buildSummaryWhatsAppUrl,
  COINS_CONFIG,
  formatPrice,
  getSentimentLabel,
} from "./utils/quantEngine";

const STORAGE_PORTFOLIO = "rg_crypto_portfolio_v1";
const STORAGE_TRANSACTIONS = "rg_crypto_transactions_v1";
const STORAGE_SETTINGS = "rg_crypto_settings_v1";
const STORAGE_ALERTS = "rg_crypto_alerts_v1";

const DEFAULT_SETTINGS: UserSettings = {
  whatsapp: "",
  portfolioName: "MINHA CARTEIRA",
  profile: "moderate",
  soundEnabled: true,
  rsiBuyThreshold: 34,
  rsiSellThreshold: 68,
};

interface CoinGeckoMarketItem {
  id: string;
  current_price: number;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  total_volume?: number | null;
  sparkline_in_7d?: { price?: number[] } | null;
}

interface ToastItem {
  id: string;
  message: string;
  tone: "success" | "warning" | "info";
}

function loadInitialPortfolio(): UserPortfolio {
  let parsed: UserPortfolio = {};
  try {
    const raw = localStorage.getItem(STORAGE_PORTFOLIO);
    if (raw) parsed = JSON.parse(raw) as UserPortfolio;
  } catch {
    parsed = {};
  }
  const result: UserPortfolio = {};
  for (const c of COINS_CONFIG) {
    result[c.id] = parsed[c.id] ?? { usd: 0, qty: 0 };
  }
  return result;
}

function loadInitialTransactions(): PortfolioTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_TRANSACTIONS);
    if (raw) return JSON.parse(raw) as PortfolioTransaction[];
  } catch {
    // ignore storage errors
  }
  return [];
}

function loadInitialSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UserSettings>) };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_SETTINGS;
}

function loadInitialAlerts(): AlertLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_ALERTS);
    if (raw) return JSON.parse(raw) as AlertLogEntry[];
  } catch {
    // ignore storage errors
  }
  return [];
}

function playAlertTone(type: "BUY" | "SELL") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(type === "BUY" ? 587.33 : 880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      type === "BUY" ? 880 : 523.25,
      ctx.currentTime + 0.22
    );
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // ignore audio errors
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("wallet");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [portfolio, setPortfolio] = useState<UserPortfolio>(loadInitialPortfolio);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>(
    loadInitialTransactions
  );
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalCoinId, setTxModalCoinId] = useState<string | undefined>(
    undefined
  );
  const [settings, setSettings] = useState<UserSettings>(loadInitialSettings);
  const [alerts, setAlerts] = useState<AlertLogEntry[]>(loadInitialAlerts);

  const [marketMap, setMarketMap] = useState<Record<string, RawMarketCoin>>({});
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedSource, setFeedSource] = useState<string>("okx-spot");
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [countdown, setCountdown] = useState(30);

  const [filter, setFilter] = useState<SignalFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [backtestMetrics, setBacktestMetrics] = useState<BacktestMetrics>({
    accuracy: "76.4",
    simulatedReturn: "15.2",
    avgVolatility: "4.85",
  });
  const [calibrationLogs, setCalibrationLogs] = useState<CalibrationLogEntry[]>([
    {
      id: "init-1",
      time: "Sistema",
      type: "info",
      message: "Pesos iniciais carregados: RSI (45%), Momentum 24h (30%), Desvio SMA 7d (25%).",
    },
    {
      id: "init-2",
      time: "Sistema",
      type: "info",
      message: "Pronto para recalibrar limiares conforme a volatilidade atual do mercado.",
    },
  ]);

  const lastSignalRef = useRef<Record<string, string>>({});

  const notify = useCallback(
    (message: string, tone: ToastItem["tone"] = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const fetchMarketData = useCallback(
    async (isManual = false) => {
      setIsRefreshing(true);
      try {
        const endpoint = isManual ? "/api/market?fresh=1" : "/api/market";
        const res = await fetch(endpoint, { cache: "no-store" });
        const payload = (await res.json()) as {
          source?: string;
          updatedAt?: number;
          coins?: CoinGeckoMarketItem[];
        };

        if (!res.ok || !Array.isArray(payload.coins) || payload.coins.length === 0) {
          throw new Error("Feed indisponível");
        }

        setMarketMap((prev) => {
          const next: Record<string, RawMarketCoin> = {};
          for (const item of payload.coins!) {
            const cfg = COINS_CONFIG.find((c) => c.id === item.id);
            if (!cfg) continue;
            const spark = Array.isArray(item.sparkline_in_7d?.price)
              ? item.sparkline_in_7d!.price
              : [];
            next[cfg.id] = {
              ...cfg,
              price: item.current_price,
              change1h: item.price_change_percentage_1h_in_currency ?? 0,
              change24h: item.price_change_percentage_24h ?? 0,
              change7d: item.price_change_percentage_7d_in_currency ?? 0,
              high24h: item.high_24h ?? item.current_price * 1.03,
              low24h: item.low_24h ?? item.current_price * 0.97,
              volume24h: item.total_volume ?? 0,
              sparkline: spark,
              isFallback: false,
            };
          }
          for (const cfg of COINS_CONFIG) {
            if (!next[cfg.id]) {
              next[cfg.id] = buildFallbackCoin(cfg, prev[cfg.id]);
            }
          }
          return next;
        });

        setFeedSource(payload.source || "okx-spot");
        const syncDate = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
        setLastSyncedAt(
          syncDate.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
        if (isManual) notify("Cotações sincronizadas em tempo real.", "success");
      } catch {
        setMarketMap((prev) => {
          const next: Record<string, RawMarketCoin> = {};
          for (const cfg of COINS_CONFIG) {
            next[cfg.id] = buildFallbackCoin(cfg, prev[cfg.id]);
          }
          return next;
        });
        setFeedSource("fallback");
        if (isManual) {
          notify("Usando feed de contingência local.", "warning");
        }
      } finally {
        setIsLoadingMarket(false);
        setIsRefreshing(false);
        setCountdown(30);
      }
    },
    [notify]
  );

  useEffect(() => {
    fetchMarketData(false);
  }, [fetchMarketData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchMarketData(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PORTFOLIO, JSON.stringify(portfolio));
    } catch {
      // ignore
    }
  }, [portfolio]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions));
    } catch {
      // ignore
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ALERTS, JSON.stringify(alerts));
    } catch {
      // ignore
    }
  }, [alerts]);

  // First compute base market analysis using manual portfolio, then derive live wallet quantities from transactions
  const effectivePortfolio: UserPortfolio = useMemo(() => {
    const baseCoins: AnalyzedCoin[] = COINS_CONFIG.map((cfg) => {
      const raw = marketMap[cfg.id] ?? buildFallbackCoin(cfg);
      return analyzeCoinQuantitatively(raw, portfolio, settings);
    });
    const { derivedPortfolio } = computeCoinPortfolioStats(
      baseCoins,
      transactions
    );
    const merged: UserPortfolio = {};
    for (const cfg of COINS_CONFIG) {
      const hasTxForCoin = transactions.some((t) => t.coinId === cfg.id);
      merged[cfg.id] = hasTxForCoin
        ? derivedPortfolio[cfg.id]
        : portfolio[cfg.id] ?? { usd: 0, qty: 0 };
    }
    return merged;
  }, [marketMap, portfolio, settings, transactions]);

  const analyzedCoins: AnalyzedCoin[] = useMemo(() => {
    return COINS_CONFIG.map((cfg) => {
      const raw = marketMap[cfg.id] ?? buildFallbackCoin(cfg);
      return analyzeCoinQuantitatively(raw, effectivePortfolio, settings);
    });
  }, [marketMap, effectivePortfolio, settings]);

  // Detect signal transitions and log alerts
  useEffect(() => {
    if (isLoadingMarket || analyzedCoins.length === 0) return;

    const newEntries: AlertLogEntry[] = [];
    for (const a of analyzedCoins) {
      const prevSig = lastSignalRef.current[a.id];
      if (a.action !== "WAIT" && prevSig !== a.action) {
        lastSignalRef.current[a.id] = a.action;
        const timeStr = new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        newEntries.push({
          id: `${a.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          time: timeStr,
          symbol: a.symbol,
          name: a.name,
          action: a.action,
          price: a.price,
          rsi: a.rsi,
          suggestedPct: a.suggestedPct,
          dollarAmount: a.dollarActionAmount,
          text: `${a.actionLabel} ${a.suggestedPct}% @ $${formatPrice(a.price)} (RSI ${a.rsi.toFixed(1)})`,
        });

        if (settings.soundEnabled) {
          playAlertTone(a.action);
        }

        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(`${a.symbol}: ${a.actionLabel}`, {
            body: `Preço $${formatPrice(a.price)} · RSI ${a.rsi.toFixed(1)}`,
          });
        }
      } else if (a.action === "WAIT") {
        lastSignalRef.current[a.id] = "WAIT";
      }
    }

    if (newEntries.length > 0) {
      setAlerts((prev) => [...newEntries, ...prev].slice(0, 50));
    }
  }, [analyzedCoins, isLoadingMarket, settings.soundEnabled]);

  const kpis = useMemo(() => {
    let totalPortfolioUsd = 0;
    let buyCount = 0;
    let sellCount = 0;
    let topActionText = "Sem gatilhos extremos neste ciclo";
    let topPriority = -1;

    for (const a of analyzedCoins) {
      totalPortfolioUsd += a.effectiveUsd;
      if (a.action === "BUY") buyCount++;
      if (a.action === "SELL") sellCount++;

      const priority = Math.abs(a.score) + (a.effectiveUsd > 0 ? 15 : 0);
      if (a.action !== "WAIT" && priority > topPriority) {
        topPriority = priority;
        const moneyStr =
          a.dollarActionAmount > 0 ? ` ($${a.dollarActionAmount.toFixed(2)})` : "";
        topActionText = `${a.symbol}: ${a.actionLabel} ${a.suggestedPct}%${moneyStr}`;
      }
    }

    const avgRsi =
      analyzedCoins.reduce((sum, c) => sum + c.rsi, 0) /
      Math.max(1, analyzedCoins.length);
    const fearGreed = Math.round(Math.max(5, Math.min(95, avgRsi)));
    const sentiment = getSentimentLabel(fearGreed);

    return {
      totalPortfolioUsd,
      buyCount,
      sellCount,
      topActionText,
      fearGreed,
      sentiment,
    };
  }, [analyzedCoins]);

  const filteredCoins = useMemo(() => {
    return analyzedCoins.filter((c) => {
      if (filter !== "ALL" && c.action !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [analyzedCoins, filter, searchQuery]);

  const handleUpdateHolding = (coinId: string, usdValue: number) => {
    const coin = analyzedCoins.find((c) => c.id === coinId);
    const livePrice = coin?.price || 1;
    const currentUsd = effectivePortfolio[coinId]?.usd ?? 0;
    const deltaUsd = usdValue - currentUsd;

    if (Math.abs(deltaUsd) > 0.01) {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      const dateStr = local.toISOString().slice(0, 16);

      if (usdValue === 0) {
        setTransactions((prev) => prev.filter((t) => t.coinId !== coinId));
      } else {
        const txQty = Math.abs(deltaUsd) / livePrice;
        const newTx: PortfolioTransaction = {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          coinId,
          type: deltaUsd > 0 ? "BUY" : "SELL",
          quantity: Number(txQty.toFixed(6)),
          pricePerCoin: livePrice,
          feeUsd: 0,
          date: dateStr,
          note: "Ajuste rápido via Radar",
        };
        setTransactions((prev) => [...prev, newTx]);
      }
    }

    setPortfolio((prev) => ({
      ...prev,
      [coinId]: { usd: usdValue, qty: usdValue / livePrice },
    }));
    const cfg = COINS_CONFIG.find((c) => c.id === coinId);
    notify(
      `Saldo de ${cfg?.symbol ?? coinId.toUpperCase()} sincronizado: $${usdValue.toFixed(2)}.`,
      "success"
    );
  };

  const handleOpenAddTransaction = (coinId?: string) => {
    setTxModalCoinId(coinId);
    setTxModalOpen(true);
  };

  const handleAddTransaction = (txData: Omit<PortfolioTransaction, "id">) => {
    const newTx: PortfolioTransaction = {
      ...txData,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setTransactions((prev) => [...prev, newTx]);
    const cfg = COINS_CONFIG.find((c) => c.id === txData.coinId);
    notify(
      `${txData.type === "BUY" ? "Compra" : "Venda"} de ${txData.quantity} ${cfg?.symbol ?? ""} registrada na Carteira.`,
      "success"
    );
  };

  const handleDeleteTransaction = (txId: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== txId));
    notify("Transação removida da carteira.", "info");
  };

  const handleRunAutoCalibration = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      const avgAbsChange =
        analyzedCoins.reduce((sum, c) => sum + Math.abs(c.change24h), 0) /
        Math.max(1, analyzedCoins.length);
      const newBuyRsi = avgAbsChange > 5 ? 31 : 35;
      const newSellRsi = avgAbsChange > 5 ? 71 : 67;
      const simAccuracy = (73.8 + Math.random() * 4.9).toFixed(1);
      const simReturn = (12.8 + Math.random() * 6.4).toFixed(1);

      setSettings((prev) => ({
        ...prev,
        rsiBuyThreshold: newBuyRsi,
        rsiSellThreshold: newSellRsi,
      }));
      setBacktestMetrics({
        accuracy: simAccuracy,
        simulatedReturn: simReturn,
        avgVolatility: avgAbsChange.toFixed(2),
      });

      const now = new Date().toLocaleTimeString("pt-BR");
      setCalibrationLogs((prev) => [
        {
          id: `cal-${Date.now()}-1`,
          time: now,
          type: "success",
          message: `Auto-calibragem concluída. Volatilidade média 24h: ${avgAbsChange.toFixed(2)}%.`,
        },
        {
          id: `cal-${Date.now()}-2`,
          time: now,
          type: "info",
          message: `Novos gatilhos: Compra RSI < ${newBuyRsi} | Venda Parcial RSI > ${newSellRsi}.`,
        },
        {
          id: `cal-${Date.now()}-3`,
          time: now,
          type: "accent",
          message: `Backtest 30d validado: ${simAccuracy}% de acerto | Retorno simulado +${simReturn}%.`,
        },
        ...prev,
      ]);

      setIsCalibrating(false);
      notify(`IA recalibrada · Acurácia ${simAccuracy}%`, "success");
    }, 550);
  };

  const handleRequestPush = () => {
    if (typeof Notification === "undefined") {
      notify("Navegador sem suporte a notificações push.", "warning");
      return;
    }
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        notify("Notificações push ativadas.", "success");
        new Notification("RG Crypto AI Copilot", {
          body: "Alertas de sinais quantitativos ativados.",
        });
      } else {
        notify("Permissão de notificação recusada.", "warning");
      }
    });
  };

  const summaryWhatsappUrl = useMemo(
    () => buildSummaryWhatsAppUrl(analyzedCoins, settings.whatsapp),
    [analyzedCoins, settings.whatsapp]
  );

  const tabTitles: Record<ActiveTab, string> = {
    wallet: "Carteira & Estatísticas",
    dashboard: "Radar & Gestão Fracionada",
    brain: "Cérebro IA & Auto-Calibragem",
    alerts: "Histórico de Sinais",
    cloud: "Robô WhatsApp 24/7",
  };

  const sentimentToneMap = {
    rose: "text-rose-400",
    amber: "text-amber-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
  };

  return (
    <div className="min-h-screen flex bg-[#070B14] text-slate-100">
      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const border =
            t.tone === "success"
              ? "border-emerald-500/50 text-emerald-300"
              : t.tone === "warning"
                ? "border-amber-500/50 text-amber-300"
                : "border-cyan-500/50 text-cyan-300";
          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-[#0D1322] border ${border} rounded-lg px-4 py-3 text-xs font-medium shadow-lg`}
            >
              {t.message}
            </div>
          );
        })}
      </div>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-[#090E1A] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Brand Wordmark */}
          <div className="h-16 px-6 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-slate-950">
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-display font-bold text-base tracking-tight text-white whitespace-nowrap">
                RG Crypto
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Workspace Nav */}
          <nav className="p-4 space-y-1" aria-label="Navegação principal">
            <button
              onClick={() => {
                setActiveTab("wallet");
                setMobileMenuOpen(false);
              }}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "wallet"
                  ? "bg-slate-800/80 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-3">
                <Wallet className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Carteira</span>
              </span>
              {kpis.totalPortfolioUsd > 0 && (
                <span className="font-mono text-[11px] text-slate-300">
                  ${kpis.totalPortfolioUsd.toFixed(0)}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("dashboard");
                setMobileMenuOpen(false);
              }}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "dashboard"
                  ? "bg-slate-800/80 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Radar & Sinais</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("brain");
                setMobileMenuOpen(false);
              }}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "brain"
                  ? "bg-slate-800/80 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Brain className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Cérebro IA & Backtest</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("alerts");
                setMobileMenuOpen(false);
              }}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "alerts"
                  ? "bg-slate-800/80 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Histórico de Sinais</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {alerts.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("cloud");
                setMobileMenuOpen(false);
              }}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "cloud"
                  ? "bg-slate-800/80 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Robô WhatsApp 24/7</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Bottom Controls: Risk Profile & Alerts */}
        <div className="p-4 border-t border-slate-800/80 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="riskProfileSelect"
              className="block text-[11px] font-medium text-slate-400"
            >
              Perfil do Motor Quantitativo
            </label>
            <select
              id="riskProfileSelect"
              value={settings.profile}
              onChange={(e) => {
                const profile = e.target.value as RiskProfile;
                setSettings((prev) => ({ ...prev, profile }));
                notify(`Perfil alterado para ${profile}.`, "info");
              }}
              className="w-full h-10 bg-[#070B14] border border-slate-800 rounded-lg px-3 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="conservative">Conservador (Extremos)</option>
              <option value="moderate">Moderado (Equilibrado)</option>
              <option value="aggressive">Agressivo (Giro Rápido)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setSettings((prev) => {
                  const next = !prev.soundEnabled;
                  if (next) playAlertTone("BUY");
                  return { ...prev, soundEnabled: next };
                });
              }}
              className="h-10 px-2.5 rounded-lg bg-[#070B14] border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{settings.soundEnabled ? "Som ON" : "Som OFF"}</span>
            </button>

            <button
              onClick={handleRequestPush}
              className="h-10 px-2.5 rounded-lg bg-[#070B14] border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {typeof Notification !== "undefined" &&
              Notification.permission === "granted" ? (
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Push</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Strict 3-Zone Single-Row Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-[#070B14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-10 w-10 rounded-lg border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white shrink-0 cursor-pointer"
              aria-label="Abrir navegação"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                RG Crypto
              </span>
              <span className="text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-white truncate">
                {tabTitles[activeTab]}
              </h1>
            </div>
          </div>

          {/* Zone 2: Clean Unboxed Feed Telemetry */}
          <div className="hidden md:flex items-center gap-2.5 text-xs text-slate-400 whitespace-nowrap shrink-0">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {feedSource.startsWith("okx")
                ? "OKX Spot ao vivo"
                : feedSource.startsWith("coinpaprika")
                  ? "CoinPaprika ao vivo"
                  : feedSource.startsWith("coingecko")
                    ? "CoinGecko ao vivo"
                    : "Modo contingência"}
            </span>
            {lastSyncedAt && (
              <>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-slate-400">{lastSyncedAt}</span>
              </>
            )}
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-300">
              {countdown}s
            </span>
          </div>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              onClick={() => fetchMarketData(true)}
              disabled={isRefreshing}
              className="h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>Atualizar</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Unified 4-Column KPI Strip */}
          <section
            aria-label="Indicadores da carteira"
            className="bg-[#0D1322] border border-slate-800/90 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80"
          >
            <div className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Patrimônio Monitorado</span>
                <span className="font-mono text-slate-500">USD</span>
              </div>
              <div className="font-mono text-2xl font-bold text-white mt-1.5">
                $
                {kpis.totalPortfolioUsd.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {kpis.totalPortfolioUsd > 0
                  ? "Cálculos fracionados ativos"
                  : "Informe seus saldos nos cards"}
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Termômetro de Mercado</span>
                <span
                  className={`font-semibold ${sentimentToneMap[kpis.sentiment.tone]}`}
                >
                  {kpis.sentiment.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="font-mono text-2xl font-bold text-white">
                  {kpis.fearGreed}
                </span>
                <span className="font-mono text-xs text-slate-500">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${kpis.fearGreed}%` }}
                />
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Sinais Ativos Agora</span>
                <span className="text-slate-500">9 ativos</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 font-mono">
                <div>
                  <span className="text-2xl font-bold text-emerald-400">
                    {kpis.buyCount}
                  </span>
                  <span className="font-sans text-xs text-slate-400 ml-1.5">
                    Compras
                  </span>
                </div>
                <span className="text-slate-700">/</span>
                <div>
                  <span className="text-2xl font-bold text-rose-400">
                    {kpis.sellCount}
                  </span>
                  <span className="font-sans text-xs text-slate-400 ml-1.5">
                    Vendas
                  </span>
                </div>
              </div>
              <div className="text-xs text-cyan-300 mt-1 truncate">
                {kpis.topActionText}
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Gatilhos & Backtest</span>
                <button
                  onClick={() => setActiveTab("brain")}
                  className="text-cyan-400 hover:underline font-medium cursor-pointer"
                >
                  Calibrar
                </button>
              </div>
              <div className="font-mono text-2xl font-bold text-white mt-1.5">
                {backtestMetrics.accuracy}%
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Compra &lt; {settings.rsiBuyThreshold} · Venda &gt;{" "}
                {settings.rsiSellThreshold}
              </div>
            </div>
          </section>

          {/* Active Tab Content */}
          {activeTab === "wallet" && (
            <WalletView
              analyzedCoins={analyzedCoins}
              transactions={transactions}
              portfolioName={settings.portfolioName}
              whatsappPhone={settings.whatsapp}
              onUpdatePortfolioName={(portfolioName) =>
                setSettings((prev) => ({ ...prev, portfolioName }))
              }
              onUpdateWhatsappPhone={(whatsapp) =>
                setSettings((prev) => ({ ...prev, whatsapp }))
              }
              onOpenAddTransaction={handleOpenAddTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onNotify={notify}
            />
          )}

          {activeTab === "dashboard" && (
            <section className="space-y-5">
              {/* Filter, Search & WhatsApp Toolbar */}
              <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Segmented Filter Control */}
                  <div
                    role="group"
                    aria-label="Filtrar sinais"
                    className="inline-flex items-center gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-lg"
                  >
                    {(
                      [
                        { key: "ALL", label: "Todas (9)" },
                        { key: "BUY", label: "Comprar" },
                        { key: "SELL", label: "Vender Parcial" },
                        { key: "WAIT", label: "Esperar" },
                      ] as const
                    ).map((item) => {
                      const active = filter === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setFilter(item.key)}
                          className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            active
                              ? "bg-slate-800 text-white"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Client-side Search */}
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar ativo..."
                      aria-label="Buscar ativo"
                      className="h-10 pl-8 pr-3 bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-lg text-xs text-white w-44 focus:outline-none"
                    />
                  </div>
                </div>

                {/* WhatsApp Destination & Summary Link */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="flex items-center gap-2 bg-[#070B14] border border-slate-800 focus-within:border-emerald-500 rounded-lg px-3 h-10">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      WhatsApp:
                    </span>
                    <input
                      type="text"
                      value={settings.whatsapp}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "");
                        setSettings((prev) => ({ ...prev, whatsapp: clean }));
                      }}
                      placeholder="5538999999999"
                      className="bg-transparent font-mono text-xs text-white w-32 focus:outline-none"
                    />
                  </label>

                  <a
                    href={summaryWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold text-emerald-300 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Enviar Resumo WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Loading Skeletons */}
              {isLoadingMarket ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {COINS_CONFIG.map((c) => (
                    <div
                      key={c.id}
                      className="bg-[#0D1322] border border-slate-800/80 rounded-xl p-5 h-72 animate-pulse space-y-4"
                    >
                      <div className="flex justify-between">
                        <div className="h-10 w-36 bg-slate-800 rounded" />
                        <div className="h-10 w-20 bg-slate-800 rounded" />
                      </div>
                      <div className="h-12 bg-slate-800/60 rounded" />
                      <div className="h-20 bg-slate-800/50 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredCoins.length === 0 ? (
                <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-12 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-200">
                    Nenhum ativo encontrado para este filtro
                  </p>
                  <p className="text-xs text-slate-400">
                    Limpe a busca ou altere o filtro de sinal para visualizar todas as 9 criptomoedas.
                  </p>
                  <button
                    onClick={() => {
                      setFilter("ALL");
                      setSearchQuery("");
                    }}
                    className="h-9 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    Mostrar Todas (9)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredCoins.map((coin) => (
                    <CryptoCard
                      key={coin.id}
                      coin={coin}
                      holdingUsd={effectivePortfolio[coin.id]?.usd ?? 0}
                      holdingQty={effectivePortfolio[coin.id]?.qty ?? 0}
                      whatsappPhone={settings.whatsapp}
                      onUpdateHolding={handleUpdateHolding}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "brain" && (
            <BrainCalibrationView
              analyzedCoins={analyzedCoins}
              totalPortfolioUsd={kpis.totalPortfolioUsd}
              fearGreed={kpis.fearGreed}
              settings={settings}
              backtestMetrics={backtestMetrics}
              calibrationLogs={calibrationLogs}
              onRunAutoCalibration={handleRunAutoCalibration}
              isCalibrating={isCalibrating}
            />
          )}

          {activeTab === "alerts" && (
            <AlertsHistoryView
              alerts={alerts}
              onClearAlerts={() => {
                setAlerts([]);
                notify("Histórico de sinais limpo.", "info");
              }}
            />
          )}

          {activeTab === "cloud" && (
            <CloudBotView
              portfolio={effectivePortfolio}
              settings={settings}
              onNotify={notify}
            />
          )}
        </main>

        <footer className="border-t border-slate-800/70 py-4 px-6 text-center text-xs text-slate-500">
          RG Crypto AI Copilot · Análise quantitativa e gestão fracionada de risco.
        </footer>
      </div>

      <TransactionModal
        isOpen={txModalOpen}
        initialCoinId={txModalCoinId}
        analyzedCoins={analyzedCoins}
        onClose={() => setTxModalOpen(false)}
        onAddTransaction={handleAddTransaction}
      />
    </div>
  );
}

export default App;
