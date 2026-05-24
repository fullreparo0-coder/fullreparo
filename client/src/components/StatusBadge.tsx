import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  aguardando_coleta: "Aguardando Coleta",
  coleta_agendada: "Coleta Agendada",
  coletado: "Coletado",
  recebido_na_assistencia: "Recebido",
  em_diagnostico: "Em Diagnóstico",
  aguardando_aprovacao: "Aguard. Aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  aguardando_peca: "Aguard. Peça",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  aguardando_entrega: "Aguard. Entrega",
  saiu_para_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={cn(
        `status-${status}`,
        "inline-flex items-center rounded-full font-medium",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className
      )}
    >
      {label}
    </span>
  );
}

export { STATUS_LABELS };
