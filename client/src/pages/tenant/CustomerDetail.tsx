import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { BrandCombobox } from "@/components/BrandCombobox";
import { ModelCombobox } from "@/components/ModelCombobox";
import { DEVICE_TYPES } from "@shared/const";
import { isValidDocument, detectDocumentType, onlyDigits } from "@shared/cpfCnpj";
import { useCepLookup, formatCep } from "@/hooks/useCepLookup";
import { useDeviceSpecialties } from "@/hooks/useDeviceSpecialties";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  FileText,
  MapPin,
  Smartphone,
  ClipboardList,
  Calendar,
  Hash,
  Cpu,
  Fingerprint,
  Palette,
  Pencil,
  X,
  Check,
  Loader2,
  Plus,
  ClipboardPlus,
  Search,
  MessageSquare,
  KeyRound,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 10;

// ─── Tipos ────────────────────────────────────────────────────────────────────
type DeviceForm = {
  brand: string;
  model: string;
  type: string;
  color: string;
  imei: string;
  serialNumber: string;
  notes: string;
};

const EMPTY_DEVICE: DeviceForm = {
  brand: "",
  model: "",
  type: "",
  color: "",
  imei: "",
  serialNumber: "",
  notes: "",
};

// ─── InfoRow (modo leitura) ────────────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

// ─── EditField ────────────────────────────────────────────────────────────────
function EditField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="text-sm resize-none"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [ordersPage, setOrdersPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(EMPTY_DEVICE);
  const [provisionalPassword, setProvisionalPassword] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const customerId = Number(id);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  // ── Especialidades do tenant (filtra tipos e marcas no modal de aparelho) ──────
  const { data: tenantSpecialties } = trpc.tenants.getSpecialties.useQuery();
  const { filteredTypes: deviceTypes, getBrandsForType } = useDeviceSpecialties({
    specialties: tenantSpecialties,
  });

  const { data: customer, isLoading: loadingCustomer } = trpc.customers.getById.useQuery(
    { id: customerId },
    { enabled: !!customerId && !isNaN(customerId) }
  );

  const { data: devicesData, isLoading: loadingDevices } = trpc.customers.devices.useQuery(
    { customerId },
    { enabled: !!customerId && !isNaN(customerId) }
  );

  const { data: ordersData, isLoading: loadingOrders } = trpc.customers.orders.useQuery(
    { customerId, page: ordersPage, pageSize: PAGE_SIZE },
    { enabled: !!customerId && !isNaN(customerId) }
  );

  // ── Estado do formulário de edição ───────────────────────────────────────────
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    document: "",
    address: "",
    addressNumber: "",
    addressReference: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  });

  function openEdit() {
    if (!customer) return;
    setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      document: customer.document ?? "",
      address: customer.address ?? "",
      addressNumber: customer.addressNumber ?? "",
      addressReference: customer.addressReference ?? "",
      neighborhood: customer.neighborhood ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      zipCode: customer.zipCode ?? "",
      notes: customer.notes ?? "",
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  // ── Mutation com atualização otimista ─────────────────────────────────────────
  const updateMutation = trpc.customers.update.useMutation({
    onMutate: async (newData) => {
      await utils.customers.getById.cancel({ id: customerId });
      const previous = utils.customers.getById.getData({ id: customerId });
      utils.customers.getById.setData({ id: customerId }, (old) =>
        old ? { ...old, ...newData } : old
      );
      return { previous };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.customers.getById.setData({ id: customerId }, context.previous);
      }
      toast.error("Erro ao salvar. Tente novamente.");
    },
    onSuccess: () => {
      setEditing(false);
      toast.success("Dados do cliente atualizados.");
      utils.customers.getById.invalidate({ id: customerId });
    },
  });

  // ── CEP lookup ──────────────────────────────────────────────────────────────
  const { status: cepStatus, error: cepError } = useCepLookup(form.zipCode, {
    onFound: (r) =>
      setForm((f) => ({
        ...f,
        address: r.address || f.address,
        neighborhood: r.neighborhood || f.neighborhood,
        city: r.city || f.city,
        state: r.state || f.state,
      })),
  });

  function handleSave() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (form.document?.trim()) {
      const digits = onlyDigits(form.document);
      if ((digits.length === 11 || digits.length === 14) && !isValidDocument(digits)) {
        const type = detectDocumentType(digits);
        toast.error(type ? `${type} inválido. Verifique os dígitos informados.` : "Documento inválido.");
        return;
      }
    }
    updateMutation.mutate({ id: customerId, ...form });
  }

  // ── Mutation: gerar/reenviar senha provisória ────────────────────────────────
  const generatePasswordMutation = trpc.customerAuth.generateProvisionalPassword.useMutation({
    onSuccess: (data) => {
      setProvisionalPassword(data.plainPassword);
      setPasswordDialogOpen(true);
      toast.success(`Senha gerada para ${data.customerName}.`);
    },
    onError: () => {
      toast.error("Erro ao gerar senha. Tente novamente.");
    },
  });

  const resendPasswordMutation = trpc.customerAuth.resendProvisionalPassword.useMutation({
    onSuccess: (data) => {
      setProvisionalPassword(data.plainPassword);
      setPasswordDialogOpen(true);
      toast.success(`Nova senha gerada para ${data.customerName}.`);
    },
    onError: () => {
      toast.error("Erro ao reenviar senha. Tente novamente.");
    },
  });

  // ── Mutation: adicionar aparelho ──────────────────────────────────────────────
  const addDeviceMutation = trpc.customers.addDevice.useMutation({
    onSuccess: () => {
      toast.success("Aparelho cadastrado com sucesso.");
      setDeviceModalOpen(false);
      setDeviceForm(EMPTY_DEVICE);
      utils.customers.devices.invalidate({ customerId });
    },
    onError: () => {
      toast.error("Erro ao cadastrar aparelho. Tente novamente.");
    },
  });

  function openDeviceModal() {
    setDeviceForm(EMPTY_DEVICE);
    setDeviceModalOpen(true);
  }

  function handleAddDevice() {
    if (!deviceForm.brand.trim()) {
      toast.error("Informe a marca do aparelho.");
      return;
    }
    if (!deviceForm.model.trim()) {
      toast.error("Informe o modelo do aparelho.");
      return;
    }
    addDeviceMutation.mutate({ customerId, ...deviceForm });
  }

  // ── Derivados ─────────────────────────────────────────────────────────────────
  const devices = devicesData ?? [];
  const orders = ordersData?.data ?? [];
  const ordersTotalCount = ordersData?.totalCount ?? 0;
  const ordersTotalPages = ordersData?.totalPages ?? 0;

  // ── Loading / Not found ───────────────────────────────────────────────────────
  if (loadingCustomer) {
    return (
      <TenantLayout title="Detalhes do Cliente">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48 lg:col-span-2" />
          </div>
        </div>
      </TenantLayout>
    );
  }

  if (!customer) {
    return (
      <TenantLayout title="Cliente não encontrado">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            Cliente não encontrado ou sem permissão de acesso.
          </p>
          <Button variant="outline" onClick={() => navigate("/painel/clientes")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Clientes
          </Button>
        </div>
      </TenantLayout>
    );
  }

  const initials = customer.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const fullAddress = [
    customer.address,
    customer.addressNumber ? `nº ${customer.addressNumber}` : null,
    customer.neighborhood,
    customer.city,
    customer.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <TenantLayout title="Detalhes do Cliente">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/painel/clientes")}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Clientes
          </Button>
        </div>

        {/* Perfil + Aparelhos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card do cliente */}
          <Card>
            <CardContent className="pt-6 pb-5">
              {/* Avatar + nome */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl mb-3">
                  {initials}
                </div>
                {editing ? (
                  <div className="w-full text-left">
                    <EditField
                      label="Nome completo"
                      value={form.name}
                      onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                      placeholder="Nome do cliente"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-base font-semibold text-foreground">{customer.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cliente desde{" "}
                      {new Date(customer.createdAt).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </>
                )}
              </div>

              {/* Campos */}
              {editing ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <EditField
                    label="Telefone"
                    value={form.phone}
                    onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    placeholder="(11) 99999-9999"
                  />
                  <EditField
                    label="E-mail"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    placeholder="email@exemplo.com"
                  />
                  <div className="space-y-1">
                    <EditField
                      label="CPF / CNPJ"
                      value={form.document}
                      onChange={(v) => setForm((f) => ({ ...f, document: v }))}
                      placeholder="000.000.000-00"
                    />
                    {(() => {
                      const digits = onlyDigits(form.document);
                      if ((digits.length === 11 || digits.length === 14) && !isValidDocument(digits)) {
                        const type = detectDocumentType(digits);
                        return (
                          <p className="text-xs text-destructive">
                            {type ? `${type} inválido.` : "Documento inválido."}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <EditField
                    label="Endereço"
                    value={form.address}
                    onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                    placeholder="Rua e complemento"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <EditField
                      label="Número"
                      value={form.addressNumber}
                      onChange={(v) => setForm((f) => ({ ...f, addressNumber: v }))}
                      placeholder="123"
                    />
                    <EditField
                      label="Referência"
                      value={form.addressReference}
                      onChange={(v) => setForm((f) => ({ ...f, addressReference: v }))}
                      placeholder="Próx. ao mercado..."
                    />
                  </div>
                  <EditField
                    label="Bairro"
                    value={form.neighborhood}
                    onChange={(v) => setForm((f) => ({ ...f, neighborhood: v }))}
                    placeholder="Centro"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <EditField
                      label="Cidade"
                      value={form.city}
                      onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                      placeholder="São Paulo"
                    />
                    <EditField
                      label="Estado"
                      value={form.state}
                      onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                      placeholder="SP"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CEP</Label>
                    <div className="relative">
                      <Input
                        value={form.zipCode}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, zipCode: formatCep(e.target.value) }))
                        }
                        placeholder="00000-000"
                        maxLength={9}
                        className="h-8 text-sm pr-7"
                      />
                      {cepStatus === "loading" && (
                        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      {cepStatus === "found" && (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
                      )}
                      {cepStatus === "error" && (
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    {cepStatus === "error" && cepError && (
                      <p className="text-xs text-destructive">{cepError}</p>
                    )}
                    {cepStatus === "found" && (
                      <p className="text-xs text-green-600">Endereço preenchido automaticamente.</p>
                    )}
                  </div>
                  <EditField
                    label="Observações"
                    value={form.notes}
                    onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                    multiline
                    placeholder="Informações adicionais..."
                  />

                  {/* Botões de ação */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={cancelEdit}
                      disabled={updateMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t border-border pt-4">
                  <InfoRow icon={Phone} label="Telefone" value={customer.phone} />
                  <InfoRow icon={Mail} label="E-mail" value={customer.email} />
                  <InfoRow icon={FileText} label="CPF / CNPJ" value={customer.document} />
                  <InfoRow icon={MapPin} label="Endereço" value={fullAddress || null} />
                  {customer.addressReference && (
                    <InfoRow icon={MapPin} label="Referência" value={customer.addressReference} />
                  )}
                  {customer.notes && (
                    <InfoRow icon={FileText} label="Observações" value={customer.notes} />
                  )}

                  {/* Acesso ao portal — senha provisória */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <KeyRound className="h-3 w-3" />
                      Acesso ao portal do cliente
                    </p>
                    <div className="flex gap-2">
                      {!customer.localLoginEnabled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => generatePasswordMutation.mutate({ customerId })}
                          disabled={generatePasswordMutation.isPending}
                        >
                          {generatePasswordMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Gerar senha de acesso
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              disabled={resendPasswordMutation.isPending}
                            >
                              {resendPasswordMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Reenviar senha
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reenviar senha provisória?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso irá gerar uma nova senha provisória para <strong>{customer.name}</strong>.
                                A senha anterior será invalidada e o cliente precisará trocar a nova senha no próximo acesso.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => resendPasswordMutation.mutate({ customerId })}
                              >
                                Gerar nova senha
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="pt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={openEdit}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar dados
                    </Button>
                    {customer.phone && (
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-800"
                              onClick={() => {
                                const phone = String(customer.phone).replace(/\D/g, "");
                                window.open(`https://wa.me/55${phone}`, "_blank");
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">WhatsApp: {customer.phone}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/painel/os/nova?customerId=${customerId}`)}
                    >
                      <ClipboardPlus className="h-3.5 w-3.5 mr-1.5" />
                      Nova OS
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aparelhos cadastrados */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Aparelhos Cadastrados
                {devices.length > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {devices.length} {devices.length === 1 ? "aparelho" : "aparelhos"}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 px-2.5 text-xs"
                  onClick={openDeviceModal}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo Aparelho
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingDevices ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Smartphone className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Nenhum aparelho cadastrado</p>
                  <Button size="sm" variant="outline" onClick={openDeviceModal}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Cadastrar primeiro aparelho
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {device.brand} {device.model}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {device.type && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Cpu className="h-3 w-3" /> {device.type}
                            </span>
                          )}
                          {device.color && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Palette className="h-3 w-3" /> {device.color}
                            </span>
                          )}
                          {device.imei && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                              <Fingerprint className="h-3 w-3" /> IMEI: {device.imei}
                            </span>
                          )}
                          {device.serialNumber && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                              <Hash className="h-3 w-3" /> SN: {device.serialNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Histórico de Ordens de Serviço */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Histórico de Ordens de Serviço
              {ordersTotalCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs font-normal">
                  {ordersTotalCount} {ordersTotalCount === 1 ? "ordem" : "ordens"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingOrders ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma ordem de serviço registrada
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {orders.map((os) => (
                    <div
                      key={os.id}
                      className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                      onClick={() => navigate(`/painel/os/${os.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/painel/os/${os.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground font-mono">
                            {os.osNumber}
                          </span>
                          <StatusBadge status={os.status} size="sm" />
                          <Badge variant="outline" className="text-xs font-normal capitalize">
                            {os.origin === "balcao" ? "Balcão" : "Coleta"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {os.reportedDefect}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Calendar className="h-3 w-3" />
                        {new Date(os.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>

                {ordersTotalCount > PAGE_SIZE && (
                  <div className="mt-4">
                    <Pagination
                      currentPage={ordersPage}
                      totalPages={ordersTotalPages}
                      totalCount={ordersTotalCount}
                      pageSize={PAGE_SIZE}
                      onPageChange={setOrdersPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Modal: Novo Aparelho ─────────────────────────────────────────────────────────────────────── */}
      <Dialog open={deviceModalOpen} onOpenChange={setDeviceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Novo Aparelho
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Marca + Modelo (obrigatórios) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Marca <span className="text-destructive">*</span>
                </Label>
                <BrandCombobox
                  value={deviceForm.brand}
                  onChange={(v) => setDeviceForm((f) => ({ ...f, brand: v }))}
                  placeholder="Selecione a marca"
                  className="h-8 text-sm"
                  allowedBrands={getBrandsForType(deviceForm.type || "Smartphone")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Modelo <span className="text-destructive">*</span>
                </Label>
                <ModelCombobox
                  value={deviceForm.model}
                  onChange={(val) => setDeviceForm((f) => ({ ...f, model: val }))}
                  brand={deviceForm.brand}
                />
              </div>
            </div>

            {/* Tipo + Cor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select
                  value={deviceForm.type || ""}
                  onValueChange={(v) => setDeviceForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <Input
                  value={deviceForm.color}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="Preto, Branco…"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* IMEI + SN */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IMEI</Label>
                <Input
                  value={deviceForm.imei}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, imei: e.target.value }))}
                  placeholder="15 dígitos"
                  className="h-8 text-sm font-mono"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Número de Série</Label>
                <Input
                  value={deviceForm.serialNumber}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, serialNumber: e.target.value }))}
                  placeholder="SN…"
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                value={deviceForm.notes}
                onChange={(e) => setDeviceForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Detalhes adicionais sobre o aparelho…"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={addDeviceMutation.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button size="sm" onClick={handleAddDevice} disabled={addDeviceMutation.isPending}>
              {addDeviceMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Cadastrar Aparelho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Senha Provisória Gerada */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Senha de Acesso Gerada
            </DialogTitle>
            <DialogDescription className="text-xs">
              Anote ou copie a senha abaixo e repasse ao cliente. Ela será solicitada no primeiro acesso ao portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Senha provisória</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-foreground">
                {provisionalPassword}
              </p>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              O cliente deverá trocar esta senha no primeiro acesso. Após fechar este dialog, a senha não será exibida novamente.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (provisionalPassword) {
                  navigator.clipboard.writeText(provisionalPassword);
                  toast.success("Senha copiada para a área de transferência.");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar senha
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (customer?.phone && provisionalPassword) {
                  const phone = String(customer.phone).replace(/\D/g, "");
                  const msg = encodeURIComponent(
                    `Olá ${customer.name}! Sua senha de acesso ao portal é: *${provisionalPassword}*. Acesse e troque sua senha no primeiro login.`
                  );
                  window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
                }
                setPasswordDialogOpen(false);
              }}
              disabled={!customer?.phone}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Enviar por WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}
