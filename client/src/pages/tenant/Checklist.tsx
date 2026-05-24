import { useState, useMemo, useEffect, useCallback } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DEVICE_TYPES } from "@shared/const";
import {
  Plus,
  Trash2,
  Globe,
  Smartphone,
  Lock,
  CheckSquare,
  Save,
  AlertCircle,
} from "lucide-react";

const GLOBAL_TAB = "__global__";

type AdminEntry = {
  id: number;
  label: string;
  sortOrder: number;
  isActive: boolean;
  deviceType: string | null;
  isCustom: boolean;
  templateId: number | null;
  overrideId: number | null;
  isGloballyActive: boolean;
};

/** Representa um item no estado local de edição */
type DraftItem = {
  /** Chave única local (pode ser "tpl-{templateId}" ou "custom-{overrideId}" ou "new-{uuid}") */
  key: string;
  templateId: number | null;
  overrideId: number | null;
  label: string;
  isActive: boolean;
  isCustom: boolean;
  isGloballyActive: boolean;
};

function buildDraftFromEntries(entries: AdminEntry[]): DraftItem[] {
  return entries
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({
      key: e.isCustom ? `custom-${e.overrideId ?? e.id}` : `tpl-${e.templateId}`,
      templateId: e.templateId,
      overrideId: e.overrideId,
      label: e.label,
      isActive: e.isActive,
      isCustom: e.isCustom,
      isGloballyActive: e.isGloballyActive,
    }));
}

export default function TenantChecklist() {
  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.tenantChecklist.listForAdmin.useQuery(undefined);

  const saveMutation = trpc.tenantChecklist.saveForType.useMutation({
    onSuccess: () => {
      utils.tenantChecklist.listForAdmin.invalidate();
      setDirty(false);
      toast.success("Checklist salvo com sucesso.");
    },
    onError: (e) => toast.error(e.message),
  });

  const [selectedType, setSelectedType] = useState<string>(GLOBAL_TAB);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  /** Filtra entradas do banco pelo tipo selecionado */
  const entriesForType = useMemo<AdminEntry[]>(() => {
    const list = items as AdminEntry[];
    if (selectedType === GLOBAL_TAB) return list.filter((i) => !i.deviceType);
    return list.filter((i) => i.deviceType === selectedType);
  }, [items, selectedType]);

  /** Sincroniza o draft quando o tipo muda ou os dados chegam do banco */
  useEffect(() => {
    if (!isLoading) {
      setDraft(buildDraftFromEntries(entriesForType));
      setDirty(false);
      setNewLabel("");
    }
  }, [selectedType, isLoading, items]);

  /** Troca de tipo com confirmação se houver alterações pendentes */
  const handleTypeChange = useCallback(
    (newType: string) => {
      if (dirty) {
        const ok = confirm("Você tem alterações não salvas. Deseja descartá-las e trocar de tipo?");
        if (!ok) return;
      }
      setSelectedType(newType);
    },
    [dirty]
  );

  /** Toggle de ativo/inativo de um item no draft */
  const handleToggle = (key: string) => {
    setDraft((prev) =>
      prev.map((item) => (item.key === key ? { ...item, isActive: !item.isActive } : item))
    );
    setDirty(true);
  };

  /** Adiciona um novo item exclusivo ao draft */
  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    const newKey = `new-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        key: newKey,
        templateId: null,
        overrideId: null,
        label,
        isActive: true,
        isCustom: true,
        isGloballyActive: true,
      },
    ]);
    setNewLabel("");
    setDirty(true);
  };

  /** Remove um item exclusivo do draft */
  const handleRemove = (key: string) => {
    setDraft((prev) => prev.filter((item) => item.key !== key));
    setDirty(true);
  };

  /** Salva o draft atual no banco */
  const handleSave = () => {
    saveMutation.mutate({
      deviceType: selectedType === GLOBAL_TAB ? null : selectedType,
      items: draft.map((item, idx) => ({
        templateId: item.templateId,
        overrideId: item.overrideId,
        label: item.label,
        isActive: item.isActive,
        isCustom: item.isCustom,
        sortOrder: idx,
      })),
    });
  };

  /** Descarta alterações e restaura o draft do banco */
  const handleDiscard = () => {
    setDraft(buildDraftFromEntries(entriesForType));
    setDirty(false);
    setNewLabel("");
  };

  const activeCount = draft.filter((i) => i.isActive).length;

  return (
    <TenantLayout title="Checklist de Entrada">
      <div className="space-y-5 max-w-2xl">

        {/* Seletor de tipo */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold">Tipo de aparelho</CardTitle>
            <CardDescription className="text-xs">
              Selecione o tipo para editar os itens do checklist correspondente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-10 text-sm w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_TAB}>
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Global — aparece em todos os tipos
                  </span>
                </SelectItem>
                <Separator className="my-1" />
                {DEVICE_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    <span className="flex items-center gap-2">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      {dt}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Editor do checklist */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  {selectedType === GLOBAL_TAB ? (
                    <><Globe className="h-4 w-4 text-primary" />Itens Globais</>
                  ) : (
                    <><Smartphone className="h-4 w-4 text-primary" />{selectedType}</>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedType === GLOBAL_TAB
                    ? "Aparecem em todas as OS, independente do tipo."
                    : `Aparecem apenas em OS do tipo "${selectedType}".`}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {activeCount} / {draft.length} ativos
              </Badge>
            </div>
          </CardHeader>

          {/* Legenda */}
          <div className="px-5 pb-3 flex items-center gap-5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Item do sistema
            </span>
            <span className="flex items-center gap-1.5">
              <CheckSquare className="h-3 w-3 text-primary" />
              Item exclusivo da sua assistência
            </span>
          </div>

          <Separator />

          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : draft.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Nenhum item para este tipo. Adicione um abaixo.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {draft.map((item) => (
                  <li
                    key={item.key}
                    className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 ${
                      !item.isActive ? "opacity-50" : ""
                    }`}
                  >
                    {/* Checkbox de ativo/inativo */}
                    <Checkbox
                      checked={item.isActive}
                      onCheckedChange={() => handleToggle(item.key)}
                      disabled={!item.isGloballyActive}
                      title={
                        !item.isGloballyActive
                          ? "Desativado globalmente pelo sistema"
                          : item.isActive
                          ? "Desmarcar para desativar"
                          : "Marcar para ativar"
                      }
                      className="shrink-0"
                    />

                    {/* Ícone de origem */}
                    <span
                      className="shrink-0"
                      title={item.isCustom ? "Item exclusivo da sua assistência" : "Item do sistema"}
                    >
                      {item.isCustom ? (
                        <CheckSquare className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </span>

                    {/* Label */}
                    <span className="flex-1 text-sm text-foreground">{item.label}</span>

                    {/* Remover (apenas itens exclusivos) */}
                    {item.isCustom && (
                      <button
                        onClick={() => handleRemove(item.key)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        title="Remover item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Adicionar novo item exclusivo */}
            <div className="px-5 py-4 border-t border-border bg-muted/20">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Adicionar item exclusivo para{" "}
                <strong>{selectedType === GLOBAL_TAB ? "todos os tipos" : selectedType}</strong>
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Película protetora inclusa"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  maxLength={200}
                  className="h-9 text-sm flex-1"
                />
                <Button
                  onClick={handleAdd}
                  disabled={!newLabel.trim()}
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de ações — só aparece quando há alterações */}
        {dirty && (
          <div className="sticky bottom-4 z-10">
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-5 py-3.5 shadow-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="flex-1 text-sm text-amber-800 dark:text-amber-300 font-medium">
                Você tem alterações não salvas.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={saveMutation.isPending}
                className="h-8 text-xs"
              >
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="h-8 text-xs gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
