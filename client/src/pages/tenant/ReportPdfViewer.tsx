import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Download, FileText, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { TenantLayout } from "@/components/TenantLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function safeDecode(value: string | null, fallback: string) {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return fallback;
  }
}

function isAllowedPdfSrc(src: string) {
  return src.startsWith("/api/export/") && src.includes(".pdf");
}

function isMobilePdfPreviewLimited() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const isiOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobileViewport = window.matchMedia?.("(max-width: 767px)").matches ?? false;
  const isTouchOnly = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;

  return isiOS || (isMobileViewport && isTouchOnly);
}

export default function ReportPdfViewer() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [sharing, setSharing] = useState(false);

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const rawSrc = safeDecode(params.get("src"), "");
  const src = isAllowedPdfSrc(rawSrc) ? rawSrc : "";
  const title = safeDecode(params.get("title"), "Relatório em PDF");
  const filename = safeDecode(params.get("filename"), `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
  const backTo = safeDecode(params.get("back"), "/painel/relatorios");
  const absolutePdfUrl = src ? new URL(src, window.location.origin).toString() : "";
  const useMobileSafeMode = useMemo(() => isMobilePdfPreviewLimited(), []);

  const handleBack = () => {
    navigate(backTo || "/painel/relatorios");
  };

  const handleDownload = async () => {
    if (!src) return;

    try {
      const response = await fetch(src, { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível preparar o PDF para download.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível baixar o relatório.");
    }
  };

  const handleShare = async () => {
    if (!src || sharing) return;
    setSharing(true);

    try {
      const response = await fetch(src, { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível carregar o PDF para compartilhamento.");

      const blob = await response.blob();
      const file = new File([blob], filename, { type: "application/pdf" });
      const shareDataWithFile: ShareData = {
        title,
        text: `${title} - FullReparo`,
        files: [file],
      };

      if (navigator.canShare?.(shareDataWithFile)) {
        await navigator.share(shareDataWithFile);
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title,
          text: `${title} - FullReparo`,
          url: absolutePdfUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(absolutePdfUrl);
      toast.success("Link do relatório copiado. Você pode colar no WhatsApp, e-mail ou outro aplicativo.");
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(absolutePdfUrl);
        toast.success("Não foi possível abrir o compartilhamento do dispositivo, então copiei o link do relatório.");
      } catch {
        toast.error(error?.message || "Não foi possível compartilhar o relatório.");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <TenantLayout title={title}>
      <div className="space-y-4">
        <Card className="border border-border">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {useMobileSafeMode
                      ? "Modo mobile seguro com retorno ao app e compartilhamento."
                      : "Visualização interna com retorno ao app e compartilhamento."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <Button variant="outline" onClick={handleBack} className="h-11 gap-2 justify-center sm:h-10">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao app
                </Button>
                <Button variant="outline" onClick={handleDownload} disabled={!src} className="h-11 gap-2 justify-center sm:h-10">
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
                <Button onClick={handleShare} disabled={!src || sharing} className="h-11 gap-2 justify-center sm:h-10">
                  <Share2 className="h-4 w-4" />
                  {sharing ? "Preparando..." : "Compartilhar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {src ? (
          useMobileSafeMode ? (
            <Card className="border border-border bg-muted/20">
              <CardContent className="p-6 text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                  <Smartphone className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-foreground">PDF pronto para uso</p>
                  <p className="text-sm text-muted-foreground">
                    No celular, alguns navegadores abrem PDFs em uma tela nativa sem os botões do FullReparo.
                    Por isso, mantivemos você nesta tela segura: use <span className="font-medium text-foreground">Compartilhar</span>,
                    <span className="font-medium text-foreground"> Baixar PDF</span> ou <span className="font-medium text-foreground">Voltar ao app</span>.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-[calc(100vh-220px)] min-h-[520px] rounded-xl border border-border bg-muted/30 overflow-hidden">
              <iframe title={title} src={src} className="h-full w-full bg-background" />
            </div>
          )
        ) : (
          <Card className="border border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">
              Não foi possível abrir este PDF porque o endereço informado não é válido.
            </CardContent>
          </Card>
        )}
      </div>
    </TenantLayout>
  );
}
