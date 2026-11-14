import React from "react";
import { Check, Copy, Download, Terminal } from "lucide-react";
import type { UserPortfolio, UserSettings } from "../types/crypto";
import {
  generatePythonBotCode,
  generateWorkflowYML,
} from "../utils/quantEngine";

interface CloudBotViewProps {
  portfolio: UserPortfolio;
  settings: UserSettings;
  onNotify: (message: string, tone?: "success" | "warning" | "info") => void;
}

export const CloudBotView: React.FC<CloudBotViewProps> = ({
  portfolio,
  settings,
  onNotify,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const pythonCode = generatePythonBotCode(portfolio, settings);
  const ymlCode = generateWorkflowYML();
  const reqCode = "requests==2.32.3\n";

  const downloadFile = (
    filename: string,
    content: string,
    mimeType = "text/plain;charset=utf-8"
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify(`Arquivo "${filename}" baixado.`, "success");
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      onNotify("Código copiado para a área de transferência.", "success");
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      onNotify("Não foi possível copiar automaticamente.", "warning");
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-xs font-semibold text-emerald-400">
              Automação Gratuita · GitHub Actions + CallMeBot
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Robô Autônomo 24/7 com Alertas no WhatsApp
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Roda automaticamente a cada 15 minutos na nuvem gratuita do GitHub Actions com seus saldos e limiares calibrados, enviando alertas de compra e realização parcial no seu WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              onClick={() =>
                downloadFile(
                  "bot_whatsapp_24h.py",
                  pythonCode,
                  "text/x-python;charset=utf-8"
                )
              }
              className="h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Robô Python (.py)</span>
            </button>
            <button
              onClick={() =>
                downloadFile("crypto_bot.yml", ymlCode, "text/yaml;charset=utf-8")
              }
              className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Baixar Workflow (.yml)</span>
            </button>
          </div>
        </div>

        {/* 3-Column Setup Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-5 border-b border-slate-800/80">
          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-emerald-400">
              01. Ativar CallMeBot
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Salve o número{" "}
              <span className="font-mono text-slate-200">+34 644 71 98 38</span>{" "}
              nos contatos e envie no WhatsApp:{" "}
              <code className="font-mono text-emerald-300">
                I allow callmebot to send me messages
              </code>{" "}
              para receber sua APIKEY.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-cyan-400">
              02. Subir no GitHub
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crie um repositório privado no GitHub e adicione{" "}
              <code className="font-mono text-slate-200">
                bot_whatsapp_24h.py
              </code>
              ,{" "}
              <code className="font-mono text-slate-200">requirements.txt</code>{" "}
              e{" "}
              <code className="font-mono text-slate-200">
                .github/workflows/crypto_bot.yml
              </code>
              .
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-slate-200">
              03. Configurar Secrets
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Em <em className="text-slate-300">Settings &gt; Secrets &gt; Actions</em>,
              crie{" "}
              <code className="font-mono text-slate-200">WHATSAPP_PHONE</code> e{" "}
              <code className="font-mono text-slate-200">CALLMEBOT_APIKEY</code>.
              Seus saldos já vão preenchidos no script abaixo.
            </p>
          </div>
        </div>

        {/* Script Previews */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#070B14] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>bot_whatsapp_24h.py</span>
              </div>
              <button
                onClick={() => handleCopy("py", pythonCode)}
                className="h-7 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === "py" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedId === "py" ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
            <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-80 leading-relaxed">
              {pythonCode}
            </pre>
          </div>

          <div className="space-y-5">
            <div className="bg-[#070B14] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  .github/workflows/crypto_bot.yml
                </span>
                <button
                  onClick={() => handleCopy("yml", ymlCode)}
                  className="h-7 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === "yml" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedId === "yml" ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
              <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                {ymlCode}
              </pre>
            </div>

            <div className="bg-[#070B14] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-amber-400">
                  requirements.txt
                </span>
                <button
                  onClick={() => downloadFile("requirements.txt", reqCode)}
                  className="h-7 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar .txt</span>
                </button>
              </div>
              <pre className="p-4 text-[11px] font-mono text-slate-300">
                {reqCode}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
