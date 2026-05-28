import { useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantHost } from "@/contexts/TenantHostContext";
import { Truck, Search, Shield, Phone, MessageCircle, MapPin, Clock, LogIn, User, LogOut, UserPlus, Wrench, Zap, Star, Smartphone, Laptop, Tablet, Watch, Printer, Gamepad2, Camera, Headphones, Speaker, Wifi, Tv, Monitor, Mouse, Wind, Package } from "lucide-react";
import { useTenantNav } from "@/hooks/useTenantNav";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { useAuth } from "@/_core/hooks/useAuth";
import { parseBusinessHours, formatBusinessHoursText, isOpenNow, nextOpenTime, DAY_NAMES_SHORT } from "@shared/businessHours";

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

/** Card de categoria com accordion expandir/recolher e animação de entrada */
function SpecialtyCard({
  type,
  brands,
  icon,
  primaryColor,
  index,
  defaultOpen = false,
}: {
  type: string;
  brands: string[];
  icon: React.ReactNode;
  primaryColor: string;
  index: number;
  defaultOpen?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  // Animação de entrada via Intersection Observer
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timer = setTimeout(() => setVisible(true), index * 50);
          observer.disconnect();
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const contrastColor = getContrastColor(primaryColor);

  return (
    <div
      ref={ref}
      className="rounded-xl overflow-hidden bg-card/95"
      style={{
        border: `1px solid ${open ? primaryColor + "38" : primaryColor + "16"}`,
        boxShadow: open ? `0 3px 14px ${primaryColor}14` : "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition: [
          "opacity 300ms cubic-bezier(0.23, 1, 0.32, 1)",
          "transform 300ms cubic-bezier(0.23, 1, 0.32, 1)",
          "border-color 200ms ease",
          "box-shadow 200ms ease",
        ].join(", "),
      }}
    >
      {/* Botão de expandir/recolher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group sm:gap-2.5 sm:px-3 sm:py-2.5"
        style={{
          background: open
            ? `linear-gradient(135deg, ${primaryColor}18 0%, ${primaryColor}08 100%)`
            : `${primaryColor}06`,
          transition: "background 200ms ease",
        }}
        aria-expanded={open}
      >
        {/* Ícone da categoria */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 sm:h-8 sm:w-8"
          style={{
            background: open
              ? `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`
              : `${primaryColor}18`,
            color: open ? contrastColor : primaryColor,
            transition: "background 200ms ease, color 200ms ease",
            boxShadow: open ? `0 2px 8px ${primaryColor}40` : "none",
          }}
        >
          {icon}
        </div>

        {/* Nome da categoria */}
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-semibold leading-tight sm:text-[13px]"
            style={{ color: open ? primaryColor : undefined }}
          >
            {type}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 sm:text-[11px]">
            {brands.length} {brands.length === 1 ? "marca" : "marcas"}
          </p>
        </div>

        {/* Badge de contagem + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {!open && (
            <div className="flex gap-1">
              {brands.slice(0, 3).map((b) => (
                <span
                  key={b}
                  className="hidden sm:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
                >
                  {b}
                </span>
              ))}
              {brands.length > 3 && (
                <span
                  className="hidden sm:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
                >
                  +{brands.length - 3}
                </span>
              )}
            </div>
          )}
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{
              backgroundColor: open ? `${primaryColor}20` : `${primaryColor}10`,
              color: primaryColor,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 250ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </button>

      {/* Conteúdo expansível — animação via max-height */}
      <div
        ref={contentRef}
        style={{
          maxHeight: open ? "600px" : "0px",
          overflow: "hidden",
          transition: open
            ? "max-height 400ms cubic-bezier(0.23, 1, 0.32, 1)"
            : "max-height 250ms cubic-bezier(0.77, 0, 0.175, 1)",
        }}
      >
        <div
          className="px-2.5 pb-2.5 pt-1 sm:px-3 sm:pb-3"
          style={{ borderTop: `1px solid ${primaryColor}15` }}
        >
          {/* Linha divisória decorativa */}
          <div className="flex flex-wrap gap-1 pt-2 sm:gap-1.5 sm:pt-2.5">
            {brands.map((brand) => (
              <span
                key={brand}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:py-1 sm:text-[11px]"
                style={{
                  backgroundColor: `${primaryColor}0d`,
                  color: primaryColor,
                  border: `1px solid ${primaryColor}28`,
                  transition: "background 150ms ease, transform 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = `${primaryColor}20`;
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = `${primaryColor}0d`;
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Grid de cards de especialidades com accordion e animação escalonada */
function SpecialtiesGrid({
  entries,
  iconMap,
  primaryColor,
}: {
  entries: [string, string[]][];
  iconMap: Record<string, React.ReactNode>;
  primaryColor: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([type, brands], index) => (
        <SpecialtyCard
          key={type}
          type={type}
          brands={brands}
          icon={iconMap[type] ?? <Package className="h-4 w-4" />}
          primaryColor={primaryColor}
          index={index}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}

/**
 * Página home do portal público do tenant.
 * Exibida quando o usuário acessa o subdomínio ou customDomain da assistência
 * (ex: rocha.fullreparo.com.br) sem nenhum caminho específico.
 */
export default function PublicPortal() {
  const [, navigate] = useLocation();
  const { navigate: tenantNavigate } = useTenantNav();
  const { tenant, loading, isHostTenant, isTestMode } = useTenantHost();
  const { user, logout } = useAuth();

  // Enquanto carrega a detecção de host
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-16 border-b border-border">
          <div className="max-w-xl mx-auto px-4 h-full flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-10 space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  // Host não pertence a nenhum tenant — não renderizar (App.tsx redireciona para Home)
  if (!isHostTenant || !tenant) {
    return null;
  }

  const primaryColor = tenant.primaryColor ?? "#1e3a5f";
  const secondaryColor = tenant.secondaryColor ?? "#d97706";
  const contrastColor = getContrastColor(primaryColor);
  const secondaryContrastColor = getContrastColor(secondaryColor);

  // Iniciais da assistência (até 2 letras)
  const initials = tenant.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "FR";

  const whatsappNumber = tenant.whatsappNumber || tenant.phone;
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/55${whatsappNumber.replace(/\D/g, "")}`
    : null;

  const fullAddress = [tenant.address, tenant.city, tenant.state]
    .filter(Boolean)
    .join(", ");

  const mapSearchAddress = [tenant.address, tenant.city, tenant.state, "Brasil"]
    .filter(Boolean)
    .join(", ");

  const encodedMapSearchAddress = mapSearchAddress ? encodeURIComponent(mapSearchAddress) : "";

  const googleMapsUrl = encodedMapSearchAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodedMapSearchAddress}`
    : null;

  const googleMapsEmbedUrl = encodedMapSearchAddress
    ? `https://maps.google.com/maps?q=${encodedMapSearchAddress}&z=15&output=embed`
    : null;

  const defaultServices = [
    { icon: Smartphone, title: "Celulares e smartphones", description: "Diagnóstico, troca de tela, bateria, conectores e reparos gerais." },
    { icon: Laptop, title: "Notebooks e computadores", description: "Manutenção, formatação, upgrades, limpeza e correções de desempenho." },
    { icon: Tablet, title: "Tablets e eletrônicos", description: "Atendimento para tablets, acessórios e dispositivos eletrônicos diversos." },
    { icon: Shield, title: "Garantia digital", description: "Serviços com registro, acompanhamento e consulta de garantia online." },
  ];

  const serviceFlow = [
    { icon: MessageCircle, title: "Você chama ou solicita coleta", description: "Entre em contato, peça uma coleta ou leve o aparelho até a assistência." },
    { icon: Wrench, title: "A equipe avalia o aparelho", description: "O diagnóstico e o orçamento ficam registrados para acompanhamento." },
    { icon: Search, title: "Acompanhe tudo online", description: "Consulte a OS, aprove orçamento e veja cada etapa do atendimento." },
    { icon: Shield, title: "Receba com garantia", description: "Ao finalizar, sua garantia digital fica disponível para consulta." },
  ];

  // Status de funcionamento para o badge do hero
  const heroSchedule = tenant.businessHours ? parseBusinessHours(tenant.businessHours) : null;
  const isOpen = heroSchedule ? isOpenNow(heroSchedule, new Date()) : null;

  // Animação de entrada escalonada: badge → logo+nome → subtítulo → CTAs → ícone
  const [heroStep, setHeroStep] = useState(0);
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setHeroStep(5); return; }
    const delays = [80, 200, 340, 480, 620];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setHeroStep(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const heroItemStyle = (step: number): React.CSSProperties => ({
    opacity: heroStep >= step ? 1 : 0,
    transform: heroStep >= step ? "translateY(0)" : "translateY(14px)",
    transition: "opacity 320ms cubic-bezier(0.23, 1, 0.32, 1), transform 320ms cubic-bezier(0.23, 1, 0.32, 1)",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Banner de modo de teste */}
      {isTestMode && (
        <div className="flex items-center justify-center gap-2 bg-amber-400 text-amber-900 text-xs font-semibold px-4 py-1.5">
          <span>⚠️</span>
          <span>
            Modo de Teste — visualizando portal de{" "}
            <strong>{tenant?.name}</strong>. Em produção, acesse via subdomínio.
          </span>
        </div>
      )}

      {/* Cabeçalho com branding do tenant — cor primária como fundo */}
      <header className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => tenantNavigate("/")}
            className="h-10 w-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-white/20 hover:opacity-80 transition-opacity"
          >
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-sm font-bold" style={{ color: contrastColor }}>
                {initials}
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => tenantNavigate("/")}
              className="font-display text-base font-bold truncate hover:opacity-90 transition-opacity block text-left"
              style={{ color: contrastColor }}
            >
              {tenant.name}
            </button>
            {(tenant.city || tenant.state) && (
              <p className="text-xs flex items-center gap-1" style={{ color: contrastColor, opacity: 0.75 }}>
                <MapPin className="h-3 w-3 shrink-0" />
                {[tenant.city, tenant.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {/* Botão de login / perfil do usuário */}
          {user ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => tenantNavigate("/minha-conta")}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/20"
                style={{ color: contrastColor }}
                title="Minha conta"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name ?? ""} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="max-w-[80px] truncate hidden sm:inline">{user.name?.split(" ")[0]}</span>
              </button>
              <button
                onClick={() => logout()}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/20"
                style={{ color: contrastColor, opacity: 0.8 }}
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => tenantNavigate("/entrar")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:bg-white/20 shrink-0"
              style={{ color: contrastColor, border: `1px solid ${contrastColor}40` }}
            >
              <LogIn className="h-3.5 w-3.5" />
              Entrar
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
           HERO — layout assimétrico com fundo dinâmico
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}e8 45%, ${primaryColor}b0 100%)`,
          minHeight: "clamp(240px, 56vw, 340px)",
        }}
      >
        {/* Padrão de pontos SVG inline */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill={contrastColor} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Formas geométricas flutuantes */}
        <div
          className="absolute -top-16 -right-16 h-64 w-64 rounded-full opacity-[0.12] blur-2xl"
          style={{ backgroundColor: contrastColor }}
        />
        <div
          className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full opacity-[0.08] blur-xl"
          style={{ backgroundColor: secondaryColor }}
        />
        <div
          className="absolute top-1/2 right-8 h-20 w-20 rounded-full opacity-[0.15]"
          style={{
            backgroundColor: "transparent",
            border: `2px solid ${contrastColor}`,
            transform: "translateY(-50%)",
          }}
        />
        <div
          className="absolute top-1/3 right-20 h-10 w-10 rounded-full opacity-[0.10]"
          style={{
            backgroundColor: "transparent",
            border: `2px solid ${contrastColor}`,
          }}
        />

        {/* Conteúdo do hero */}
        <div className="relative max-w-6xl mx-auto px-4 py-8 sm:py-10 md:py-16">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Coluna de texto */}
            <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
              {/* Badge de status — step 1 */}
              <div className="flex items-center gap-2" style={heroItemStyle(1)}>
                {isOpen !== null && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: isOpen ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)",
                      color: contrastColor,
                      border: `1px solid ${isOpen ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)"}`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: isOpen ? "#4ade80" : "#f87171",
                        boxShadow: isOpen ? "0 0 6px #4ade80" : "0 0 6px #f87171",
                      }}
                    />
                    {isOpen ? "Aberto agora" : "Fechado agora"}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", color: contrastColor }}
                >
                  <Star className="h-3 w-3" />
                  Assistência Técnica
                </span>
              </div>


              {/* Texto de boas-vindas — step 3 */}
              <p className="text-[13px] leading-snug sm:text-sm sm:leading-relaxed" style={{ ...heroItemStyle(3), color: contrastColor, opacity: heroStep >= 3 ? 0.88 : 0 }}>
                {(tenant as any).welcomeText
                  ? (tenant as any).welcomeText
                  : "Solicite coleta, acompanhe sua OS ou verifique sua garantia digital com facilidade."}
              </p>

              {/* CTAs diretos no hero — step 4 */}
              <div className="grid grid-cols-2 gap-2 pt-0.5 sm:flex sm:flex-wrap sm:pt-1" style={heroItemStyle(4)}>
                <button
                  onClick={() => tenantNavigate("/coleta")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-md transition-all duration-150 active:scale-[0.97] hover:brightness-110 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                  style={{ backgroundColor: secondaryColor, color: secondaryContrastColor }}
                >
                  <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Solicitar Coleta
                </button>
                <button
                  onClick={() => tenantNavigate("/rastrear")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.97] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.18)",
                    color: contrastColor,
                    border: `1px solid rgba(255,255,255,0.35)`,
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Rastrear OS
                </button>
                <button
                  onClick={() => tenantNavigate("/garantia")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.97] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.12)",
                    color: contrastColor,
                    border: `1px solid rgba(255,255,255,0.25)`,
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="sm:hidden">Garantia</span>
                  <span className="hidden sm:inline">Consultar garantia</span>
                </button>
              </div>
            </div>

            {/* Elemento visual de destaque — ícone animado com halo — step 5 */}
            <div className="shrink-0 hidden xs:flex flex-col items-center justify-center" style={{ marginTop: "8px", ...heroItemStyle(5) }}>
              <div className="relative">
                {/* Halo pulsante */}
                <div
                  className="absolute inset-0 rounded-full opacity-30"
                  style={{
                    backgroundColor: secondaryColor,
                    transform: "scale(1.6)",
                    animation: "heroPulse 2.4s ease-in-out infinite",
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full opacity-15"
                  style={{
                    backgroundColor: secondaryColor,
                    transform: "scale(2.2)",
                    animation: "heroPulse 2.4s ease-in-out infinite 0.4s",
                  }}
                />
                {/* Ícone central */}
                <div
                  className="relative h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl"
                  style={{ backgroundColor: secondaryColor }}
                >
                  <Wrench className="h-8 w-8" style={{ color: secondaryContrastColor }} />
                </div>
              </div>
              {/* Chip de destaque abaixo do ícone */}
              <div
                className="mt-6 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: "rgba(255,255,255,0.18)", color: contrastColor }}
              >
                <Zap className="h-3 w-3" />
                Rápido
              </div>
            </div>
          </div>
        </div>

        {/* Onda de transição para o conteúdo abaixo */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none" style={{ height: "32px" }}>
          <svg
            viewBox="0 0 1200 32"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ display: "block" }}
          >
            <path
              d="M0,16 C300,32 900,0 1200,16 L1200,32 L0,32 Z"
              fill="var(--background)"
            />
          </svg>
        </div>
      </div>

      {/* Animações CSS inline para o hero */}
      <style>{`
        @keyframes heroPulse {
          0%, 100% { opacity: 0.3; transform: scale(1.6); }
          50% { opacity: 0.15; transform: scale(1.9); }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes heroPulse { from { opacity: 0.2; } to { opacity: 0.2; } }
          @keyframes heroFadeUp { from { opacity: 1; } to { opacity: 1; } }
        }
        /* xs breakpoint: 480px */
        @media (min-width: 480px) {
          .hidden.xs\\:flex { display: flex !important; }
        }
      `}</style>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 space-y-5 sm:py-6 sm:space-y-7 md:py-8 md:space-y-8">

        {/* CTA de cadastro — visível apenas para visitantes não logados */}
        {!user && (
          <div
            className="rounded-xl p-3 flex items-center gap-2.5 shadow-sm sm:rounded-2xl sm:p-4 sm:gap-3"
            style={{ backgroundColor: `${primaryColor}12`, border: `1.5px solid ${primaryColor}30` }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 sm:h-10 sm:w-10 sm:rounded-xl"
              style={{ backgroundColor: secondaryColor }}
            >
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: secondaryContrastColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold leading-tight text-foreground sm:text-sm">Crie sua conta grátis</p>
              <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                Acompanhe suas OS e solicite coletas com facilidade
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 shrink-0 px-2.5 text-xs font-semibold shadow-sm sm:h-9 sm:px-3"
              style={{ backgroundColor: secondaryColor, color: secondaryContrastColor }}
              onClick={() => tenantNavigate("/register")}
            >
              Criar conta
            </Button>
          </div>
        )}

        {/* Serviços principais */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Serviços</p>
              <h2 className="font-display text-lg font-bold text-foreground mt-0.5 sm:mt-1 sm:text-2xl">Como podemos ajudar?</h2>
            </div>
            <span
              className="hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex"
              style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
            >
              Atendimento rápido
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {defaultServices.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="rounded-xl border border-border/70 bg-card/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl">
                <CardContent className="p-2.5 sm:p-4">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg mb-2 sm:h-8 sm:w-8 sm:rounded-xl sm:mb-3"
                    style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">{title}</p>
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground line-clamp-2 sm:mt-1.5 sm:text-xs">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Especialidades e marcas atendidas — redesign com cards por categoria */}
        {(() => {
          const raw = tenant.deviceSpecialties;
          if (!raw) return null;
          let specialties: Record<string, string[]> = {};
          try { specialties = JSON.parse(raw); } catch { return null; }
          const entries = Object.entries(specialties).filter(([, brands]) => brands.length > 0);
          if (entries.length === 0) return null;

          // Mapa de ícones por categoria
          const iconMap: Record<string, React.ReactNode> = {
            "Smartphone": <Smartphone className="h-4 w-4" />,
            "Notebook": <Laptop className="h-4 w-4" />,
            "Tablet": <Tablet className="h-4 w-4" />,
            "Smartwatch": <Watch className="h-4 w-4" />,
            "Impressora": <Printer className="h-4 w-4" />,
            "Console / Videogame": <Gamepad2 className="h-4 w-4" />,
            "Câmera / Filmadora": <Camera className="h-4 w-4" />,
            "Fone de ouvido / Headset": <Headphones className="h-4 w-4" />,
            "Fone de Ouvido": <Headphones className="h-4 w-4" />,
            "Caixa de som": <Speaker className="h-4 w-4" />,
            "Roteador / Modem": <Wifi className="h-4 w-4" />,
            "Smart TV": <Tv className="h-4 w-4" />,
            "Desktop / PC": <Monitor className="h-4 w-4" />,
            "Monitor": <Monitor className="h-4 w-4" />,
            "Teclado / Mouse": <Mouse className="h-4 w-4" />,
            "Drone": <Wind className="h-4 w-4" />,
          };

          return (
            <div className="space-y-3">
              {/* Cabeçalho da seção */}
              <div className="flex items-center gap-2 px-1">
                <div
                  className="h-5 w-1 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Especialidades
                </p>
                <span
                  className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  {entries.length} {entries.length === 1 ? "categoria" : "categorias"}
                </span>
              </div>

              {/* Grid de cards por categoria */}
              <SpecialtiesGrid entries={entries} iconMap={iconMap} primaryColor={primaryColor} />
            </div>
          );
        })()}

        {/* Como funciona */}
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atendimento</p>
            <h2 className="font-display text-lg font-bold leading-tight text-foreground mt-0.5 sm:mt-1 sm:text-2xl">Do orçamento à garantia, tudo acompanhado online</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {serviceFlow.map(({ icon: Icon, title, description }, index) => (
              <Card key={title} className="relative overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl">
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex items-center gap-2 mb-2 sm:gap-2.5 sm:mb-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8 sm:rounded-xl"
                      style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
                    >
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 sm:text-[11px] sm:px-2" style={{ backgroundColor: `${secondaryColor}18`, color: secondaryColor }}>
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">{title}</p>
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground line-clamp-2 sm:mt-1.5 sm:text-xs">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Horário de funcionamento */}
        {tenant.businessHours && (() => {
          const schedule = parseBusinessHours(tenant.businessHours);
          const now = new Date();
          const todayKey = String(now.getDay());

          // Formato estruturado (novo)
          if (schedule) {
            const open = isOpenNow(schedule, now);
            const nextOpen = !open ? nextOpenTime(schedule, now) : null;
            return (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Horário de Atendimento
                </p>
                <div className="rounded-xl border border-border bg-card p-3 space-y-2.5 sm:rounded-2xl sm:p-4 sm:space-y-3">
                  {/* Status e próxima abertura */}
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 sm:h-8 sm:w-8"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <Clock className="h-4 w-4" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: open ? "#16a34a20" : "#dc262620",
                          color: open ? "#16a34a" : "#dc2626",
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: open ? "#16a34a" : "#dc2626" }} />
                        {open ? "Aberto agora" : "Fechado agora"}
                      </span>
                      {nextOpen && (
                        <p className="text-xs text-muted-foreground mt-0.5">{nextOpen}</p>
                      )}
                    </div>
                  </div>
                  {/* Tabela de horários por dia */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:gap-x-4 sm:gap-y-1">
                    {Array.from({ length: 7 }, (_, i) => String(i)).map((key) => {
                      const day = schedule[key];
                      const isToday = key === todayKey;
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between text-xs py-0.5 ${
                            isToday ? "font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          <span style={isToday ? { color: primaryColor } : {}}>
                            {DAY_NAMES_SHORT[key]}
                          </span>
                          <span>
                            {day ? `${day.open}–${day.close}` : "Fechado"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Fallback: texto livre legado
          return (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Horário de Atendimento
              </p>
              <div className="rounded-xl border border-border bg-card p-3 sm:rounded-2xl sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 sm:h-10 sm:w-10 sm:rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                    <Clock className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <p className="pt-1 text-xs leading-snug text-foreground sm:pt-2 sm:text-sm sm:leading-relaxed">{tenant.businessHours}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Mapa de localização */}
        {(tenant.address || tenant.city) && (() => {
          const displayAddress = mapSearchAddress;
          return (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Onde nos encontrar
              </p>
              <div className="rounded-2xl border border-border overflow-hidden bg-card">
                {googleMapsEmbedUrl ? (
                  <iframe
                    title={`Mapa de ${tenant.name}`}
                    src={googleMapsEmbedUrl}
                    className="h-44 w-full border-0 sm:h-52"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="h-44 w-full flex items-center justify-center bg-muted/40 px-6 text-center sm:h-52">
                    <div className="space-y-2">
                      <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">Localização disponível</p>
                      <p className="text-xs text-muted-foreground">Use o endereço abaixo para abrir a rota.</p>
                    </div>
                  </div>
                )}
                {(tenant.address || googleMapsUrl) && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-3 py-2.5 bg-card border-t border-border sm:gap-2 sm:px-4 sm:py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">
                        {displayAddress || "Localização da assistência"}
                      </p>
                    </div>
                    {googleMapsUrl && (
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold hover:underline" style={{ color: primaryColor }}>
                        Abrir rota
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Contato */}
        {(tenant.phone || whatsappUrl) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Fale conosco
            </p>
            <div className="flex gap-2 sm:gap-3">
              {tenant.phone && (
                <a href={`tel:${tenant.phone.replace(/\D/g, "")}`} className="flex-1">
                  <Button variant="outline" className="h-9 w-full gap-1.5 bg-background text-xs sm:h-10 sm:gap-2 sm:text-sm">
                    <Phone className="h-4 w-4" />
                    Ligar
                  </Button>
                </a>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button
                    className="h-9 w-full gap-1.5 text-xs text-white sm:h-10 sm:gap-2 sm:text-sm"
                    style={{ backgroundColor: "#25d366" }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border sm:py-6">
        {tenant.name} · Powered by{" "}
        <a href="/" className="font-semibold text-foreground hover:underline">
          fullreparo
        </a>
      </footer>

      {/* Botão flutuante WhatsApp */}
      <WhatsAppFAB whatsappNumber={tenant.whatsappNumber} tenantName={tenant.name} />
    </div>
  );
}
