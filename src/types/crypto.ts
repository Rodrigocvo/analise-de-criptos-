export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type SignalAction = "BUY" | "SELL" | "WAIT";
export type ActiveTab = "wallet" | "dashboard" | "brain" | "alerts" | "cloud";
export type SignalFilter = "ALL" | SignalAction;
export type TransactionType = "BUY" | "SELL";
export type ChartTimeframe = "24h" | "7d" | "30d" | "90d" | "All";

export interface CoinConfig {
  id: string;
  symbol: string;
  name: string;
  color: string;
  fallbackPrice: number;
  fallback24h: number;
  fallback7d: number;
  high24h: number;
  low24h: number;
}

export interface RawMarketCoin extends CoinConfig {
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  sparkline: number[];
  isFallback: boolean;
}

export interface AnalyzedCoin extends RawMarketCoin {
  rsi: number;
  rangePos: number;
  distFromSmaPct: number;
  score: number;
  action: SignalAction;
  actionLabel: string;
  suggestedPct: number;
  targetPrice: number;
  rationale: string;
  effectiveUsd: number;
  dollarActionAmount: number;
}

export interface PortfolioHolding {
  usd: number;
  qty: number;
}

export type UserPortfolio = Record<string, PortfolioHolding>;

export interface PortfolioTransaction {
  id: string;
  coinId: string;
  type: TransactionType;
  quantity: number;
  pricePerCoin: number;
  feeUsd: number;
  date: string; // ISO string YYYY-MM-DDTHH:mm
  note?: string;
}

export interface CoinPortfolioStat {
  coin: AnalyzedCoin;
  quantity: number;
  holdingsUsd: number;
  costBasisUsd: number;
  avgBuyPrice: number;
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
  totalPnlUsd: number;
  totalPnlPct: number;
  allocationPct: number;
}

export interface PortfolioSummaryStats {
  totalHoldingsUsd: number;
  totalCostBasisUsd: number;
  allTimeProfitUsd: number;
  allTimeProfitPct: number;
  change24hUsd: number;
  change24hPct: number;
  bestPerformer: CoinPortfolioStat | null;
  worstPerformer: CoinPortfolioStat | null;
  activeAssetsCount: number;
}

export interface UserSettings {
  whatsapp: string;
  portfolioName: string;
  profile: RiskProfile;
  soundEnabled: boolean;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;
}

export interface AlertLogEntry {
  id: string;
  time: string;
  symbol: string;
  name: string;
  action: "BUY" | "SELL";
  price: number;
  rsi: number;
  suggestedPct: number;
  dollarAmount: number;
  text: string;
}

export interface CalibrationLogEntry {
  id: string;
  time: string;
  type: "success" | "info" | "accent";
  message: string;
}

export interface BacktestMetrics {
  accuracy: string;
  simulatedReturn: string;
  avgVolatility: string;
}
