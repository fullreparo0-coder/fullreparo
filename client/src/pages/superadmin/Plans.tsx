import { useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Package, CheckCircle2, FlaskConical, Save } from "lucide-react";
import { toast } from "sonner";

type PlanForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  maxOsPerMonth: string;
  maxUsers: string;
  hasPickupDelivery: boolean;
  hasOnlineBudget: boolean;
  hasWhatsapp: boolean;
  hasClientPortal: boolean;
  hasStock: boolean;
  hasFinancial: boolean;
  hasReports: boolean;
  hasAdvancedCustomization: boolean;
  isPublic: boolean;
  isActive: boolean;
};

const betaDefaults: PlanForm = {
  name: "Beta",
  slug: "beta",
  description: "Plano interno para clientes testadores do FullReparo, liberado manualmente pelo Super Admin durante a fase de validação.",
  price: "0",
  maxOsPerMonth: "-1",
  maxUsers: "-1",
  hasPickupDelivery: true,
  hasOnlineBudget: true,
  hasWhatsapp: true,
  hasClientPortal: true,
  hasStock: true,
  hasFinancial: true,
  hasReports: true,
  hasAdvancedCustomization: true,
  isPublic: false,
  isActive: true,
};

const featureFields: Array<{ key: keyof PlanForm; label: string }> = [
  { key: "hasPickupDelivery", label: "Coleta/entrega" },
  { key: "hasOnlineBudget", label: "Orçamento online" },
  { key: "hasWhatsapp", label: "WhatsApp" },
  { key: "hasClientPortal", label: "Portal do cliente" },
  { key: "hasStock", label: "Estoque" },
  { key: "hasFinancial", label: "Financeiro" },
  { key: "hasReports", label: "Relatórios" },
  { key: "hasAdvancedCustomization", label: "Customização avançada" },
];

function toPayload(form: PlanForm) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description || null,
    price: Number(form.price || 0),
    maxOsPerMonth: Number(form.maxOsPerMonth || 0),
    maxUsers: Number(form.maxUsers || 0),
    hasPickupDelivery: form.hasPickupDelivery,
    hasOnlineBudget: form.hasOnlineBudget,
    hasWhatsapp: form.hasWhatsapp,
    hasClientPortal: form.hasClientPortal,
    hasStock: form.hasStock,
    hasFinancial: form.hasFinancial,
    hasReports: form.hasReports,
    hasAdvancedCustomization: form.hasAdvancedCustomization,
    isPublic: form.isPublic,
    isActive: form.isActive,
  };
}

function planToForm(plan: any): PlanForm {
  return {
    name: plan.name || "",
    slug: plan.slug || "",
    description: plan.description || "",
    price: String(Number(plan.price || 0)),
    maxOsPerMonth: String(plan.maxOsPerMonth ?? 0),
    maxUsers: String(plan.maxUsers ?? 0),
    hasPickupDelivery: Boolean(plan.hasPickupDelivery),
    hasOnlineBudget: Boolean(plan.hasOnlineBudget),
    hasWhatsapp: Boolean(plan.hasWhatsapp),
    hasClientPortal: Boolean(plan.hasClientPortal),
    hasStock: Boolean(plan.hasStock),
    hasFinancial: Boolean(plan.hasFinancial),
    hasReports: Boolean(plan.hasReports),
    hasAdvancedCustomization: Boolean(plan.hasAdvancedCustomization),
    isPublic: plan.isPublic !== false,
    isActive: Boolean(plan.isActive),
  };
}

function PlanEditor({ plan, onSave, saving }: { plan: any; onSave: (id: number, form: PlanForm) => void; saving: boolean }) {
  const [form, setForm] = useState<PlanForm>(() => planToForm(plan));

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {plan.name}
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{plan.slug}</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={form.isActive ? "default" : "secondary"}>{form.isActive ? "Ativo" : "Inativo"}</Badge>
            <Badge variant={form.isPublic ? "outline" : "secondary"}>{form.isPublic ? "Público" : "Interno"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço mensal</Label>
            <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>OS/mês</Label>
            <Input type="number" min="-1" value={form.maxOsPerMonth} onChange={(e) => setForm((f) => ({ ...f, maxOsPerMonth: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Usuários</Label>
            <Input type="number" min="-1" value={form.maxUsers} onChange={(e) => setForm((f) => ({ ...f, maxUsers: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
            <span>Ativo para seleção</span>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
            <span>Mostrar no cadastro público</span>
            <Switch checked={form.isPublic} onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))} />
          </div>
          {featureFields.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
              <span>{feature.label}</span>
              <Switch checked={Boolean(form[feature.key])} onCheckedChange={(v) => setForm((f) => ({ ...f, [feature.key]: v }))} />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{Number(form.maxOsPerMonth) === -1 ? "OS ilimitadas" : `Até ${form.maxOsPerMonth} OS/mês`}</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{Number(form.maxUsers) === -1 ? "Usuários ilimitados" : `Até ${form.maxUsers} usuários`}</p>
          </div>
          <Button size="sm" onClick={() => onSave(plan.id, form)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminPlans() {
  const utils = trpc.useUtils();
  const { data: plans, isLoading } = trpc.plans.listAll.useQuery();
  const betaExists = plans?.some((plan) => plan.slug === "beta");

  const create = trpc.plans.create.useMutation({
    onSuccess: () => {
      toast.success("Plano Beta criado com sucesso");
      utils.plans.listAll.invalidate();
      utils.plans.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao criar plano"),
  });

  const update = trpc.plans.update.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso");
      utils.plans.listAll.invalidate();
      utils.plans.list.invalidate();
      utils.tenants.listPublicPlans.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar plano"),
  });

  return (
    <TenantLayout title="Planos">
      <div className="space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" /> Plano Beta para testadores
            </CardTitle>
            <CardDescription>
              Use este plano para liberar manualmente assistências que estão testando o FullReparo. Ele fica ativo para o Super Admin selecionar no tenant, mas não aparece no cadastro público quando marcado como interno.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Configuração padrão: gratuito, interno, ativo, OS ilimitadas, usuários ilimitados e recursos liberados para validação.
            </div>
            <Button onClick={() => create.mutate(toPayload(betaDefaults))} disabled={create.isPending || betaExists}>
              {betaExists ? "Plano Beta já existe" : create.isPending ? "Criando..." : "Criar Plano Beta"}
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {plans?.map((plan) => (
              <PlanEditor key={plan.id} plan={plan} saving={update.isPending} onSave={(id, form) => update.mutate({ id, ...toPayload(form) })} />
            ))}
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
