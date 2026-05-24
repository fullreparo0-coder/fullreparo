import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Building2, ArrowLeft, Save, MapPin, Mail, Phone, 
  FileText, ShieldCheck, Users, BarChart3, Globe, Lock, Unlock 
} from "lucide-react";

export default function SuperAdminTenantDetail() {
  const [, params] = useRoute("/superadmin/tenants/:id");
  const [, navigate] = useLocation();
  const tenantId = params?.id ? parseInt(params.id) : null;
  const utils = trpc.useUtils();

  const { data: tenant, isLoading } = trpc.tenants.getById.useQuery(
    { id: tenantId! },
    { enabled: !!tenantId }
  );
  
  const { data: plans } = trpc.plans.list.useQuery();

  const update = trpc.tenants.update.useMutation({
    onSuccess: () => {
      toast.success("Informações atualizadas com sucesso");
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar informações"),
  });

  const toggleStatus = trpc.tenants.toggleStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      utils.tenants.getById.invalidate({ id: tenantId! });
    },
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    planId: "",
    status: "",
    trialEndsAt: "",
    subscriptionEndsAt: ""
  });

  const toDateTimeLocal = (value?: string | Date | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        document: tenant.document || "",
        address: tenant.address || "",
        city: tenant.city || "",
        state: tenant.state || "",
        zipCode: tenant.zipCode || "",
        planId: String(tenant.planId || "1"),
        status: tenant.status || "active",
        trialEndsAt: toDateTimeLocal((tenant as any).trialEndsAt),
        subscriptionEndsAt: toDateTimeLocal((tenant as any).subscriptionEndsAt)
      });
    }
  }, [tenant]);

  if (isLoading) {
    return (
      <TenantLayout title="Carregando...">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </TenantLayout>
    );
  }

  if (!tenant) {
    return (
      <TenantLayout title="Erro">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Assistência não encontrada.</p>
          <Button variant="link" onClick={() => navigate("/superadmin/tenants")}>Voltar para a lista</Button>
        </div>
      </TenantLayout>
    );
  }

  const handleSave = () => {
    update.mutate({
      id: tenantId!,
      ...form,
      planId: parseInt(form.planId),
      status: form.status as any,
      trialEndsAt: form.trialEndsAt ? new Date(form.trialEndsAt).getTime() : null,
      subscriptionEndsAt: form.subscriptionEndsAt ? new Date(form.subscriptionEndsAt).getTime() : null
    });
  };

  return (
    <TenantLayout title={`Detalhes: ${tenant.name}`}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/tenants")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => toggleStatus.mutate({ 
                id: tenant.id, 
                status: tenant.status === "active" ? "blocked" : "active" 
              })}
            >
              {tenant.status === "active" ? (
                <><Lock className="h-4 w-4 mr-2" /> Bloquear</>
              ) : (
                <><Unlock className="h-4 w-4 mr-2" /> Ativar</>
              )}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {update.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Resumo e Métricas */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col items-center text-center">
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    {tenant.logoUrl ? (
                      <img src={tenant.logoUrl} alt={tenant.name} className="h-16 w-16 object-contain" />
                    ) : (
                      <Building2 className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <CardTitle className="text-xl">{tenant.name}</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">{tenant.slug}.fullreparo.com.br</CardDescription>
                  <Badge variant={tenant.status === "active" ? "default" : tenant.status === "trial" ? "secondary" : "destructive"} className="mt-3">
                    {tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Em teste" : tenant.status === "suspended" ? "Suspenso" : "Bloqueado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="border-t pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">{(tenant as any).metrics?.users || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Usuários</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold">—</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Total OS</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-2 text-primary" /> Assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Plano Atual</Label>
                  <Select value={form.planId} onValueChange={(v) => setForm(f => ({ ...f, planId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status da assinatura</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Em teste</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fim do teste grátis</Label>
                  <Input type="datetime-local" value={form.trialEndsAt} onChange={e => setForm(f => ({ ...f, trialEndsAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim da assinatura</Label>
                  <Input type="datetime-local" value={form.subscriptionEndsAt} onChange={e => setForm(f => ({ ...f, subscriptionEndsAt: e.target.value }))} />
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    O super admin pode alterar plano, status e datas. Trocas de plano disparam notificação para a assistência e registro interno.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Criado em: {new Date(tenant.createdAt!).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna da Direita: Dados Cadastrais */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary" /> Dados Cadastrais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome da Assistência</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF ou CNPJ</Label>
                    <Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail de Contato</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary" /> Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 space-y-1.5">
                    <Label>CEP</Label>
                    <Input value={form.zipCode} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Logradouro / Número / Bairro</Label>
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Cidade</Label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado (UF)</Label>
                    <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Globe className="h-5 w-5 mr-2 text-primary" /> Presença Online
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Subdomínio</Label>
                    <div className="flex items-center gap-2">
                      <Input value={tenant.slug} disabled />
                      <span className="text-sm text-muted-foreground">.fullreparo.com.br</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Domínio Customizado</Label>
                    <Input value={tenant.customDomain || "Nenhum configurado"} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
