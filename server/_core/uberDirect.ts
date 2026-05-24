export type UberDirectEnvironment = "sandbox" | "production";

export type UberDirectTenantConfig = {
  ownDeliveryEnabled: boolean;
  enabled: boolean;
  environment: string | null;
  customerId: string | null;
  clientId: string | null;
  clientSecret: string | null;
};

function maskCredential(value?: string | null, prefix = 6, suffix = 4) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= prefix + suffix) return `${trimmed.slice(0, 2)}••••`;
  return `${trimmed.slice(0, prefix)}••••${trimmed.slice(-suffix)}`;
}

export function sanitizeUberDirectConfig(config: UberDirectTenantConfig) {
  return {
    ownDeliveryEnabled: Boolean(config.ownDeliveryEnabled),
    enabled: Boolean(config.enabled),
    environment: (config.environment === "production" ? "production" : "sandbox") as UberDirectEnvironment,
    customerIdConfigured: Boolean(config.customerId),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    customerIdPreview: maskCredential(config.customerId, 8, 6),
    clientIdPreview: maskCredential(config.clientId, 8, 4),
  };
}

export function assertUberDirectReady(config: UberDirectTenantConfig) {
  if (!config.enabled) throw new Error("Uber Direct não está habilitado para esta assistência.");
  if (!config.customerId) throw new Error("Customer ID da Uber Direct não configurado.");
  if (!config.clientId) throw new Error("Client ID da Uber Direct não configurado.");
  if (!config.clientSecret) throw new Error("Client Secret da Uber Direct não configurado.");
}
