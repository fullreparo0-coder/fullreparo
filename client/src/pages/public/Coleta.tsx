/**
 * PublicColeta — Formulário de solicitação de coleta do portal público.
 *
 * - Detecta o tenant pelo host (TenantHostContext) ou slug na URL (/coleta/:slug)
 * - Pré-preenche dados do cliente quando ele está logado (customerAuth.meLocal)
 * - Usa useTenantNav para preservar ?tenant= em todas as navegações internas
 * - Exibe modal de aceite de termo de serviço quando configurado pelo tenant
 * - Busca automática de endereço via ViaCEP ao digitar o CEP
 */

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { useTenantNav } from "@/hooks/useTenantNav";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Truck, CheckCircle2, Wrench, ArrowRight, MessageCircle,
  FileText, User, MapPin, Smartphone, ChevronRight,
  CalendarDays, Sun, Sunset, Moon, Search, Camera, X, Navigation,
} from "lucide-react";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { useDeviceSpecialties } from "@/hooks/useDeviceSpecialties";

/** Retorna '#ffffff' ou '#000000' com base na luminância WCAG */
function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return "#ffffff";
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#000000" : "#ffffff";
}

// DEVICE_TYPES local removido — substituído pelo hook useDeviceSpecialties que usa as especialidades do tenant

const SHIFTS = [
  { id: "manha",  label: "Manhã",  range: "08h – 12h", Icon: Sun },
  { id: "tarde",  label: "Tarde",  range: "12h – 18h", Icon: Sunset },
  { id: "noite",  label: "Noite",  range: "18h – 21h", Icon: Moon },
] as const;

type ShiftId = typeof SHIFTS[number]["id"];

/** Retorna os próximos N dias úteis a partir de amanhã (pula domingos). */
function getAvailableDates(count = 7): { value: string; label: string }[] {
  const dates: { value: string; label: string }[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (dates.length < count) {
    if (d.getDay() !== 0) {
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      dates.push({ value: iso, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** Formata string de CEP para 00000-000 */
function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

/** Monta string de endereço completo para salvar no banco */
function buildFullAddress(addr: AddressFields): string {
  const parts = [
    addr.street,
    addr.number ? `nº ${addr.number}` : "",
    addr.complement || "",
    addr.neighborhood || "",
    addr.city ? `${addr.city}${addr.state ? ` - ${addr.state}` : ""}` : "",
    addr.zipCode ? `CEP ${addr.zipCode}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

interface AddressFields {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
}

/** Formata prazo em horas para texto amigável */
function formatDeadline(hours: number): string {
  if (hours < 1) return "Coleta express";
  if (hours === 1) return "Coleta em até 1 hora";
  if (hours < 24) return `Coleta em até ${hours} horas`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  if (days === 1 && rem === 0) return "Coleta no mesmo dia";
  if (days === 1) return `Coleta em até 1 dia e ${rem}h`;
  if (rem === 0) return `Coleta em até ${days} dias úteis`;
  return `Coleta em até ${days} dias e ${rem}h`;
}

export default function PublicColeta() {
  const [, params] = useRoute("/coleta/:slug");
  const { navigate: tenantNavigate } = useTenantNav();

  const { tenant: hostTenant, isHostTenant, loading: hostLoading } = useTenantHost();
  const slugFromUrl = params?.slug ?? "";

  const [submitted, setSubmitted] = useState<{ osNumber: string; token: string } | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deviceType: "Smartphone",
    brand: "",
    model: "",
    reportedDefect: "",
    notes: "",
  });

  const [address, setAddress] = useState<AddressFields>({
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
  });

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [pickupEstimate, setPickupEstimate] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  const [pickupDate, setPickupDate] = useState("");
  const [pickupShift, setPickupShift] = useState<ShiftId | "">("");
  const [saveAddressAsDefault, setSaveAddressAsDefault] = useState(false);
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);

  // Mutation para salvar endereço no perfil do cliente
  const updateMyProfile = trpc.customerAuth.updateMyProfile.useMutation();

  const { data: tenantBySlug, isLoading: slugLoading } = trpc.public.getTenantInfo.useQuery(
    { slug: slugFromUrl },
    { enabled: !isHostTenant && !!slugFromUrl }
  );

  const tenant = isHostTenant ? hostTenant : tenantBySlug ?? null;
  const tenantLoading = isHostTenant ? hostLoading : slugLoading;

  // ── Filtro de tipos e marcas pelas especialidades do tenant ──────────────────
  const { filteredTypes: deviceTypes, getBrandsForType } = useDeviceSpecialties({
    rawJson: tenant?.deviceSpecialties,
  });

  const { data: customerMe } = trpc.customerAuth.meLocal.useQuery();

  // Pré-preencher dados do cliente logado (nome, telefone, e-mail e endereço)
  useEffect(() => {
    if (!customerMe) return;
    setForm((prev) => ({
      ...prev,
      customerName: prev.customerName || customerMe.name || "",
      customerPhone: prev.customerPhone || customerMe.phone || "",
      customerEmail: prev.customerEmail || customerMe.email || "",
    }));
    // Pré-preenche endereço apenas se o cliente tem CEP salvo e o campo está vazio
    if (customerMe.zipCode) {
      setAddress((prev) => ({
        zipCode: prev.zipCode || formatCep(customerMe.zipCode ?? ""),
        street: prev.street || customerMe.address || "",
        number: prev.number || customerMe.addressNumber || "",
        complement: prev.complement || "",
        neighborhood: prev.neighborhood || customerMe.neighborhood || "",
        city: prev.city || customerMe.city || "",
        state: prev.state || customerMe.state || "",
        reference: prev.reference || customerMe.addressReference || "",
      }));
    }
  }, [customerMe]);

  // Busca automática de endereço via ViaCEP
  const handleCepChange = async (raw: string) => {
    const formatted = formatCep(raw);
    setAddress((a) => ({ ...a, zipCode: formatted }));
    setCepError("");

    const digits = formatted.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado. Verifique e tente novamente.");
        setCepLoading(false);
        return;
      }
      setAddress((a) => ({
        ...a,
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: data.uf || "",
        // mantém número, complemento e referência que o usuário já digitou
      }));
      // Validar cobertura e calcular estimativa de coleta
      setPickupEstimate(null);
      if (tenant) {
        const prefixes: string[] = (() => {
          try { return JSON.parse((tenant as any).coverageZipPrefixes ?? "[]") as string[]; }
          catch { return []; }
        })();
        const deadlines: Record<string, number> = (() => {
          try { return JSON.parse((tenant as any).coverageDeadlines ?? "{}") as Record<string, number>; }
          catch { return {}; }
        })();

        if (prefixes.length > 0) {
          const matchedPrefix = prefixes.find((p) => digits.startsWith(p.replace(/\D/g, "")));
          if (!matchedPrefix) {
            setCepError(
              `Este CEP está fora da área de cobertura de ${tenant.name}. Verifique com a assistência se atendem sua região.`
            );
          } else {
            // Calcular estimativa: prazo específico > prazo padrão > sem estimativa
            const hours = deadlines[matchedPrefix] ?? deadlines["default"] ?? null;
            if (hours != null && hours > 0) {
              setPickupEstimate(formatDeadline(hours));
            }
          }
        } else {
          // Sem restrição de cobertura — apenas exibir estimativa padrão se configurada
          const defaultHours = deadlines["default"] ?? null;
          if (defaultHours != null && defaultHours > 0) {
            setPickupEstimate(formatDeadline(defaultHours));
          }
        }
      }
      // Foca no campo número após preencher o endereço
      setTimeout(() => numberRef.current?.focus(), 100);
    } catch {
      setCepError("Erro ao buscar CEP. Preencha o endereço manualmente.");
    } finally {
      setCepLoading(false);
    }
  };

  const updAddr = (field: keyof AddressFields, value: string) =>
    setAddress((a) => ({ ...a, [field]: value }));

  const createColeta = trpc.serviceOrders.createColeta.useMutation({
    onSuccess: (data) => {
      setSubmitted({ osNumber: data.osNumber, token: data.publicToken });
    },
    onError: (err) => {
      if (err.message?.includes("limite") || err.message?.includes("plano")) {
        toast.error(err.message, { duration: 8000 });
      } else {
        toast.error("Erro ao enviar solicitação. Tente novamente.");
      }
    },
  });

  const upd = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handlePhotoChange = (files: FileList | null) => {
    if (!files?.length) return;
    const availableSlots = 2 - devicePhotos.length;
    if (availableSlots <= 0) {
      toast.error("Você já adicionou o limite de 2 fotos.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, availableSlots);
    selectedFiles.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Envie apenas imagens do aparelho.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Cada foto deve ter no máximo 8MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (result) setDevicePhotos((photos) => [...photos, result].slice(0, 2));
      };
      reader.onerror = () => toast.error("Não foi possível carregar uma das fotos.");
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setDevicePhotos((photos) => photos.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta compartilhamento de localização.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSharedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0),
        });
        setLocationLoading(false);
        toast.success("Localização compartilhada com a assistência.");
      },
      () => {
        setLocationLoading(false);
        toast.error("Não foi possível obter sua localização. Verifique a permissão do navegador.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const handleSubmit = () => {
    if (!tenant) return;
    if (!form.customerName.trim()) { toast.error("Informe seu nome completo."); return; }
    if (!form.customerPhone.trim()) { toast.error("Informe seu telefone."); return; }
    if (!form.reportedDefect.trim()) { toast.error("Descreva o defeito do aparelho."); return; }
    if (!address.zipCode.replace(/\D/g, "")) { toast.error("Informe o CEP para coleta."); return; }
    if (!address.street.trim()) { toast.error("Informe a rua/logradouro."); return; }
    if (!address.number.trim()) { toast.error("Informe o número do endereço."); return; }
    if (cepError) { toast.error("Corrija o endereço antes de continuar."); return; }

    const terms = (tenant as any).serviceTerms as string | null | undefined;
    if (terms && !termsAccepted) {
      setShowTermsModal(true);
      return;
    }

    submitColeta(false);
  };

  const submitColeta = (accepted: boolean) => {
    if (!tenant) return;
    const shiftInfo = SHIFTS.find((s) => s.id === pickupShift);
    const preferredPickupTime = pickupDate && shiftInfo
      ? `${new Date(pickupDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} – ${shiftInfo.label} (${shiftInfo.range})`
      : pickupDate
      ? new Date(pickupDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
      : undefined;
    const pickupAddress = buildFullAddress(address);
    const notes = [
      form.notes,
      address.reference ? `Ponto de referência: ${address.reference}` : "",
    ].filter(Boolean).join("\n");

    // Salva endereço como padrão no perfil se o cliente está logado e marcou o checkbox
    if (saveAddressAsDefault && customerMe) {
      updateMyProfile.mutate({
        name: customerMe.name ?? form.customerName,
        phone: customerMe.phone ?? form.customerPhone,
        zipCode: address.zipCode,
        address: address.street,
        addressNumber: address.number,
        addressReference: address.reference || undefined,
        neighborhood: address.neighborhood || undefined,
        city: address.city || undefined,
        state: address.state || undefined,
      }, {
        onSuccess: () => toast.success("Endereço salvo no seu perfil!", { duration: 3000 }),
      });
    }

    createColeta.mutate({
      ...form,
      // Se o cliente selecionou "Outra marca" no Select filtrado, envia string vazia
      brand: form.brand === "__outro__" ? "" : form.brand,
      pickupAddress,
      notes,
      tenantId: tenant.id,
      termsAccepted: accepted,
      preferredPickupTime,
      photoBase64s: devicePhotos,
      pickupLatitude: sharedLocation?.latitude,
      pickupLongitude: sharedLocation?.longitude,
      pickupLocationAccuracy: sharedLocation?.accuracy,
    });
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
    submitColeta(true);
  };

  const primaryColor = tenant?.primaryColor ?? "#1e3a5f";
  const contrastColor = getContrastColor(primaryColor);
  const whatsappNumber = tenant?.whatsappNumber ?? null;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: primaryColor, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // ── Tenant não encontrado ─────────────────────────────────────────────────────
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <Wrench className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Assistência não encontrada</h1>
          <p className="text-muted-foreground text-sm">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  // ── Tela de sucesso ───────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TenantPublicHeader tenant={tenant} subtitle="Solicitação enviada" />
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="max-w-sm w-full text-center shadow-lg">
            <CardContent className="p-8">
              <div
                className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-5"
                style={{ backgroundColor: `${primaryColor}18` }}
              >
                <CheckCircle2 className="h-9 w-9" style={{ color: primaryColor }} />
              </div>
              <h1 className="font-display text-2xl font-bold mb-2">Solicitação enviada!</h1>
              <p className="text-muted-foreground text-sm mb-5">
                Sua OS foi criada com sucesso. Em breve entraremos em contato para confirmar a coleta.
              </p>
              <div
                className="rounded-xl p-4 mb-6"
                style={{ backgroundColor: `${primaryColor}0f`, border: `1px solid ${primaryColor}30` }}
              >
                <p className="text-xs text-muted-foreground mb-1">Número da OS</p>
                <p className="font-display text-2xl font-bold" style={{ color: primaryColor }}>
                  {submitted.osNumber}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  className="w-full font-semibold"
                  onClick={() => tenantNavigate(`/rastrear/${submitted.token}`)}
                  style={{ backgroundColor: primaryColor, color: contrastColor }}
                >
                  Acompanhar OS <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => tenantNavigate("/minha-conta")}
                >
                  Ver minhas ordens
                </Button>
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/55${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${tenant.name}! Acabei de solicitar uma coleta. Minha OS é ${submitted.osNumber}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 border"
                    style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Confirmar pelo WhatsApp
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <footer className="text-center py-6 text-xs text-muted-foreground">
          {tenant.name} · Powered by <span className="font-semibold text-foreground">fullreparo</span>
        </footer>
        <WhatsAppFAB
          whatsappNumber={whatsappNumber}
          tenantName={tenant.name}
          message={`Olá, ${tenant.name}! Acabei de solicitar uma coleta. Minha OS é ${submitted.osNumber}.`}
        />
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────────
  const isLoggedIn = !!customerMe;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TenantPublicHeader tenant={tenant} subtitle="Solicitar Coleta" />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 space-y-4">

        {/* Banner de cliente logado */}
        {isLoggedIn && (
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: `${primaryColor}12`, border: `1px solid ${primaryColor}25` }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <User className="h-4 w-4" style={{ color: primaryColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: primaryColor }}>
                Olá, {customerMe.name?.split(" ")[0]}!
              </p>
              <p className="text-xs text-muted-foreground">Seus dados foram preenchidos automaticamente.</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs" style={{ borderColor: `${primaryColor}40`, color: primaryColor }}>
              Logado
            </Badge>
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" style={{ color: primaryColor }} />
              Solicitar Coleta do Aparelho
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Preencha os dados abaixo e entraremos em contato para agendar a coleta.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── Seção: Seus dados ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seus dados</h3>
              </div>
              <div>
                <Label htmlFor="customerName">Nome completo *</Label>
                <Input
                  id="customerName"
                  className="mt-1.5"
                  value={form.customerName}
                  onChange={(e) => upd("customerName", e.target.value)}
                  placeholder="João Silva"
                  readOnly={isLoggedIn}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customerPhone">Telefone / WhatsApp *</Label>
                  <Input
                    id="customerPhone"
                    className="mt-1.5"
                    value={form.customerPhone}
                    onChange={(e) => upd("customerPhone", e.target.value)}
                    placeholder="(11) 99999-9999"
                    readOnly={isLoggedIn}
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">E-mail</Label>
                  <Input
                    id="customerEmail"
                    className="mt-1.5"
                    value={form.customerEmail}
                    onChange={(e) => upd("customerEmail", e.target.value)}
                    placeholder="joao@email.com"
                    readOnly={isLoggedIn}
                  />
                </div>
              </div>
            </section>

            <div className="border-t border-border" />

            {/* ── Seção: Aparelho ───────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aparelho</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo *</Label>
                  <Select value={form.deviceType} onValueChange={(v) => upd("deviceType", v)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="brand">Marca</Label>
                  {getBrandsForType(form.deviceType) ? (
                    <Select value={form.brand} onValueChange={(v) => upd("brand", v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecione a marca" />
                      </SelectTrigger>
                      <SelectContent>
                        {getBrandsForType(form.deviceType)!.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                        <SelectItem value="__outro__">Outra marca</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="brand"
                      className="mt-1.5"
                      value={form.brand}
                      onChange={(e) => upd("brand", e.target.value)}
                      placeholder="Samsung"
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    className="mt-1.5"
                    value={form.model}
                    onChange={(e) => upd("model", e.target.value)}
                    placeholder="Galaxy S23"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="reportedDefect">Defeito relatado *</Label>
                <Textarea
                  id="reportedDefect"
                  className="mt-1.5"
                  value={form.reportedDefect}
                  onChange={(e) => upd("reportedDefect", e.target.value)}
                  placeholder="Descreva o problema com o aparelho..."
                  rows={3}
                />
              </div>
            </section>

            <div className="border-t border-border" />

            {/* ── Seção: Endereço de Coleta ─────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereço de Coleta</h3>
              </div>

              {/* CEP com busca automática */}
              <div>
                <Label htmlFor="zipCode">CEP *</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="zipCode"
                    value={address.zipCode}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`pr-9 ${cepError ? "border-destructive" : ""}`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {cepLoading ? (
                      <Spinner className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Search className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                </div>
                {cepError && (
                  <p className="mt-1 text-xs text-destructive">{cepError}</p>
                )}
                {!cepError && address.zipCode.replace(/\D/g, "").length < 8 && (
                  <p className="mt-1 text-xs text-muted-foreground">Digite o CEP para preencher o endereço automaticamente.</p>
                )}
                {!cepError && pickupEstimate && (
                  <div
                    className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}
                  >
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    <span>{pickupEstimate}</span>
                  </div>
                )}
              </div>

              {/* Rua + Número */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="street">Rua / Logradouro *</Label>
                  <Input
                    id="street"
                    className="mt-1.5"
                    value={address.street}
                    onChange={(e) => updAddr("street", e.target.value)}
                    placeholder="Rua das Flores"
                  />
                </div>
                <div>
                  <Label htmlFor="number">Número *</Label>
                  <Input
                    id="number"
                    ref={numberRef}
                    className="mt-1.5"
                    value={address.number}
                    onChange={(e) => updAddr("number", e.target.value)}
                    placeholder="123"
                  />
                </div>
              </div>

              {/* Complemento + Bairro */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    className="mt-1.5"
                    value={address.complement}
                    onChange={(e) => updAddr("complement", e.target.value)}
                    placeholder="Apto 42, Bloco B"
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    className="mt-1.5"
                    value={address.neighborhood}
                    onChange={(e) => updAddr("neighborhood", e.target.value)}
                    placeholder="Bela Vista"
                  />
                </div>
              </div>

              {/* Cidade + Estado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    className="mt-1.5"
                    value={address.city}
                    onChange={(e) => updAddr("city", e.target.value)}
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    className="mt-1.5"
                    value={address.state}
                    onChange={(e) => updAddr("state", e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>

              {/* Ponto de referência */}
              <div>
                <Label htmlFor="reference">Ponto de referência</Label>
                <Input
                  id="reference"
                  className="mt-1.5"
                  value={address.reference}
                  onChange={(e) => updAddr("reference", e.target.value)}
                  placeholder="Próximo ao mercado, portão azul..."
                />
              </div>

              {/* Checkbox: salvar endereço como padrão (só para clientes logados) */}
              {customerMe && (
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
                  <Checkbox
                    id="saveAddressAsDefault"
                    checked={saveAddressAsDefault}
                    onCheckedChange={(v) => setSaveAddressAsDefault(!!v)}
                    className="mt-0.5 shrink-0"
                  />
                  <label
                    htmlFor="saveAddressAsDefault"
                    className="cursor-pointer text-sm leading-snug select-none"
                  >
                    <span className="font-medium text-foreground">Salvar como meu endereço padrão</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Próximas solicitações serão pré-preenchidas com este endereço
                    </span>
                  </label>
                </div>
              )}

              {/* Seletor de data */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  Data preferida para coleta
                </Label>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {getAvailableDates(8).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPickupDate(value)}
                      className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition-all ${
                        pickupDate === value
                          ? "border-transparent text-white shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      style={pickupDate === value ? { backgroundColor: primaryColor } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de turno */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                  Turno preferido
                </Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {SHIFTS.map(({ id, label, range, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPickupShift(id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center transition-all ${
                        pickupShift === id
                          ? "border-transparent text-white shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      style={pickupShift === id ? { backgroundColor: primaryColor } : {}}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold">{label}</span>
                      <span className={`text-[10px] ${pickupShift === id ? "opacity-80" : "text-muted-foreground"}`}>{range}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Observações adicionais */}
              <div>
                <Label htmlFor="notes">Observações adicionais</Label>
                <Textarea
                  id="notes"
                  className="mt-1.5"
                  value={form.notes}
                  onChange={(e) => upd("notes", e.target.value)}
                  rows={2}
                  placeholder="Qualquer informação adicional sobre o aparelho ou a coleta..."
                />
              </div>
            </section>

            <div className="border-t border-border" />

            {/* ── Seção: Fotos e Localização ───────────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fotos e localização</h3>
              </div>

              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Fotos do celular/aparelho</p>
                    <p className="text-xs text-muted-foreground">
                      Envie até 2 fotos para a assistência avaliar o estado do aparelho antes da coleta.
                    </p>
                  </div>
                  <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${devicePhotos.length >= 2 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}>
                    <Camera className="h-4 w-4" />
                    Adicionar foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="sr-only"
                      disabled={devicePhotos.length >= 2}
                      onChange={(event) => {
                        handlePhotoChange(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {devicePhotos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {devicePhotos.map((photo, index) => (
                      <div key={`${photo.slice(0, 24)}-${index}`} className="relative overflow-hidden rounded-lg border border-border bg-background">
                        <img src={photo} alt={`Foto ${index + 1} do aparelho`} className="h-36 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                          aria-label={`Remover foto ${index + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                          Foto {index + 1} de 2
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Compartilhar localização da coleta</p>
                    <p className="text-xs text-muted-foreground">
                      No final, compartilhe sua localização atual para facilitar a chegada do entregador da assistência.
                    </p>
                    {sharedLocation && (
                      <p className="mt-1 text-xs font-medium" style={{ color: primaryColor }}>
                        Localização anexada{sharedLocation.accuracy ? ` · precisão aproximada de ${sharedLocation.accuracy}m` : ""}.
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="outline" onClick={handleShareLocation} disabled={locationLoading}>
                    {locationLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Obtendo...
                      </>
                    ) : (
                      <>
                        <Navigation className="mr-2 h-4 w-4" />
                        {sharedLocation ? "Atualizar localização" : "Compartilhar localização"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>

            {/* Botão de envio */}
            <Button
              className="w-full font-semibold"
              size="lg"
              onClick={handleSubmit}
              disabled={createColeta.isPending}
              style={{ backgroundColor: primaryColor, color: contrastColor }}
            >
              {createColeta.isPending ? (
                <>
                  <span
                    className="mr-2 h-4 w-4 rounded-full border-2 border-t-transparent animate-spin inline-block"
                    style={{ borderColor: contrastColor, borderTopColor: "transparent" }}
                  />
                  Enviando...
                </>
              ) : (
                <>
                  Solicitar Coleta
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>

            {!isLoggedIn && (
              <p className="text-center text-xs text-muted-foreground">
                Já tem conta?{" "}
                <button
                  type="button"
                  className="underline hover:text-foreground transition-colors"
                  onClick={() => tenantNavigate("/entrar")}
                >
                  Faça login
                </button>{" "}
                para pré-preencher seus dados.
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        {tenant.name} · Powered by <span className="font-semibold text-foreground">fullreparo</span>
      </footer>

      <WhatsAppFAB whatsappNumber={whatsappNumber} tenantName={tenant.name} />

      {/* Modal de Aceite do Termo de Serviço */}
      {(tenant as any).serviceTerms && (
        <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Termo de Serviço
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Para continuar, leia e aceite o termo de serviço de <strong>{tenant.name}</strong>:
            </p>
            <ScrollArea className="h-56 rounded-md border border-border p-4 bg-muted/30">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{(tenant as any).serviceTerms}</p>
            </ScrollArea>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setShowTermsModal(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={handleAcceptTerms}
                disabled={createColeta.isPending}
                className="w-full sm:w-auto"
                style={{ backgroundColor: primaryColor, color: contrastColor }}
              >
                {createColeta.isPending ? "Enviando..." : "Li e aceito o termo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Componente de cabeçalho reutilizável para o portal público ────────────────

interface TenantPublicHeaderProps {
  tenant: {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
  };
  subtitle: string;
}

export function TenantPublicHeader({ tenant, subtitle }: TenantPublicHeaderProps) {
  const { tenantPath } = useTenantNav();
  const primaryColor = tenant.primaryColor ?? "#1e3a5f";
  const clean = primaryColor.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2) || "1e", 16);
  const g = parseInt(full.slice(2, 4) || "3a", 16);
  const b = parseInt(full.slice(4, 6) || "5f", 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const textColor = lum > 140 ? "#000000" : "#ffffff";
  const initials = tenant.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <header className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: primaryColor }}>
      <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
        <a
          href={tenantPath("/")}
          className="h-8 w-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-white/20 hover:opacity-80 transition-opacity"
        >
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-bold" style={{ color: textColor }}>
              {initials || "FR"}
            </span>
          )}
        </a>
        <div className="min-w-0">
          <a href={tenantPath("/")} className="font-display text-sm font-bold truncate hover:opacity-90 transition-opacity block" style={{ color: textColor }}>
            {tenant.name}
          </a>
          <p className="text-xs" style={{ color: textColor, opacity: 0.75 }}>{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
