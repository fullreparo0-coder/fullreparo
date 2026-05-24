import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pagination } from "@/components/Pagination";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertTriangle, Edit, Package, Plus, Search, Trash2 } from "lucide-react";

const PAGE_SIZE = 20;

type StockForm = {
  name: string;
  sku: string;
  category: string;
  brand: string;
  model: string;
  quantity: number;
  minQuantity: number;
  costPrice: number;
  salePrice: number;
};

type StockItem = Omit<StockForm, "sku" | "category" | "brand" | "model" | "costPrice" | "salePrice"> & {
  id: number;
  tenantId?: number;
  sku: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  costPrice: string | number | null;
  salePrice: string | number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

const EMPTY_FORM: StockForm = {
  name: "",
  sku: "",
  category: "",
  brand: "",
  model: "",
  quantity: 0,
  minQuantity: 1,
  costPrice: 0,
  salePrice: 0,
};

function normalizeStockPayload(form: StockForm) {
  return {
    name: form.name.trim(),
    sku: form.sku.trim() || undefined,
    category: form.category.trim() || undefined,
    brand: form.brand.trim() || undefined,
    model: form.model.trim() || undefined,
    quantity: Math.max(0, Number(form.quantity) || 0),
    minQuantity: Math.max(0, Number(form.minQuantity) || 0),
    costPrice: Math.max(0, Number(form.costPrice) || 0),
    salePrice: Math.max(0, Number(form.salePrice) || 0),
  };
}

function StockFormFields({ form, setForm }: { form: StockForm; setForm: React.Dispatch<React.SetStateAction<StockForm>> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label>Nome da peça *</Label>
        <Input className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tela Samsung S23" />
      </div>
      <div>
        <Label>SKU</Label>
        <Input className="mt-1.5" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
      </div>
      <div>
        <Label>Categoria</Label>
        <Input className="mt-1.5" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Telas" />
      </div>
      <div>
        <Label>Marca</Label>
        <Input className="mt-1.5" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
      </div>
      <div>
        <Label>Modelo</Label>
        <Input className="mt-1.5" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
      </div>
      <div>
        <Label>Quantidade</Label>
        <Input type="number" min={0} className="mt-1.5" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
      </div>
      <div>
        <Label>Qtd mínima</Label>
        <Input type="number" min={0} className="mt-1.5" value={form.minQuantity} onChange={(e) => setForm((f) => ({ ...f, minQuantity: Number(e.target.value) }))} />
      </div>
      <div>
        <Label>Custo (R$)</Label>
        <Input type="number" min={0} step="0.01" className="mt-1.5" value={form.costPrice} onChange={(e) => setForm((f) => ({ ...f, costPrice: Number(e.target.value) }))} />
      </div>
      <div>
        <Label>Venda (R$)</Label>
        <Input type="number" min={0} step="0.01" className="mt-1.5" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: Number(e.target.value) }))} />
      </div>
    </div>
  );
}

export default function StockList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<StockForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<StockForm>(EMPTY_FORM);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => { setPage(1); }, [search]);

  const { data, isLoading } = trpc.stock.list.useQuery({
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = (data?.data ?? []) as StockItem[];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const lowStockCount = items.filter((item) => item.quantity <= item.minQuantity).length;
  const totalInventoryValue = items.reduce((sum, item) => sum + Number(item.costPrice) * item.quantity, 0);

  const create = trpc.stock.create.useMutation({
    onSuccess: () => {
      toast.success("Item adicionado ao estoque");
      setOpen(false);
      setForm(EMPTY_FORM);
      utils.stock.list.invalidate();
    },
    onError: () => toast.error("Erro ao adicionar item"),
  });

  const update = trpc.stock.update.useMutation({
    onSuccess: () => {
      toast.success("Item atualizado com sucesso");
      setEditOpen(false);
      setEditingItem(null);
      setEditForm(EMPTY_FORM);
      utils.stock.list.invalidate();
    },
    onError: () => toast.error("Erro ao atualizar item"),
  });

  const remove = trpc.stock.delete.useMutation({
    onSuccess: () => {
      toast.success("Item removido do estoque");
      utils.stock.list.invalidate();
    },
    onError: () => toast.error("Erro ao remover item"),
  });

  function handleCreate() {
    const payload = normalizeStockPayload(form);
    if (!payload.name) {
      toast.error("Informe o nome da peça");
      return;
    }
    create.mutate(payload);
  }

  function openEdit(item: StockItem) {
    setEditingItem(item);
    setEditForm({
      name: item.name ?? "",
      sku: item.sku ?? "",
      category: item.category ?? "",
      brand: item.brand ?? "",
      model: item.model ?? "",
      quantity: Number(item.quantity) || 0,
      minQuantity: Number(item.minQuantity) || 0,
      costPrice: Number(item.costPrice) || 0,
      salePrice: Number(item.salePrice) || 0,
    });
    setEditOpen(true);
  }

  function handleUpdate() {
    if (!editingItem) return;
    const payload = normalizeStockPayload(editForm);
    if (!payload.name) {
      toast.error("Informe o nome da peça");
      return;
    }
    update.mutate({ id: editingItem.id, ...payload });
  }

  function adjustQuantity(item: StockItem, delta: number) {
    const nextQuantity = Math.max(0, Number(item.quantity) + delta);
    update.mutate({ id: item.id, quantity: nextQuantity });
  }

  function handleDelete(item: StockItem) {
    if (!window.confirm(`Remover "${item.name}" do estoque? Esta ação não pode ser desfeita.`)) return;
    remove.mutate({ id: item.id });
  }

  return (
    <TenantLayout title="Estoque">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Itens cadastrados</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Alertas na página</p>
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-600" : ""}`}>{lowStockCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor de custo na página</p>
              <p className="text-2xl font-bold">R$ {totalInventoryValue.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU, marca ou modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" /> Nova Peça</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar ao Estoque</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <StockFormFields form={form} setForm={setForm} />
                <Button className="w-full" onClick={handleCreate} disabled={!form.name.trim() || create.isPending}>
                  {create.isPending ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? "Nenhuma peça encontrada para essa busca" : "Nenhum item no estoque"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Cadastre peças, acompanhe quantidade mínima e ajuste o saldo rapidamente.</p>
                {!search && (
                  <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar primeira peça
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.4fr] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30">
                  <span>Nome</span>
                  <span>Categoria</span>
                  <span>Quantidade</span>
                  <span>Custo</span>
                  <span>Venda</span>
                  <span className="text-right">Ações</span>
                </div>
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1.4fr] gap-2 lg:gap-4 px-5 py-3.5 items-center">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {item.sku ? <span>SKU: {item.sku}</span> : null}
                        {item.brand ? <span>{item.brand} {item.model}</span> : null}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.category ?? "—"}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold ${item.quantity <= item.minQuantity ? "text-red-600" : "text-foreground"}`}>
                        {item.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground">mín. {item.minQuantity}</span>
                      {item.quantity <= item.minQuantity && (
                        <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" /> baixo</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">R$ {Number(item.costPrice).toFixed(2)}</span>
                    <span className="text-sm font-medium">R$ {Number(item.salePrice).toFixed(2)}</span>
                    <div className="flex flex-wrap justify-start lg:justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 px-2" disabled={update.isPending} onClick={() => adjustQuantity(item, -1)}>-1</Button>
                      <Button size="sm" variant="outline" className="h-8 px-2" disabled={update.isPending} onClick={() => adjustQuantity(item, 1)}>+1</Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(item)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-red-600 hover:text-red-700" disabled={remove.isPending} onClick={() => handleDelete(item)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {totalCount > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}

        <Dialog open={editOpen} onOpenChange={(value) => { setEditOpen(value); if (!value) setEditingItem(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Item do Estoque</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <StockFormFields form={editForm} setForm={setEditForm} />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={update.isPending}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleUpdate} disabled={!editForm.name.trim() || update.isPending}>
                  {update.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
}
