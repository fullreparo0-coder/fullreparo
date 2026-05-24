import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Wrench, Truck, Shield, BarChart3, Users, Smartphone,
  CheckCircle2, ArrowRight, Star, Zap, Globe, Lock
} from "lucide-react";

const FEATURES = [
  { icon: Wrench, title: "Gestão de OS", desc: "Controle completo do ciclo de vida de cada ordem de serviço, do balcão à entrega." },
  { icon: Truck, title: "Leva e Traz", desc: "Fluxo de coleta e entrega com rastreamento em tempo real, fotos e assinatura digital." },
  { icon: Users, title: "Multi-perfis", desc: "Atendente, técnico, entregador e cliente — cada um com acesso personalizado." },
  { icon: Shield, title: "Garantia Digital", desc: "Emissão automática de garantia vinculada à OS finalizada, consultável online." },
  { icon: BarChart3, title: "Relatórios", desc: "Métricas de desempenho, receita e produtividade para tomar melhores decisões." },
  { icon: Globe, title: "Portal do Cliente", desc: "Link público de rastreamento e aprovação de orçamento sem necessidade de login." },
];

const PLANS = [
  {
    name: "Básico",
    price: "Grátis",
    period: "para começar",
    color: "border-border",
    features: ["Até 50 OS/mês", "3 usuários", "OS no balcão", "Rastreamento público"],
    cta: "Começar grátis",
    highlight: false,
  },
  {
    name: "Profissional",
    price: "R$ 99",
    period: "/mês",
    color: "border-primary",
    features: ["Até 200 OS/mês", "10 usuários", "Leva e traz", "Portal do cliente", "Orçamento online", "WhatsApp"],
    cta: "Assinar agora",
    highlight: true,
  },
  {
    name: "Premium",
    price: "R$ 199",
    period: "/mês",
    color: "border-secondary",
    features: ["OS ilimitadas", "Usuários ilimitados", "Estoque", "Financeiro", "Relatórios avançados", "Personalização total"],
    cta: "Falar com vendas",
    highlight: false,
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Login do dono da plataforma: autentica via OAuth e redireciona para /superadmin
  const handleOwnerLogin = () => {
    window.location.href = getLoginUrl("/superadmin");
  };

  // Se já autenticado como super_admin, vai direto para o painel
  const handleCTA = () => {
    if (isAuthenticated && user?.role === "super_admin") {
      navigate("/superadmin");
    } else {
      navigate("/cadastro");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">fullreparo</span>
          </button>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated && user?.role === "super_admin" ? (
              <Button onClick={() => navigate("/superadmin")} size="sm">
                Painel <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={handleOwnerLogin}>
                  Login
                </Button>
                <Button size="sm" onClick={() => navigate("/cadastro")}>
                  Cadastrar assistência
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="container relative text-center">
          <Badge variant="secondary" className="mb-6 text-xs font-medium">
            <Zap className="mr-1 h-3 w-3" /> SaaS Multi-tenant para Assistências Técnicas
          </Badge>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
            Gerencie sua assistência
            <span className="block text-primary mt-1">com inteligência</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Do balcão à entrega, controle todo o ciclo de vida das ordens de serviço com rastreamento em tempo real, portal do cliente e garantia digital.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleCTA} className="text-base px-8">
              Começar gratuitamente <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/rastrear/demo")} className="text-base px-8">
              Ver demonstração
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Sem cartão de crédito · 14 dias de trial gratuito
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Tudo que sua assistência precisa
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Uma plataforma completa para gerenciar clientes, aparelhos, técnicos e entregas em um só lugar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card rounded-xl p-6 border border-border hover:shadow-md transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Dois fluxos, uma plataforma
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card rounded-xl p-8 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Smartphone className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-semibold">OS no Balcão</h3>
              </div>
              <ul className="space-y-3">
                {["Cadastro rápido de cliente e aparelho", "Checklist de entrada e fotos", "Geração automática de número de OS", "Impressão de etiqueta com QR Code", "Envio de comprovante via WhatsApp"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-xl p-8 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Truck className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-semibold">Leva e Traz</h3>
              </div>
              <ul className="space-y-3">
                {["Portal público para solicitar coleta", "Designação de entregador", "Confirmação com foto e assinatura digital", "Rastreamento em tempo real pelo cliente", "Aprovação de orçamento online"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">Planos e preços</h2>
            <p className="text-muted-foreground">Escolha o plano ideal para o tamanho da sua assistência.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`bg-card rounded-xl p-6 border-2 ${plan.color} ${plan.highlight ? "shadow-lg scale-105" : ""} relative`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-3">
                      <Star className="h-3 w-3 mr-1" /> Mais popular
                    </Badge>
                  </div>
                )}
                <h3 className="font-display text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={handleCTA}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="bg-primary rounded-2xl p-12 text-center text-primary-foreground">
            <Lock className="h-10 w-10 mx-auto mb-4 opacity-80" />
            <h2 className="font-display text-3xl font-bold mb-4">
              Pronto para transformar sua assistência?
            </h2>
            <p className="text-primary-foreground/80 max-w-lg mx-auto mb-8">
              Comece gratuitamente hoje. Sem cartão de crédito, sem compromisso.
            </p>
            <Button size="lg" variant="secondary" onClick={handleCTA} className="text-base px-10">
              Criar conta gratuita <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Wrench className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">fullreparo</span>
          </div>
          <p>© {new Date().getFullYear()} fullreparo. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="/garantia" className="hover:text-foreground">Verificar Garantia</a>
            <a href="/rastrear/demo" className="hover:text-foreground">Rastrear OS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
