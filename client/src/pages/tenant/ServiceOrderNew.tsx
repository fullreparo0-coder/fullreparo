import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  UserPlus,
  Smartphone,
  ClipboardCheck,
  Save,
  User,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Phone,
  Mail,
  FileText,
  History,
  PlusCircle,
  Cpu,
  Printer,
  Cpu as ChipIcon,
} from "lucide-react";
import { BrandCombobox } from "@/components/BrandCombobox";
import { ModelCombobox } from "@/components/ModelCombobox";
import { DEVICE_TYPES } from "@shared/const";
import { useDeviceSpecialties } from "@/hooks/useDeviceSpecialties";
import { isValidDocument, detectDocumentType, onlyDigits } from "@shared/cpfCnpj";
import { useCepLookup, formatCep } from "@/hooks/useCepLookup";

// DEFAULT_CHECKLIST removido — itens carregados do banco via trpc.tenantChecklist.list (personalizável por tenant)

/** Lê o valor de um query param da URL atual */
function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Detecta se a string parece CPF/CNPJ (só dígitos e separadores) ou e-mail */
function detectQueryType(q: string): "cpf" | "email" | "unknown" {
  const digits = q.replace(/\D/g, "");
  if (q.includes("@")) return "email";
  if (digits.length >= 5) return "cpf";
  return "unknown";
}

function getDocumentValidationMessage(value: string): string | null {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length !== 11 && digits.length !== 14) {
    return "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.";
  }
  if (!isValidDocument(digits)) {
    const type = detectDocumentType(digits) ?? "Documento";
    return `${type} inválido. Verifique os dígitos informados.`;
  }
  return null;
}

/** Formata CPF parcialmente enquanto o usuário digita */
function formatCpfPartial(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  // CNPJ
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

type FoundCustomer = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  document?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

// ─── Sub-componente: CEP lookup no modal de cadastro rápido ─────────────────

type QuickFormType = {
  name: string;
  phone: string;
  email: string;
  document: string;
  zipCode: string;
  address: string;
  addressNumber: string;
  addressReference: string;
  city: string;
  state: string;
};

function QuickRegisterCepLookup({
  quickForm,
  setQuickForm,
}: {
  quickForm: QuickFormType;
  setQuickForm: React.Dispatch<React.SetStateAction<QuickFormType>>;
}) {
  const { status: cepStatus, error: cepError } = useCepLookup(quickForm.zipCode, {
    onFound: (r) =>
      setQuickForm((f) => ({
        ...f,
        address: r.address || f.address,
        city: r.city || f.city,
        state: r.state || f.state,
      })),
  });

  return (
      <div className="space-y-3 border-t pt-3 mt-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Endereço (opcional)</p>

      <div className="space-y-1">
        <Label className="text-sm">CEP</Label>
        <div className="relative">
          <Input
            value={quickForm.zipCode}
            onChange={(e) =>
              setQuickForm((f) => ({ ...f, zipCode: formatCep(e.target.value) }))
            }
            placeholder="00000-000"
            maxLength={9}
            className="pr-7"
          />
          {cepStatus === "loading" && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {cepStatus === "found" && (
            <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
          )}
          {cepStatus === "error" && (
            <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
        {cepStatus === "error" && cepError && (
          <p className="text-xs text-amber-600">{cepError}</p>
        )}
        {cepStatus === "found" && (
          <p className="text-xs text-emerald-600">Endereço preenchido automaticamente.</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Label className="text-sm">Endereço</Label>
          <Input
            className="mt-1"
            placeholder="Rua e complemento"
            value={quickForm.address}
            onChange={(e) => setQuickForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-sm">Número</Label>
          <Input
            className="mt-1"
            placeholder="123"
            value={quickForm.addressNumber}
            onChange={(e) => setQuickForm((f) => ({ ...f, addressNumber: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <Label className="text-sm">Ponto de Referência</Label>
        <Input
          className="mt-1"
          placeholder="Próximo ao mercado, em frente à escola..."
          value={quickForm.addressReference}
          onChange={(e) => setQuickForm((f) => ({ ...f, addressReference: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-sm">Cidade</Label>
          <Input
            className="mt-1"
            placeholder="São Paulo"
            value={quickForm.city}
            onChange={(e) => setQuickForm((f) => ({ ...f, city: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-sm">Estado</Label>
          <Input
            className="mt-1"
            placeholder="SP"
            maxLength={2}
            value={quickForm.state}
            onChange={(e) => setQuickForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ServiceOrderNew() {
  // ── Lê customerId da URL (ex: /painel/os/nova?customerId=42) ──────────────
  const prefilledCustomerId = useMemo(() => {
    const raw = getQueryParam("customerId");
    const n = raw ? parseInt(raw, 10) : NaN;
    return isNaN(n) ? null : n;
  }, []);

  // Step: "identify" → "customer" → "device" → "os"
  const [step, setStep] = useState<"identify" | "customer" | "device" | "os">(
    prefilledCustomerId ? "customer" : "identify"
  );
  const [customerId, setCustomerId] = useState<number | null>(prefilledCustomerId);

  // ── Step 0: identificação ─────────────────────────────────────────────────
  const [identifyQuery, setIdentifyQuery] = useState("");
  const [displayQuery, setDisplayQuery] = useState(""); // valor formatado exibido
  const [searchState, setSearchState] = useState<"idle" | "searching" | "found" | "not_found" | "invalid_document">("idle");
  const [foundCustomer, setFoundCustomer] = useState<FoundCustomer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modal de cadastro rápido ───────────────────────────────────────────────
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({
    name: "",
    phone: "",
    email: "",
    document: "",
    zipCode: "",
    address: "",
    addressNumber: "",
    addressReference: "",
    city: "",
    state: "",
  });

  // ── Formulário principal ──────────────────────────────────────────────────
  const [selectedChecklist, setSelectedChecklist] = useState<string[]>([]);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    brand: "",
    model: "",
    deviceType: "Smartphone",
    imei: "",
    serialNumber: "",
    color: "",
    reportedDefect: "",
    physicalCondition: "",
    accessories: "",
    devicePassword: "",
    internalNotes: "",
    initialBudgetValue: "",
    warrantyDays: "90",
  });

  // ── Checklist dinâmico por tipo de aparelho ──────────────────────────────
  const { data: checklistItems = [] } = trpc.tenantChecklist.list.useQuery(
    { deviceType: form.deviceType || undefined },
    { enabled: !!form.deviceType }
  );
  const activeChecklistItems = checklistItems.filter((i) => i.isActive);
  // Conta quantos itens são específicos do tipo (não globais)
  const specificItemsCount = activeChecklistItems.filter((i) => i.deviceType != null).length;
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // ── Busca dados do cliente pré-selecionado (quando vem do perfil) ─────────
  const { data: prefilledCustomer } = trpc.customers.getById.useQuery(
    { id: prefilledCustomerId! },
    { enabled: !!prefilledCustomerId && !!user?.tenantId }
  );

  useEffect(() => {
    if (!prefilledCustomer) return;
    setForm((f) => ({
      ...f,
      customerName: prefilledCustomer.name ?? "",
      customerPhone: prefilledCustomer.phone ?? "",
      customerEmail: prefilledCustomer.email ?? "",
    }));
    setCustomerId(prefilledCustomer.id);
    setStep("device");
  }, [prefilledCustomer]);

  // ── Especialidades do tenant (filtra tipos e marcas) ──────────────────────────
  const { data: specialties } = trpc.tenants.getSpecialties.useQuery(
    undefined,
    { enabled: !!user?.tenantId }
  );
  const { filteredTypes, getBrandsForType } = useDeviceSpecialties({ specialties });
  const filteredBrands = useMemo(
    () => getBrandsForType(form.deviceType),
    [getBrandsForType, form.deviceType]
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: usage } = trpc.serviceOrders.usageStats.useQuery(
    undefined,
    { enabled: !!user?.tenantId }
  );

  // ── Estado de aparelho selecionado ──────────────────────────────────────
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [deviceMode, setDeviceMode] = useState<"select" | "new">("select");
  const [devicesHistoryOpen, setDevicesHistoryOpen] = useState(false);

  // ── Chip, aprovação no balcão e modal de impressão pós-criação ─────────────
  const [deliveredChip, setDeliveredChip] = useState(false);
  const [initialBudgetApproved, setInitialBudgetApproved] = useState(false);
  const initialBudgetApprovedRef = useRef(false);
  const setInitialBudgetApprovedValue = (checked: boolean) => {
    initialBudgetApprovedRef.current = checked;
    setInitialBudgetApproved(checked);
  };
  const [printChoiceOpen, setPrintChoiceOpen] = useState(false);
  const [createdOs, setCreatedOs] = useState<{ id: number; osNumber: string } | null>(null);

  // ── Busca aparelhos do cliente identificado ───────────────────────────────
  const { data: customerDevices, isLoading: devicesLoading } = trpc.customers.devices.useQuery(
    { customerId: customerId! },
    { enabled: !!customerId && !!user?.tenantId }
  );

  const identifyDocumentDigits = useMemo(() => onlyDigits(identifyQuery), [identifyQuery]);
  const isIdentifyDocumentQuery = detectQueryType(identifyQuery) === "cpf";
  const isIdentifyCompleteDocument =
    isIdentifyDocumentQuery && (identifyDocumentDigits.length === 11 || identifyDocumentDigits.length === 14);
  const identifyDocumentTypeLabel = identifyDocumentDigits.length === 14 ? "CNPJ" : "CPF";

  const identifyDocumentError = useMemo(() => {
    if (!isIdentifyCompleteDocument) return null;
    return getDocumentValidationMessage(identifyDocumentDigits);
  }, [identifyDocumentDigits, isIdentifyCompleteDocument]);

  const completeDocumentNotFoundMessage =
    isIdentifyCompleteDocument && !identifyDocumentError
      ? `${identifyDocumentTypeLabel} válido, mas ainda não cadastrado.`
      : null;

  const quickDocumentError = useMemo(
    () => getDocumentValidationMessage(quickForm.document),
    [quickForm.document]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createCustomer = trpc.customers.create.useMutation();
  const createOs = trpc.serviceOrders.createBalcao.useMutation();

  // ── Busca automática com debounce ─────────────────────────────────────────
  const doSearch = useCallback(
    async (query: string) => {
      if (!user?.tenantId) return;
      const clean = query.trim();
      if (clean.length < 5) {
        setSearchState("idle");
        setFoundCustomer(null);
        return;
      }
      setSearchState("searching");
      try {
        const result = await utils.client.customers.findByDocument.query({ query: clean });
        if (result) {
          setFoundCustomer(result as FoundCustomer);
          setSearchState("found");
        } else {
          const searchType = detectQueryType(clean);
          const digits = onlyDigits(clean);
          const isCompleteDocument = searchType === "cpf" && (digits.length === 11 || digits.length === 14);
          setFoundCustomer(null);
          setSearchState(searchType === "cpf" && !isCompleteDocument ? "idle" : "not_found");
        }
      } catch {
        const searchType = detectQueryType(clean);
        setFoundCustomer(null);
        setSearchState(searchType === "cpf" ? "invalid_document" : "idle");
      }
    },
    [user?.tenantId, utils.client.customers.findByDocument]
  );

  const handleIdentifyChange = (raw: string) => {
    // Detecta tipo e formata
    const type = detectQueryType(raw);
    let formatted = raw;
    if (type === "cpf") {
      formatted = formatCpfPartial(raw);
    }
    setDisplayQuery(formatted);
    // Para busca, usa o valor limpo (sem formatação)
      const cleanForSearch = type === "cpf" ? raw.replace(/\D/g, "").slice(0, 14) : raw.trim();
      setIdentifyQuery(cleanForSearch);

      // Debounce 400ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (cleanForSearch.length < 5) {
        setSearchState("idle");
        setFoundCustomer(null);
        return;
      }
      if (type === "cpf") {
        const isCompleteDocument = cleanForSearch.length === 11 || cleanForSearch.length === 14;
        if (isCompleteDocument && !isValidDocument(cleanForSearch)) {
          setSearchState("invalid_document");
          setFoundCustomer(null);
          return;
        }
      }
      setSearchState("searching");
      debounceRef.current = setTimeout(() => doSearch(cleanForSearch), 400);
  };

  // ── Confirmar cliente encontrado ──────────────────────────────────────────
  const handleConfirmFound = () => {
    if (!foundCustomer) return;
    setCustomerId(foundCustomer.id);
    setForm((f) => ({
      ...f,
      customerName: foundCustomer.name,
      customerPhone: foundCustomer.phone ?? "",
      customerEmail: foundCustomer.email ?? "",
    }));
    setStep("device");
  };

  // ── Abrir modal de cadastro rápido ────────────────────────────────────────
  const handleOpenQuickRegister = () => {
    const type = detectQueryType(identifyQuery);
    const documentError = type === "cpf" ? getDocumentValidationMessage(identifyQuery) : null;
    if (documentError) {
      toast.error(documentError);
      setSearchState("invalid_document");
      return;
    }
    setQuickForm({
      name: "",
      phone: "",
      email: type === "email" ? identifyQuery : "",
      document: type === "cpf" ? identifyQuery : "",
      zipCode: "",
      address: "",
      addressNumber: "",
      addressReference: "",
      city: "",
      state: "",
    });
    setQuickRegisterOpen(true);
  };

  // ── Salvar cadastro rápido ────────────────────────────────────────────────
  const handleQuickRegister = async () => {
    if (!quickForm.name.trim() || !quickForm.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    if (quickDocumentError) {
      toast.error(quickDocumentError);
      return;
    }
    try {
      const result = await createCustomer.mutateAsync({
        name: quickForm.name.trim(),
        phone: quickForm.phone.trim(),
        email: quickForm.email.trim() || undefined,
        document: quickForm.document.trim() || undefined,
        zipCode: quickForm.zipCode.trim() || undefined,
        address: quickForm.address.trim() || undefined,
        addressNumber: quickForm.addressNumber.trim() || undefined,
        addressReference: quickForm.addressReference.trim() || undefined,
        city: quickForm.city.trim() || undefined,
        state: quickForm.state.trim() || undefined,
      });
      setCustomerId(result.id);
      setForm((f) => ({
        ...f,
        customerName: quickForm.name.trim(),
        customerPhone: quickForm.phone.trim(),
        customerEmail: quickForm.email.trim(),
      }));
      setQuickRegisterOpen(false);
      toast.success("Cliente cadastrado com sucesso!");
      setStep("device");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao cadastrar cliente";
        toast.error(message || "Erro ao cadastrar cliente");
      }
  };

  // ── Pular identificação ───────────────────────────────────────────────────
  const handleSkipIdentify = () => {
    setFoundCustomer(null);
    setSearchState("idle");
    setStep("customer");
  };

  // ── Step "customer" manual (sem CPF) ──────────────────────────────────────
  const handleCustomerNext = async () => {
    if (!customerId) {
      try {
        const result = await createCustomer.mutateAsync({
          name: form.customerName,
          phone: form.customerPhone,
          email: form.customerEmail || undefined,
        });
        setCustomerId(result.id);
        toast.success("Cliente cadastrado com sucesso");
      } catch {
        toast.error("Erro ao cadastrar cliente");
        return;
      }
    }
    setStep("device");
  };

  // ── Selecionar aparelho existente ────────────────────────────────────────
  const handleSelectDevice = (device: { id: number; brand: string; model: string; type?: string | null; color?: string | null; imei?: string | null; serialNumber?: string | null }) => {
    setSelectedDeviceId(device.id);
    setForm((f) => ({
      ...f,
      brand: device.brand,
      model: device.model,
      deviceType: device.type ?? f.deviceType,
      color: device.color ?? "",
      imei: device.imei ?? "",
      serialNumber: device.serialNumber ?? "",
    }));
    setDeviceMode("select");
    setDevicesHistoryOpen(false);
  };

  const handleNewDevice = () => {
    setSelectedDeviceId(null);
    setForm((f) => ({ ...f, brand: "", model: "", deviceType: "Smartphone", color: "", imei: "", serialNumber: "" }));
    setDeviceMode("new");
    setDevicesHistoryOpen(false);
  };

  const parseInitialBudgetValue = () => {
    const raw = form.initialBudgetValue.trim();
    if (!raw) return undefined;

    const sanitized = raw.replace(/[^\d,.-]/g, "");
    const normalized = sanitized.includes(",")
      ? sanitized.replace(/\./g, "").replace(",", ".")
      : sanitized;
    const parsed = Number(normalized);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  // ── Submissão da OS ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customerId) return;
    const initialBudgetValue = parseInitialBudgetValue();
    if (initialBudgetValue === null) {
      toast.error("Informe um valor de orçamento válido ou deixe o campo em branco.");
      return;
    }
    const shouldApproveInitialBudget = initialBudgetApprovedRef.current || initialBudgetApproved;
    if (shouldApproveInitialBudget && !initialBudgetValue) {
      toast.error("Para marcar como aprovado no balcão, informe o valor do orçamento inicial.");
      return;
    }

    try {
      const result = await createOs.mutateAsync({
        customerId,
        deviceId: selectedDeviceId ?? undefined,
        brand: form.brand,
        model: form.model,
        imei: form.imei || undefined,
        serialNumber: form.serialNumber || undefined,
        deviceType: form.deviceType,
        reportedDefect: form.reportedDefect,
        physicalCondition: form.physicalCondition || undefined,
        accessories: form.accessories || undefined,
        devicePassword: form.devicePassword || undefined,
        internalNotes: form.internalNotes || undefined,
        warrantyDays: parseInt(form.warrantyDays),
        initialBudgetValue,
        initialBudgetApproved: shouldApproveInitialBudget,
        initialBudgetStatus: shouldApproveInitialBudget ? "approved" : undefined,
        checklist: selectedChecklist,
      });
      toast.success(`OS ${result.osNumber} criada com sucesso!`);
      setCreatedOs({ id: result.id, osNumber: result.osNumber });
      setPrintChoiceOpen(true);
    } catch {
      toast.error("Erro ao criar OS");
    }
  };

  // ── Ações do modal de impressão ───────────────────────────────────────────
  const handlePrintChoice = (mode: "a4" | "thermal" | "skip") => {
    if (!createdOs) return;
    setPrintChoiceOpen(false);
    if (mode === "skip") {
      navigate(`/painel/os/${createdOs.id}`);
    } else {
      navigate(`/painel/os/${createdOs.id}?print=${mode}`);
    }
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const toggleChecklist = (item: string) => {
    setSelectedChecklist((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // ── Guard: sem tenant ─────────────────────────────────────────────────────
  if (!user?.tenantId) {
    return (
      <TenantLayout title="Nova OS">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
            <UserPlus className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Usuário sem assistência vinculada</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Sua conta não está vinculada a nenhuma assistência técnica. Solicite ao administrador que vincule seu usuário.
            </p>
          </div>
        </div>
      </TenantLayout>
    );
  }

  // ── Limite atingido ───────────────────────────────────────────────────────
  if (usage?.isAtLimit) {
    return (
      <TenantLayout title="Nova OS">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
            <Save className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Limite do plano atingido</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Você usou <strong>{usage.used}/{usage.limit}</strong> OS este mês no plano{" "}
              <strong>{usage.planName}</strong>. Faça upgrade para continuar criando ordens de serviço.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/painel/os")}>Ver OS existentes</Button>
            <Button onClick={() => navigate("/painel/configuracoes")}>Ver planos</Button>
          </div>
        </div>
      </TenantLayout>
    );
  }

  // ── Steps indicator ───────────────────────────────────────────────────────
  const stepOrder = ["identify", "customer", "device", "os"] as const;
  const stepLabels = [
    { key: "identify", label: "Identificar", icon: Search },
    { key: "customer", label: "Cliente", icon: UserPlus },
    { key: "device", label: "Aparelho", icon: Smartphone },
    { key: "os", label: "OS", icon: ClipboardCheck },
  ] as const;
  const currentStepIdx = stepOrder.indexOf(step);
  const visibleStepLabels = stepLabels.filter((s) => s.key !== "customer" || step === "customer");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TenantLayout title="Nova Ordem de Serviço">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Banner: cliente pré-selecionado */}
        {prefilledCustomer && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Criando OS para <span className="text-primary">{prefilledCustomer.name}</span>
              </p>
              {prefilledCustomer.phone && (
                <p className="text-xs text-muted-foreground">{prefilledCustomer.phone}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-7 px-2 shrink-0"
              onClick={() => navigate(`/painel/clientes/${prefilledCustomer.id}`)}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Voltar ao perfil
            </Button>
          </div>
        )}

        {/* Banner de aviso quando próximo do limite */}
        {usage?.isNearLimit && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="mt-0.5 h-4 w-4 shrink-0 text-amber-600">⚠️</div>
            <div className="text-sm">
              <p className="font-medium text-amber-800">Atenção: limite próximo</p>
              <p className="text-amber-700">
                Você usou <strong>{usage.used} de {usage.limit}</strong> OS este mês ({usage.percentUsed}%) no plano <strong>{usage.planName}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Steps indicator */}
        <div className="flex items-center gap-1.5 text-sm overflow-x-auto pb-1">
          {visibleStepLabels.map((s, idx) => {
            const isActive = step === s.key;
            const isDone = currentStepIdx > stepOrder.indexOf(s.key);
            return (
              <div key={s.key} className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? "✓" : idx + 1}
                </div>
                <span className={isActive ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {s.label}
                </span>
                {idx < visibleStepLabels.length - 1 && <div className="h-px w-6 bg-border" />}
              </div>
            );
          })}
        </div>

        {/* ─── Step 0: Identificação por CPF / e-mail ─────────────────────── */}
        {step === "identify" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Identificar Cliente
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Digite os primeiros 5 dígitos do CPF/CNPJ ou o e-mail para buscar um cliente já cadastrado.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campo de busca */}
              <div>
                <Label className="text-sm font-medium">CPF, CNPJ ou E-mail</Label>
                <div className="relative mt-1.5">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {searchState === "searching" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : identifyQuery.includes("@") ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <Input
                    className="pl-9 h-12 text-base"
                    placeholder="000.000.000-00 ou cliente@email.com"
                    value={displayQuery}
                    onChange={(e) => handleIdentifyChange(e.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                  {searchState === "found" && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                  )}
                  {searchState === "not_found" && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-500" />
                  )}
                  {searchState === "invalid_document" && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                  )}
                </div>
                {identifyQuery.length > 0 && identifyQuery.length < 5 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Continue digitando para iniciar a busca...
                  </p>
                )}
                {detectQueryType(identifyQuery) === "cpf" && onlyDigits(identifyQuery).length >= 5 && onlyDigits(identifyQuery).length < 11 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Buscando cadastro existente a partir dos primeiros dígitos. Continue digitando para confirmar o documento completo.
                  </p>
                )}
                {detectQueryType(identifyQuery) === "cpf" && onlyDigits(identifyQuery).length > 11 && onlyDigits(identifyQuery).length < 14 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete os 14 dígitos do CNPJ para validar antes de prosseguir.
                  </p>
                )}
                {identifyDocumentError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {identifyDocumentError}
                  </p>
                )}
                {searchState === "not_found" && completeDocumentNotFoundMessage && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {completeDocumentNotFoundMessage}
                  </p>
                )}
              </div>

              {/* Estado: buscando */}
              {searchState === "searching" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando cliente...
                </div>
              )}

              {/* Estado: encontrado */}
              {searchState === "found" && foundCustomer && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-emerald-800">Cliente encontrado</span>
                    <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-700 border-0">
                      Cadastrado
                    </Badge>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold shrink-0">
                      {foundCustomer.name[0]?.toUpperCase()}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-foreground">{foundCustomer.name}</p>
                      {foundCustomer.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {foundCustomer.phone}
                        </p>
                      )}
                      {foundCustomer.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {foundCustomer.email}
                        </p>
                      )}
                      {foundCustomer.city && (
                        <p className="text-xs text-muted-foreground">{foundCustomer.city}{foundCustomer.state ? `, ${foundCustomer.state}` : ""}</p>
                      )}
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleConfirmFound}>
                    Confirmar e continuar
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Estado: documento inválido */}
              {searchState === "invalid_document" && identifyDocumentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-sm font-medium text-red-800">CPF/CNPJ inválido</span>
                  </div>
                  <p className="text-sm text-red-700">
                    {identifyDocumentError} Você pode corrigir para buscar um cadastro existente ou seguir sem CPF/CNPJ e preencher os dados manualmente.
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    variant="outline"
                    onClick={handleSkipIdentify}
                  >
                    Preencher cliente manualmente sem CPF/CNPJ
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Estado: não encontrado */}
              {searchState === "not_found" && (
                completeDocumentNotFoundMessage ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="text-sm font-medium text-amber-800">{identifyDocumentTypeLabel} não cadastrado</span>
                    </div>
                    <p className="text-sm text-amber-700">
                      {completeDocumentNotFoundMessage} Deseja cadastrar este cliente agora usando o documento informado?
                    </p>
                    <Button
                      type="button"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleOpenQuickRegister}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Cadastrar novo cliente
                    </Button>
                    <Button
                      type="button"
                      className="w-full"
                      variant="outline"
                      onClick={handleSkipIdentify}
                    >
                      Preencher cliente manualmente sem CPF/CNPJ
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="text-sm font-medium text-amber-800">Cliente não encontrado</span>
                    </div>
                    <p className="text-sm text-amber-700">
                      Nenhum cliente com este e-mail foi encontrado. Deseja cadastrá-lo agora?
                    </p>
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleOpenQuickRegister}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Cadastrar novo cliente
                    </Button>
                  </div>
                )
              )}

              {/* Botão pular */}
              <div className="pt-1">
                <button
                  className="text-xs underline underline-offset-2 transition-colors text-muted-foreground hover:text-foreground"
                  onClick={handleSkipIdentify}
                >
                  Pular identificação e preencher manualmente
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 1: Cliente (manual, sem CPF) ──────────────────────────── */}
        {step === "customer" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome completo *</Label>
                  <Input
                    className="mt-1.5"
                    value={form.customerName}
                    onChange={(e) => update("customerName", e.target.value)}
                    placeholder="João Silva"
                  />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input
                    className="mt-1.5"
                    value={form.customerPhone}
                    onChange={(e) => update("customerPhone", e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    className="mt-1.5"
                    value={form.customerEmail}
                    onChange={(e) => update("customerEmail", e.target.value)}
                    placeholder="joao@email.com"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("identify")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCustomerNext}
                  disabled={!form.customerName || !form.customerPhone}
                >
                  Próximo: Aparelho
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 2: Aparelho ────────────────────────────────────────────── */}
        {step === "device" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Dados do Aparelho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* ─ Histórico de aparelhos do cliente ─ */}
              {customerId && (
                <div className="space-y-3">
                  {devicesLoading && (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando aparelhos anteriores...
                    </div>
                  )}

                  {!devicesLoading && customerDevices && customerDevices.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-3 text-left"
                        onClick={() => setDevicesHistoryOpen((v) => !v)}
                        aria-expanded={devicesHistoryOpen}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-primary ring-1 ring-border">
                          <History className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            Ver {customerDevices.length} {customerDevices.length === 1 ? "aparelho anterior" : "aparelhos anteriores"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            Histórico oculto para manter o cadastro mais rápido no balcão.
                          </p>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                            devicesHistoryOpen ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {devicesHistoryOpen && (
                        <div className="grid gap-2 border-t border-border bg-background p-2">
                          {customerDevices.map((device) => {
                            const isSelected = selectedDeviceId === device.id && deviceMode === "select";
                            return (
                              <button
                                key={device.id}
                                type="button"
                                onClick={() => handleSelectDevice(device)}
                                className={`w-full text-left rounded-lg border p-3 transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                  }`}>
                                    <Cpu className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm text-foreground">{device.brand} {device.model}</span>
                                      {device.type && (
                                        <Badge variant="secondary" className="text-xs h-5">{device.type}</Badge>
                                      )}
                                      {isSelected && (
                                        <Badge className="text-xs h-5 bg-primary/10 text-primary border-0 ml-auto">
                                          <CheckCircle2 className="h-3 w-3 mr-1" /> Selecionado
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex gap-3 mt-0.5 flex-wrap">
                                      {device.color && (
                                        <span className="text-xs text-muted-foreground">{device.color}</span>
                                      )}
                                      {device.imei && (
                                        <span className="text-xs text-muted-foreground font-mono">IMEI: {device.imei}</span>
                                      )}
                                      {device.serialNumber && (
                                        <span className="text-xs text-muted-foreground font-mono">SN: {device.serialNumber}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {!devicesLoading && (!customerDevices || customerDevices.length === 0) && (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
                      <Smartphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum aparelho cadastrado para este cliente.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados abaixo para cadastrar o primeiro.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    onClick={handleNewDevice}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Cadastrar novo aparelho
                  </button>

                  <Separator />
                </div>
              )}

              {/* ─ Formulário de aparelho (novo ou sem histórico) ─ */}
              {(deviceMode === "new" || !customerDevices || customerDevices.length === 0 || !customerId) && (
                <>
                  {deviceMode === "new" && (
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <PlusCircle className="h-4 w-4 text-primary" /> Novo aparelho
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo de equipamento</Label>
                      <Select value={form.deviceType} onValueChange={(v) => update("deviceType", v)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredTypes.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cor</Label>
                      <Input
                        className="mt-1.5"
                        value={form.color}
                        onChange={(e) => update("color", e.target.value)}
                        placeholder="Preto"
                      />
                    </div>
                    <div>
                      <Label>Marca *</Label>
                      <div className="mt-1.5">
                        <BrandCombobox
                          value={form.brand}
                          onChange={(v) => update("brand", v)}
                          placeholder="Selecione a marca"
                          allowedBrands={filteredBrands}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Modelo *</Label>
                      <div className="mt-1.5">
                        <ModelCombobox
                          value={form.model}
                          onChange={(val) => update("model", val)}
                          brand={form.brand}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>IMEI / Número de série</Label>
                      <Input
                        className="mt-1.5"
                        value={form.imei}
                        onChange={(e) => update("imei", e.target.value)}
                        placeholder="IMEI ou SN"
                      />
                    </div>
                    <div>
                      <Label>Senha do aparelho</Label>
                      <Input
                        className="mt-1.5"
                        value={form.devicePassword}
                        onChange={(e) => update("devicePassword", e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ─ Resumo do aparelho selecionado ─ */}
              {deviceMode === "select" && selectedDeviceId && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Aparelho selecionado</p>
                  <p className="font-medium text-sm">{form.brand} {form.model}</p>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    {form.deviceType && <span className="text-xs text-muted-foreground">{form.deviceType}</span>}
                    {form.color && <span className="text-xs text-muted-foreground">{form.color}</span>}
                    {form.imei && <span className="text-xs text-muted-foreground font-mono">IMEI: {form.imei}</span>}
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Senha do aparelho</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={form.devicePassword}
                      onChange={(e) => update("devicePassword", e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (prefilledCustomer) {
                      navigate(`/painel/clientes/${prefilledCustomer.id}`);
                    } else {
                      setStep("identify");
                    }
                  }}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep("os")}
                  disabled={!form.brand || !form.model}
                >
                  Próximo: OS
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 3: OS ──────────────────────────────────────────────────── */}
        {step === "os" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" /> Detalhes da OS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Defeito relatado *</Label>
                <Textarea
                  className="mt-1.5"
                  value={form.reportedDefect}
                  onChange={(e) => update("reportedDefect", e.target.value)}
                  placeholder="Descreva o problema relatado pelo cliente..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                <div className="space-y-3">
                  <div>
                    <Label>Orçamento inicial</Label>
                    <Input
                      className="mt-1.5"
                      inputMode="decimal"
                      value={form.initialBudgetValue}
                      onChange={(e) => update("initialBudgetValue", e.target.value)}
                      placeholder="0,00"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use este campo quando o diagnóstico for feito no balcão e o cliente puder aprovar na hora.
                    </p>
                  </div>
                  <label
                    htmlFor="initial-budget-approved"
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
                  >
                    <Checkbox
                      id="initial-budget-approved"
                      checked={initialBudgetApproved}
                      onCheckedChange={(v) => setInitialBudgetApprovedValue(!!v)}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="block font-medium">Orçamento já aprovado no balcão</span>
                      <span className="block text-xs text-emerald-800">
                        Marque quando o cliente já autorizou o serviço na abertura da OS.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  {initialBudgetApproved
                    ? "Com aprovação marcada, a OS será criada como aprovado."
                    : <>Se preenchido, a OS será criada em <strong>aguardando aprovação</strong>.</>}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhes adicionais</p>
                <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estado físico</Label>
                  <Input
                    className="mt-1.5"
                    value={form.physicalCondition}
                    onChange={(e) => update("physicalCondition", e.target.value)}
                    placeholder="Bom estado, sem trincas"
                  />
                </div>
                <div>
                  <Label>Acessórios entregues</Label>
                  <Input
                    className="mt-1.5"
                    value={form.accessories}
                    onChange={(e) => update("accessories", e.target.value)}
                    placeholder="Carregador, cabo"
                  />
                </div>
                </div>
                <div>
                  <Label>Observações internas</Label>
                  <Textarea
                    className="mt-1.5"
                    value={form.internalNotes}
                    onChange={(e) => update("internalNotes", e.target.value)}
                    placeholder="Notas para a equipe técnica..."
                    rows={2}
                  />
                </div>
              </div>

              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Checklist de entrada</Label>
                  {specificItemsCount > 0 && (
                    <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      {specificItemsCount} {specificItemsCount === 1 ? "item específico" : "itens específicos"} para {form.deviceType}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeChecklistItems.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2">Nenhum item de checklist configurado.</p>
                  )}
                  {activeChecklistItems.map((item) => (
                    <label
                      key={item.id}
                      htmlFor={`cl-${item.id}`}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <Checkbox
                        id={`cl-${item.id}`}
                        checked={selectedChecklist.includes(item.label)}
                        onCheckedChange={() => toggleChecklist(item.label)}
                        className="shrink-0"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Confirmação de entrega do chip */}
              <div
                className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors cursor-pointer ${
                  deliveredChip
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-amber-300 bg-amber-50"
                }`}
                onClick={() => setDeliveredChip((v) => !v)}
              >
                <Checkbox
                  id="delivered-chip"
                  checked={deliveredChip}
                  onCheckedChange={(v) => setDeliveredChip(!!v)}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1">
                  <label
                    htmlFor="delivered-chip"
                    className={`text-sm font-semibold cursor-pointer ${
                      deliveredChip ? "text-emerald-800" : "text-amber-800"
                    }`}
                  >
                    Entregou o chip ao cliente
                  </label>
                  <p className={`text-xs mt-0.5 ${
                    deliveredChip ? "text-emerald-700" : "text-amber-700"
                  }`}>
                    {deliveredChip
                      ? "Confirmado — chip devolvido ao cliente."
                      : "Obrigatório confirmar antes de criar a OS."}
                  </p>
                </div>
                {deliveredChip ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("device")}>
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={!form.reportedDefect || !deliveredChip || createOs.isPending}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {createOs.isPending ? "Salvando..." : "Criar OS"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── Modal de cadastro rápido ──────────────────────────────────────── */}
      <Dialog open={quickRegisterOpen} onOpenChange={setQuickRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Cadastro Rápido de Cliente
            </DialogTitle>
          </DialogHeader>
          <QuickRegisterCepLookup quickForm={quickForm} setQuickForm={setQuickForm} />
          <div className="space-y-3 py-2">
            {/* CPF/e-mail já preenchido */}
            {(quickForm.document || quickForm.email) && (
              <div className={`rounded-md px-3 py-2 text-sm ${quickDocumentError ? "bg-red-50 text-red-700 border border-red-200" : "bg-muted text-muted-foreground"}`}>
                {quickForm.document ? (
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    CPF/CNPJ: <strong>{quickForm.document}</strong>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    E-mail: <strong>{quickForm.email}</strong>
                  </span>
                )}
              </div>
            )}
            {quickDocumentError && quickForm.document && (
              <p className="text-xs text-red-600 -mt-1 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {quickDocumentError}
              </p>
            )}
            <div>
              <Label>Nome completo *</Label>
              <Input
                className="mt-1.5"
                placeholder="João Silva"
                value={quickForm.name}
                onChange={(e) => setQuickForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <Label>Telefone / WhatsApp *</Label>
              <Input
                className="mt-1.5"
                placeholder="(11) 99999-9999"
                value={quickForm.phone}
                onChange={(e) => setQuickForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            {/* Se veio por CPF, mostra campo de e-mail; se veio por e-mail, mostra CPF */}
            {quickForm.document && (
              <div>
                <Label>E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  className="mt-1.5"
                  placeholder="joao@email.com"
                  value={quickForm.email}
                  onChange={(e) => setQuickForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            )}
            {quickForm.email && !quickForm.document && (
              <div>
                <Label>CPF / CNPJ <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  className="mt-1.5"
                  placeholder="000.000.000-00"
                  value={quickForm.document}
                  onChange={(e) => setQuickForm((f) => ({ ...f, document: formatCpfPartial(e.target.value) }))}
                />
                {quickDocumentError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {quickDocumentError}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuickRegisterOpen(false)}>
              Cancelar cadastro
            </Button>
            <Button
              onClick={handleQuickRegister}
              disabled={!quickForm.name.trim() || !quickForm.phone.trim() || !!quickDocumentError || createCustomer.isPending}
            >
              {createCustomer.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Cadastrando...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-1.5" /> Cadastrar e continuar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal de impressão pós-criação ──────────────────────────────────────── */}
      <Dialog
        open={printChoiceOpen}
        onOpenChange={(open) => {
          if (!open && createdOs) {
            navigate(`/painel/os/${createdOs.id}`);
          }
          setPrintChoiceOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              OS criada com sucesso!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {createdOs && (
                <span>
                  OS <strong className="text-foreground font-mono">{createdOs.osNumber}</strong> registrada.
                  Deseja imprimir a ficha agora?
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            {/* Opção: Bobina Térmica */}
            <button
              onClick={() => handlePrintChoice("thermal")}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors text-center group"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Printer className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Bobina Térmica</p>
                <p className="text-xs text-muted-foreground">58mm / 80mm</p>
              </div>
            </button>

            {/* Opção: Folha A4 */}
            <button
              onClick={() => handlePrintChoice("a4")}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors text-center group"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Folha A4</p>
                <p className="text-xs text-muted-foreground">Completa</p>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => handlePrintChoice("skip")}
            >
              Pular impressão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}
