import { useCallback, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const navigatorStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return displayModeStandalone || navigatorStandalone;
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() ?? "";
  const maxTouchPoints = window.navigator.maxTouchPoints ?? 0;

  return /iphone|ipad|ipod/.test(userAgent) || (platform === "macintel" && maxTouchPoints > 1);
}

function isSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes("safari") && !userAgent.includes("crios") && !userAgent.includes("fxios") && !userAgent.includes("edgios");
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [isIos] = useState(() => isIosDevice());
  const [isSafari] = useState(() => isSafariBrowser());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsInstalled(isStandaloneMode());
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayModeChange = () => setIsInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayModeQuery?.addEventListener?.("change", handleDisplayModeChange);

    setIsInstalled(isStandaloneMode());

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayModeQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt || isInstalled) return false;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      return true;
    }

    return false;
  }, [installPrompt, isInstalled]);

  return useMemo(() => ({
    canInstall: Boolean(installPrompt) && !isInstalled,
    isInstalled,
    isIos,
    isSafari,
    shouldShowIosInstructions: isIos && isSafari && !isInstalled,
    promptInstall,
  }), [installPrompt, isInstalled, isIos, isSafari, promptInstall]);
}
