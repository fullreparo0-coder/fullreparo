export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Gera a URL de login OAuth.
 *
 * @param returnPath  Caminho relativo para redirecionar após o login (ex: "/minha-conta").
 *                    Quando omitido, o App.tsx decide o destino com base no role do usuário.
 */
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  if (!oauthPortalUrl || !appId) {
    const fallbackUrl = new URL(returnPath ?? "/login", window.location.origin);
    fallbackUrl.searchParams.set("oauth", "unavailable");
    return fallbackUrl.toString();
  }

  // Codifica origin + returnPath no state para que o callback possa redirecionar corretamente
  const statePayload = JSON.stringify({
    origin: window.location.origin,
    returnPath: returnPath ?? null,
  });
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
