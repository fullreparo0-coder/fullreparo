import { useState } from "react";
import { useLocation } from "wouter";
import { getTenantPortalUrl } from "@shared/tenantUrl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import {
  Wrench, ArrowRight, ArrowLeft, Check, Building2,
  Mail, Phone, MapPin, Package, Zap, Star, CheckCircle2,
  Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePassword } from "@shared/passwordRules";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Plan = {
  id: number;
  name: string;
  slug: string;
  price: string;
  maxUsers: number;
  maxOsPerMonth: number;
  hasPickupDelivery: boolean;
  hasOnlineBudget: boolean;
  hasWhatsapp: boolean;
  hasClientPortal: boolean;
  hasStock: boolean;
  hasFinancial: boolean;
  hasReports: boolean;
  hasAdvancedCustomization: boolean;
};

type FormData = {
  name: string;
  document: string;
  email: string;
  phone: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressReference: string;
  city: string;
  state: string;
  zipCode: string;
  password: string;
  confirmPassword: string;
  planId: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Empresa" },
  { id: 2, label: "Plano" },
  { id: 3, label: "Confirmação" },
];

const PLAN_ICONS: Record<string, React.ElementType> = {
  basico: Package,
  profissional: Zap,
  premium: Star,
};

const PLAN_COLORS: Record<string, string> = {
  basico: "from-slate-500 to-slate-700",
  profissional: "from-primary to-blue-700",
  premium: "from-amber-500 to-amber-700",
};

const FEATURE_LABELS: Record<string, string> = {
  hasPickupDelivery: "Leva e traz",
  hasOnlineBudget: "Orçamento online",
  hasWhatsapp: "Integração WhatsApp",
  hasClientPortal: "Portal do cliente",
  hasStock: "Controle de estoque",
  hasFinancial: "Módulo financeiro",
  hasReports: "Relatórios avançados",
  hasAdvancedCustomization: "Personalização avançada",
};

const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlugPreview(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  // CNPJ
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CadastroPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<{ slug: string; name: string; claimToken: string; planName?: string; trialEndsAt?: number; loginUrl?: string; dashboardUrl?: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [form, setForm] = useState<FormData>({
    name: "",
    document: "",
    email: "",
    phone: "",
    addressStreet: "",
    addressNumber: "",
    addressNeighborhood: "",
    addressReference: "",
    city: "",
    state: "",
    zipCode: "",
    password: "",
    confirmPassword: "",
    planId: 1,
  });

  const { data: plans = [], isLoading: loadingPlans } = trpc.tenants.listPublicPlans.useQuery();

  const register = trpc.tenants.register.useMutation({
    onSuccess: (data) => {
      setResult({
        slug: data.slug,
        name: data.name,
        claimToken: data.claimToken ?? "",
        planName: data.planName,
        trialEndsAt: data.trialEndsAt,
        loginUrl: data.loginUrl,
        dashboardUrl: data.dashboardUrl,
      });
      setStep(3);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cadastrar. Tente novamente.");
    },
  });

  const slugPreview = generateSlugPreview(form.name);

  // ─── Validação step 1 ─────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const newErrors: typeof errors = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      newErrors.name = "Nome deve ter ao menos 2 caracteres";
    
    const docDigits = form.document.replace(/\D/g, "");
    if (!docDigits || (docDigits.length !== 11 && docDigits.length !== 14))
      newErrors.document = "Documento obrigatório (CPF ou CNPJ)";

    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "E-mail inválido";
    if (!form.phone.replace(/\D/g, "") || form.phone.replace(/\D/g, "").length < 8)
      newErrors.phone = "Telefone inválido";
    
    if (!form.zipCode.replace(/\D/g, "") || form.zipCode.replace(/\D/g, "").length < 8)
      newErrors.zipCode = "CEP obrigatório";
    if (!form.addressStreet.trim() || form.addressStreet.trim().length < 3)
      newErrors.addressStreet = "Rua obrigatória";
    if (!form.addressNumber.trim())
      newErrors.addressNumber = "Número obrigatório";
    if (!form.city.trim() || form.city.trim().length < 2)
      newErrors.city = "Cidade obrigatória";
    if (!form.state)
      newErrors.state = "UF obrigatória";

    const passwordErrors = validatePassword(form.password);
    if (passwordErrors.length > 0)
      newErrors.password = `Senha deve conter: ${passwordErrors.join(", ")}`;
    if (!form.confirmPassword)
      newErrors.confirmPassword = "Confirme sua senha";
    else if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "As senhas não conferem";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
  }

  function handleSubmit() {
    register.mutate({
      name: form.name.trim(),
      document: form.document.replace(/\D/g, ""),
      email: form.email.trim(),
      phone: form.phone.replace(/\D/g, ""),
      addressStreet: form.addressStreet.trim(),
      addressNumber: form.addressNumber.trim(),
      addressNeighborhood: form.addressNeighborhood.trim() || undefined,
      addressReference: form.addressReference.trim() || undefined,
      city: form.city.trim(),
      state: form.state,
      zipCode: form.zipCode.replace(/\D/g, ""),
      password: form.password,
      confirmPassword: form.confirmPassword,
      planId: form.planId,
    });
  }

  async function handleZipCodeBlur() {
    const digits = form.zipCode.replace(/\D/g, "");
    if (digits.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data?.erro) return;
      setForm((current) => ({
        ...current,
        addressStreet: current.addressStreet || data.logradouro || "",
        addressNeighborhood: current.addressNeighborhood || data.bairro || "",
        city: current.city || data.localidade || "",
        state: current.state || data.uf || "",
      }));
    } catch {
      // A busca por CEP é auxiliar; o usuário pode preencher manualmente.
    }
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  const selectedPlan = plans.find((p) => p.id === form.planId);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-primary font-display font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            fullreparo
          </button>
          <span className="text-sm text-muted-foreground">
            Já tem conta?{" "}
            <a href="/login" className="text-primary font-medium hover:underline">
              Entrar
            </a>
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Título */}
        {step < 3 && (
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Cadastre sua assistência
            </h1>
            <p className="text-muted-foreground">
              Configure sua conta em menos de 2 minutos e comece a usar gratuitamente.
            </p>
          </div>
        )}

        {/* Stepper */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-0 mb-8">
            {STEPS.filter((s) => s.id < 3).map((s, idx) => (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                      step > s.id
                        ? "bg-emerald-500 text-white"
                        : step === s.id
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "bg-slate-200 text-slate-400"
                    )}
                  >
                    {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      step === s.id ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.filter((s) => s.id < 3).length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-16 mx-2 mb-4 transition-all",
                      step > s.id ? "bg-emerald-400" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Step 1: Dados da empresa ─────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Dados da empresa</h2>
            </div>
            <Separator />

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nome da assistência <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: TechFix Assistência Técnica"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              {form.name.length >= 2 && (
                <p className="text-xs text-muted-foreground">
                  Seu link público será:{" "}
                  <span className="font-mono text-primary">
                    {getTenantPortalUrl(slugPreview)}
                  </span>
                </p>
              )}
            </div>

            {/* CNPJ/CPF */}
            <div className="space-y-1.5">
              <Label htmlFor="document">
                CNPJ ou CPF <span className="text-destructive">*</span>
              </Label>
              <Input
                id="document"
                placeholder="00.000.000/0000-00"
                value={form.document}
                onChange={(e) => updateField("document", formatDocument(e.target.value))}
                className={cn(errors.document && "border-destructive")}
              />
              {errors.document && <p className="text-xs text-destructive">{errors.document}</p>}
            </div>

            {/* E-mail e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  E-mail <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@suaassistencia.com"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={cn("pl-9", errors.email && "border-destructive")}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Telefone / WhatsApp <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                    className={cn("pl-9", errors.phone && "border-destructive")}
                  />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>

            {/* Endereço completo */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1 space-y-1.5">
                  <Label htmlFor="zipCode">
                    CEP <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="zipCode"
                    placeholder="00000-000"
                    value={form.zipCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const masked = val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val;
                      updateField("zipCode", masked);
                    }}
                    onBlur={handleZipCodeBlur}
                    className={cn(errors.zipCode && "border-destructive")}
                  />
                  {errors.zipCode && <p className="text-xs text-destructive">{errors.zipCode}</p>}
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="addressStreet">
                    Rua <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="addressStreet"
                    placeholder="Rua, avenida ou travessa"
                    value={form.addressStreet}
                    onChange={(e) => updateField("addressStreet", e.target.value)}
                    className={cn(errors.addressStreet && "border-destructive")}
                  />
                  {errors.addressStreet && <p className="text-xs text-destructive">{errors.addressStreet}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="addressNumber">
                    Número <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="addressNumber"
                    placeholder="123 ou S/N"
                    value={form.addressNumber}
                    onChange={(e) => updateField("addressNumber", e.target.value)}
                    className={cn(errors.addressNumber && "border-destructive")}
                  />
                  {errors.addressNumber && <p className="text-xs text-destructive">{errors.addressNumber}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addressNeighborhood">Bairro</Label>
                  <Input
                    id="addressNeighborhood"
                    placeholder="Centro"
                    value={form.addressNeighborhood}
                    onChange={(e) => updateField("addressNeighborhood", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addressReference">Ponto de referência</Label>
                  <Input
                    id="addressReference"
                    placeholder="Próximo à praça"
                    value={form.addressReference}
                    onChange={(e) => updateField("addressReference", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Cidade e Estado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">
                  Cidade <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="city"
                    placeholder="São Paulo"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className={cn("pl-9", errors.city && "border-destructive")}
                  />
                </div>
                {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">
                  Estado <span className="text-destructive">*</span>
                </Label>
                <select
                  id="state"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    errors.state && "border-destructive"
                  )}
                >
                  <option value="">Selecione</option>
                  {BRAZIL_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
              </div>
            </div>

            {/* Senha do administrador */}
            <div className="space-y-4 pt-2">
              <Separator />
              <div>
                <p className="text-sm font-semibold text-foreground">Acesso ao painel</p>
                <p className="text-xs text-muted-foreground">
                  Este e-mail e senha serão usados pelo administrador da assistência para entrar no painel.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">
                    Senha <span className="text-destructive">*</span>
                  </Label>
                  <PasswordInput
                    id="password"
                    value={form.password}
                    onChange={(value) => updateField("password", value)}
                    placeholder="Crie uma senha forte"
                    autoComplete="new-password"
                    showStrength
                    className={cn(errors.password && "border-destructive")}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">
                    Confirmar senha <span className="text-destructive">*</span>
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={form.confirmPassword}
                    onChange={(value) => updateField("confirmPassword", value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    confirmOf={form.password}
                    showMatchIndicator
                    className={cn(errors.confirmPassword && "border-destructive")}
                  />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            <Button onClick={handleNext} className="w-full mt-2" size="lg">
              Próximo: Escolher plano
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ─── Step 2: Seleção de plano ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Escolha seu plano</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os planos incluem 14 dias gratuitos. Cancele quando quiser.
              </p>
            </div>

            {loadingPlans ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4">
                {plans.map((plan) => {
                  const Icon = PLAN_ICONS[plan.slug] ?? Package;
                  const gradient = PLAN_COLORS[plan.slug] ?? "from-slate-500 to-slate-700";
                  const isSelected = form.planId === plan.id;
                  const features = Object.entries(FEATURE_LABELS)
                    .filter(([key]) => (plan as any)[key] === true)
                    .map(([, label]) => label);

                  return (
                    <button
                      key={plan.id}
                      onClick={() => updateField("planId", plan.id)}
                      className={cn(
                        "w-full text-left rounded-2xl border-2 p-5 transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {/* Ícone */}
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white", gradient)}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{plan.name}</span>
                              {plan.slug === "profissional" && (
                                <Badge className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">
                                  Popular
                                </Badge>
                              )}
                            </div>
                            <div className="text-right">
                              {Number(plan.price) === 0 ? (
                                <span className="font-bold text-emerald-600">Grátis</span>
                              ) : (
                                <div>
                                  <span className="text-xs text-muted-foreground">R$</span>
                                  <span className="font-bold text-lg text-foreground">
                                    {" "}{Number(plan.price).toFixed(0)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">/mês</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Limites */}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>Até {plan.maxUsers} usuários</span>
                            <span>·</span>
                            <span>{plan.maxOsPerMonth} OS/mês</span>
                          </div>

                          {/* Features */}
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {features.map((f) => (
                                <span
                                  key={f}
                                  className={cn(
                                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full",
                                    isSelected
                                      ? "bg-primary/10 text-primary"
                                      : "bg-slate-100 text-slate-600"
                                  )}
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Seletor */}
                        <div
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all mt-0.5",
                            isSelected ? "border-primary bg-primary" : "border-slate-300"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={handleBack} size="lg" className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleSubmit} size="lg" className="flex-1" disabled={register.isPending}>
                {register.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar minha conta
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Confirmação ──────────────────────────────────────── */}
        {step === 3 && result && (() => {
          const portalBase = getTenantPortalUrl(result.slug);
          const buildPortalUrl = (path: string) => {
            try {
              const url = new URL(portalBase);
              const params = new URLSearchParams(url.search);
              return `${url.origin}${path}${params.toString() ? `?${params.toString()}` : ""}`;
            } catch {
              return `${portalBase}${path}`;
            }
          };
          const loginPath = buildPortalUrl(result.loginUrl ?? "/login");
          const dashboardPath = buildPortalUrl(result.dashboardUrl ?? "/painel/dashboard");
          // Mantém o link de ativação Manus como alternativa para instalações que ainda usem vínculo OAuth.
          // Em preview: base é https://preview.manus.computer/?tenant=slug
          //   → https://preview.manus.computer/login?tenant=slug&claim=TOKEN
          // Em produção: base é https://slug.fullreparo.com.br
          //   → https://slug.fullreparo.com.br/login?claim=TOKEN
          const activationUrl = (() => {
            if (!result.claimToken) return portalBase;
            try {
              const url = new URL(portalBase);
              // Pega os query params existentes (ex: tenant=slug em preview)
              const params = new URLSearchParams(url.search);
              params.set("claim", result.claimToken);
              return `${url.origin}/login?${params.toString()}`;
            } catch {
              return `${portalBase}/login?claim=${result.claimToken}`;
            }
          })();
          return (
          <div className="text-center space-y-6">
            {/* Ícone de sucesso */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Wrench className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>

            <div>
              <h1 className="font-display text-3xl font-bold text-foreground mb-2">
                Conta criada com sucesso!
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                A assistência <strong>{result.name}</strong> está pronta. O administrador já pode acessar o painel com o e-mail e a senha cadastrados.
              </p>
            </div>

            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 text-left max-w-sm mx-auto space-y-2">
              <p className="text-sm font-semibold text-emerald-900">Plano e teste grátis ativados</p>
              <p className="text-sm text-emerald-800">
                Plano escolhido: <strong>{result.planName ?? "Plano selecionado"}</strong>.
                {result.trialEndsAt ? (
                  <> O teste grátis fica válido até <strong>{new Date(result.trialEndsAt).toLocaleString("pt-BR")}</strong>.</>
                ) : null}
              </p>
              <p className="text-xs text-emerald-700">
                Enviamos uma notificação para a assistência com os dados do plano escolhido e o prazo do teste.
              </p>
            </div>

            {/* Botões de acesso */}
            <div className="max-w-sm mx-auto space-y-3">
              <Button
                size="lg"
                className="w-full gap-2 text-base"
                onClick={() => { window.location.href = loginPath; }}
              >
                <CheckCircle2 className="h-5 w-5" />
                Fazer login agora
              </Button>
              <p className="text-xs text-muted-foreground">
                Use o e-mail e a senha informados neste cadastro. Após o login, você será levado ao painel da assistência.
              </p>
              {result.claimToken && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => { window.location.href = activationUrl; }}
                >
                  Ativar também com conta Manus
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Card de informações */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-left space-y-3 max-w-sm mx-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Seus links
              </p>
              <div className="space-y-2">
                <div
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => window.open(portalBase, "_blank")}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Portal público</p>
                    <p className="text-sm font-mono text-primary truncate">
                      {portalBase}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { window.location.href = loginPath; }}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Painel administrativo</p>
                    <p className="text-sm font-mono text-primary">{dashboardPath}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            </div>

            {/* Próximos passos */}
            <div className="bg-primary/5 rounded-2xl border border-primary/10 p-5 text-left max-w-sm mx-auto">
              <p className="text-sm font-semibold text-foreground mb-3">Próximos passos</p>
              <div className="space-y-2.5">
                {[
                  "Clique em \"Fazer login agora\" e entre com e-mail e senha",
                  "Configure o logo e as cores da sua marca",
                  "Cadastre sua equipe (técnicos e entregadores)",
                  "Abra sua primeira ordem de serviço",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                size="lg"
                onClick={() => { window.location.href = loginPath; }}
                className="gap-2"
              >
                Ir para login do painel
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.open(portalBase, "_blank")}
                className="gap-2"
              >
                Ver portal público
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          );
        })()}
      </main>
    </div>
  );
}
