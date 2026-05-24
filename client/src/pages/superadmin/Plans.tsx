import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Package, CheckCircle2 } from "lucide-react";

export default function SuperAdminPlans() {
  const { data: plans, isLoading } = trpc.plans.list.useQuery();

  return (
    <TenantLayout title="Planos">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans?.map((plan) => (
              <Card key={plan.id} className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      {plan.name}
                    </CardTitle>
                    <Badge variant={plan.isActive ? "default" : "secondary"}>
                      {plan.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold font-display">
                    {plan.price === "0" ? "Grátis" : `R$ ${Number(plan.price).toFixed(2)}`}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    {plan.maxOsPerMonth === -1 ? "OS ilimitadas" : `Até ${plan.maxOsPerMonth} OS/mês`}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    {plan.maxUsers === -1 ? "Usuários ilimitados" : `Até ${plan.maxUsers} usuários`}
                  </div>
                  {plan.description && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Descrição:</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
