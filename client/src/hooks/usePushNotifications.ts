import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

type PushTarget = "tenant_user" | "customer";

type UsePushNotificationsOptions = {
  target: PushTarget;
  tenantId?: number;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isNotificationGranted() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

export function usePushNotifications({ target, tenantId }: UsePushNotificationsOptions) {
  const configQuery = trpc.push.config.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const subscribeTenantUser = trpc.push.subscribeTenantUser.useMutation();
  const subscribeCustomer = trpc.push.subscribeCustomer.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  const browserSupported = useMemo(() => (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  ), []);

  const permission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  const serverEnabled = Boolean(configQuery.data?.enabled && configQuery.data?.vapidPublicKey);
  const canEnable = browserSupported && serverEnabled && permission !== "denied";
  const isEnabled = browserSupported && isNotificationGranted();

  const enable = useCallback(async () => {
    if (!browserSupported) {
      throw new Error("Este navegador não suporta notificações push PWA.");
    }

    if (!configQuery.data?.enabled || !configQuery.data.vapidPublicKey) {
      throw new Error("Notificações push ainda não estão configuradas no servidor.");
    }

    const permissionResult = await Notification.requestPermission();
    if (permissionResult !== "granted") {
      throw new Error("Permissão de notificação não concedida.");
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(configQuery.data.vapidPublicKey),
    });

    const serialized = subscription.toJSON();
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
      throw new Error("Assinatura push inválida.");
    }

    if (target === "tenant_user") {
      await subscribeTenantUser.mutateAsync({ subscription: serialized as any });
    } else {
      await subscribeCustomer.mutateAsync({ tenantId, subscription: serialized as any });
    }

    return { success: true } as const;
  }, [browserSupported, configQuery.data?.enabled, configQuery.data?.vapidPublicKey, subscribeCustomer, subscribeTenantUser, target, tenantId]);

  const disable = useCallback(async () => {
    if (!browserSupported) return { success: true } as const;

    const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }

    return { success: true } as const;
  }, [browserSupported, unsubscribeMutation]);

  return {
    browserSupported,
    serverEnabled,
    canEnable,
    isEnabled,
    permission,
    enable,
    disable,
    isLoading: configQuery.isLoading || subscribeTenantUser.isPending || subscribeCustomer.isPending || unsubscribeMutation.isPending,
  };
}
