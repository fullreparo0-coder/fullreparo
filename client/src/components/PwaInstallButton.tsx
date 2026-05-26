import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download, Share, Smartphone } from "lucide-react";

type PwaInstallButtonVariant = "banner" | "sidebar";

interface PwaInstallButtonProps {
  variant?: PwaInstallButtonVariant;
  className?: string;
}

export function PwaInstallButton({ variant = "banner", className }: PwaInstallButtonProps) {
  const { canInstall, isInstalled, shouldShowIosInstructions, promptInstall } = usePwaInstall();

  if (isInstalled || (!canInstall && !shouldShowIosInstructions)) {
    return null;
  }

  if (shouldShowIosInstructions) {
    if (variant === "sidebar") {
      return (
        <div className={cn("rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5 text-sidebar-foreground", className)}>
          <div className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
            <div className="min-w-0">
              <p className="text-xs font-semibold">Instalar app</p>
              <p className="mt-1 text-[11px] leading-snug text-sidebar-foreground/65">
                No iPhone, toque em <Share className="inline h-3 w-3" /> Compartilhar e depois em Adicionar à Tela de Início.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-blue-950", className)}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Instale o app no iPhone</p>
            <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
              Toque em <Share className="inline h-3.5 w-3.5" /> Compartilhar no Safari e escolha Adicionar à Tela de Início.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          "h-9 w-full justify-start gap-2 rounded-lg px-2.5 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          className,
        )}
        onClick={() => void promptInstall()}
      >
        <Download className="h-4 w-4 shrink-0" />
        Instalar app
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className={cn("w-full gap-2 font-semibold", className)}
      onClick={() => void promptInstall()}
    >
      <Download className="h-4 w-4" />
      Instalar app
    </Button>
  );
}
