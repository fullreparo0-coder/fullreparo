import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Login realizado com sucesso!");
      window.location.href = "/superadmin";
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === "super_admin") {
        navigate("/superadmin", { replace: true });
      } else {
        navigate("/painel/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, loading, user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Wrench className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground">fullreparo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel do Administrador
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@fullreparo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-muted/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-muted/30"
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Entrar no sistema
          </Button>
        </form>

        <p className="mt-8 text-[10px] text-center text-muted-foreground uppercase tracking-widest opacity-50">
          Acesso Restrito
        </p>
      </div>
    </div>
  );
}
