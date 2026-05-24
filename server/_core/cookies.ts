import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Sufixos de ambientes de preview/deploy que não devem receber domain cookie. */
const IGNORED_DOMAIN_SUFFIXES = [
  ".manus.computer",
  ".manus.space",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".render.com",
];

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Deriva o valor do atributo `domain` do cookie de sessão.
 *
 * Para subdomínios reais (ex: rocha.fullreparo.com.br), define o domain como
 * ".fullreparo.com.br" para que o cookie seja compartilhado entre todos os
 * subdomínios do mesmo domínio raiz.
 *
 * Retorna `undefined` para localhost, IPs e ambientes de preview.
 */
function deriveCookieDomain(hostname: string): string | undefined {
  const host = hostname.split(":")[0].toLowerCase();

  if (!host) return undefined;
  if (LOCAL_HOSTS.has(host)) return undefined;
  if (isIpAddress(host)) return undefined;

  for (const suffix of IGNORED_DOMAIN_SUFFIXES) {
    if (host.endsWith(suffix)) return undefined;
  }

  const labels = host.split(".");

  // Domínio com ao menos 2 labels (ex: fullreparo.com ou fullreparo.com.br)
  // Para .com.br (3 labels no domínio raiz), precisamos de ao menos 2 labels
  // para construir o domain cookie com ponto prefixado.
  if (labels.length < 2) return undefined;

  // Usa os dois últimos labels para .com e três para second-level TLDs (.com.br)
  const tld = labels.slice(-2).join(".");
  const isSecondLevelTld = /^[a-z]{2,4}\.[a-z]{2}$/.test(tld);
  const rootLabels = isSecondLevelTld ? labels.slice(-3) : labels.slice(-2);
  const rootDomain = rootLabels.join(".");

  // Prefixo "." permite que o cookie seja lido por todos os subdomínios
  return `.${rootDomain}`;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname ?? req.headers.host ?? "";
  const domain = deriveCookieDomain(hostname);

  return {
    ...(domain ? { domain } : {}),
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}

// Exporta para uso em testes
export { deriveCookieDomain };
