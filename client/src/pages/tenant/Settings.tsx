import { useState, useEffect, useRef, useCallback } from "react";
import { getTenantPortalUrl } from "@shared/tenantUrl";
import { parseBusinessHours, DEFAULT_WEEK_SCHEDULE, type WeekSchedule } from "@shared/businessHours";
import { BusinessHoursEditor } from "@/components/BusinessHoursEditor";
import { DeviceSpecialtiesEditor } from "@/components/DeviceSpecialtiesEditor";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Settings,
  Globe,
  Palette,
  Copy,
  ExternalLink,
  Link2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Info,
  ImageIcon,
  UploadCloud,
  Wrench,
  FileText,
  Bell,
  MessageCircle,
  CreditCard,
  Shield,
  ChevronDown,
  ChevronUp,
  Truck,
  Search,
  Star,
  Zap,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

/** Valida formato de domínio no frontend (mesma regex do backend) */
function isValidDomain(d: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i.test(d.trim());
}

const LOGO_MAX_DIMENSION = 512;
const LOGO_MAX_DATA_URL_LENGTH = 2_800_000;

type SupportedLogoMimeType = "image/png" | "image/jpeg" | "image/webp";

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível carregar o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

async function normalizeLogoForUpload(file: File): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(originalDataUrl);
  const ratio = Math.min(1, LOGO_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível preparar o logo no navegador.");
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const preferredMimeType: SupportedLogoMimeType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  let dataUrl = canvas.toDataURL(preferredMimeType, 0.9);
  if (!dataUrl.startsWith(`data:${preferredMimeType};`)) {
    dataUrl = canvas.toDataURL("image/png");
  }

  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  }

  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) {
    throw new Error("O logo continua muito grande. Tente uma imagem menor ou com menos detalhes.");
  }

  return dataUrl;
}

export default function TenantSettings() {
  const utils = trpc.useUtils();
  const { data: tenant, isLoading } = trpc.tenants.getMine.useQuery();

  const [termsText, setTermsText] = useState("");
  const [warrantyTermsText, setWarrantyTermsText] = useState("");
  const [welcomeText, setWelcomeText] = useState("");

  // Notificações de status ao cliente (WhatsApp)
  const [notifyStatuses, setNotifyStatuses] = useState<string[]>([]);
  const [notifyMessages, setNotifyMessages] = useState<Record<string, string>>({});
  const [expandedNotify, setExpandedNotify] = useState<Record<string, boolean>>({});
  const { data: notifyConfig } = trpc.tenants.getNotifyConfig.useQuery();
  const updateNotifyStatuses = trpc.tenants.updateNotifyStatuses.useMutation({
    onSuccess: () => {
      toast.success("Configurações de notificação salvas");
      utils.tenants.getMine.invalidate();
      utils.tenants.getNotifyConfig.invalidate();
    },
    onError: () => toast.error("Erro ao salvar notificações"),
  });

  useEffect(() => {
    if (notifyConfig) {
      setNotifyStatuses(notifyConfig.notifyStatuses);
      setNotifyMessages(notifyConfig.notifyMessages);
    }
  }, [notifyConfig]);

  // Integração Pagar.me para pagamento online do cliente
  const { data: pagarmeConfig } = trpc.tenants.getPagarmeConfig.useQuery();
  const [pagarmeForm, setPagarmeForm] = useState({
    enabled: false,
    environment: "sandbox" as "sandbox" | "production",
    publicKey: "",
    secretKey: "",
    webhookSecret: "",
  });
  const updatePagarmeConfig = trpc.tenants.updatePagarmeConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração Pagar.me salva com segurança");
      setPagarmeForm((prev) => ({ ...prev, publicKey: "", secretKey: "", webhookSecret: "" }));
      utils.tenants.getPagarmeConfig.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Erro ao salvar configuração Pagar.me"),
  });

  useEffect(() => {
    if (pagarmeConfig) {
      setPagarmeForm((prev) => ({
        ...prev,
        enabled: Boolean(pagarmeConfig.enabled),
        environment: pagarmeConfig.environment,
        publicKey: "",
        secretKey: "",
        webhookSecret: "",
      }));
    }
  }, [pagarmeConfig]);

  // Logística: coleta própria e Uber Direct
  const { data: uberDirectConfig } = trpc.tenants.getUberDirectConfig.useQuery();
  const [uberDirectForm, setUberDirectForm] = useState({
    ownDeliveryEnabled: true,
    enabled: false,
    environment: "sandbox" as "sandbox" | "production",
    customerId: "",
    clientId: "",
    clientSecret: "",
  });
  const updateUberDirectConfig = trpc.tenants.updateUberDirectConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração de logística salva com segurança");
      setUberDirectForm((prev) => ({ ...prev, customerId: "", clientId: "", clientSecret: "" }));
      utils.tenants.getUberDirectConfig.invalidate();
      utils.tenants.getMine.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Erro ao salvar configuração Uber Direct"),
  });

  useEffect(() => {
    if (uberDirectConfig) {
      setUberDirectForm((prev) => ({
        ...prev,
        ownDeliveryEnabled: Boolean(uberDirectConfig.ownDeliveryEnabled),
        enabled: Boolean(uberDirectConfig.enabled),
        environment: uberDirectConfig.environment,
        customerId: "",
        clientId: "",
        clientSecret: "",
      }));
    }
  }, [uberDirectConfig]);

  // Cobertura por CEP
  const [coveragePrefixes, setCoveragePrefixes] = useState<string[]>([]);
  const [coverageInput, setCoverageInput] = useState("");
  const [coverageDeadlines, setCoverageDeadlines] = useState<Record<string, number>>({});
  const [defaultDeadline, setDefaultDeadline] = useState<string>("24");
  const updateCoverageDeadlines = trpc.tenants.updateCoverageDeadlines.useMutation({
    onSuccess: () => {
      toast.success("Prazos de coleta salvos");
      utils.tenants.getMine.invalidate();
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: () => toast.error("Erro ao salvar prazos"),
  });
  const updateCoverage = trpc.tenants.updateCoverage.useMutation({
    onSuccess: () => {
      toast.success("Área de cobertura salva");
      utils.tenants.getMine.invalidate();
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: () => toast.error("Erro ao salvar área de cobertura"),
  });

  const updateWelcomeText = trpc.tenants.updateWelcomeText.useMutation({
    onSuccess: () => {
      toast.success("Texto de boas-vindas salvo!");
      utils.tenants.getMine.invalidate();
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: () => toast.error("Erro ao salvar texto de boas-vindas"),
  });

  const updateTerms = trpc.tenants.updateTerms.useMutation({
    onSuccess: () => {
      toast.success("Termo de serviço salvo");
      utils.tenants.getMine.invalidate();
    },
    onError: () => toast.error("Erro ao salvar o termo"),
  });

  const update = trpc.tenants.updateMine.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas");
      utils.tenants.getMine.invalidate();
      // Invalida o cache do portal público para refletir as mudanças imediatamente
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const updateDomain = trpc.tenants.updateCustomDomain.useMutation({
    onSuccess: (data) => {
      toast.success(`Domínio ${data.customDomain} configurado com sucesso`);
      utils.tenants.getMine.invalidate();
      setDomainInput("");
    },
    onError: (err) => toast.error(err.message ?? "Erro ao configurar domínio"),
  });

  const removeDomain = trpc.tenants.removeCustomDomain.useMutation({
    onSuccess: () => {
      toast.success("Domínio personalizado removido");
      utils.tenants.getMine.invalidate();
    },
    onError: () => toast.error("Erro ao remover domínio"),
  });

  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule>(DEFAULT_WEEK_SCHEDULE);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsappNumber: "",
    businessHours: "",
    address: "",
    city: "",
    state: "",
    primaryColor: "#1e3a5f",
    secondaryColor: "#d97706",
  });

  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState("");
  const [colorError, setColorError] = useState("");
  const [notificationEmailInput, setNotificationEmailInput] = useState("");
  const updateNotificationEmail = trpc.tenants.updateNotificationEmail.useMutation({
    onSuccess: () => {
      toast.success("E-mail de notificações salvo!");
      utils.tenants.getMine.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Erro ao salvar e-mail"),
  });

  /** Valida formato hexadecimal #RGB ou #RRGGBB */
  const isValidHex = (v: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v.trim());

  /** Retorna '#ffffff' ou '#000000' com base na luminância percebida */
  const getContrastColor = (hex: string): string => {
    const clean = hex.replace("#", "");
    if (clean.length !== 6 && clean.length !== 3) return "#ffffff";
    const full = clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // Luminância relativa (WCAG)
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 140 ? "#000000" : "#ffffff";
  };

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLogoProcessing, setIsLogoProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = trpc.tenants.uploadLogo.useMutation({
    onSuccess: () => {
      toast.success("Logo atualizado com sucesso");
      setLogoPreview(null);
      utils.tenants.getMine.invalidate();
      // Invalida o cache do portal público para refletir o novo logo imediatamente
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Erro ao enviar logo"),
  });

  const removeLogo = trpc.tenants.removeLogo.useMutation({
    onSuccess: () => {
      toast.success("Logo removido");
      utils.tenants.getMine.invalidate();
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: () => toast.error("Erro ao remover logo"),
  });

  const processLogoFile = useCallback(async (file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG ou WebP.");
      return;
    }

    setIsLogoProcessing(true);
    try {
      const dataUrl = await normalizeLogoForUpload(file);
      setLogoPreview(dataUrl);
      toast.success("Logo preparado para envio");
    } catch (error) {
      console.error("[TenantSettings] Falha ao processar logo:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao preparar o logo");
    } finally {
      setIsLogoProcessing(false);
    }
  }, []);

  const handleLogoUpload = () => {
    if (!logoPreview) return;
    const mimeMatch = logoPreview.match(/^data:([^;]+);/);
    const mimeType = mimeMatch?.[1];
    if (!mimeType || !["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      toast.error("Formato inválido. Selecione novamente o logo em PNG, JPG ou WebP.");
      return;
    }
    uploadLogo.mutate({ dataUrl: logoPreview, mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp" });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processLogoFile(file);
  }, [processLogoFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name ?? "",
        phone: tenant.phone ?? "",
        whatsappNumber: tenant.whatsappNumber ?? "",
        businessHours: tenant.businessHours ?? "",
        address: tenant.address ?? "",
        city: tenant.city ?? "",
        state: tenant.state ?? "",
        primaryColor: tenant.primaryColor ?? "#1e3a5f",
        secondaryColor: tenant.secondaryColor ?? "#d97706",
      });
      setTermsText(tenant.serviceTerms ?? "");
      setWarrantyTermsText((tenant as any).warrantyTerms ?? "");
      setWelcomeText((tenant as any).welcomeText ?? "");
      setNotificationEmailInput((tenant as any).notificationEmail ?? "");
      // Inicializa o editor de horário estruturado
      const parsedHours = parseBusinessHours(tenant.businessHours ?? "");
      if (parsedHours) setWeekSchedule(parsedHours);
      try {
        const raw = (tenant as any).coverageZipPrefixes;
        setCoveragePrefixes(raw ? JSON.parse(raw) : []);
      } catch {
        setCoveragePrefixes([]);
      }
      try {
        const rawD = (tenant as any).coverageDeadlines;
        const parsed: Record<string, number> = rawD ? JSON.parse(rawD) : {};
        const { default: def, ...rest } = parsed;
        setCoverageDeadlines(rest);
        setDefaultDeadline(def != null ? String(def) : "24");
      } catch {
        setCoverageDeadlines({});
        setDefaultDeadline("24");
      }
    }
  }, [tenant]);

  const upd = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "primaryColor" || field === "secondaryColor") {
      if (value && !isValidHex(value)) {
        setColorError("Formato inválido. Use #RGB ou #RRGGBB (ex: #1e3a5f)");
      } else {
        setColorError("");
      }
    }
  };

  // ── Especialidades (tipos e marcas que o tenant atende) ──────────────────
  const [specialties, setSpecialties] = useState<Record<string, string[]>>({});
  const { data: savedSpecialties } = trpc.tenants.getSpecialties.useQuery();
  const updateSpecialties = trpc.tenants.updateSpecialties.useMutation({
    onSuccess: () => {
      toast.success("Especialidades salvas!");
      utils.tenants.getSpecialties.invalidate();
      utils.public.getTenantByHost.invalidate();
      utils.public.getTenantInfo.invalidate();
    },
    onError: () => toast.error("Erro ao salvar especialidades"),
  });
  useEffect(() => {
    if (savedSpecialties) setSpecialties(savedSpecialties);
  }, [savedSpecialties]);

  const portalUrl = tenant
    ? getTenantPortalUrl(tenant.slug, tenant.customDomain ?? null)
    : "";
  const pagarmeWebhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/pagarme`
    : "/api/webhooks/pagarme";

  const handleDomainChange = (v: string) => {
    setDomainInput(v);
    if (v && !isValidDomain(v)) {
      setDomainError("Formato inválido. Ex: rochacelulares.com.br");
    } else {
      setDomainError("");
    }
  };

  const handleSaveDomain = () => {
    if (!domainInput.trim()) return;
    if (!isValidDomain(domainInput)) {
      setDomainError("Formato inválido. Ex: rochacelulares.com.br");
      return;
    }
    updateDomain.mutate({ customDomain: domainInput.trim() });
  };

  if (isLoading) {
    return (
      <TenantLayout title="Configurações">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout title="Configurações">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Informações básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" /> Informações da Assistência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome da assistência</Label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => upd("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input className="mt-1.5" value={form.phone} onChange={(e) => upd("phone", e.target.value)} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  className="mt-1.5"
                  value={form.whatsappNumber}
                  onChange={(e) => upd("whatsappNumber", e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input className="mt-1.5" value={form.city} onChange={(e) => upd("city", e.target.value)} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input className="mt-1.5" value={form.state} onChange={(e) => upd("state", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input className="mt-1.5" value={form.address} onChange={(e) => upd("address", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="mb-2 block">Horário de Funcionamento</Label>
                <BusinessHoursEditor
                  value={weekSchedule}
                  onChange={(schedule) => {
                    setWeekSchedule(schedule);
                    upd("businessHours", JSON.stringify(schedule));
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2">Exibido no portal público com status de aberto/fechado em tempo real.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logotipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" /> Logotipo da Assistência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo atual */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="h-full w-full object-contain" />
                ) : tenant?.logoUrl ? (
                  <img src={tenant.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {logoPreview ? "Pré-visualização" : tenant?.logoUrl ? "Logo atual" : "Sem logo"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {logoPreview
                    ? "Clique em \"Enviar\" para salvar"
                    : "PNG, JPG ou WebP • Máx. 2 MB"}
                </p>
                <div className="flex gap-2 mt-2">
                  {logoPreview ? (
                    <>
                      <Button size="sm" onClick={handleLogoUpload} disabled={uploadLogo.isPending || isLogoProcessing}>
                        {uploadLogo.isPending ? "Enviando..." : isLogoProcessing ? "Preparando..." : "Enviar logo"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLogoPreview(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLogoProcessing}>
                        <UploadCloud className="h-3.5 w-3.5 mr-1.5" /> {isLogoProcessing ? "Preparando..." : "Selecionar arquivo"}
                      </Button>
                      {tenant?.logoUrl && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover logotipo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O logotipo será removido do portal público e do painel. Será substituído pelas iniciais da assistência.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeLogo.mutate()}
                                disabled={removeLogo.isPending}
                              >
                                {removeLogo.isPending ? "Removendo..." : "Remover"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Drag-and-drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <UploadCloud className={`h-7 w-7 ${isDragging ? "text-primary" : "text-muted-foreground/50"}`} />
              <p className="text-sm text-muted-foreground text-center">
                <span className="font-medium text-foreground">Clique ou arraste</span> uma imagem aqui
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP • compressão automática para upload</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processLogoFile(file);
                e.target.value = "";
              }}
            />
          </CardContent>
        </Card>

        {/* Personalização visual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" /> Personalização Visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Temas prontos */}
            <div className="space-y-2">
              <Label>Temas prontos</Label>
              <p className="text-xs text-muted-foreground">Aplique uma combinação de cores com um clique. Você pode ajustar individualmente depois.</p>
              <div className="grid grid-cols-2 gap-2 mt-1 sm:grid-cols-4">
                {[
                  {
                    name: "Profissional",
                    description: "Azul marinho + Dourado",
                    primary: "#1e3a5f",
                    secondary: "#d97706",
                  },
                  {
                    name: "Vibrante",
                    description: "Azul céu + Laranja",
                    primary: "#0ea5e9",
                    secondary: "#ea580c",
                  },
                  {
                    name: "Elegante",
                    description: "Roxo + Rosa",
                    primary: "#7c3aed",
                    secondary: "#ec4899",
                  },
                  {
                    name: "Natural",
                    description: "Verde + Verde Limão",
                    primary: "#16a34a",
                    secondary: "#84cc16",
                  },
                  {
                    name: "Moderno",
                    description: "Cinza escuro + Ciano",
                    primary: "#374151",
                    secondary: "#06b6d4",
                  },
                  {
                    name: "Energético",
                    description: "Vermelho + Amarelo",
                    primary: "#dc2626",
                    secondary: "#f59e0b",
                  },
                  {
                    name: "Teal",
                    description: "Teal + Verde Esmeralda",
                    primary: "#0f766e",
                    secondary: "#22c55e",
                  },
                  {
                    name: "Royal",
                    description: "Azul Royal + Violeta",
                    primary: "#1d4ed8",
                    secondary: "#8b5cf6",
                  },
                ].map((theme) => {
                  const isActive =
                    form.primaryColor.toLowerCase() === theme.primary &&
                    form.secondaryColor.toLowerCase() === theme.secondary;
                  return (
                    <button
                      key={theme.name}
                      title={`${theme.name}: ${theme.description}`}
                      onClick={() => {
                        upd("primaryColor", theme.primary);
                        upd("secondaryColor", theme.secondary);
                      }}
                      className={`relative flex flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all hover:scale-[1.02] ${
                        isActive
                          ? "border-foreground shadow-md"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      {/* Amostra das duas cores */}
                      <div className="flex gap-1">
                        <div
                          className="h-5 w-5 rounded-md shadow-sm"
                          style={{ backgroundColor: theme.primary }}
                        />
                        <div
                          className="h-5 w-5 rounded-md shadow-sm"
                          style={{ backgroundColor: theme.secondary }}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-none">{theme.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{theme.description}</p>
                      </div>
                      {isActive && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--background)" }}>
                            <polyline points="1.5,6 4.5,9 10.5,3" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paleta predefinida */}
            <div className="space-y-2">
              <Label>Cor primária</Label>
              <p className="text-xs text-muted-foreground">Escolha uma cor predefinida ou personalize abaixo.</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { hex: "#1e3a5f", name: "Azul Marinho" },
                  { hex: "#0ea5e9", name: "Azul Céu" },
                  { hex: "#16a34a", name: "Verde" },
                  { hex: "#7c3aed", name: "Roxo" },
                  { hex: "#dc2626", name: "Vermelho" },
                  { hex: "#ea580c", name: "Laranja" },
                  { hex: "#d97706", name: "Dourado" },
                  { hex: "#0f766e", name: "Teal" },
                  { hex: "#1d4ed8", name: "Azul Royal" },
                  { hex: "#374151", name: "Cinza Escuro" },
                ].map((color) => (
                  <button
                    key={color.hex}
                    title={color.name}
                    onClick={() => upd("primaryColor", color.hex)}
                    className={`h-8 w-8 rounded-lg border-2 transition-all ${
                      form.primaryColor.toLowerCase() === color.hex
                        ? "border-foreground scale-110 shadow-md"
                        : "border-transparent hover:scale-105 hover:border-border"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Paleta predefinida — cor secundária */}
            <div className="space-y-2">
              <Label>Cor secundária</Label>
              <p className="text-xs text-muted-foreground">Usada nos botões de destaque e no ícone do hero. Escolha uma cor predefinida ou personalize abaixo.</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { hex: "#d97706", name: "Dourado" },
                  { hex: "#f59e0b", name: "Amarelo âmbar" },
                  { hex: "#ea580c", name: "Laranja" },
                  { hex: "#f97316", name: "Laranja Claro" },
                  { hex: "#84cc16", name: "Verde Limão" },
                  { hex: "#22c55e", name: "Verde Esmeralda" },
                  { hex: "#ef4444", name: "Vermelho Coral" },
                  { hex: "#ec4899", name: "Rosa" },
                  { hex: "#8b5cf6", name: "Violeta" },
                  { hex: "#06b6d4", name: "Ciano" },
                ].map((color) => (
                  <button
                    key={color.hex}
                    title={color.name}
                    onClick={() => upd("secondaryColor", color.hex)}
                    className={`h-8 w-8 rounded-lg border-2 transition-all ${
                      form.secondaryColor.toLowerCase() === color.hex
                        ? "border-foreground scale-110 shadow-md"
                        : "border-transparent hover:scale-105 hover:border-border"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Seletores customizados */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cor primária personalizada</Label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => upd("primaryColor", e.target.value)}
                    className="h-9 w-12 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => upd("primaryColor", e.target.value)}
                    className={`font-mono text-sm ${colorError ? "border-destructive" : ""}`}
                    placeholder="#1e3a5f"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cor secundária personalizada</Label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => upd("secondaryColor", e.target.value)}
                    className="h-9 w-12 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form.secondaryColor}
                    onChange={(e) => upd("secondaryColor", e.target.value)}
                    className="font-mono text-sm"
                    placeholder="#d97706"
                  />
                </div>
              </div>
            </div>

            {colorError && (
              <p className="text-xs text-destructive">{colorError}</p>
            )}

            {/* Preview em tempo real — hero fiel ao portal público */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pré-visualização do portal público</Label>
              <div className="rounded-xl border border-border overflow-hidden shadow-sm select-none">

                {/* ── Header sticky simulado ── */}
                <div
                  className="px-4 py-2.5 flex items-center gap-2.5"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
                    {(logoPreview ?? tenant?.logoUrl) ? (
                      <img src={logoPreview ?? tenant?.logoUrl ?? ""} alt="logo" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs font-bold" style={{ color: getContrastColor(form.primaryColor) }}>
                        {(form.name || tenant?.name || "FR").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: getContrastColor(form.primaryColor) }}>
                      {form.name || tenant?.name || "Sua Assistência"}
                    </p>
                  </div>
                  <div
                    className="text-xs px-2 py-0.5 rounded-md font-medium shrink-0"
                    style={{ border: `1px solid ${getContrastColor(form.primaryColor)}40`, color: getContrastColor(form.primaryColor) }}
                  >
                    Entrar
                  </div>
                </div>

                {/* ── Hero simulado ── */}
                <div
                  className="relative overflow-hidden px-4 py-5"
                  style={{
                    background: `linear-gradient(145deg, ${form.primaryColor} 0%, ${form.primaryColor}cc 100%)`,
                  }}
                >
                  {/* Padrão de pontos */}
                  <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="prev-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill={getContrastColor(form.primaryColor)} />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#prev-dots)" />
                  </svg>
                  {/* Círculo decorativo */}
                  <div
                    className="absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-10 blur-xl"
                    style={{ backgroundColor: getContrastColor(form.primaryColor) }}
                  />

                  <div className="relative flex items-start gap-3">
                    {/* Coluna de texto */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: "rgba(22,163,74,0.25)", color: getContrastColor(form.primaryColor), border: "1px solid rgba(22,163,74,0.4)" }}
                        >
                          <span className="h-1 w-1 rounded-full bg-green-400" />
                          Aberto agora
                        </span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: "rgba(255,255,255,0.15)", color: getContrastColor(form.primaryColor) }}
                        >
                          <Star className="h-2.5 w-2.5" />
                          Assistência Técnica
                        </span>
                      </div>

                      {/* Logo + Nome */}
                      <div className="flex items-center gap-2">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                        >
                          {(logoPreview ?? tenant?.logoUrl) ? (
                            <img src={logoPreview ?? tenant?.logoUrl ?? ""} alt="logo" className="h-full w-full object-contain rounded-xl" />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: getContrastColor(form.primaryColor) }}>
                              {(form.name || tenant?.name || "FR").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight" style={{ color: getContrastColor(form.primaryColor) }}>
                            {form.name || tenant?.name || "Sua Assistência"}
                          </p>
                          <p className="text-[10px]" style={{ color: getContrastColor(form.primaryColor), opacity: 0.7 }}>
                            São Paulo, SP
                          </p>
                        </div>
                      </div>

                      {/* Subtítulo */}
                      <p className="text-[11px] leading-relaxed" style={{ color: getContrastColor(form.primaryColor), opacity: 0.85 }}>
                        Solicite coleta, acompanhe sua OS ou verifique sua garantia digital.
                      </p>

                      {/* CTAs */}
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold shadow-sm"
                          style={{ backgroundColor: form.secondaryColor, color: getContrastColor(form.secondaryColor) }}
                        >
                          <Truck className="h-3 w-3" />
                          Solicitar Coleta
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                          style={{ backgroundColor: "rgba(255,255,255,0.18)", color: getContrastColor(form.primaryColor), border: "1px solid rgba(255,255,255,0.35)" }}
                        >
                          <Search className="h-3 w-3" />
                          Rastrear OS
                        </button>
                      </div>
                    </div>

                    {/* Ícone animado */}
                    <div className="shrink-0 flex flex-col items-center justify-center mt-1">
                      <div className="relative">
                        <div
                          className="absolute inset-0 rounded-full opacity-25"
                          style={{ backgroundColor: form.secondaryColor, transform: "scale(1.7)" }}
                        />
                        <div
                          className="relative h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: form.secondaryColor }}
                        >
                          <Wrench className="h-5 w-5" style={{ color: getContrastColor(form.secondaryColor) }} />
                        </div>
                      </div>
                      <div
                        className="mt-4 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: "rgba(255,255,255,0.18)", color: getContrastColor(form.primaryColor) }}
                      >
                        <Zap className="h-2.5 w-2.5" />
                        Rápido
                      </div>
                    </div>
                  </div>

                  {/* Onda de transição */}
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: "12px" }}>
                    <svg viewBox="0 0 400 12" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full" style={{ display: "block" }}>
                      <path d="M0,6 C100,12 300,0 400,6 L400,12 L0,12 Z" fill="var(--background)" />
                    </svg>
                  </div>
                </div>

                {/* ── Seção abaixo do hero (CTA de conta) ── */}
                <div className="bg-background px-4 py-3">
                  <div
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: `${form.primaryColor}10`, border: `1.5px solid ${form.primaryColor}25` }}
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: form.secondaryColor }}
                    >
                      <Star className="h-4 w-4" style={{ color: getContrastColor(form.secondaryColor) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">Crie sua conta grátis</p>
                      <p className="text-[10px] text-muted-foreground">Acompanhe suas OS com facilidade</p>
                    </div>
                    <button
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0"
                      style={{ backgroundColor: form.secondaryColor, color: getContrastColor(form.secondaryColor) }}
                    >
                      Criar conta
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Amostra de contraste */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div
                className="h-9 w-9 rounded-lg shrink-0"
                style={{ backgroundColor: form.primaryColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Contraste do texto</p>
                <p className="text-xs text-muted-foreground">
                  Certifique-se de que o texto branco seja legível sobre a cor escolhida.
                </p>
              </div>
              <div
                  className="px-3 py-1.5 rounded-md text-xs font-semibold shrink-0"
                    style={{
                      backgroundColor: form.primaryColor,
                      color: getContrastColor(form.primaryColor),
                    }}
                  >
                    {getContrastColor(form.primaryColor) === "#000000" ? "Texto escuro" : "Texto claro"}
                  </div>
            </div>

          </CardContent>
        </Card>

        {/* Especialidades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" /> Especialidades e Marcas Atendidas
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Configure os tipos de aparelhos e as marcas que sua assistência atende. Essas informações
              aparecem como chips coloridos na landing page do seu portal público.
              Deixe as marcas em branco para aceitar qualquer marca naquela categoria.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <DeviceSpecialtiesEditor
              value={specialties}
              onChange={setSpecialties}
              primaryColor={form.primaryColor}
            />
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {Object.keys(specialties).length} categoria{Object.keys(specialties).length !== 1 ? "s" : ""} ·{" "}
                {Object.values(specialties).reduce((acc, b) => acc + b.length, 0)} marca{Object.values(specialties).reduce((acc, b) => acc + b.length, 0) !== 1 ? "s" : ""} selecionada{Object.values(specialties).reduce((acc, b) => acc + b.length, 0) !== 1 ? "s" : ""}
              </p>
              <Button
                size="sm"
                onClick={() => updateSpecialties.mutate({ specialties })}
                disabled={updateSpecialties.isPending}
              >
                {updateSpecialties.isPending ? "Salvando..." : "Salvar Especialidades"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Portal público */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" /> Portal Público de Coleta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Compartilhe este link com seus clientes para que eles possam solicitar coleta online.
            </p>
            <div className="flex gap-2">
              <Input value={portalUrl} readOnly className="font-mono text-xs bg-muted" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(portalUrl);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => window.open(portalUrl, "_blank")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            {tenant?.slug && (
              <p className="text-xs text-muted-foreground">
                Slug: <span className="font-mono font-medium">{tenant.slug}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Domínio personalizado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" /> Domínio Personalizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status atual */}
            {tenant?.customDomain !== undefined && tenant?.customDomain !== null ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate font-mono">
                      {tenant.customDomain}
                    </p>
                    <p className="text-xs text-muted-foreground">Domínio configurado</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">
                    Ativo
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover domínio personalizado?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O domínio <span className="font-mono font-semibold">{tenant.customDomain}</span> será
                          desvinculado da sua assistência. O portal público voltará a funcionar apenas pelo link
                          padrão do fullreparo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => removeDomain.mutate()}
                          disabled={removeDomain.isPending}
                        >
                          {removeDomain.isPending ? "Removendo..." : "Remover"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">Nenhum domínio personalizado configurado.</p>
                </div>
                <Badge variant="outline" className="text-muted-foreground border-border text-xs shrink-0 ml-3">
                  Não configurado
                </Badge>
              </div>
            )}

            {/* Formulário para configurar novo domínio */}
            <div className="space-y-2">
              <Label>
                {tenant?.customDomain ? "Alterar domínio" : "Configurar domínio próprio"}
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    value={domainInput}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    placeholder="rochacelulares.com.br"
                    className={`font-mono text-sm ${domainError ? "border-destructive" : ""}`}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveDomain()}
                  />
                  {domainError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {domainError}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleSaveDomain}
                  disabled={!domainInput.trim() || !!domainError || updateDomain.isPending}
                >
                  {updateDomain.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>

            {/* Instruções de DNS */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-sm font-semibold text-blue-800">Como configurar o DNS</p>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                Após salvar o domínio acima, acesse o painel do seu provedor de domínio (Registro.br, GoDaddy,
                Cloudflare, etc.) e adicione o seguinte registro DNS:
              </p>
              <div className="rounded-md bg-white border border-blue-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-100 text-blue-800">
                      <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                      <th className="px-3 py-2 text-left font-semibold">Nome</th>
                      <th className="px-3 py-2 text-left font-semibold">Valor</th>
                      <th className="px-3 py-2 text-left font-semibold">TTL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-blue-100">
                      <td className="px-3 py-2 font-mono font-bold text-blue-700">CNAME</td>
                      <td className="px-3 py-2 font-mono">
                        {tenant?.customDomain
                          ? tenant.customDomain.split(".").length > 2
                            ? tenant.customDomain.split(".")[0]
                            : "@"
                          : "seu-dominio"}
                      </td>
                      <td className="px-3 py-2 font-mono text-blue-700">
                        {tenant?.slug ? `${tenant.slug}.fullreparo.com.br` : "slug.fullreparo.com.br"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">3600</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-blue-600">
                A propagação do DNS pode levar de alguns minutos até 48 horas. Após a propagação, seu portal
                público estará acessível pelo domínio configurado.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* E-mail de Notificações de Nova OS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" /> E-mail de Notificações
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Quando uma nova OS chegar pelo portal público (coleta ou cadastro), o sistema enviará um e-mail de alerta para o endereço configurado abaixo.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail para receber alertas de nova OS</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="contato@suaassistencia.com.br"
                  value={notificationEmailInput}
                  onChange={(e) => setNotificationEmailInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => updateNotificationEmail.mutate({ notificationEmail: notificationEmailInput })}
                  disabled={updateNotificationEmail.isPending}
                >
                  {updateNotificationEmail.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              {notificationEmailInput && (
                <p className="text-xs text-muted-foreground">
                  Alertas serão enviados para <span className="font-medium text-foreground">{notificationEmailInput}</span> sempre que uma nova OS chegar pelo portal público.
                </p>
              )}
              {!notificationEmailInput && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhum e-mail configurado. Sem e-mail, as notificações de nova OS aparecerão apenas no painel de notificações interno.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logística */}
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
              <Truck className="h-4 w-4" /> Logística — Coleta Própria e Uber Direct
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Defina quais modalidades a assistência poderá usar para buscar e entregar aparelhos. A coleta própria
              continua disponível para entregadores internos; o Uber Direct pode ser ativado com as credenciais da conta da assistência.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Coleta própria da assistência</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mantém o fluxo atual com atendente, técnico ou entregador interno responsável pela rota.
                </p>
              </div>
              <Switch
                checked={uberDirectForm.ownDeliveryEnabled}
                onCheckedChange={(checked) => setUberDirectForm((prev) => ({ ...prev, ownDeliveryEnabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Uber Direct</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativo, a assistência poderá usar entregadores sob demanda da Uber para coletas e entregas.
                </p>
              </div>
              <Switch
                checked={uberDirectForm.enabled}
                onCheckedChange={(checked) => setUberDirectForm((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={uberDirectForm.environment}
                  onChange={(e) => setUberDirectForm((prev) => ({ ...prev, environment: e.target.value as "sandbox" | "production" }))}
                >
                  <option value="sandbox">Sandbox / testes</option>
                  <option value="production">Produção</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Customer ID</Label>
                <Input
                  value={uberDirectForm.customerId}
                  onChange={(e) => setUberDirectForm((prev) => ({ ...prev, customerId: e.target.value }))}
                  placeholder={uberDirectConfig?.customerIdConfigured ? uberDirectConfig.customerIdPreview ?? "Customer ID já configurado" : "cus_..."}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Client ID</Label>
                <Input
                  value={uberDirectForm.clientId}
                  onChange={(e) => setUberDirectForm((prev) => ({ ...prev, clientId: e.target.value }))}
                  placeholder={uberDirectConfig?.clientIdConfigured ? uberDirectConfig.clientIdPreview ?? "Client ID já configurado" : "Client ID da Uber"}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  value={uberDirectForm.clientSecret}
                  onChange={(e) => setUberDirectForm((prev) => ({ ...prev, clientSecret: e.target.value }))}
                  placeholder={uberDirectConfig?.clientSecretConfigured ? "Client Secret já configurado — deixe em branco para manter" : "Client Secret da Uber"}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 leading-relaxed">
              As credenciais não são exibidas novamente após salvar. Se trocar a chave na Uber, cole os novos dados aqui e salve.
              A ativação operacional de cotações, criação de entrega e rastreio será conectada ao fluxo de coletas/entregas em uma próxima etapa.
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={uberDirectForm.ownDeliveryEnabled ? "default" : "secondary"}>
                  Coleta própria {uberDirectForm.ownDeliveryEnabled ? "ativa" : "inativa"}
                </Badge>
                <Badge variant={uberDirectForm.enabled ? "default" : "secondary"}>
                  Uber Direct {uberDirectForm.enabled ? "ativo" : "inativo"}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => updateUberDirectConfig.mutate({
                  ownDeliveryEnabled: uberDirectForm.ownDeliveryEnabled,
                  enabled: uberDirectForm.enabled,
                  environment: uberDirectForm.environment,
                  customerId: uberDirectForm.customerId.trim() || undefined,
                  clientId: uberDirectForm.clientId.trim() || undefined,
                  clientSecret: uberDirectForm.clientSecret.trim() || undefined,
                })}
                disabled={updateUberDirectConfig.isPending}
              >
                {updateUberDirectConfig.isPending ? "Salvando..." : "Salvar logística"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pagar.me */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
              <CreditCard className="h-4 w-4" /> Pagar.me — PIX e Cartão
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Configure o gateway usado no pagamento opcional da Minha Conta. O cliente só verá PIX/cartão
              depois que o serviço estiver concluído e a entrega for autorizada por ele.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Pagamento online no portal do cliente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativo, as cobranças são criadas no Pagar.me e confirmadas pelo webhook.
                </p>
              </div>
              <Switch
                checked={pagarmeForm.enabled}
                onCheckedChange={(checked) => setPagarmeForm((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={pagarmeForm.environment}
                  onChange={(e) => setPagarmeForm((prev) => ({ ...prev, environment: e.target.value as "sandbox" | "production" }))}
                >
                  <option value="sandbox">Sandbox / testes</option>
                  <option value="production">Produção</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Chave pública</Label>
                <Input
                  value={pagarmeForm.publicKey}
                  onChange={(e) => setPagarmeForm((prev) => ({ ...prev, publicKey: e.target.value }))}
                  placeholder={pagarmeConfig?.publicKeyConfigured ? pagarmeConfig.publicKeyPreview ?? "Chave já configurada" : "pk_test_..."}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Chave secreta</Label>
                <Input
                  type="password"
                  value={pagarmeForm.secretKey}
                  onChange={(e) => setPagarmeForm((prev) => ({ ...prev, secretKey: e.target.value }))}
                  placeholder={pagarmeConfig?.secretKeyConfigured ? "Chave secreta já configurada — deixe em branco para manter" : "sk_test_..."}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Webhook secret</Label>
                <Input
                  type="password"
                  value={pagarmeForm.webhookSecret}
                  onChange={(e) => setPagarmeForm((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                  placeholder={pagarmeConfig?.webhookSecretConfigured ? "Secret já configurado — deixe em branco para manter" : "segredo do webhook"}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-sm font-semibold text-blue-800">URL do webhook</p>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                Cadastre esta URL no painel do Pagar.me para que pagamentos aprovados sejam baixados
                automaticamente no FullReparo.
              </p>
              <div className="flex gap-2">
                <Input value={pagarmeWebhookUrl} readOnly className="font-mono text-xs bg-white" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(pagarmeWebhookUrl);
                    toast.success("URL do webhook copiada");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={pagarmeConfig?.publicKeyConfigured ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}>
                  Pública {pagarmeConfig?.publicKeyConfigured ? "configurada" : "pendente"}
                </Badge>
                <Badge variant="outline" className={pagarmeConfig?.secretKeyConfigured ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}>
                  Secreta {pagarmeConfig?.secretKeyConfigured ? "configurada" : "pendente"}
                </Badge>
                <Badge variant="outline" className={pagarmeConfig?.webhookSecretConfigured ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}>
                  Webhook {pagarmeConfig?.webhookSecretConfigured ? "configurado" : "pendente"}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => updatePagarmeConfig.mutate({
                  enabled: pagarmeForm.enabled,
                  environment: pagarmeForm.environment,
                  publicKey: pagarmeForm.publicKey.trim() || undefined,
                  secretKey: pagarmeForm.secretKey.trim() || undefined,
                  webhookSecret: pagarmeForm.webhookSecret.trim() || undefined,
                })}
                disabled={updatePagarmeConfig.isPending}
              >
                {updatePagarmeConfig.isPending ? "Salvando..." : "Salvar Pagar.me"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notificações de Status ao Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" /> Notificações de Status ao Cliente
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ative os status que devem gerar um link de WhatsApp para enviar ao cliente. Clique em
              {" "}<span className="font-medium text-foreground">Personalizar mensagem</span> para editar
              o texto enviado. Variáveis disponíveis:
              {" "}<code className="text-xs bg-muted px-1 rounded">{"{{nomeCliente}}"}</code>,
              {" "}<code className="text-xs bg-muted px-1 rounded">{"{{numeroOS}}"}</code>,
              {" "}<code className="text-xs bg-muted px-1 rounded">{"{{status}}"}</code>,
              {" "}<code className="text-xs bg-muted px-1 rounded">{"{{nomeTenant}}"}</code>,
              {" "}<code className="text-xs bg-muted px-1 rounded">{"{{linkRastreamento}}"}</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              { value: "pronto", label: "Pronto para retirada", defaultMsg: "Olá, {{nomeCliente}}! Seu aparelho (OS #{{numeroOS}}) está pronto para retirada em {{nomeTenant}}. Acompanhe: {{linkRastreamento}}" },
              { value: "em_reparo", label: "Em reparo", defaultMsg: "Olá, {{nomeCliente}}! Seu aparelho (OS #{{numeroOS}}) está em reparo na {{nomeTenant}}." },
              { value: "aguardando_aprovacao", label: "Aguardando aprovação do orçamento", defaultMsg: "Olá, {{nomeCliente}}! O orçamento da OS #{{numeroOS}} está aguardando sua aprovação. Acesse: {{linkRastreamento}}" },
              { value: "aprovado", label: "Orçamento aprovado", defaultMsg: "Olá, {{nomeCliente}}! Orçamento da OS #{{numeroOS}} aprovado. Iniciando o reparo em breve." },
              { value: "recusado", label: "Orçamento recusado", defaultMsg: "Olá, {{nomeCliente}}! Orçamento da OS #{{numeroOS}} recusado. Entre em contato com {{nomeTenant}} para combinar a devolução." },
              { value: "aguardando_peca", label: "Aguardando peça", defaultMsg: "Olá, {{nomeCliente}}! Estamos aguardando a peça para concluir o reparo da OS #{{numeroOS}}." },
              { value: "aguardando_entrega", label: "Aguardando entrega", defaultMsg: "Olá, {{nomeCliente}}! Seu aparelho (OS #{{numeroOS}}) está pronto e aguardando agendamento de entrega." },
              { value: "saiu_para_entrega", label: "Saiu para entrega", defaultMsg: "Olá, {{nomeCliente}}! Seu aparelho (OS #{{numeroOS}}) saiu para entrega. Acompanhe: {{linkRastreamento}}" },
              { value: "entregue", label: "Entregue", defaultMsg: "Olá, {{nomeCliente}}! Seu aparelho (OS #{{numeroOS}}) foi entregue. Obrigado por escolher {{nomeTenant}}!" },
              { value: "finalizado", label: "Finalizado", defaultMsg: "Olá, {{nomeCliente}}! A OS #{{numeroOS}} foi finalizada. Obrigado pela preferência!" },
              { value: "cancelado", label: "Cancelado", defaultMsg: "Olá, {{nomeCliente}}! A OS #{{numeroOS}} foi cancelada. Entre em contato com {{nomeTenant}} para mais informações." },
            ] as { value: string; label: string; defaultMsg: string }[]).map((s) => {
              const isActive = notifyStatuses.includes(s.value);
              const isExpanded = expandedNotify[s.value] ?? false;
              const customMsg = notifyMessages[s.value] ?? "";
              return (
                <div key={s.value} className={`rounded-lg border transition-colors ${
                  isActive ? "border-green-200 bg-green-50/50" : "border-border bg-muted/20"
                }`}>
                  {/* Linha principal: toggle + label + expandir */}
                  <div className="flex items-center justify-between py-2 px-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageCircle className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? "text-green-600" : "text-muted-foreground"
                      }`} />
                      <span className={`text-sm ${
                        isActive ? "font-medium" : "text-muted-foreground"
                      }`}>{s.label}</span>
                      {customMsg && isActive && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 ml-1">
                          Personalizada
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => setExpandedNotify((prev) => ({ ...prev, [s.value]: !prev[s.value] }))}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {isExpanded ? "Ocultar" : "Personalizar mensagem"}
                        </button>
                      )}
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => {
                          setNotifyStatuses((prev) =>
                            checked ? [...prev, s.value] : prev.filter((x) => x !== s.value)
                          );
                          if (checked) {
                            // Ao ativar, expandir automaticamente para o usuário ver/editar a mensagem
                            setExpandedNotify((prev) => ({ ...prev, [s.value]: true }));
                          } else {
                            setExpandedNotify((prev) => ({ ...prev, [s.value]: false }));
                          }
                        }}
                      />
                    </div>
                  </div>
                  {/* Área expandível: textarea da mensagem */}
                  {isActive && isExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      <Label className="text-xs text-muted-foreground">Mensagem personalizada</Label>
                      <Textarea
                        value={customMsg}
                        onChange={(e) =>
                          setNotifyMessages((prev) => ({ ...prev, [s.value]: e.target.value }))
                        }
                        placeholder={s.defaultMsg}
                        rows={3}
                        className="text-xs resize-y"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco para usar a mensagem padrão do sistema.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={() => updateNotifyStatuses.mutate({ notifyStatuses, notifyMessages })}
                disabled={updateNotifyStatuses.isPending}
              >
                {updateNotifyStatuses.isPending ? "Salvando..." : "Salvar Notificações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Texto de Boas-vindas do Portal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" /> Texto de Boas-vindas
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mensagem exibida no hero da landing page do seu portal público. Use para apresentar sua assistência, diferenciais ou uma chamada para ação. Máximo 300 caracteres.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              placeholder="Ex: Especialistas em Apple e Samsung há 10 anos em São Paulo. Reparo rápido, garantia real e atendimento humanizado."
              rows={3}
              maxLength={300}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {welcomeText.length}/300 caracteres
              </p>
              <Button
                size="sm"
                onClick={() => updateWelcomeText.mutate({ welcomeText })}
                disabled={updateWelcomeText.isPending}
              >
                {updateWelcomeText.isPending ? "Salvando..." : "Salvar Boas-vindas"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Termo de Serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Termo de Serviço
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Este texto é impresso junto com a OS de balcão (o cliente assina físicamente) e exibido em um
              modal de aceite no portal de solicitação de coleta antes de o cliente confirmar.
              Deixe em branco para não usar termo.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="Ex: Ao entregar o aparelho, o cliente declara estar ciente de que a assistência não se responsabiliza por dados armazenados no dispositivo..."
              rows={8}
              className="resize-y text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {termsText.length} caracteres
              </p>
              <Button
                size="sm"
                onClick={() => updateTerms.mutate({ serviceTerms: termsText })}
                disabled={updateTerms.isPending}
              >
                {updateTerms.isPending ? "Salvando..." : "Salvar Termo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Termo de Garantia */}
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
              <Shield className="h-4 w-4" /> Termo de Garantia
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Este texto é exibido no modal de encerramento da OS (antes de confirmar) e impresso no
              comprovante de garantia entregue ao cliente. Deixe em branco para não usar termo de garantia.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={warrantyTermsText}
              onChange={(e) => setWarrantyTermsText(e.target.value)}
              placeholder="Ex: A garantia cobre defeitos de mão de obra e peças substituídas por esta assistência. Não cobre danos físicos, líquidos, quedas ou uso inadequado. Para acionar a garantia, apresente este comprovante..."
              rows={6}
              className="resize-y text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {warrantyTermsText.length} caracteres
              </p>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => updateTerms.mutate({ warrantyTerms: warrantyTermsText })}
                disabled={updateTerms.isPending}
              >
                {updateTerms.isPending ? "Salvando..." : "Salvar Termo de Garantia"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Área de Cobertura por CEP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" /> Área de Cobertura e Prazos de Coleta
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Informe os prefixos de CEP que sua assistência atende e o prazo estimado de coleta para cada região. Deixe vazio para aceitar qualquer CEP.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adicionar prefixo */}
            <div className="flex gap-2">
              <Input
                value={coverageInput}
                onChange={(e) => setCoverageInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Prefixo CEP (ex: 01, 04)"
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = coverageInput.trim();
                    if (val && !coveragePrefixes.includes(val)) {
                      setCoveragePrefixes((p) => [...p, val]);
                    }
                    setCoverageInput("");
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const val = coverageInput.trim();
                  if (val && !coveragePrefixes.includes(val)) {
                    setCoveragePrefixes((p) => [...p, val]);
                  }
                  setCoverageInput("");
                }}
              >
                Adicionar
              </Button>
            </div>

            {/* Lista de prefixos com prazo */}
            {coveragePrefixes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Prefixos e prazos configurados:</p>
                {coveragePrefixes.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono w-16 justify-center shrink-0">{p}</Badge>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={coverageDeadlines[p] ?? ""}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setCoverageDeadlines((prev) => ({
                          ...prev,
                          [p]: isNaN(v) ? 0 : v,
                        }));
                      }}
                      placeholder="Prazo (h)"
                      className="w-28 font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground">horas</span>
                    <button
                      className="ml-auto text-muted-foreground hover:text-destructive text-xs"
                      onClick={() => {
                        setCoveragePrefixes((prev) => prev.filter((x) => x !== p));
                        setCoverageDeadlines((prev) => { const n = { ...prev }; delete n[p]; return n; });
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum prefixo configurado — todos os CEPs serão aceitos.</p>
            )}

            {/* Prazo padrão (fallback) */}
            <div className="border-t pt-3 space-y-1">
              <Label className="text-xs">Prazo padrão (para CEPs não listados acima)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={defaultDeadline}
                  onChange={(e) => setDefaultDeadline(e.target.value)}
                  className="w-28 font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">horas</span>
              </div>
              <p className="text-xs text-muted-foreground">Exibido quando o CEP do cliente não corresponde a nenhum prefixo específico.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateCoverage.mutate({ coverageZipPrefixes: coveragePrefixes })}
                disabled={updateCoverage.isPending}
              >
                {updateCoverage.isPending ? "Salvando..." : "Salvar Cobertura"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const deadlines: Record<string, number> = { ...coverageDeadlines };
                  const def = parseInt(defaultDeadline);
                  if (!isNaN(def) && def > 0) deadlines["default"] = def;
                  updateCoverageDeadlines.mutate({ deadlines });
                }}
                disabled={updateCoverageDeadlines.isPending}
              >
                {updateCoverageDeadlines.isPending ? "Salvando..." : "Salvar Prazos"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          onClick={() => update.mutate(form)}
          disabled={update.isPending}
        >
          {update.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </TenantLayout>
  );
}
