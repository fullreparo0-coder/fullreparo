import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Building2, Users, Package, ArrowRight, ShieldCheck, CheckSquare } from "lucide-react";

export default function SuperAdminDashboard() {
  const [, navigate] = useLocation();
  const { data: tenants } = trpc.tenants.list.useQuery();
  const { data: plans } = trpc.plans.list.useQuery();

  const active = tenants?.filter((t) => t.status === "active").length ?? 0;
  const blocked = tenants?.filter((t) => t.status === "blocked").length ?? 0;

  return (
    <TenantLayout title="Super Admin">
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Painel de Administração Global</p>
            <p className="text-sm text-muted-foreground">Gerencie todas as assistências e planos da plataforma</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total de Assistências</p>
                  <p className="text-3xl font-bold font-display">{tenants?.length ?? 0}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ativas</p>
                  <p className="text-3xl font-bold font-display text-emerald-600">{active}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Planos</p>
                  <p className="text-3xl font-bold font-display">{plans?.length ?? 0}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/20">
                  <Package className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" className="h-auto py-5 flex-col gap-2" onClick={() => navigate("/superadmin/tenants")}>
            <Building2 className="h-6 w-6 text-primary" />
            <span>Gerenciar Assistências</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="outline" className="h-auto py-5 flex-col gap-2" onClick={() => navigate("/superadmin/plans")}>
            <Package className="h-6 w-6 text-secondary-foreground" />
            <span>Gerenciar Planos</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="outline" className="h-auto py-5 flex-col gap-2 col-span-2" onClick={() => navigate("/superadmin/checklist")}>
            <CheckSquare className="h-6 w-6 text-primary" />
            <span>Checklist Padrão de OS</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </TenantLayout>
  );
}
