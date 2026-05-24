import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCircle2, XCircle, Activity, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Link } from "wouter";

type EventType = "all" | "budget_approved" | "budget_rejected" | "status_change" | "auto_communication";

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  budget_approved: {
    label: "Orçamento aprovado",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  budget_rejected: {
    label: "Orçamento recusado",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  status_change: {
    label: "Mudança de status",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Activity className="h-3.5 w-3.5" />,
  },
  auto_communication: {
    label: "Comunicação automática",
    color: "bg-violet-100 text-violet-800 border-violet-200",
    icon: <Bell className="h-3.5 w-3.5" />,
  },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  portal: "Portal",
  rastreamento: "Link público",
  sistema: "Sistema",
  push_pwa: "Push PWA",
  email: "E-mail",
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<EventType>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const pageSize = 30;

  const { data, isLoading } = trpc.notifications.list.useQuery({
    page,
    pageSize,
    eventType,
    search: search || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleEventTypeChange(val: string) {
    setEventType(val as EventType);
    setPage(1);
  }

  return (
    <TenantLayout title="Notificações">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Histórico de Notificações</h1>
              <p className="text-sm text-muted-foreground">
                Aprovações, recusas, mudanças de status e comunicações automáticas por Push PWA e e-mail
              </p>
            </div>
          </div>
          {data && (
            <Badge variant="secondary" className="text-sm">
              {data.total} {data.total === 1 ? "registro" : "registros"}
            </Badge>
          )}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por mensagem ou responsável..."
                    className="pl-9"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button variant="outline" onClick={handleSearch}>
                  Buscar
                </Button>
              </div>
              <Select value={eventType} onValueChange={handleEventTypeChange}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Tipo de evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  <SelectItem value="budget_approved">Orçamento aprovado</SelectItem>
                  <SelectItem value="budget_rejected">Orçamento recusado</SelectItem>
                  <SelectItem value="status_change">Mudança de status</SelectItem>
                  <SelectItem value="auto_communication">Comunicação automática</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Eventos registrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !data?.items.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum evento encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Os eventos aparecerão aqui quando clientes aprovarem/recusarem orçamentos, quando
                  statuses críticos forem alterados ou quando a automação v16 enviar Push PWA/e-mail.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {data.items.map((item) => {
                  const typeInfo = EVENT_TYPE_LABELS[item.eventType] ?? {
                    label: item.eventType,
                    color: "bg-gray-100 text-gray-700 border-gray-200",
                    icon: <Activity className="h-3.5 w-3.5" />,
                  };
                  const channelLabel = CHANNEL_LABELS[item.channel] ?? item.channel;
                  const sentAt = new Date(item.sentAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1.5 px-6 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-4"
                    >
                      {/* Tipo de evento */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeInfo.color}`}
                        >
                          {typeInfo.icon}
                          {typeInfo.label}
                        </span>
                      </div>

                      {/* Conteúdo principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.osNumber || item.serviceOrderId ? (
                            <Link
                              href={`/painel/os/${item.serviceOrderId}`}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              {item.osNumber ? `OS ${item.osNumber}` : `OS #${item.serviceOrderId}`}
                            </Link>
                          ) : null}
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {channelLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-foreground/80 line-clamp-2">{item.message}</p>
                        {item.actorName && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Por: <span className="font-medium">{item.actorName}</span>
                          </p>
                        )}
                      </div>

                      {/* Data/hora */}
                      <div className="shrink-0 text-right">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{sentAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages} · {data?.total ?? 0} registros
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
