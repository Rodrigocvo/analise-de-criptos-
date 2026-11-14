export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type SignalAction = "BUY" | "SELL" | "WAIT";
export type ActiveTab = "dashboard" | "brain" | "alerts" | "cloud";
export type SignalFilter = "ALL" | SignalAction;

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

export interface UserSettings {
  whatsapp: string;
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
