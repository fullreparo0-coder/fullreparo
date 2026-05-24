# Diagnóstico Arquitetural — Migração para Subdomínio por Tenant

## Estado Atual

A arquitetura já foi projetada para subdomínio desde o início. O código existente suporta resolução por host de forma nativa. O que precisa mudar é pequeno e cirúrgico.

---

## O que já está pronto (não precisa mudar)

| Componente | Status | Detalhe |
|---|---|---|
| `tenantResolver.ts` | **Pronto** | Extrai slug de `rochacell.fullreparo.com.br` → `"rochacell"` automaticamente |
| `getTenantByDomain()` | **Pronto** | Busca por slug do subdomínio + fallback por `customDomain` exato |
| `ctx.tenantFromHost` | **Pronto** | Injetado em todo contexto tRPC via middleware Express |
| `getTenantByHost` (tRPC) | **Pronto** | Retorna o tenant resolvido pelo host para o frontend |
| `TenantHostContext` | **Pronto** | Frontend já detecta o tenant pelo host automaticamente |
| `isHostTenant` | **Pronto** | Flag usada em `HomeOrPortal`, `Coleta.tsx`, `PublicPortal.tsx` |
| `customerAuth` (cookies) | **Pronto** | Cookie `customer_session` é `httpOnly; path=/` — funciona por subdomínio |
| Rotas `/coleta`, `/entrar`, `/minha-conta` | **Prontas** | Todas funcionam por detecção de host, sem depender de slug na URL |
| `customDomain` no schema | **Pronto** | Campo `varchar(200)` na tabela `tenants` para domínio próprio futuro |

---

## O que precisa mudar (pequeno e cirúrgico)

### 1. DNS — Wildcard `*.fullreparo.com.br` (infraestrutura, fora do código)

**O que é:** Registro DNS `A` ou `CNAME` do tipo wildcard apontando para o servidor.

**Status:** Não verificável aqui — depende do provedor DNS do domínio `fullreparo.com.br`.

**O que fazer:**
- Adicionar registro `*.fullreparo.com.br → IP_DO_SERVIDOR` (ou CNAME para o load balancer).
- No Manus (plataforma atual), isso é configurado nas **Configurações de Domínio** do projeto (painel Management UI → Settings → Domains).
- Após publicar, o Manus provisiona automaticamente o certificado TLS wildcard via Let's Encrypt.

**Risco:** Nenhum impacto no código. Mudança puramente de infraestrutura.

---

### 2. Frontend — Gerar links corretos por subdomínio (3 arquivos)

**Problema:** Três locais no frontend ainda geram links no formato antigo `/coleta/{slug}`:

| Arquivo | Linha | Problema |
|---|---|---|
| `client/src/pages/tenant/Settings.tsx` | 284 | `portalUrl = origin + "/coleta/" + slug` |
| `client/src/pages/public/Cadastro.tsx` | 296, 559, 602 | Exibe e navega para `/coleta/{slug}` |
| `client/src/pages/superadmin/Tenants.tsx` | 62 | Texto "Será usado na URL: /coleta/{slug}" |

**Correção:** Criar uma função utilitária `getTenantPortalUrl(slug, origin?)` que gera a URL correta:

```ts
// shared/tenantUrl.ts
export function getTenantPortalUrl(slug: string, origin?: string): string {
  // Em produção: rochacell.fullreparo.com.br
  // Em desenvolvimento/preview: fullreparo.com.br/?tenant=rochacell (fallback)
  const base = origin ?? window.location.origin;
  const isPreview = base.includes("manus.computer") || base.includes("manus.space") || base.includes("localhost");
  if (isPreview) {
    return `${base}/?tenant=${slug}`;
  }
  // Substitui o hostname pelo subdomínio do tenant
  const url = new URL(base);
  url.hostname = `${slug}.${getRootDomain(url.hostname)}`;
  return url.origin;
}
```

**Risco:** Baixo. Apenas exibição de links — não quebra nenhuma funcionalidade existente.

---

### 3. Backend — `trackingBaseUrl` no `serviceOrders.ts` (1 linha)

**Problema:** Linha 331 usa `"https://app.fullreparo.com.br"` como fallback hardcoded para o link de rastreamento enviado por WhatsApp.

**Correção:** Usar `ctx.tenantFromHost?.slug` para gerar a URL correta:

```ts
// Antes:
const trackingBaseUrl = origin ?? "https://app.fullreparo.com.br";

// Depois:
const tenantSlug = ctx.tenantFromHost?.slug ?? ctx.user?.tenantSlug;
const trackingBaseUrl = origin 
  ?? (tenantSlug ? `https://${tenantSlug}.fullreparo.com.br` : "https://fullreparo.com.br");
```

**Risco:** Baixo. Só afeta o link enviado por WhatsApp na notificação de status.

---

### 4. Compatibilidade retroativa — Rota `/coleta/:slug` (manter)

A rota `/coleta/:slug` **deve ser mantida** como fallback permanente para:
- Links antigos já compartilhados com clientes
- Ambientes de preview/desenvolvimento (onde subdomínio não funciona)
- Modo de teste via `?tenant=slug`

Não há nada a remover. A rota já existe e continuará funcionando em paralelo.

---

## Plano de Migração Incremental (4 etapas)

### Etapa 1 — Infraestrutura (DNS + TLS) — Fora do código
- Configurar wildcard DNS `*.fullreparo.com.br` no painel do Manus (Settings → Domains)
- Publicar o projeto para que o Manus provisione o certificado TLS wildcard
- **Impacto no código:** zero

### Etapa 2 — Utilitário de URL (shared/tenantUrl.ts) — 1 arquivo novo
- Criar `getTenantPortalUrl(slug)` com detecção automática de ambiente
- **Impacto:** nenhum — arquivo novo, sem alterar nada existente

### Etapa 3 — Atualizar links no frontend — 3 arquivos
- `Settings.tsx`: usar `getTenantPortalUrl(tenant.slug)` no lugar de `origin + "/coleta/" + slug`
- `Cadastro.tsx`: idem na tela de sucesso do cadastro
- `Tenants.tsx` (superadmin): atualizar texto informativo
- **Impacto:** apenas visual (links exibidos ao usuário)

### Etapa 4 — Corrigir trackingBaseUrl no backend — 1 linha
- `serviceOrders.ts` linha 331: usar slug do tenant para gerar URL de rastreamento
- **Impacto:** apenas o link enviado por WhatsApp nas notificações de status

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Cookie `customer_session` não funcionar em subdomínio | Baixo | Cookie já é `httpOnly; path=/` sem `domain=` fixo — funciona por subdomínio automaticamente |
| CORS bloqueando requisições tRPC de subdomínio | Médio | Verificar configuração CORS no `server/_core/index.ts` para aceitar `*.fullreparo.com.br` |
| Links antigos `/coleta/{slug}` quebrarem | Zero | Rota mantida como fallback permanente |
| Ambiente de preview Manus não funcionar com subdomínio | Esperado | Modo `?tenant=slug` continua funcionando em preview — sem impacto no desenvolvimento |
| Certificado TLS wildcard | Baixo | Manus provisiona automaticamente via Let's Encrypt ao publicar |

---

## Verificação de CORS (importante)

Ao migrar para subdomínio, as requisições tRPC virão de `rochacell.fullreparo.com.br` para o servidor. O CORS precisa aceitar origens `*.fullreparo.com.br`.

Verificar em `server/_core/index.ts`:

```ts
// Deve aceitar subdomínios do fullreparo
cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = /^https?:\/\/([\w-]+\.)?fullreparo\.com\.br$/.test(origin)
      || origin.includes("localhost")
      || origin.includes("manus.computer")
      || origin.includes("manus.space");
    callback(null, allowed);
  },
  credentials: true,
})
```

---

## Resumo Executivo

O sistema **já está arquitetado para subdomínio**. O `tenantResolver.ts` já extrai o slug de `rochacell.fullreparo.com.br` e injeta o tenant em todo o contexto. O frontend já detecta o host automaticamente via `TenantHostContext`.

O que falta é:
1. **DNS wildcard** (infraestrutura, fora do código)
2. **3 arquivos de frontend** para gerar links corretos
3. **1 linha no backend** para o link de rastreamento por WhatsApp
4. **Verificar CORS** para aceitar `*.fullreparo.com.br`

Nenhuma reconstrução. Nenhum refactor gigante. Migração incremental e segura.
