import { useState, useMemo } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DEVICE_TYPES } from "@shared/const";
import {
  Plus,
  Trash2,
  GripVertical,
  CheckSquare,
  Pencil,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Globe,
  Smartphone,
} from "lucide-react";

type ChecklistItem = {
  id: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
  deviceType: string | null;
};

/** Aba "Global" representa itens sem deviceType (null) */
const GLOBAL_TAB = "__global__";

export default function SuperAdminChecklist() {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.checklistTemplates.list.useQuery(undefined);

  const createMutation = trpc.checklistTemplates.create.useMutation({
    onSuccess: () => {
      utils.checklistTemplates.list.invalidate();
      setNewLabel("");
      toast.success("Item adicionado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.checklistTemplates.update.useMutation({
    onSuccess: () => {
      utils.checklistTemplates.list.invalidate();
      setEditingId(null);
      toast.success("Item atualizado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.checklistTemplates.delete.useMutation({
    onSuccess: () => {
      utils.checklistTemplates.list.invalidate();
      toast.success("Item removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.checklistTemplates.reorder.useMutation({
    onSuccess: () => utils.checklistTemplates.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [activeTab, setActiveTab] = useState(GLOBAL_TAB);
  const [newLabel, setNewLabel] = useState("");
  const [newDeviceType, setNewDeviceType] = useState<string>(GLOBAL_TAB);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  /** Itens filtrados pela aba ativa */
  const tabItems = useMemo<ChecklistItem[]>(() => {
    const list = items as ChecklistItem[];
    if (activeTab === GLOBAL_TAB) return list.filter((i) => !i.deviceType);
    return list.filter((i) => i.deviceType === activeTab);
  }, [items, activeTab]);

  const sorted = [...tabItems].sort((a, b) => a.sortOrder - b.sortOrder);

  /** Contagem de itens ativos por aba para badges */
  const countByTab = useMemo(() => {
    const list = items as ChecklistItem[];
    const map: Record<string, number> = { [GLOBAL_TAB]: 0 };
    for (const item of list) {
      const key = item.deviceType ?? GLOBAL_TAB;
      map[key] = (map[key] ?? 0) + (item.isActive ? 1 : 0);
    }
    return map;
  }, [items]);

  /** Tipos que já têm pelo menos 1 item cadastrado */
  const usedTypes = useMemo(() => {
    const list = items as ChecklistItem[];
    return Array.from(new Set(list.filter((i) => i.deviceType).map((i) => i.deviceType as string)));
  }, [items]);

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    const deviceType = newDeviceType === GLOBAL_TAB ? null : newDeviceType;
    createMutation.mutate({ label, isActive: true, deviceType });
    // Muda para a aba do tipo recém-adicionado
    setActiveTab(newDeviceType);
  };

  const handleStartEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
  };

  const handleSaveEdit = (id: number) => {
    const label = editLabel.trim();
    if (!label) return;
    updateMutation.mutate({ id, label });
  };

  const handleToggleActive = (item: ChecklistItem) => {
    updateMutation.mutate({ id: item.id, isActive: !item.isActive });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remover este item do checklist padrão?")) return;
    deleteMutation.mutate({ id });
  };

  const handleMove = (item: ChecklistItem, direction: "up" | "down") => {
    const idx = sorted.findIndex((i) => i.id === item.id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const swapItem = sorted[swapIdx];
    reorderMutation.mutate([
      { id: item.id, sortOrder: swapItem.sortOrder },
      { id: swapItem.id, sortOrder: item.sortOrder },
    ]);
  };

  /** Abas: Global + tipos que já têm itens + tipos que não têm (para adicionar) */
  const allTabs = [GLOBAL_TAB, ...DEVICE_TYPES];

  return (
    <TenantLayout title="Checklist Padrão">
      <div className="space-y-6 max-w-3xl">
        {/* Cabeçalho informativo */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <CheckSquare className="h-7 w-7 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Checklist de Entrada por Tipo de Aparelho</p>
            <p className="text-sm text-muted-foreground">
              Itens <strong>Globais</strong> aparecem em todos os tipos de OS. Itens específicos aparecem
              apenas quando o tipo de aparelho corresponde. Itens inativos ficam ocultos para os atendentes.
            </p>
          </div>
        </div>

        {/* Adicionar novo item */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Adicionar item</CardTitle>
            <CardDescription>Escolha o tipo de aparelho ou deixe como Global.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Select value={newDeviceType} onValueChange={setNewDeviceType}>
                <SelectTrigger className="w-48 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL_TAB}>
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Global (todos)
                    </span>
                  </SelectItem>
                  {DEVICE_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {dt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ex: Carregador original incluso"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                maxLength={200}
                className="flex-1"
              />
              <Button
                onClick={handleAdd}
                disabled={!newLabel.trim() || createMutation.isPending}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Abas por tipo */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto flex-wrap gap-1 bg-muted p-1 min-w-full">
              <TabsTrigger value={GLOBAL_TAB} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
                <Globe className="h-3 w-3" />
                Global
                {(countByTab[GLOBAL_TAB] ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {countByTab[GLOBAL_TAB]}
                  </Badge>
                )}
              </TabsTrigger>
              {/* Mostrar primeiro os tipos que já têm itens, depois os demais */}
              {[...usedTypes, ...DEVICE_TYPES.filter((dt) => !usedTypes.includes(dt))].map((dt) => (
                <TabsTrigger key={dt} value={dt} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
                  <Smartphone className="h-3 w-3" />
                  {dt}
                  {(countByTab[dt] ?? 0) > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                      {countByTab[dt]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {allTabs.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {tab === GLOBAL_TAB ? (
                      <>
                        <Globe className="h-4 w-4 text-primary" />
                        Itens Globais
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4 text-primary" />
                        {tab}
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {tab === GLOBAL_TAB
                      ? "Aparecem em todas as OS, independente do tipo de aparelho."
                      : `Aparecem apenas em OS do tipo "${tab}".`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">Carregando...</div>
                  ) : sorted.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      Nenhum item para este tipo. Use o formulário acima para adicionar.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {sorted.map((item, idx) => (
                        <li
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            !item.isActive ? "opacity-50 bg-muted/30" : ""
                          }`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

                          {/* Setas de reordenação */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={() => handleMove(item, "up")}
                              disabled={idx === 0 || reorderMutation.isPending}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                              title="Mover para cima"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleMove(item, "down")}
                              disabled={idx === sorted.length - 1 || reorderMutation.isPending}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Label */}
                          {editingId === item.id ? (
                            <div className="flex flex-1 items-center gap-2 min-w-0">
                              <Input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(item.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                className="h-8 text-sm"
                                autoFocus
                                maxLength={200}
                              />
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={!editLabel.trim() || updateMutation.isPending}
                                className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                                title="Salvar"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="flex-1 text-sm truncate">{item.label}</span>
                          )}

                          {/* Toggle ativo/inativo */}
                          <Switch
                            checked={item.isActive}
                            onCheckedChange={() => handleToggleActive(item)}
                            disabled={updateMutation.isPending}
                            title={item.isActive ? "Desativar item" : "Ativar item"}
                          />

                          {/* Editar */}
                          {editingId !== item.id && (
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Excluir */}
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteMutation.isPending}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TenantLayout>
  );
}
