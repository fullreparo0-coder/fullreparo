import { useMemo, type ElementType } from "react";
import { useLocation } from "wouter";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Cog,
  GraduationCap,
  MessageCircle,
  MonitorPlay,
  Package,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { TenantLayout } from "@/components/TenantLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type Step = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  icon: ElementType;
  roles?: string[];
};

type Tutorial = {
  title: string;
  audience: string;
  description: string;
  steps: string[];
  icon: ElementType;
  roles?: string[];
};

type TrainingSlide = {
  title: string;
  subtitle: string;
  duration: string;
  topics: string[];
  accent: string;
  roles?: string[];
};

const ADMIN_ROLES = ["tenant_admin", "admin", "super_admin"];
const OPERATIONAL_ROLES = ["tenant_admin", "admin", "super_admin", "atendente", "tecnico", "entregador"];

const setupSteps: Step[] = [
  {
    title: "Configure a identidade da assistência",
    description: "Complete nome, telefone, WhatsApp, endereço, horários, logo, cores e redes sociais para deixar o portal público pronto para seus clientes.",
    actionLabel: "Abrir configurações",
    href: "/painel/configuracoes",
    icon: Cog,
    roles: ADMIN_ROLES,
  },
  {
    title: "Cadastre sua equipe",
    description: "Crie acessos locais para atendentes, técnicos e entregadores. Cada membro entra pelo link da própria assistência.",
    actionLabel: "Cadastrar equipe",
    href: "/painel/usuarios",
    icon: Users,
    roles: ADMIN_ROLES,
  },
  {
    title: "Revise o checklist técnico",
    description: "Padronize inspeções, conferências e etapas de diagnóstico para reduzir erros na entrada e saída dos aparelhos.",
    actionLabel: "Editar checklist",
    href: "/painel/checklist",
    icon: ClipboardList,
    roles: ADMIN_ROLES,
  },
  {
    title: "Crie a primeira ordem de serviço",
    description: "Registre cliente, equipamento, defeito relatado, acessórios, fotos e responsáveis para iniciar o fluxo operacional.",
    actionLabel: "Nova OS",
    href: "/painel/os/nova",
    icon: Wrench,
  },
  {
    title: "Acompanhe o dia pela Central do Dia",
    description: "Use a central para priorizar atendimentos, coletas, entregas, orçamentos pendentes e tarefas importantes.",
    actionLabel: "Abrir central",
    href: "/painel/central-do-dia",
    icon: CheckCircle2,
  },
];

const tutorials: Tutorial[] = [
  {
    title: "Fluxo completo da ordem de serviço",
    audience: "Atendimento e administração",
    description: "Este tutorial ensina como abrir, acompanhar e concluir uma OS sem perder histórico, comunicação e rastreabilidade.",
    icon: ClipboardList,
    steps: [
      "Abra uma nova OS e confirme os dados do cliente antes de registrar o equipamento.",
      "Descreva defeito relatado, acessórios recebidos e condições visuais do aparelho.",
      "Atribua técnico, acompanhe status e registre observações internas sempre que houver mudança relevante.",
      "Finalize somente depois de atualizar orçamento, garantia, retirada, entrega ou coleta, conforme o caso.",
    ],
  },
  {
    title: "Configuração inicial da assistência",
    audience: "Dono ou admin da assistência",
    description: "Checklist de configuração para deixar o portal da loja pronto antes de divulgar o link para clientes.",
    icon: ShieldCheck,
    roles: ADMIN_ROLES,
    steps: [
      "Acesse Configurações e revise dados comerciais, endereço, telefone, WhatsApp e redes sociais.",
      "Envie logo, escolha cores e confirme como o portal público aparece no link da assistência.",
      "Cadastre membros da equipe com senha local e perfil correto: atendente, técnico ou entregador.",
      "Revise checklist, termos, mensagens e notificações antes de operar em produção.",
    ],
  },
  {
    title: "Atendimento ao cliente no balcão",
    audience: "Atendentes",
    description: "Boas práticas para registrar entradas, responder dúvidas e manter o cliente informado pelo portal.",
    icon: MessageCircle,
    roles: ["tenant_admin", "admin", "super_admin", "atendente"],
    steps: [
      "Localize ou cadastre o cliente usando CPF, telefone e e-mail corretos.",
      "Explique que o acompanhamento pode ser feito pelo portal da assistência com CPF/e-mail e senha.",
      "Registre todas as informações combinadas para evitar divergência na retirada.",
      "Use status e observações para manter a equipe técnica alinhada.",
    ],
  },
  {
    title: "Rotina do técnico",
    audience: "Técnicos",
    description: "Como o técnico deve usar o painel para manter diagnóstico, orçamento e execução organizados.",
    icon: Wrench,
    roles: ["tenant_admin", "admin", "super_admin", "tecnico"],
    steps: [
      "Abra a OS atribuída e revise defeito relatado, acessórios e checklist de entrada.",
      "Registre diagnóstico, peças necessárias, risco técnico e observações internas.",
      "Atualize status quando aguardar aprovação, peça, reparo, teste ou retirada.",
      "Finalize o serviço com conferência e informações de garantia.",
    ],
  },
  {
    title: "Coletas e entregas",
    audience: "Entregadores e operação",
    description: "Orientação para controlar aparelhos fora da loja com segurança e rastreabilidade.",
    icon: Truck,
    roles: ["tenant_admin", "admin", "super_admin", "entregador"],
    steps: [
      "Consulte coletas pendentes pela Central do Dia ou pelo painel de entregador.",
      "Confirme endereço, contato do cliente e observações antes de sair para a rota.",
      "Atualize o status assim que coletar ou entregar o aparelho.",
      "Registre qualquer divergência, ausência do cliente ou impossibilidade de entrega.",
    ],
  },
  {
    title: "Controle de estoque básico",
    audience: "Administração e técnicos autorizados",
    description: "Como consultar peças, reduzir perdas e manter disponibilidade para orçamentos e reparos.",
    icon: Package,
    roles: ["tenant_admin", "admin", "super_admin", "tecnico"],
    steps: [
      "Cadastre peças com nome claro, custo, venda e quantidade disponível.",
      "Consulte estoque antes de prometer prazo ao cliente.",
      "Atualize movimentações quando uma peça for usada em reparo.",
      "Revise itens críticos com frequência para evitar parada operacional.",
    ],
  },
];

const trainingSlides: TrainingSlide[] = [
  {
    title: "Boas-vindas ao painel da assistência",
    subtitle: "Visão geral do FullReparo para donos e equipe",
    duration: "5 min",
    accent: "from-blue-600 to-cyan-500",
    topics: ["Portal da loja", "Papéis de acesso", "Fluxo operacional", "Onde buscar ajuda"],
  },
  {
    title: "Configuração inicial em 5 etapas",
    subtitle: "Da identidade da loja ao primeiro atendimento",
    duration: "8 min",
    accent: "from-violet-600 to-fuchsia-500",
    roles: ADMIN_ROLES,
    topics: ["Dados da assistência", "WhatsApp e endereço", "Equipe", "Checklist", "Divulgação do link"],
  },
  {
    title: "Treinamento do atendimento",
    subtitle: "Como abrir OS e orientar o cliente",
    duration: "10 min",
    accent: "from-emerald-600 to-teal-500",
    roles: ["tenant_admin", "admin", "super_admin", "atendente"],
    topics: ["Cadastro do cliente", "Entrada do aparelho", "Status da OS", "Comunicação clara"],
  },
  {
    title: "Treinamento técnico",
    subtitle: "Diagnóstico, orçamento, execução e garantia",
    duration: "10 min",
    accent: "from-amber-600 to-orange-500",
    roles: ["tenant_admin", "admin", "super_admin", "tecnico"],
    topics: ["Checklist técnico", "Diagnóstico", "Peças", "Testes finais", "Garantia"],
  },
  {
    title: "Treinamento de coleta e entrega",
    subtitle: "Rotina segura para aparelhos em trânsito",
    duration: "7 min",
    accent: "from-slate-700 to-slate-500",
    roles: ["tenant_admin", "admin", "super_admin", "entregador"],
    topics: ["Rotas", "Confirmação de endereço", "Atualização de status", "Ocorrências"],
  },
];

function canSee(role: string | undefined, roles?: string[]) {
  if (!roles || roles.length === 0) return true;
  return roles.includes(role ?? "");
}

export default function HelpTraining() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const visibleSteps = useMemo(
    () => setupSteps.filter((step) => canSee(user?.role, step.roles)),
    [user?.role]
  );
  const visibleTutorials = useMemo(
    () => tutorials.filter((tutorial) => canSee(user?.role, tutorial.roles)),
    [user?.role]
  );
  const visibleSlides = useMemo(
    () => trainingSlides.filter((slide) => canSee(user?.role, slide.roles)),
    [user?.role]
  );

  return (
    <TenantLayout title="Ajuda e Treinamento">
      <div className="space-y-6 max-w-6xl mx-auto">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 lg:p-8 overflow-hidden relative">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.35),transparent_55%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] items-center">
            <div className="space-y-4">
              <Badge className="bg-white/10 text-white hover:bg-white/10 border-white/20">
                Central de aprendizado do tenant
              </Badge>
              <div>
                <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
                  Aprenda a configurar e operar sua assistência
                </h1>
                <p className="mt-3 text-sm lg:text-base text-white/75 max-w-2xl">
                  Use esta área para treinar dono, atendentes, técnicos e entregadores. O tutorial web serve para consulta rápida, enquanto os cards de slides organizam o treinamento formal da equipe.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => navigate("/painel/configuracoes")}>Começar configuração</Button>
                <Button variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white" onClick={() => navigate("/painel/os/nova")}>Criar primeira OS</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Primeiros passos", visibleSteps.length],
                ["Tutoriais", visibleTutorials.length],
                ["Treinamentos", visibleSlides.length],
                ["Perfil", user?.role ?? "equipe"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur">
                  <p className="text-xs text-white/60">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Tabs defaultValue="primeiros-passos" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full lg:w-[620px]">
            <TabsTrigger value="primeiros-passos">Primeiros Passos</TabsTrigger>
            <TabsTrigger value="tutoriais">Tutoriais</TabsTrigger>
            <TabsTrigger value="slides">Slides</TabsTrigger>
          </TabsList>

          <TabsContent value="primeiros-passos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-600" /> Configuração recomendada</CardTitle>
                <CardDescription>
                  Siga esta sequência para deixar a assistência pronta para operar e para receber clientes pelo portal público.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleSteps.map((step, index) => (
                    <Card key={step.title} className="border-slate-200 shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                            <step.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <Badge variant="outline" className="mb-2">Etapa {index + 1}</Badge>
                            <CardTitle className="text-base leading-tight">{step.title}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground min-h-[60px]">{step.description}</p>
                        <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(step.href)}>
                          {step.actionLabel}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tutoriais" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600" /> Tutorial web operacional</CardTitle>
                <CardDescription>
                  Consulte os procedimentos essenciais por função. O conteúdo exibido respeita o perfil do usuário logado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {visibleTutorials.map((tutorial, index) => (
                    <AccordionItem key={tutorial.title} value={`tutorial-${index}`}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                            <tutorial.icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold">{tutorial.title}</p>
                            <p className="text-xs text-muted-foreground">{tutorial.audience}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-12 space-y-4">
                          <p className="text-sm text-muted-foreground">{tutorial.description}</p>
                          <div className="space-y-2">
                            {tutorial.steps.map((step, stepIndex) => (
                              <div key={step} className="flex gap-3 rounded-xl border bg-white p-3">
                                <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                  {stepIndex + 1}
                                </div>
                                <p className="text-sm text-slate-700">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="slides" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MonitorPlay className="h-5 w-5 text-blue-600" /> Slides de treinamento</CardTitle>
                <CardDescription>
                  Estrutura pronta para treinamento interno. Cada card funciona como um módulo de apresentação para onboarding da equipe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleSlides.map((slide, index) => (
                    <div key={slide.title} className="rounded-2xl border bg-white overflow-hidden shadow-sm">
                      <div className={cn("h-28 p-5 text-white bg-gradient-to-br", slide.accent)}>
                        <div className="flex items-center justify-between">
                          <Badge className="bg-white/20 text-white hover:bg-white/20 border-white/20">Módulo {index + 1}</Badge>
                          <span className="text-xs text-white/80">{slide.duration}</span>
                        </div>
                        <h3 className="font-display font-bold text-lg mt-4 leading-tight">{slide.title}</h3>
                      </div>
                      <div className="p-5 space-y-4">
                        <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
                        <div className="space-y-2">
                          {slide.topics.map((topic) => (
                            <div key={topic} className="flex items-center gap-2 text-sm">
                              <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                              <span>{topic}</span>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" className="w-full" onClick={() => window.print()}>
                          Imprimir / salvar módulo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TenantLayout>
  );
}
