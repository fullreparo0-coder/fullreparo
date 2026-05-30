import { useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Building2, Lock, Unlock, LogIn, Eye, KeyRound, Copy, AlertTriangle, Clock3 } from "lucide-react";
import { useLocation } from "wouter";

type ProvisionalPasswordResult = {
  tenantName: string;
  adminName: string;
  adminEmail: string;
  plainPassword: string;
  loginUrl: string;
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
};

const daysUntil = (value?: string | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const statusLabel: Record<string, string> = {
  active: "Ativo",
  trial: "Teste",
  suspended: "Suspenso",
  blocked: "Bloqueado",
};

export default function SuperAdminTenants() {
  const [open, setOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [provisionalPassword, setProvisionalPassword] = useState<ProvisionalPasswordResult | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", planId: "1" });
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const { data: tenants, isLoading } = trpc.tenants.list.useQuery();
  const { data: plans } = trpc.plans.list.useQuery();
  const create = trpc.tenants.create.useMutation({
    onSuccess: () => {
      toast.success("Assistência criada");
      setOpen(false);
      utils.tenants.list.invalidate();
    },
    onError: () => toast.error("Erro ao criar assistência"),
  });
  const betaPlan = plans?.find((p) => p.slug === "beta" || p.name.toLowerCase() === "beta");
  const getPlanName = (planId: number | null | undefined) => plans?.find((p) => p.id === planId)?.name ?? (planId ? `Plano ${planId}` : "—");

  const toggleStatus = trpc.tenants.toggleStatus.useMutation({
    onSuccess: () => utils.tenants.list.invalidate(),
  });
  const activateBetaPlan = trpc.tenants.activateBetaPlan.useMutation({
    onSuccess: (data) => {
      toast.success(`Assistência ativada no ${data.planName}`);
      utils.tenants.list.invalidate();
    },
    onError: (error) => toast.error(error.message || "Erro ao ativar Plano Beta"),
  });
  const switchTenant = trpc.tenants.switchTenant.useMutation({
    onSuccess: async (data) => {
      toast.success(`Operando como: ${data.tenantName}`);
      // Refetch explícito de auth.me para garantir que tenantId está atualizado antes de navegar
      await utils.auth.me.refetch();
      navigate("/painel/dashboard");
    },
    onError: () => toast.error("Erro ao selecionar assistência"),
  });
  const generateTenantPassword = trpc.tenants.generateTenantAdminProvisionalPassword.useMutation({
    onSuccess: (data) => {
      setProvisionalPassword({
        tenantName: data.tenantName,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        plainPassword: data.plainPassword,
        loginUrl: data.loginUrl,
      });
      setPasswordDialogOpen(true);
      toast.success("Senha provisória gerada");
    },
    onError: (error) => toast.error(error.message || "Erro ao gerar senha provisória"),
  });

  return (
    <TenantLayout title="Assistências">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" /> Nova Assistência</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Assistência</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome *</Label>
                  <Input className="mt-1.5" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="TechFix SP" />
                </div>
                <div>
                  <Label>Slug (URL) *</Label>
                  <Input className="mt-1.5" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, "-") }))} placeholder="techfix-sp" />
                  <p className="text-xs text-muted-foreground mt-1">Portal: <span className="font-mono">{form.slug ? `${form.slug}.fullreparo.com.br` : "slug.fullreparo.com.br"}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>E-mail</Label>
                    <Input className="mt-1.5" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input className="mt-1.5" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Plano</Label>
                  <Select value={form.planId} onValueChange={(v) => setForm(f => ({ ...f, planId: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => create.mutate({ ...form, planId: parseInt(form.planId) })} disabled={!form.name || !form.slug || create.isPending}>
                  {create.isPending ? "Criando..." : "Criar Assistência"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Senha provisória gerada</DialogTitle>
            </DialogHeader>
            {provisionalPassword && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
                  <p><span className="font-medium">Assistência:</span> {provisionalPassword.tenantName}</p>
                  <p><span className="font-medium">Administrador:</span> {provisionalPassword.adminName}</p>
                  <p><span className="font-medium">E-mail de login:</span> {provisionalPassword.adminEmail}</p>
                  <p><span className="font-medium">Link:</span> {provisionalPassword.loginUrl}</p>
                </div>
                <div>
                  <Label>Senha provisória</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input value={provisionalPassword.plainPassword} readOnly className="font-mono text-base" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(provisionalPassword.plainPassword);
                        toast.success("Senha copiada");
                      }}
                    >
                      <Copy className="h-4 w-4 mr-1.5" /> Copiar
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Entregue esta senha ao administrador da assistência por um canal seguro. Após o acesso, oriente a troca da senha no painel.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : !tenants || tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma assistência cadastrada</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden lg:grid grid-cols-[1.6fr_0.9fr_1fr_1.1fr_1.3fr_auto] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30">
                  <span>Nome</span>
                  <span>Slug</span>
                  <span>Plano</span>
                  <span>Status</span>
                  <span>Governança</span>
                  <span>Ações</span>
                </div>
                {tenants.map((t) => {
                  const isBetaTenant = !!betaPlan && t.planId === betaPlan.id;
                  const trialDays = daysUntil(t.trialEndsAt);
                  const subscriptionDays = daysUntil(t.subscriptionEndsAt);
                  const needsWhatsapp = !t.whatsappNumber;
                  const isExpiring = (t.status === "trial" && trialDays !== null && trialDays <= 3) || (t.status === "active" && subscriptionDays !== null && subscriptionDays <= 7);
                  return (
                  <div key={t.id} className="grid grid-cols-1 lg:grid-cols-[1.6fr_0.9fr_1fr_1.1fr_1.3fr_auto] gap-2 lg:gap-4 px-5 py-4 items-center">
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      {t.email && <p className="text-xs text-muted-foreground">{t.email}</p>}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{t.slug}</span>
                    <span className="text-xs text-muted-foreground">{getPlanName(t.planId)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={isBetaTenant ? "secondary" : t.status === "active" || t.status === "trial" ? "default" : "destructive"} className="w-fit text-xs">
                        {isBetaTenant ? "Beta" : statusLabel[t.status] ?? t.status}
                      </Badge>
                      {isExpiring && <Badge variant="outline" className="w-fit text-xs"><Clock3 className="h-3 w-3 mr-1" /> Vencimento próximo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Teste: {formatDate(t.trialEndsAt)}</p>
                      <p>Assinatura: {formatDate(t.subscriptionEndsAt)}</p>
                      {needsWhatsapp && <p className="flex items-center text-amber-700"><AlertTriangle className="h-3 w-3 mr-1" /> WhatsApp sem número</p>}
                    </div>
	                    <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
	                      <Button
	                        size="sm"
	                        variant="outline"
	                        onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
	                        title="Ver detalhes completos"
	                      >
	                        <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
	                      </Button>
	                                            <Button
                        size="sm"
                        variant="default"
                        onClick={() => switchTenant.mutate({ tenantId: t.id })}
                        disabled={switchTenant.isPending}
                        title="Operar como este tenant"
                      >
                        <LogIn className="h-3.5 w-3.5 mr-1" /> Operar
                      </Button>
                      <Button
                        size="sm"
                        variant={isBetaTenant ? "secondary" : "outline"}
                        onClick={() => {
                          if (!betaPlan) {
                            toast.error("Plano Beta não encontrado. Crie o Plano Beta em Super Admin → Planos.");
                            return;
                          }
                          if (window.confirm(`Ativar ${t.name} no Plano Beta?`)) {
                            activateBetaPlan.mutate({ id: t.id });
                          }
                        }}
                        disabled={!betaPlan || isBetaTenant || activateBetaPlan.isPending}
                        title={isBetaTenant ? "Esta assistência já está no Plano Beta" : "Ativar esta assistência no Plano Beta"}
                      >
                        {isBetaTenant ? "Beta ativo" : "Ativar Beta"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateTenantPassword.mutate({ tenantId: t.id })}
                        disabled={generateTenantPassword.isPending}
                        title="Gerar senha provisória para o administrador da assistência"
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1" /> Senha
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleStatus.mutate({ id: t.id, status: t.status === "active" ? "blocked" : "active" })}
                      >

	                        {t.status === "active" ? (
	                          <><Lock className="h-3.5 w-3.5 mr-1" /> Bloquear</>
	                        ) : (
	                          <><Unlock className="h-3.5 w-3.5 mr-1" /> Ativar</>
	                        )}
	                      </Button>
	                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantLayout>
  );
}
