import type {
  AnalyzedCoin,
  CoinConfig,
  RawMarketCoin,
  RiskProfile,
  UserPortfolio,
  UserSettings,
} from "../types/crypto";

export const COINS_CONFIG: CoinConfig[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    color: "#F7931A",
    fallbackPrice: 64150.0,
    fallback24h: -6.15,
    fallback7d: -15.1,
    high24h: 68500,
    low24h: 63300,
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    color: "#627EEA",
    fallbackPrice: 1765.0,
    fallback24h: -8.45,
    fallback7d: -20.8,
    high24h: 1936,
    low24h: 1728,
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    color: "#14F195",
    fallbackPrice: 69.8,
    fallback24h: -11.15,
    fallback7d: -21.7,
    high24h: 78.7,
    low24h: 68.5,
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    color: "#F3BA2F",
    fallbackPrice: 578.0,
    fallback24h: -8.35,
    fallback7d: -16.7,
    high24h: 632.4,
    low24h: 568.7,
  },
  {
    id: "ripple",
    symbol: "XRP",
    name: "XRP",
    color: "#38BDF8",
    fallbackPrice: 0.908,
    fallback24h: -10.2,
    fallback7d: -21.4,
    high24h: 1.014,
    low24h: 0.893,
  },
  {
    id: "polygon-ecosystem-token",
    symbol: "POL",
    name: "Polygon",
    color: "#8247E5",
    fallbackPrice: 0.078,
    fallback24h: -8.1,
    fallback7d: -13.8,
    high24h: 0.085,
    low24h: 0.076,
  },
  {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    color: "#C2A633",
    fallbackPrice: 0.0565,
    fallback24h: -12.3,
    fallback7d: -20.5,
    high24h: 0.0648,
    low24h: 0.0554,
  },
  {
    id: "tron",
    symbol: "TRX",
    name: "TRON",
    color: "#FF060A",
    fallbackPrice: 0.3064,
    fallback24h: -1.85,
    fallback7d: -4.1,
    high24h: 0.314,
    low24h: 0.306,
  },
  {
    id: "litecoin",
    symbol: "LTC",
    name: "Litecoin",
    color: "#345D9D",
    fallbackPrice: 44.2,
    fallback24h: -10.1,
    fallback7d: -14.9,
    high24h: 49.6,
    low24h: 43.4,
  },
];

export function formatPrice(val: number): string {
  if (val >= 1000) {
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (val >= 1) {
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  }
  if (val >= 0.1) {
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
}

export function buildFallbackCoin(
  cfg: CoinConfig,
  prev?: RawMarketCoin
): RawMarketCoin {
  const jitter = prev ? 1 + (Math.random() - 0.5) * 0.004 : 1;
  const basePrice = prev ? prev.price * jitter : cfg.fallbackPrice;

  const spark: number[] = [];
  let p = basePrice / (1 + cfg.fallback7d / 100);
  for (let i = 0; i < 42; i++) {
    p = p * (1 + cfg.fallback7d / 100 / 42 + (Math.random() - 0.5) * 0.012);
    spark.push(p);
  }
  spark[spark.length - 1] = basePrice;

  return {
    ...cfg,
    price: basePrice,
    change1h: cfg.fallback24h / 12 + (Math.random() - 0.5) * 0.4,
    change24h: cfg.fallback24h + (Math.random() - 0.5) * 0.3,
    change7d: cfg.fallback7d,
    high24h: Math.max(cfg.high24h, basePrice),
    low24h: Math.min(cfg.low24h, basePrice),
    volume24h: 1_250_000_000,
    sparkline: spark,
    isFallback: true,
  };
}

export function calculateRSI(prices: number[], period = 14): number | null {
  if (!prices || prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  const slice = prices.slice(-(period + 1));
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function analyzeCoinQuantitatively(
  coin: RawMarketCoin,
  portfolio: UserPortfolio,
  settings: UserSettings
): AnalyzedCoin {
  let rsi = calculateRSI(coin.sparkline, 14);
  if (rsi === null || Number.isNaN(rsi)) {
    rsi = 50 + coin.change24h * 2.1 + coin.change7d * 0.65;
    rsi = Math.max(12, Math.min(89, rsi));
  }

  const range = coin.high24h - coin.low24h;
  const rangePos = range > 0 ? ((coin.price - coin.low24h) / range) * 100 : 50;

  const sma =
    coin.sparkline && coin.sparkline.length > 0
      ? coin.sparkline.reduce((a, b) => a + b, 0) / coin.sparkline.length
      : coin.price;
  const distFromSmaPct = sma > 0 ? ((coin.price - sma) / sma) * 100 : 0;

  let buyRsi = settings.rsiBuyThreshold;
  let sellRsi = settings.rsiSellThreshold;
  let dropTrigger = -4.5;
  let pumpTrigger = 4.2;

  if (settings.profile === "conservative") {
    buyRsi -= 5;
    sellRsi += 5;
    dropTrigger = -6.5;
    pumpTrigger = 6.0;
  } else if (settings.profile === "aggressive") {
    buyRsi += 5;
    sellRsi -= 5;
    dropTrigger = -3.0;
    pumpTrigger = 2.8;
  }

  let score = 0;
  score += (rsi - 50) * 1.35;
  score += coin.change24h * 3.2;
  score += distFromSmaPct * 1.8;

  const holding = portfolio[coin.id] || { usd: 0, qty: 0 };
  const effectiveUsd =
    holding.usd > 0
      ? holding.usd
      : holding.qty > 0
        ? holding.qty * coin.price
        : 0;

  let action: AnalyzedCoin["action"] = "WAIT";
  let actionLabel = "ESPERAR";
  let suggestedPct = 0;
  let targetPrice = coin.price;
  let rationale = "";

  if (rsi <= buyRsi || coin.change24h <= dropTrigger) {
    action = "BUY";
    actionLabel = "COMPRAR";
    const intensity = Math.min(
      1,
      Math.max(0.25, (buyRsi - rsi + Math.abs(coin.change24h)) / 22)
    );
    suggestedPct = Math.round((15 + intensity * 25) / 5) * 5;
    targetPrice = coin.price * 1.075;
    rationale = `Sobrevenda detectada (RSI ${rsi.toFixed(1)} e variação de ${coin.change24h.toFixed(2)}% em 24h). Zona estatística de desconto para acumulação gradual.`;
  } else if (rsi >= sellRsi || coin.change24h >= pumpTrigger) {
    action = "SELL";
    actionLabel = "VENDER PARCIAL";
    const intensity = Math.min(
      1,
      Math.max(0.2, (rsi - sellRsi + coin.change24h) / 22)
    );
    suggestedPct = Math.round((15 + intensity * 25) / 5) * 5;
    targetPrice = coin.price * 0.935;
    rationale = `Esticamento de curto prazo (RSI ${rsi.toFixed(1)} e alta de +${coin.change24h.toFixed(2)}%). Realizar lucro parcial agora para recomprar na correção.`;
  } else {
    action = "WAIT";
    actionLabel = "ESPERAR";
    suggestedPct = 0;
    targetPrice = coin.price * 0.955;
    rationale = `Tendência neutra em consolidação (RSI ${rsi.toFixed(1)}). Aguarde recuo até $${formatPrice(coin.price * 0.955)} ou rompimento confirmado.`;
  }

  const dollarActionAmount =
    effectiveUsd > 0 ? effectiveUsd * (suggestedPct / 100) : 0;

  return {
    ...coin,
    rsi,
    rangePos,
    distFromSmaPct,
    score,
    action,
    actionLabel,
    suggestedPct,
    targetPrice,
    rationale,
    effectiveUsd,
    dollarActionAmount,
  };
}

export function getSentimentLabel(fng: number): {
  label: string;
  tone: "rose" | "amber" | "cyan" | "emerald";
} {
  if (fng <= 25) return { label: "Medo Extremo", tone: "rose" };
  if (fng <= 45) return { label: "Medo / Cautela", tone: "amber" };
  if (fng <= 65) return { label: "Neutro", tone: "cyan" };
  return { label: "Ganância", tone: "emerald" };
}

export function getProfileLabel(profile: RiskProfile): string {
  if (profile === "conservative") return "Conservador";
  if (profile === "aggressive") return "Agressivo";
  return "Moderado";
}

export function buildSingleCoinWhatsAppUrl(
  a: AnalyzedCoin,
  phone: string
): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const moneyLine =
    a.effectiveUsd > 0
      ? `\n💼 Seu saldo: *$${a.effectiveUsd.toFixed(2)}*\n💵 Valor sugerido da operação: *$${a.dollarActionAmount.toFixed(2)}*`
      : "";

  const msg =
    `🤖 *RG CRYPTO AI COPILOT*\n\n` +
    `🪙 Moeda: *${a.name} (${a.symbol})*\n` +
    `💲 Cotação Atual: *$${formatPrice(a.price)}* (${a.change24h >= 0 ? "+" : ""}${a.change24h.toFixed(2)}% 24h)\n` +
    `📊 RSI (14): *${a.rsi.toFixed(1)}*\n` +
    `🚨 Sinal IA: *${a.actionLabel} (${a.suggestedPct}%)*${moneyLine}\n` +
    `🎯 Alvo Técnico: *$${formatPrice(a.targetPrice)}*\n\n` +
    `📝 _${a.rationale}_`;

  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function buildSummaryWhatsAppUrl(
  analyzedCoins: AnalyzedCoin[],
  phone: string
): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const activeSignals = analyzedCoins.filter((a) => a.action !== "WAIT");

  let msg = `🤖 *RESUMO RG CRYPTO AI COPILOT*\n\n`;
  if (activeSignals.length === 0) {
    msg += `🟡 *Mercado em Consolidação:* Nenhuma moeda atingiu gatilho extremo de compra ou venda parcial neste momento. Recomendação: *ESPERAR*.`;
  } else {
    activeSignals.forEach((a) => {
      const valStr =
        a.dollarActionAmount > 0 ? ` ($${a.dollarActionAmount.toFixed(2)})` : "";
      const icon = a.action === "BUY" ? "🟢" : "🔴";
      msg += `${icon} *${a.symbol}* ($${formatPrice(a.price)}): *${a.actionLabel} ${a.suggestedPct}%*${valStr} | Alvo: $${formatPrice(a.targetPrice)}\n`;
    });
  }

  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function generateLocalHeuristicReport(
  analyzedCoins: AnalyzedCoin[],
  profile: RiskProfile
): {
  buys: AnalyzedCoin[];
  sells: AnalyzedCoin[];
  waits: AnalyzedCoin[];
  profileLabel: string;
} {
  return {
    buys: analyzedCoins.filter((a) => a.action === "BUY"),
    sells: analyzedCoins.filter((a) => a.action === "SELL"),
    waits: analyzedCoins.filter((a) => a.action === "WAIT"),
    profileLabel: getProfileLabel(profile),
  };
}

export function generatePythonBotCode(
  portfolio: UserPortfolio,
  settings: UserSettings
): string {
  const portfolioDictLines = COINS_CONFIG.map((c) => {
    const usd = portfolio[c.id]?.usd || 0;
    return `    "${c.id}": {"symbol": "${c.symbol}", "name": "${c.name}", "saldo_usd": ${usd}},`;
  }).join("\n");

  const phone = settings.whatsapp || "5538999999999";

  return `import os
import urllib.parse
import requests

# ==============================================================================
# RG CRYPTO AI COPILOT - ROBÔ AUTÔNOMO 24/7 PARA WHATSAPP (CALLMEBOT GRÁTIS)
# ==============================================================================

WHATSAPP_PHONE = os.getenv("WHATSAPP_PHONE", "${phone}")
CALLMEBOT_APIKEY = os.getenv("CALLMEBOT_APIKEY", "SUA_APIKEY_CALLMEBOT")

# Sua carteira configurada (em Dólares USD) - edite quando quiser:
CARTEIRA = {
${portfolioDictLines}
}

RSI_COMPRA = ${settings.rsiBuyThreshold}
RSI_VENDA = ${settings.rsiSellThreshold}

def calcular_rsi(precos, periodo=14):
    if not precos or len(precos) < periodo + 1:
        return 50.0
    ganhos, perdas = 0.0, 0.0
    fatia = precos[-(periodo + 1):]
    for i in range(1, len(fatia)):
        diff = fatia[i] - fatia[i - 1]
        if diff >= 0:
            ganhos += diff
        else:
            perdas -= diff
    if perdas == 0:
        return 100.0
    rs = (ganhos / periodo) / (perdas / periodo)
    return 100.0 - (100.0 / (1.0 + rs))

def enviar_whatsapp(mensagem):
    if not CALLMEBOT_APIKEY or "SUA_APIKEY" in CALLMEBOT_APIKEY:
        print("[AVISO] Configure CALLMEBOT_APIKEY. Mensagem gerada:\\n", mensagem)
        return
    texto_codificado = urllib.parse.quote(mensagem)
    url = f"https://api.callmebot.com/whatsapp.php?phone={WHATSAPP_PHONE}&text={texto_codificado}&apikey={CALLMEBOT_APIKEY}"
    try:
        r = requests.get(url, timeout=15)
        print(f"[WHATSAPP] Status: {r.status_code}")
    except Exception as e:
        print(f"[ERRO WHATSAPP] {e}")

def analisar_mercado():
    ids = ",".join(CARTEIRA.keys())
    url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids}&sparkline=true&price_change_percentage=24h"
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    dados = resp.json()

    alertas = []
    for item in dados:
        cid = item["id"]
        info = CARTEIRA.get(cid)
        if not info:
            continue

        preco = float(item["current_price"])
        var_24h = float(item.get("price_change_percentage_24h") or 0.0)
        spark = item.get("sparkline_in_7d", {}).get("price", [])
        rsi = calcular_rsi(spark, 14)
        saldo = float(info["saldo_usd"])

        if rsi <= RSI_COMPRA or var_24h <= -4.5:
            pct = min(40, max(15, round((RSI_COMPRA - rsi + abs(var_24h)) * 1.5 / 5) * 5))
            valor_op = saldo * (pct / 100.0)
            alvo = preco * 1.075
            detalhe_saldo = f" | Aportar: *+\${valor_op:.2f}*" if saldo > 0 else ""
            alertas.append(
                f"🟢 *COMPRAR {info['symbol']}* (\${preco:,.4f} | {var_24h:+.2f}% 24h)\\n"
                f"   RSI: {rsi:.1f} -> Sugestão: *+{pct}%*{detalhe_saldo} | Alvo: \${alvo:,.4f}"
            )
        elif rsi >= RSI_VENDA or var_24h >= 4.2:
            pct = min(40, max(15, round((rsi - RSI_VENDA + var_24h) * 1.5 / 5) * 5))
            valor_op = saldo * (pct / 100.0)
            alvo = preco * 0.935
            detalhe_saldo = f" | Vender: *\${valor_op:.2f}* do seu saldo" if saldo > 0 else ""
            alertas.append(
                f"🔴 *VENDER PARCIAL {info['symbol']}* (\${preco:,.4f} | {var_24h:+.2f}% 24h)\\n"
                f"   RSI: {rsi:.1f} -> Realizar *{pct}%*{detalhe_saldo} | Recomprar em: \${alvo:,.4f}"
            )

    if alertas:
        mensagem_final = "🤖 *ALERTA RG CRYPTO AI 24/7*\\n\\n" + "\\n\\n".join(alertas)
        enviar_whatsapp(mensagem_final)
    else:
        print("[OK] Nenhuma oportunidade extrema agora. Aguardando próximo ciclo.")

if __name__ == "__main__":
    analisar_mercado()
`;
}

export function generateWorkflowYML(): string {
  return `name: RG Crypto AI WhatsApp 24-7

on:
  schedule:
    - cron: '*/15 * * * *' # Roda automaticamente a cada 15 minutos, 24h/dia
  workflow_dispatch:      # Permite rodar manualmente com 1 clique

jobs:
  monitorar-cripto:
    runs-on: ubuntu-latest
    steps:
      - name: Baixar código do repositório
        uses: actions/checkout@v4

      - name: Configurar Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Instalar dependências
        run: pip install -r requirements.txt

      - name: Executar Análise IA e Notificar WhatsApp
        env:
          WHATSAPP_PHONE: \${{ secrets.WHATSAPP_PHONE }}
          CALLMEBOT_APIKEY: \${{ secrets.CALLMEBOT_APIKEY }}
        run: python bot_whatsapp_24h.py
`;
}
