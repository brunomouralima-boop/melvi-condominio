import { useState } from "react";
import { Share2, MessageCircle, Smartphone, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QRAccessCode } from "@/types";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  qr: QRAccessCode;
  /** Nome do condomínio (default: "Melvi Condomínio") */
  condominiumName?: string;
}

/**
 * Constrói a mensagem que vai ser partilhada via WhatsApp / SMS / clipboard.
 * Mantida simples, em Português, com emojis para ficar visualmente apelativa.
 */
export function buildShareMessage(qr: QRAccessCode, condominiumName = "Melvi Condomínio"): string {
  const lines = [
    `🏢 *${condominiumName}*`,
    "",
    `Olá ${qr.guestName}, foi gerado o seu acesso ao condomínio.`,
    "",
    `🔑 Código de entrada: *${qr.shortCode ?? "—"}*`,
    "",
    `📅 Válido até: ${formatDate(qr.validUntil)}`,
    "",
    "📍 Apresente este código (ou mostre o QR Code) na portaria à chegada.",
  ];
  return lines.join("\n");
}

/**
 * Botões para partilhar o acesso por WhatsApp, SMS ou clipboard.
 * Em dispositivos com Web Share API disponível, oferece o partilhar nativo
 * como opção principal.
 */
export function AccessShare({ qr, condominiumName }: Props) {
  const [copied, setCopied] = useState(false);
  const message = buildShareMessage(qr, condominiumName);
  const encoded = encodeURIComponent(message);

  // Deep links
  const whatsappUrl = `https://wa.me/?text=${encoded}`;
  const smsUrl = `sms:?body=${encoded}`;

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function shareNative() {
    try {
      await navigator.share({
        title: `Acesso ${condominiumName ?? "Melvi Condomínio"}`,
        text: message,
      });
    } catch (err: any) {
      // Utilizador cancelou — ignorar silenciosamente
      if (err?.name !== "AbortError") {
        toast.error("Falha ao partilhar");
      }
    }
  }

  function copyToClipboard() {
    navigator.clipboard
      .writeText(message)
      .then(() => {
        setCopied(true);
        toast.success("Mensagem copiada");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Falha ao copiar"));
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
        Partilhar acesso
      </div>

      {/* Partilha nativa (só em telemóvel com Web Share API) */}
      {canNativeShare && (
        <Button onClick={shareNative} className="w-full" size="lg">
          <Share2 className="h-4 w-4" />
          Partilhar…
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#1DA851] text-white font-medium text-sm py-2.5 px-3 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
        <a
          href={smsUrl}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-medium text-sm py-2.5 px-3 transition-colors"
        >
          <Smartphone className="h-4 w-4" />
          SMS
        </a>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={copyToClipboard}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar mensagem"}
      </Button>
    </div>
  );
}
