import { MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WhatsAppFABProps {
  /** Número do WhatsApp no formato internacional, ex: "5511999999999" */
  whatsappNumber: string | null | undefined;
  /** Mensagem pré-preenchida opcional */
  message?: string;
  /** Nome da assistência para compor a mensagem padrão */
  tenantName?: string;
}

/**
 * Botão de ação flutuante (FAB) de WhatsApp.
 * Fixado no canto inferior direito, visível apenas quando whatsappNumber está disponível.
 * Abre o WhatsApp Web/App com mensagem pré-preenchida.
 */
export function WhatsAppFAB({ whatsappNumber, message, tenantName }: WhatsAppFABProps) {
  if (!whatsappNumber) return null;

  const cleanNumber = whatsappNumber.replace(/\D/g, "");
  const defaultMessage = message ?? (tenantName ? `Olá, ${tenantName}! Gostaria de mais informações.` : "Olá! Gostaria de mais informações.");
  const href = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(defaultMessage)}`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl active:scale-95"
            style={{
              backgroundColor: "#25d366",
              animation: "fab-enter 0.35s cubic-bezier(0.23, 1, 0.32, 1) both",
            }}
          >
            <MessageCircle className="h-7 w-7 text-white fill-white" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs font-medium">
          {message ? "Falar sobre esta OS" : "Falar no WhatsApp"}
        </TooltipContent>
      </Tooltip>

      {/* Animação de entrada */}
      <style>{`
        @keyframes fab-enter {
          from { opacity: 0; transform: scale(0.6) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="fab-enter"] { animation: none; }
        }
      `}</style>
    </TooltipProvider>
  );
}
