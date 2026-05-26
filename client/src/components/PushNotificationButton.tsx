import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type PushNotificationButtonVariant = "sidebar" | "banner";

type PushNotificationButtonProps = {
  target: "tenant_user" | "customer";
  tenantId?: number;
  variant?: PushNotificationButtonVariant;
  className?: string;
};

export function PushNotificationButton({ target, tenantId, variant = "banner", className }: PushNotificationButtonProps) {
  const push = usePushNotifications({ target, tenantId });

  if (!push.browserSupported || !push.serverEnabled) {
    return null;
  }

  const handleEnable = async () => {
    try {
      await push.enable();
      toast.success("Notificações ativadas neste dispositivo.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível ativar notificações.");
    }
  };

  const handleDisable = async () => {
    try {
      await push.disable();
      toast.success("Notificações desativadas neste dispositivo.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível desativar notificações.");
    }
  };

  if (push.permission === "denied") {
    if (variant === "sidebar") return null;

    return (
      <div className={cn("rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950", className)}>
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Notificações bloqueadas</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
              Para receber avisos em tempo real, libere notificações para este site nas configurações do navegador.
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
        disabled={push.isLoading || !push.canEnable}
        onClick={() => void (push.isEnabled ? handleDisable() : handleEnable())}
      >
        {push.isEnabled ? <BellOff className="h-4 w-4 shrink-0" /> : <Bell className="h-4 w-4 shrink-0" />}
        {push.isEnabled ? "Desativar avisos" : "Ativar avisos"}
      </Button>
    );
  }

  return (
    <div className={cn("rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-blue-950", className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Receber avisos em tempo real</p>
          <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
            Ative para receber avisos importantes deste atendimento neste dispositivo.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3 w-full gap-2 font-semibold"
            disabled={push.isLoading || !push.canEnable}
            onClick={() => void (push.isEnabled ? handleDisable() : handleEnable())}
          >
            {push.isEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {push.isEnabled ? "Desativar notificações" : "Ativar notificações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
