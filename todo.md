# fullreparo — SaaS Multi-Tenant para Assistências Técnicas

## Banco de Dados / Schema
- [x] Tabela tenants (assistências)
- [x] Tabela plans (planos SaaS)
- [x] Tabela users (com role e tenant_id)
- [x] Tabela customers (clientes por tenant)
- [x] Tabela devices (aparelhos)
- [x] Tabela service_orders (OS)
- [x] Tabela os_status_history (timeline)
- [x] Tabela os_items (peças/serviços da OS)
- [x] Tabela budgets (orçamentos)
- [x] Tabela pickups (coletas/entregas)
- [x] Tabela photos (fotos das OS)
- [x] Tabela warranties (garantias digitais)
- [x] Tabela stock_items (estoque de peças)
- [x] Tabela payments (pagamentos)
- [x] Tabela checklist_items (checklist de entrada)

## Backend — Routers tRPC
- [x] Router: tenants (CRUD super_admin)
- [x] Router: plans (CRUD super_admin)
- [x] Router: users (gestão por tenant)
- [x] Router: customers (CRUD por tenant)
- [x] Router: service_orders (abertura, atualização, timeline)
- [x] Router: budgets (criar, aprovar, recusar)
- [x] Router: pickups (coleta e entrega)
- [x] Router: stock (estoque de peças)
- [x] Router: payments (registrar pagamento)
- [x] Router: warranties (emitir e consultar)
- [x] Router: public (rastreamento público de OS)
- [x] Middleware multi-tenant (injetar tenant_id no contexto)
- [x] JWT com user_id, tenant_id e role

## Frontend — Design System
- [x] Paleta de cores elegante (azul escuro + dourado/âmbar)
- [x] Tipografia refinada (Inter + fonte de destaque)
- [x] Componentes globais: StatusBadge, OSTimeline, SignatureCanvas
- [x] Layout de dashboard com sidebar responsiva (TenantLayout)
- [x] Landing page pública do SaaS

## Frontend — Autenticação e Roteamento
- [x] Página de login
- [x] Roteamento por role (super_admin, tenant_admin, atendente, tecnico, entregador, cliente)
- [x] Guards de rota por permissão no TenantLayout

## Painel Super Admin
- [x] Dashboard com métricas gerais
- [x] Listagem e cadastro de tenants
- [x] Gestão de planos (Básico, Profissional, Premium)
- [x] Bloquear/desbloquear tenant
- [x] Configurar limites por plano

## Painel da Assistência (tenant_admin + atendente)
- [x] Dashboard da assistência com KPIs
- [x] Abertura de OS no balcão (formulário completo)
- [x] Listagem e busca de OS (por número, cliente, IMEI, QR)
- [x] Detalhes e timeline da OS
- [x] Gestão de clientes
- [x] Gestão de equipe (técnicos, entregadores, atendentes)
- [x] Gestão de estoque de peças
- [x] Gestão de pagamentos (via detalhes da OS)
- [x] Configurações da assistência (logo, cores, WhatsApp, domínio)

## Portal do Cliente
- [x] Solicitação de coleta (formulário público por slug)
- [x] Rastreamento público de OS por link seguro (token)
- [x] Aprovação/recusa de orçamento via link público
- [x] Visualização de garantia digital

## Painel do Entregador
- [x] Lista de coletas e entregas pendentes
- [x] Confirmar retirada (foto + assinatura digital)
- [x] Confirmar entrega (foto + assinatura digital)

## Recursos Especiais
- [x] Timeline de status com 17 status
- [x] Geração de número de OS automático
- [x] Assinatura digital (canvas)
- [x] Upload de fotos via base64 → S3
- [x] Garantia digital vinculada à OS (gerada automaticamente ao finalizar)
- [x] Envio de comprovante via WhatsApp (link wa.me)
- [x] Busca global por OS, cliente, IMEI, telefone

## Testes
- [x] Testes unitários dos routers principais (18 testes passando)
- [x] Checkpoint final

## Validação Multi-Tenant — TechFix como novo tenant

- [x] Inserir tenant TechFix no banco com slug, cores e plano próprios
- [x] Verificar isolamento: queries de OS, clientes e estoque filtram por tenantId
- [x] Verificar branding separado: TechFix com cores distintas do fullreparo demo
- [x] Verificar usuários separados: usuário de um tenant não acessa dados do outro
- [x] Verificar OS separadas: OS criadas para TechFix não aparecem para outros tenants
- [x] Verificar permissões: roles aplicadas corretamente por tenant
- [x] Escrever testes Vitest de isolamento multi-tenant
- [x] Documentar resultado da validação

## Bug Fixes

- [x] FORBIDDEN em /superadmin: role "admin" (owner) não reconhecido como "super_admin" nos routers

## Cadastro Público de Assistências

- [x] Procedure pública `tenants.register` com validação de slug único, CNPJ e e-mail
- [x] Geração automática de slug a partir do nome da assistência
- [x] Notificação ao super admin via `notifyOwner` ao criar novo tenant
- [x] Página `/cadastro` com formulário multi-step (dados da empresa → plano → confirmação)
- [x] Step 1: nome, CNPJ, e-mail, telefone, cidade, estado
- [x] Step 2: seleção visual de plano (Básico, Profissional, Premium) com comparativo de features
- [x] Step 3: tela de confirmação com slug gerado e próximos passos
- [x] Link "Cadastre sua assistência" na landing page e no menu de navegação
- [x] Rota `/cadastro` registrada no App.tsx
- [x] Testes Vitest para a procedure `tenants.register`
- [x] Validação real de CNPJ/CPF na procedure `tenants.register` (dígitos verificadores)
- [x] Testes Vitest cobrindo rejeição de CNPJ/CPF inválido

## Bug Fixes — /os/nova

- [x] FORBIDDEN em /os/nova: queries de clientes/técnicos bloqueadas para super_admin sem tenantId
- [x] "Usuário sem tenant" ao tentar criar OS como super_admin (tenantId null)
- [x] super_admin deve poder selecionar um tenant antes de operar como tenant_admin
- [x] Guardar em ServiceOrderNew.tsx para não executar queries enquanto user.tenantId estiver ausente
- [x] Aguardar auth.me refletir o novo tenant após switchTenant antes de navegar para /dashboard

## Limite de OS por Plano

- [x] Backend: verificar `maxOsPerMonth` do plano do tenant antes de criar OS (createBalcao e createColeta)
- [x] Backend: retornar erro `PLAN_LIMIT_REACHED` com mensagem clara quando limite for atingido
- [x] Backend: procedure `serviceOrders.usageStats` retornando OS do mês atual e limite do plano
- [x] Frontend: exibir banner de aviso em /os/nova quando uso >= 80% do limite
- [x] Frontend: bloquear formulário com tela de upgrade quando limite for atingido (100%)
- [x] Frontend: indicador de uso (ex.: "23/50 OS este mês") no dashboard da assistência
- [x] Testes Vitest cobrindo: criação bloqueada ao atingir limite, criação permitida abaixo do limite, plano sem limite (null = ilimitado)

## Refinamentos — Limite de OS por Plano

- [x] Testes Vitest para createBalcao: bloqueio ao atingir limite, permissão abaixo do limite, plano ilimitado (maxOsPerMonth=null)
- [x] Tratar erro de limite no portal público /coleta/:slug com aviso amigável (em vez de toast genérico)

## Paginação Server-Side — Listagem de OS

- [x] Backend: atualizar procedure `serviceOrders.list` com parâmetros `page`, `pageSize` e retornar `totalCount`, `totalPages`, `currentPage`
- [x] Backend: aplicar `LIMIT` e `OFFSET` na query de OS com base na paginação
- [x] Frontend: criar componente `Pagination.tsx` reutilizável com navegação por páginas
- [x] Frontend: atualizar `ServiceOrdersList.tsx` para usar paginação server-side
- [x] Frontend: manter filtros (status, busca) ao trocar de página (reset para página 1 ao filtrar)
- [x] Frontend: exibir contador "Mostrando X–Y de Z ordens"
- [x] Testes Vitest para `serviceOrders.list` com paginação (page=1, page=2, pageSize, totalCount)

## Paginação — Clientes e Estoque

- [x] Backend: `customers.list` com `page`, `pageSize`, `totalCount`, `totalPages`
- [x] Backend: `stock.list` com `page`, `pageSize`, `totalCount`, `totalPages`
- [x] Frontend: `CustomersList.tsx` com componente `Pagination` e reset de página ao buscar
- [x] Frontend: `StockList.tsx` com componente `Pagination` e reset de página ao buscar
- [x] Testes Vitest para `customers.list` e `stock.list` com paginação

## Busca Expandida — Listagem de OS

- [x] Backend: busca por IMEI (`devices.imei`)
- [x] Backend: busca por número de série (`devices.serialNumber`)
- [x] Backend: busca por número da OS (`service_orders.osNumber`)
- [x] Backend: busca por CPF do cliente (`customers.document`)
- [x] Backend: manter busca existente por nome e telefone do cliente
- [x] Frontend: atualizar placeholder do campo de busca para refletir todos os campos
- [x] Frontend: adicionar tooltip/hint com os campos suportados
- [x] Testes Vitest para busca por IMEI, SN, número de OS e CPF
- [x] Fortalecer testes de busca expandida com dados conhecidos para afirmar resultados por IMEI, SN, osNumber e CPF
- [x] Teste Vitest para busca por serialNumber (SN) com dado conhecido
- [x] Fortalecer testes de IMEI e CPF para afirmar que retorna ao menos 1 OS correspondente

## Busca Expandida — Listagem de Clientes

- [x] Backend: busca por CPF/CNPJ (`customers.document`) em getCustomersByTenant
- [x] Backend: busca por telefone (`customers.phone`) em getCustomersByTenant
- [x] Backend: manter busca existente por nome
- [x] Frontend: atualizar placeholder do campo de busca em CustomersList.tsx
- [x] Frontend: adicionar tooltip/hint com os campos suportados
- [x] Testes Vitest: busca por CPF/CNPJ com dado conhecido
- [x] Testes Vitest: busca por telefone com dado conhecido

## Página de Detalhes do Cliente

- [x] Backend: procedure `customers.getById` retornando dados completos do cliente (isolado por tenantId)
- [x] Backend: procedure `customers.getDevices` retornando aparelhos do cliente (isolado por tenantId)
- [x] Backend: procedure `customers.getOrders` retornando OS do cliente com paginação (isolado por tenantId)
- [x] Frontend: criar página `CustomerDetail.tsx` em `/clientes/:id`
- [x] Frontend: seção de dados do cliente (nome, telefone, e-mail, CPF/CNPJ, endereço, cidade)
- [x] Frontend: seção de aparelhos cadastrados (marca, modelo, IMEI, SN, cor)
- [x] Frontend: seção de histórico de OS com StatusBadge, data e link para detalhes da OS
- [x] Frontend: botão "Voltar" para `/clientes`
- [x] Frontend: link clicável em cada linha da listagem de clientes para abrir detalhes
- [x] Rota `/clientes/:id` registrada no App.tsx dentro do TenantLayout
- [x] Testes Vitest: customers.getById retorna cliente correto do tenant
- [x] Testes Vitest: customers.getById lança NOT_FOUND para cliente de outro tenant
- [x] Testes Vitest: customers.getDevices retorna aparelhos do cliente
- [x] Testes Vitest: customers.getOrders retorna OS do cliente

## Middleware de Resolução de Tenant por Host

- [x] Backend: helper `getTenantByDomain(host)` no db.ts — busca por slug (subdomínio) e por customDomain
- [x] Backend: middleware Express `tenantResolver` em `server/_core/tenantResolver.ts`
  - extrai slug do subdomínio (ex: `rocha.fullreparo.com.br` → slug `rocha`)
  - fallback para `customDomain` exato
  - ignora `www`, `app`, `localhost`, IPs e o domínio raiz
  - injeta `req.resolvedTenant` no request
- [x] Backend: expor `tenantFromHost` no contexto tRPC (`server/_core/context.ts`)
- [x] Backend: ativar cookie cross-subdomain em `cookies.ts` (descomentar bloco de domain)
- [x] Backend: registrar o middleware no servidor Express (`server/_core/index.ts`)
- [x] Backend: procedure `public.getTenantByHost` para o frontend detectar o tenant pelo host atual
- [x] Testes Vitest: extração de slug de subdomínio (casos normais e edge cases)
- [x] Testes Vitest: resolução por customDomain
- [x] Testes Vitest: hosts ignorados (www, app, localhost, IP, domínio raiz)
- [x] Testes Vitest: tenant não encontrado retorna null sem lançar erro

## Namespace /painel para Rotas Administrativas

- [x] App.tsx: prefixar rotas operacionais com /painel (dashboard, os, clientes, usuarios, estoque, configuracoes, entregador)
- [x] App.tsx: adicionar redirecionamentos de /dashboard → /painel/dashboard (compatibilidade)
- [x] TenantLayout.tsx: atualizar todos os hrefs de NAV_ITEMS para /painel/*
- [x] TenantLayout.tsx: atualizar TENANT_REQUIRED_PATHS para /painel/*
- [x] TenantLayout.tsx: atualizar redirect de usuário sem tenant para /painel/superadmin ou /superadmin
- [x] ServiceOrdersList.tsx: atualizar navigate("/os/nova") → navigate("/painel/os/nova")
- [x] ServiceOrdersList.tsx: atualizar navigate(`/os/${id}`) → navigate(`/painel/os/${id}`)
- [x] ServiceOrderNew.tsx: atualizar navigate após criação para /painel/os/:id
- [x] ServiceOrderDetail.tsx: atualizar links internos e botão Voltar para /painel/os
- [x] CustomersList.tsx: atualizar navigate(`/clientes/${id}`) → navigate(`/painel/clientes/${id}`)
- [x] CustomerDetail.tsx: atualizar navigate("/clientes") → navigate("/painel/clientes") e links de OS
- [x] DelivererDashboard.tsx: atualizar links internos para /painel/entregador
- [x] useAuth / getLoginUrl: verificar se returnPath usa rotas antigas
- [x] Testes: verificar que 144 testes continuam passando após refactor

## Portal Público com Detecção Automática por Host

- [x] Contexto TenantHostContext: detectar tenant pelo host atual via trpc.public.getTenantByHost
- [x] Hook useTenantHost: expor { tenant, loading, isHostTenant } para componentes
- [x] App.tsx: envolver rotas públicas com TenantHostProvider
- [x] Coleta.tsx: usar branding automático (nome, logo, cor) quando isHostTenant=true, sem exigir slug na URL
- [x] Coleta.tsx: rota /coleta funcionar sem slug quando acessada por subdomínio
- [x] Track.tsx: exibir nome e branding da assistência no cabeçalho usando tenant do host
- [x] WarrantyCheck.tsx: exibir nome e branding da assistência usando tenant do host
- [x] PublicPortal.tsx: página home do subdomínio com links para coleta, rastreamento e garantia
- [x] App.tsx: rota / no subdomínio redireciona para PublicPortal quando isHostTenant=true
- [x] Testes: procedure public.getTenantByHost retorna tenant correto por slug e por customDomain

## Domínio Personalizado nas Configurações do Tenant

- [x] Backend: procedure `tenants.updateCustomDomain` com validação de formato de domínio
- [x] Backend: validar unicidade do customDomain (não pode ser usado por outro tenant)
- [x] Backend: rejeitar domínios reservados (fullreparo.com.br, subdomínios .fullreparo.com.br)
- [x] Backend: procedure `tenants.removeCustomDomain` para remover o domínio personalizado
- [x] Frontend: seção "Domínio Personalizado" na página Settings.tsx
- [x] Frontend: campo de input com validação de formato (ex: rochacelulares.com.br)
- [x] Frontend: instruções de DNS (registro CNAME apontando para o domínio do SaaS)
- [x] Frontend: badge de status (configurado / não configurado)
- [x] Frontend: botão de remover domínio com confirmação
- [x] Testes Vitest: validação de formato de domínio
- [x] Testes Vitest: rejeição de domínio reservado
- [x] Testes Vitest: rejeição de domínio já em uso por outro tenant

## Upload de Logotipo do Tenant

- [x] Backend: procedure `tenants.uploadLogo` — recebe base64/dataURL, faz upload para S3, salva URL no campo `logoUrl`
- [x] Backend: procedure `tenants.removeLogo` — remove logo (seta logoUrl para null)
- [x] Frontend: componente de upload em Settings.tsx com preview da imagem atual
- [x] Frontend: drag-and-drop ou clique para selecionar arquivo (PNG/JPG/WebP, max 2MB)
- [x] Frontend: validação de tipo e tamanho no cliente antes do upload
- [x] Frontend: botão de remover logo com confirmação
- [x] Frontend: exibir logo no cabeçalho do TenantLayout (sidebar/topbar)
- [x] Frontend: exibir logo no PublicPortal e TenantPublicHeader (Coleta, Track, WarrantyCheck)
- [x] Testes Vitest: tenants.uploadLogo rejeita acesso de atendente
- [x] Testes Vitest: tenants.removeLogo rejeita acesso de atendente

## Melhoria da Seleção de Cor Primária

- [x] Frontend: paleta de cores predefinidas (10 opções comuns para assistências técnicas)
- [x] Frontend: preview em tempo real do cabeçalho do portal com logo + cor escolhida
- [x] Frontend: amostra de contraste (botão CTA com a cor escolhida e texto branco/preto)
- [x] Frontend: validação de formato hexadecimal no campo de texto
- [x] Frontend: mover seção de cores para logo após a seção de logotipo (fluxo natural)

## Branding na Página de Rastreamento de OS

- [x] Backend: incluir `tenantBranding` (name, logoUrl, primaryColor, whatsappNumber) na resposta de `public.trackOs`
- [x] Frontend: Track.tsx — usar `tenantBranding` da OS quando não acessado por subdomínio (link direto)
- [x] Frontend: Track.tsx — aplicar cor primária no cabeçalho, botão "Aprovar orçamento" e indicadores de status
- [x] Frontend: Track.tsx — exibir logo do tenant no cabeçalho (fallback para iniciais com cor primária)
- [x] Frontend: Track.tsx — rodapé com nome da assistência em vez de "fullreparo" quando branding disponível
- [x] Frontend: DemoPage — aplicar branding genérico consistente (sem alterar dados demo)

## Branding na Página de Verificação de Garantia

- [x] Backend: incluir `tenantBranding` (name, logoUrl, primaryColor, whatsappNumber) na resposta de `public.checkWarranty`
- [x] Frontend: WarrantyCheck.tsx — usar `tenantBranding` da garantia quando não acessado por subdomínio (link direto)
- [x] Frontend: WarrantyCheck.tsx — cabeçalho colorido com cor primária, logo ou iniciais (mesmo padrão do Track.tsx)
- [x] Frontend: WarrantyCheck.tsx — rodapé com nome da assistência quando branding disponível
- [x] Frontend: WarrantyCheck.tsx — botão WhatsApp com cor primária quando whatsappNumber disponível

## Branding na Página de Coleta de OS

- [x] Frontend: Coleta.tsx — aplicar cor primária no cabeçalho (mesmo padrão TenantPublicHeader)
- [x] Frontend: Coleta.tsx — usar branding do tenant pelo slug quando não acessado por subdomínio
- [x] Frontend: Coleta.tsx — botão "Solicitar Coleta" com cor primária do tenant
- [x] Frontend: Coleta.tsx — spinner de loading com cor primária
- [x] Frontend: Coleta.tsx — botão WhatsApp com cor primária quando whatsappNumber disponível
- [x] Frontend: Coleta.tsx — rodapé com nome da assistência quando branding disponível

## Branding Dinâmico no PublicPortal

- [x] Frontend: PublicPortal.tsx — hero com cor primária do tenant (fundo, gradiente ou acento)
- [x] Frontend: PublicPortal.tsx — logo ou iniciais no cabeçalho/hero em vez de ícone fixo
- [x] Frontend: PublicPortal.tsx — botões CTA com cor primária e contraste automático
- [x] Frontend: PublicPortal.tsx — cards de serviço com ícones tematizados na cor primária
- [x] Frontend: PublicPortal.tsx — rodapé com nome da assistência

## Horário de Funcionamento do Tenant

- [x] Schema: adicionar campo `businessHours` (text, nullable) na tabela `tenants`
- [x] Migração SQL: ALTER TABLE tenants ADD COLUMN business_hours TEXT
- [x] Backend: incluir `businessHours` na procedure `tenants.update` (validação max 100 chars)
- [x] Backend: incluir `businessHours` na resposta de `public.getTenantInfo` e `public.getTenantByHost`
- [x] Frontend: campo de texto em Settings.tsx na seção de informações gerais
- [x] Frontend: exibir `businessHours` no hero do PublicPortal.tsx com ícone Clock
- [x] Testes Vitest: tenants.update salva e retorna businessHours corretamente

## Botão Flutuante de WhatsApp no Portal Público

- [x] Componente WhatsAppFAB: botão circular fixo no canto inferior direito com ícone MessageCircle
- [x] WhatsAppFAB: cor verde WhatsApp (#25d366), sombra e animação de entrada suave
- [x] WhatsAppFAB: tooltip "Falar no WhatsApp" ao hover
- [x] WhatsAppFAB: visível apenas quando whatsappNumber está configurado no tenant
- [x] WhatsAppFAB: aplicar no PublicPortal.tsx
- [x] WhatsAppFAB: aplicar no Coleta.tsx
- [x] WhatsAppFAB: aplicar no Track.tsx
- [x] WhatsAppFAB: aplicar no WarrantyCheck.tsx
- [x] WhatsAppFAB: aplicar no TrackLookup.tsx

## Mensagem Automática com OS no WhatsApp (Track)

- [x] Track.tsx: passar mensagem personalizada com número da OS ao WhatsAppFAB quando OS carregada
- [x] WhatsAppFAB: aceitar prop `message` opcional para sobrescrever mensagem padrão

## Mensagem Automática com OS no WhatsApp (Coleta)

- [x] Coleta.tsx: botão WhatsApp na tela de sucesso usa mensagem automática com número da OS criada
- [x] Coleta.tsx: WhatsAppFAB na tela de sucesso também usa mensagem com número da OS

## Notificação Interna ao Criar OS via Coleta Pública

- [x] Backend: chamar notifyOwner em createColeta com título "Nova solicitação de coleta" e dados da OS
- [x] Backend: incluir nome do cliente, telefone, aparelho, defeito relatado e endereço de coleta na notificação
- [x] Backend: notificação não deve bloquear a criação da OS em caso de falha (fire-and-forget)
- [x] Testes Vitest: createColeta dispara notificação (mock do notifyOwner)

## Edição Rápida de Dados do Cliente

- [x] Backend: procedure `customers.update` — atualiza nome, telefone, e-mail, endereço, cidade, documento e observações
- [x] Backend: validação de isolamento por tenantId (não pode editar cliente de outro tenant)
- [x] Frontend: botão "Editar" no card de perfil do cliente em CustomerDetail.tsx
- [x] Frontend: modo de edição inline — campos de texto substituem os valores exibidos
- [x] Frontend: atualização otimista com rollback em caso de erro
- [x] Frontend: botões "Salvar" e "Cancelar" no modo de edição
- [x] Frontend: feedback visual de sucesso (toast) após salvar
- [x] Testes Vitest: customers.update salva corretamente e rejeita acesso cross-tenant

## Cadastro de Aparelho no Perfil do Cliente

- [x] Backend: procedure `devices.create` — cadastra aparelho vinculado a customer + tenant, campos: brand, model, type, color, imei, serialNumber
- [x] Backend: validação de isolamento por tenantId (customer deve pertencer ao tenant do usuário)
- [x] Frontend: botão "Novo Aparelho" na seção de aparelhos em CustomerDetail.tsx
- [x] Frontend: modal de cadastro com campos brand, model, type, color, IMEI e SN
- [x] Frontend: invalidar query `customers.devices` após criação bem-sucedida
- [x] Frontend: toast de sucesso/erro após salvar
- [x] Testes Vitest: devices.create cria aparelho corretamente e rejeita acesso cross-tenant

## Nova OS a partir do Perfil do Cliente

- [x] Frontend: botão "Nova OS" no card do cliente em CustomerDetail.tsx
- [x] Frontend: navegar para /painel/os/nova?customerId=X ao clicar
- [x] Frontend: ServiceOrderNew.tsx lê customerId da query string ao montar
- [x] Frontend: pré-selecionar o cliente no campo de busca quando customerId está presente
- [x] Frontend: pré-carregar aparelhos do cliente selecionado automaticamente
- [x] Frontend: exibir banner informativo "Criando OS para [nome do cliente]" quando pré-preenchido

## Modo de Teste do Portal Público via Query Param

- [x] Frontend: TenantHostContext lê ?tenant=slug da URL como fallback quando host não é subdomínio
- [x] Frontend: busca dados do tenant via trpc.public.getTenantInfo quando slug vem da query string
- [x] Frontend: App.tsx exibe PublicPortal na rota raiz quando ?tenant=slug está presente
- [x] Frontend: banner de aviso "Modo de Teste" visível no portal quando acessado via query param

## Personalização Visual do Tenant (Branding)

- [x] Backend: procedure `tenants.updateBranding` — atualiza logoUrl, primaryColor, secondaryColor com isolamento por tenantId
- [x] Backend: procedure `tenants.uploadLogo` — recebe base64/buffer, faz upload para S3 e retorna URL
- [x] Frontend: seção "Identidade Visual" em Settings.tsx com color pickers para cor primária e secundária
- [x] Frontend: upload de logo com preview da imagem selecionada
- [x] Frontend: preview em tempo real das cores no card de exemplo
- [x] Frontend: invalidar cache do TenantHostContext após salvar branding
- [x] Frontend: toast de sucesso/erro após salvar
- [x] Testes Vitest: tenants.updateBranding salva corretamente e rejeita acesso cross-tenant

## Login no Portal Público e Redirect Inteligente

- [x] Frontend: botão "Entrar" no header do PublicPortal com ícone e estilo contrastante
- [x] Frontend: getLoginUrl passa returnPath=/ para voltar ao portal após login
- [x] Frontend: redirect pós-login baseado em role — tenant_admin/atendente/tecnico → /painel/dashboard, cliente → /minha-conta
- [x] Frontend: página /minha-conta com lista de OS do cliente logado
- [x] Frontend: rota /minha-conta registrada no App.tsx
- [x] Frontend: se usuário já está logado no portal, exibir avatar/nome no header em vez do botão Entrar

## Vínculo Customer ↔ Usuário (openId)

- [x] Schema: coluna `userOpenId` (varchar 64, nullable) na tabela `customers`
- [x] Migração SQL: ALTER TABLE customers ADD COLUMN userOpenId
- [x] Backend: procedure `customers.linkUser` vincula openId ao customer (chamada pelo atendente)
- [x] Backend: createColeta salva `userOpenId` no customer quando o usuário está logado no portal
- [x] Backend: myOrders busca OS por e-mail OU por openId do usuário logado
- [x] Testes Vitest: myOrders retorna OS vinculadas por openId mesmo sem e-mail

## Endpoint customers.findByDocument

- [x] Backend: procedure `customers.findByDocument` — busca por CPF (normalizado, só dígitos) ou e-mail (lowercase+trim) limitada ao tenantId do atendente
- [x] Backend: retorna o primeiro match com campos id, name, phone, email, document, address, city, state, zipCode, userOpenId — ou null se não encontrado
- [x] Backend: validação de input mínimo (6 chars para CPF parcial, 5 para e-mail)
- [x] Backend: normalização de CPF remove pontos, traços e barras antes de comparar
- [x] Testes Vitest: findByDocument encontra por CPF normalizado, por e-mail, retorna null quando não existe e rejeita cross-tenant

## Normalização de CPF/CNPJ no Cadastro de Clientes

- [x] Backend: customers.create normaliza `document` para apenas dígitos antes de inserir
- [x] Backend: customers.update normaliza `document` para apenas dígitos antes de atualizar
- [x] Backend: customers.create normaliza `email` para lowercase+trim antes de inserir
- [x] Backend: customers.update normaliza `email` para lowercase+trim antes de atualizar
- [x] Testes Vitest: create com CPF formatado salva apenas dígitos; update idem

## Step 0 de Identificação de Cliente na Nova OS

- [x] Frontend: step 0 com campo único CPF/e-mail antes do step de dados do cliente
- [x] Frontend: debounce de 400ms na busca — dispara findByDocument automaticamente
- [x] Frontend: mínimo de 5 chars para iniciar a busca (CPF parcial ou e-mail)
- [x] Frontend: estado "buscando" com spinner leve no campo
- [x] Frontend: estado "encontrado" — badge verde + dados do cliente preenchidos automaticamente
- [x] Frontend: estado "não encontrado" — badge laranja + botão "Cadastrar novo cliente"
- [x] Frontend: modal de cadastro rápido com CPF/e-mail já preenchido, campos nome e telefone obrigatórios
- [x] Frontend: após cadastro no modal, continuar fluxo da OS com o novo cliente selecionado
- [x] Frontend: botão "Pular identificação" para casos sem CPF/e-mail disponível
- [x] Frontend: fluxo responsivo para mobile/tablet (campo grande, botões fáceis de tocar)

## Histórico de Aparelhos no Step de Aparelho (Nova OS)

- [x] Frontend: buscar aparelhos do cliente via customers.devices quando customerId é definido
- [x] Frontend: exibir lista de aparelhos anteriores como cards selecionáveis no step de aparelho
- [x] Frontend: ao selecionar aparelho existente, pré-preencher brand, model, type, color, imei, serialNumber
- [x] Frontend: badge visual indicando aparelho selecionado vs novo cadastro
- [x] Frontend: botão "Usar este aparelho" e "Cadastrar novo aparelho" claramente distintos
- [x] Frontend: aparelhos exibidos com ícone, marca, modelo, tipo e data da última OS
- [x] Frontend: se cliente não tem aparelhos, exibir mensagem "Nenhum aparelho cadastrado" e focar no formulário

## Campo de Marca com Autocomplete

- [x] Componente `BrandCombobox` reutilizável com lista de marcas populares (Smartphone, Notebook, Tablet, etc.)
- [x] Busca por iniciais — filtra a lista ao digitar (case-insensitive)
- [x] Opção de digitar marca personalizada quando não encontrada na lista
- [x] Substituir campo Marca em `ServiceOrderNew.tsx` pelo BrandCombobox
- [x] Substituir campo Marca no modal "Novo Aparelho" em `CustomerDetail.tsx`

## Campo de Modelo com Autocomplete por Marca

- [x] Arquivo `brandModels.ts` com mapa completo marca → modelos populares no Brasil
- [x] Componente `ModelCombobox` com busca por iniciais e opção de modelo personalizado
- [x] ModelCombobox reage à marca selecionada (lista muda ao trocar a marca)
- [x] Substituir campo Modelo em `ServiceOrderNew.tsx` pelo ModelCombobox
- [x] Substituir campo Modelo no modal "Novo Aparelho" em `CustomerDetail.tsx`

## Dropdown de Tipo de Aparelho

- [x] Constante `DEVICE_TYPES` em `shared/const.ts` com categorias fixas
- [x] Substituir campo Tipo em `ServiceOrderNew.tsx` por Select com categorias fixas
- [x] Substituir campo Tipo no modal "Novo Aparelho" em `CustomerDetail.tsx`

## Especialidades do Tenant (Tipos e Marcas)

- [x] Schema: coluna `deviceSpecialties` (JSON text, nullable) na tabela `tenants` — estrutura: `{ [tipo: string]: string[] }` (ex: `{ "Smartphone": ["Samsung", "Apple"] }`)
- [x] Migração SQL: ALTER TABLE tenants ADD COLUMN deviceSpecialties
- [x] Backend: procedure `tenants.updateSpecialties` — salva o mapa tipo→marcas com isolamento por tenantId
- [x] Backend: procedure `tenants.getSpecialties` — retorna o mapa tipo→marcas do tenant atual
- [x] Frontend: seção "Especialidades" em Settings.tsx com lista de tipos (checkboxes) e, ao marcar um tipo, exibir checkboxes de marcas daquele tipo
- [x] Frontend: seleção "Todas as marcas" por tipo como atalho
- [x] Frontend: botão Salvar especialidades com toast de sucesso/erro
- [x] Frontend: ServiceOrderNew.tsx filtra tipos pelo deviceSpecialties do tenant (se configurado)
- [x] Frontend: BrandCombobox filtra marcas pelo tipo selecionado + especialidades do tenant
- [x] Frontend: CustomerDetail.tsx modal Novo Aparelho também filtra tipos e marcas

## Validação de CPF/CNPJ no Cadastro de Clientes

- [x] Shared: mover `isValidCPF` e `isValidCNPJ` para `shared/cpfCnpj.ts` com export nomeado
- [x] Shared: exportar também `formatCPF` e `formatCNPJ` para exibição formatada
- [x] Backend: `customers.create` valida dígitos verificadores do CPF/CNPJ antes de inserir
- [x] Backend: `customers.update` valida dígitos verificadores do CPF/CNPJ antes de atualizar
- [x] Backend: retornar erro `BAD_REQUEST` com mensagem "CPF inválido" ou "CNPJ inválido"
- [x] Frontend: campo CPF/CNPJ no modal de cadastro rápido (ServiceOrderNew) com validação inline
- [x] Frontend: campo CPF/CNPJ na edição inline do cliente (CustomerDetail) com validação inline
- [x] Frontend: mensagem de erro vermelha abaixo do campo quando CPF/CNPJ inválido
- [x] Frontend: botão Salvar desabilitado enquanto CPF/CNPJ inválido
- [x] Testes Vitest: customers.create rejeita CPF inválido (ex: 111.111.111-11)
- [x] Testes Vitest: customers.create rejeita CNPJ inválido
- [x] Testes Vitest: customers.create aceita CPF válido
- [x] Testes Vitest: customers.update rejeita CPF inválido

## Preenchimento Automático de Endereço por CEP (ViaCEP)

- [x] Hook `useCepLookup` em `client/src/hooks/useCepLookup.ts` com debounce 500ms, consulta ViaCEP, estados: idle/loading/found/error
- [x] Hook retorna `{ address, city, state, neighborhood, loading, error }` e aceita callback `onFound`
- [x] Máscara automática de CEP (00000-000) no campo de input
- [x] Spinner no campo CEP enquanto busca
- [x] Mensagem de erro inline "CEP não encontrado" quando inválido
- [x] Integrar em `CustomerDetail.tsx`: ao digitar CEP preenche endereço, cidade e estado automaticamente
- [x] Integrar em `ServiceOrderNew.tsx`: modal de cadastro rápido preenche endereço ao digitar CEP
- [x] Testes Vitest: hook useCepLookup (mock fetch, CEP válido, CEP inválido, debounce)

## Campos Número e Ponto de Referência no Endereço do Cliente

- [x] Schema: adicionar colunas `addressNumber` e `addressReference` na tabela `customers`
- [x] Migration SQL: ALTER TABLE customers ADD COLUMN address_number e address_reference
- [x] Backend: `customers.create` e `customers.update` aceitam `addressNumber` e `addressReference`
- [x] Backend: `customers.getById` retorna os novos campos
- [x] Frontend: `CustomerDetail.tsx` exibe e edita número e ponto de referência
- [x] Frontend: `ServiceOrderNew.tsx` modal de cadastro rápido inclui número e ponto de referência

## Checklist Editável pelo Super Admin

- [x] Schema: tabela `checklist_templates` com id, label, sortOrder, isActive, createdAt
- [x] Migration SQL: CREATE TABLE checklist_templates
- [x] Seed: inserir os 8 itens padrão atuais na tabela
- [x] Backend: `checklistTemplates.list` — lista todos os itens ordenados por sortOrder
- [x] Backend: `checklistTemplates.create` — adiciona novo item
- [x] Backend: `checklistTemplates.update` — edita label, isActive ou sortOrder
- [x] Backend: `checklistTemplates.delete` — remove item
- [x] Backend: `checklistTemplates.reorder` — atualiza sortOrder em lote
- [x] Frontend: página `/superadmin/checklist` com lista, toggle ativo/inativo, edição inline, setas de reordenamento e botão Adicionar
- [x] Frontend: botão "Checklist Padrão de OS" no Dashboard do super_admin
- [x] Frontend: rota `/superadmin/checklist` registrada no App.tsx
- [x] Frontend: ServiceOrderNew.tsx carrega itens do servidor via `trpc.checklistTemplates.list` em vez do DEFAULT_CHECKLIST hardcoded

## Checklist por Tipo de Aparelho

- [x] Schema: adicionar coluna `deviceType` (varchar 100, nullable) na tabela `checklist_templates` — null = global (aparece em todos os tipos)
- [x] Migration SQL: ALTER TABLE checklist_templates ADD COLUMN device_type
- [x] Seed: manter os 8 itens globais existentes (deviceType = null) e adicionar itens específicos por tipo
- [x] Backend: `checklistTemplates.list` aceita parâmetro opcional `deviceType` e retorna itens globais + itens do tipo
- [x] Backend: `checklistTemplates.create` e `update` aceitam campo `deviceType` opcional
- [x] Frontend superadmin: página `/superadmin/checklist` com abas — "Global" + uma aba por tipo de aparelho
- [x] Frontend superadmin: ao adicionar item, selecionar a qual tipo pertence (ou Global)
- [x] Frontend ServiceOrderNew: filtrar checklist pelo `form.deviceType` selecionado na etapa anterior
- [x] Frontend ServiceOrderNew: mostrar badge indicando quantos itens do checklist são específicos do tipo

## Checklist Personalizável por Tenant

- [x] Schema: tabela `tenant_checklist_overrides` com tenantId, templateId (nullable), label, sortOrder, isActive, isCustom, deviceType
- [x] Migration SQL: CREATE TABLE tenant_checklist_overrides
- [x] Backend: `tenantChecklist.list` — retorna checklist efetivo do tenant (globais + específicos, com overrides aplicados)
- [x] Backend: `tenantChecklist.listForAdmin` — retorna checklist completo para a tela de configuração
- [x] Backend: `tenantChecklist.toggleTemplate` — ativa/desativa item global para o tenant
- [x] Backend: `tenantChecklist.createCustom` — cria item exclusivo do tenant
- [x] Backend: `tenantChecklist.updateCustom` — edita label/isActive de item próprio
- [x] Backend: `tenantChecklist.deleteCustom` — remove item próprio do tenant
- [x] Backend: `tenantChecklist.reorder` — reordena itens do tenant
- [x] Frontend: página `/painel/checklist` com abas por tipo de aparelho
- [x] Frontend: toggle para ativar/desativar itens globais (herdados do super_admin)
- [x] Frontend: botão para adicionar item exclusivo do tenant
- [x] Frontend: edição inline de itens próprios
- [x] Frontend: link "Checklist" na navegação do TenantLayout (apenas tenant_admin/admin)
- [x] Frontend: rota `/painel/checklist` no App.tsx
- [x] Frontend: ServiceOrderNew usa `tenantChecklist.list` em vez de `checklistTemplates.list`

## Checklist — Edição em Lote por Tipo

- [x] Backend: `tenantChecklist.saveForType` — recebe tipo + lista completa de itens e persiste em lote (upsert overrides + delete removidos)
- [x] Frontend: seleciona tipo no Select → carrega lista editável localmente
- [x] Frontend: checkboxes para ativar/desativar itens globais herdados
- [x] Frontend: campo inline para adicionar novo item exclusivo do tipo
- [x] Frontend: botão remover item exclusivo (sem confirmação modal, direto)
- [x] Frontend: botão "Salvar" persiste tudo de uma vez via saveForType
- [x] Frontend: indicador de alterações não salvas (dirty state — barra sticky âmbar)
- [x] Frontend: ao trocar de tipo com alterações pendentes, confirm() antes de descartar

## Cadastro Completo de Cliente (CustomersList)

- [x] Formulário com todos os campos: Nome, Telefone, E-mail, CPF/CNPJ, CEP (com lookup ViaCEP), Logradouro, Número, Bairro, Cidade, Estado, Ponto de Referência
- [x] CEP preenche automaticamente logradouro, bairro, cidade e estado
- [x] Validação inline de CPF/CNPJ com mensagem de erro
- [x] Botão Cadastrar desabilitado enquanto CPF/CNPJ inválido
- [x] Passar todos os campos novos (zipCode, addressNumber, neighborhood, addressReference) para customers.create

## Sistema de Termos de Serviço

- [x] Schema: campo `serviceTerms` (text, nullable) na tabela `tenants`
- [x] Schema: campos `termsAcceptedAt` (bigint, nullable) e `termsAcceptedIp` (varchar 45, nullable) na tabela `service_orders`
- [x] Migration SQL: ALTER TABLE tenants ADD serviceTerms; ALTER TABLE service_orders ADD termsAcceptedAt, termsAcceptedIp
- [x] Backend: `tenants.updateTerms` — salva o texto do termo (adminProcedure)
- [x] Backend: `public.getTenantInfo` e `getTenantByHost` retornam `serviceTerms`
- [x] Backend: `serviceOrders.createColeta` — aceita `termsAccepted: boolean` e registra termsAcceptedAt + IP
- [x] Frontend Settings: seção "Termo de Serviço" com textarea para editar e botão Salvar
- [x] Frontend Coleta: ao clicar em Solicitar Coleta, abre modal com o texto do termo e botão "Li e aceito"
- [x] Frontend Coleta: se o tenant não tiver termo configurado, o modal não aparece
- [x] Frontend Impressão OS: bloco `hidden print:block` com texto do termo e linhas de assinatura (cliente + assistência)

## Checklist na Tela de Detalhes da OS

- [x] Schema: tabela `os_checklist_state` com serviceOrderId, label, isChecked, sortOrder, createdAt
- [x] Migration SQL: CREATE TABLE os_checklist_state
- [x] Backend: `osChecklist.getByOs` — retorna itens do checklist da OS (cria a partir do template do tenant se ainda não existir)
- [x] Backend: `osChecklist.toggleItem` — marca/desmarca um item (protectedProcedure, técnico ou admin)
- [x] Backend: lazy init do checklist com base no template do tenant + deviceType via join com devices
- [x] Frontend: card "Checklist de Entrada" no ServiceOrderDetail.tsx com lista de itens
- [x] Frontend: checkbox interativo por item — ao clicar, salva imediatamente via toggleItem
- [x] Frontend: badge de progresso (ex: "5/8 itens verificados")
- [x] Frontend: itens marcados com risco/cinza para distinguir do pendente
- [x] Frontend: mensagem verde "Todos os itens verificados" quando 100% marcados

## Notificação Automática de Status da OS

- [x] Schema: campo `notifyStatuses` (text/JSON, nullable) na tabela `tenants` — lista de status que disparam notificação
- [x] Schema: tabela `os_notifications` com serviceOrderId, tenantId, status, sentAt, channel, message
- [x] Migration SQL: ALTER TABLE tenants ADD notifyStatuses; CREATE TABLE os_notifications
- [x] Backend: helper `buildStatusMessage(status, os, tenant)` — gera mensagem personalizada por status
- [x] Backend: helper `buildWhatsAppLink(phone, message)` — gera URL wa.me com mensagem pré-preenchida
- [x] Backend: `sendStatusNotification(os, status, tenant)` — verifica se status está na lista, registra em os_notifications e retorna o link WhatsApp
- [x] Backend: `updateStatus` chama `sendStatusNotification` e retorna `{ success, whatsappLink }` quando há notificação
- [x] Frontend: ao mudar status, se `whatsappLink` vier na resposta, abrir modal com botão "Enviar via WhatsApp"
- [x] Frontend: modal mostra a mensagem que será enviada e botão que abre wa.me em nova aba
- [x] Frontend Settings: seção "Notificações ao Cliente" com toggles por status (ex: "Pronto para retirada", "Em diagnóstico")
- [x] Frontend Settings: campo para personalizar mensagem por status (opcional)

## Personalização de Mensagem WhatsApp por Status

- [x] Schema: campo `notifyMessages` (text/JSON, nullable) na tabela `tenants` — mapa de status → mensagem customizada
- [x] Migration SQL: ALTER TABLE tenants ADD notifyMessages
- [x] Backend: `tenants.updateNotifyStatuses` aceita também `notifyMessages` (mapa status→texto)
- [x] Backend: `statusNotification.ts` usa mensagem customizada do tenant quando disponível, fallback para mensagem padrão
- [x] Frontend Settings: ao ativar toggle de um status, exibir textarea com mensagem padrão editável
- [x] Frontend Settings: variáveis disponíveis exibidas como hint ({{nomeCliente}}, {{numeroOS}}, {{status}}, {{nomeTenant}}, {{linkRastreamento}})
- [x] Frontend Settings: salvar mensagens customizadas junto com a lista de status ativos
- [x] Frontend OS: modal de WhatsApp exibe a mensagem final já com variáveis substituídas

## Encerramento de OS com Garantia Variável

- [x] Backend: `updateStatus` aceita `warrantyDays` opcional — ao finalizar, atualiza `service_orders.warrantyDays` antes de gerar a garantia
- [x] Backend: garantia gerada usa o `warrantyDays` recém-atualizado (não o valor padrão da OS)
- [x] Frontend: ao selecionar status "finalizado", abrir modal de encerramento em vez de confirmar direto
- [x] Frontend: modal de encerramento tem campo numérico "Dias de garantia" (pré-preenchido com `os.warrantyDays ?? 90`)
- [x] Frontend: modal de encerramento tem campo de observação final (opcional)
- [x] Frontend: botão "Confirmar Encerramento" no modal dispara `updateStatus` com `status: "finalizado"`, `warrantyDays` e `notes`
- [x] Frontend: após encerramento, invalidar `serviceOrders.getById` e `warranties.getByOs` para exibir a garantia gerada

## Garantia Destacada no Rastreamento Público

- [x] Backend: `public.trackOs` retorna campos completos da garantia: `warrantyCode`, `warrantyDays`, `startsAt`, `expiresAt`, `isActive`, `description`
- [x] Frontend Track.tsx: bloco de garantia visível apenas quando OS está finalizada e garantia existe
- [x] Frontend Track.tsx: bloco exibe badge "Garantia Ativa" (verde) ou "Garantia Expirada" (cinza), prazo em dias, data de validade e código
- [x] Frontend Track.tsx: barra de progresso visual mostrando quanto da garantia já foi consumido
- [x] Frontend Track.tsx: botão "Verificar Garantia" que abre `/verificar-garantia?codigo=GAR-XXXX` com código pré-preenchido

## Bug Fix: insertId NaN ao criar OS/registros

- [x] Bug: `(result as any).insertId` retornava `undefined` (NaN) pois o drizzle/mysql2 retorna `[ResultSetHeader, FieldPacket[]]` — o ID está em `result[0].insertId`
- [x] Correção aplicada em todos os routers: `serviceOrders`, `tenants`, `customers`, `budgets`, `pickups`, `stock`, `payments`
- [x] Padrão corrigido: `Number((result as any)[0]?.insertId ?? (result as any).insertId)` com fallback para retrocompatibilidade

## Ficha de Impressão Profissional (A4 + Térmica)

- [x] Componente PrintSheet.tsx com layout A4: cabeçalho com logo/nome do tenant, número OS, data, status, dados do cliente, dados do aparelho, defeito relatado, checklist de acessórios, orçamento (itens + mão de obra + total), garantia, assinaturas e termos
- [x] Componente PrintSheet.tsx com layout térmico 58mm/80mm: versão compacta sem logo, fonte monospace, separadores ASCII, QR code do link de rastreamento, dados essenciais em blocos
- [x] CSS de impressão no index.css: @page A4 (210mm), @page thermal (58mm e 80mm), ocultar chrome do dashboard, fontes e cores monocromáticas
- [x] Botão dropdown "Imprimir" no ServiceOrderDetail.tsx com opções: "Folha A4" e "Bobina Térmica (58mm)" e "Bobina Térmica (80mm)"
- [x] QR code gerado via biblioteca qrcode.react apontando para o link de rastreamento público

## Comprovante de Garantia Imprimível

- [x] Componente WarrantyVoucher.tsx: layout de comprovante com logo/nome do tenant, número OS, dados do cliente, dados do aparelho, código de garantia, prazo, validade, QR code para verificação, termos de garantia e assinatura
- [x] CSS de impressão para o comprovante: @page A5 landscape, bordas duplas decorativas, visual de "certificado"
- [x] Botão "Imprimir Comprovante" na seção Garantia Digital do ServiceOrderDetail.tsx
- [x] Portal de impressão separado para o comprovante (print-warranty-root) com classe print-mode-warranty no body

## Botão Encerrar OS

- [x] Botão "Encerrar OS" no header da tela de detalhes, visível apenas quando status != "finalizado" e != "cancelado"
- [x] Botão também no card de Informações da OS como ação rápida
- [x] Clicar no botão abre diretamente o modal de encerramento (mesmo modal do select de status "finalizado")

## Modal de Encerramento Melhorado + Termo de Garantia

- [x] Schema: campo `warrantyTerms` (text, nullable) na tabela `tenants`
- [x] Migration SQL: ALTER TABLE tenants ADD warrantyTerms
- [x] Backend: `tenants.updateTerms` aceita `warrantyTerms`; `getMine` retorna o campo
- [x] Settings.tsx: seção "Termo de Garantia" com textarea para o tenant personalizar o texto
- [x] Modal de encerramento: redesign visual com ícone grande, seções bem separadas, preview do termo de garantia ao final
- [x] Modal de encerramento: exibe o `warrantyTerms` do tenant como preview colapsável antes de confirmar

## Comprovante de Garantia — Termo Personalizado

- [x] WarrantyVoucher.tsx: usar `warrantyTerms` do tenant no bloco "TERMOS DE GARANTIA" (fallback para `serviceTerms` se não houver)
- [x] ServiceOrderDetail.tsx: passar `warrantyTerms` do tenant para o componente WarrantyVoucher

## Enviar Garantia por WhatsApp

- [x] Botão "Enviar por WhatsApp" na seção Garantia Digital do ServiceOrderDetail.tsx
- [x] Mensagem pré-formatada com código da garantia, validade e link de verificação
- [x] Abre wa.me com telefone do cliente (se disponível) ou sem número (para o atendente colar)

## Unificação dos Botões de Garantia no Dropdown de Impressão

- [x] Adicionar separador + opções "Comprovante de Garantia" e "Garantia via WhatsApp" no dropdown de impressão do header
- [x] Remover botões Comprovante e WhatsApp do card Garantia Digital (manter apenas o código e validade)

## Dados Completos do Cliente na OS

- [x] Backend: `getById` da OS faz join com `customers` e retorna `customerPhone`, `customerEmail`, `customerAddress`, `customerDocument`
- [x] Frontend: card de Informações da OS exibe telefone, e-mail e endereço do cliente
- [x] PrintSheet.tsx: ficha A4 e térmica exibem dados completos do cliente
- [x] WarrantyVoucher.tsx: comprovante de garantia exibe telefone e endereço do cliente

## Botão WhatsApp no Card do Cliente

- [x] Botão WhatsApp no card do cliente da OS: abre wa.me com o número cadastrado, visível apenas quando customerPhone está preenchido

## Botão WhatsApp na Listagem de Clientes

- [x] Botão WhatsApp na listagem de clientes (CustomersList.tsx): ícone verde ao lado do telefone, abre wa.me em nova aba com tooltip do número
- [x] Botão WhatsApp na página de detalhes do cliente (CustomerDetail.tsx): botão no cabeçalho do card de dados

## Botão WhatsApp no Detalhe do Cliente

- [x] Botão WhatsApp no cabeçalho do card de dados pessoais em CustomerDetail.tsx, com tooltip do número

## Melhoria da Impressão Bobina Térmica

- [x] Bobina: filtrar checklist para exibir apenas itens marcados como presentes (checked=true), omitir os não marcados
- [x] Bobina: melhorar layout geral — cabeçalho mais compacto, separadores mais claros, dados do cliente em bloco dedicado
- [x] Bobina: exibir número de OS em destaque no topo (fonte maior, negrito)
- [x] A4: também filtrar checklist para exibir apenas itens presentes (com checkbox marcado visualmente)

## Checkbox Entregou Chip + Modal de Impressão Pós-Criação

- [x] Schema: campo `deliveredChip` — implementado como validação UI (sem persistência no banco, conforme decisão de escopo)
- [x] Formulário NewServiceOrder.tsx: checkbox "Entregou chip" na seção de detalhes do aparelho
- [x] Formulário: botão "Criar OS" desabilitado quando `deliveredChip` não está marcado
- [x] Pós-criação: modal de impressão automático com opções (Bobina Térmica, A4) e botão "Pular"
- [x] Modal de impressão: navega para OS com ?print=a4|thermal e auto-dispara impressão via useEffect

## Fluxo de Criação de OS — Melhorias

- [x] Checkbox "Entregou chip (SIM card)" no step "os" do ServiceOrderNew.tsx — obrigatório marcar para habilitar o botão "Criar OS"
- [x] Modal de escolha de impressão pós-criação — abre automaticamente após criar OS com opções: Bobina Térmica, Folha A4 e Pular impressão
- [x] Auto-trigger de impressão no ServiceOrderDetail.tsx via query param ?print=a4|thermal (navegação vinda do modal pós-criação)

## Fase 1 — Isolamento Multi-Tenant em /minha-conta (SEGURANÇA CRÍTICA)

- [x] Backend: corrigir `myOrders` — aceitar `tenantId` como parâmetro obrigatório e filtrar OS por tenant + customer do usuário
- [x] Backend: garantir que `myOrders` nunca retorna OS de outro tenant mesmo sem tenantId no host
- [x] Backend: nova procedure `myDevices` — aparelhos do cliente filtrados por tenantId
- [x] Backend: nova procedure `myPickupsCustomer` — coletas do cliente filtradas por tenantId
- [x] Frontend: MinhaContaPortal.tsx — passar tenantId do host para `myOrders`
- [x] Frontend: MinhaContaPortal.tsx — adicionar seção de aparelhos usando `myDevices`
- [x] Frontend: MinhaContaPortal.tsx — adicionar seção de coletas usando `myPickupsCustomer`
- [x] Testes Vitest: `myOrders` com tenantId correto retorna apenas OS daquele tenant
- [x] Testes Vitest: `myOrders` com tenantId errado retorna array vazio (isolamento)
- [x] Testes Vitest: cliente não vê OS de outro cliente do mesmo tenant

## Detalhe da OS no /minha-conta (Portal Público)

- [x] Backend: procedure `myOrderDetail` — retorna OS completa (dados, aparelho, cliente, timeline, garantia) isolada por tenant
- [x] Frontend: sheet/drawer lateral de detalhe da OS no MinhaContaPortal, abre ao clicar em uma OS
- [x] Frontend: exibir timeline completa com ícones e timestamps no drawer
- [x] Frontend: exibir dados do aparelho, defeito relatado, valor do orçamento e status atual
- [x] Frontend: exibir garantia (se existir) com código e validade
- [x] Frontend: botão "Rastrear OS" que leva para /rastrear/:token (página pública existente)
- [x] Testes Vitest: myOrderDetail retorna null para OS de outro tenant (isolamento)
- [x] Testes Vitest: myOrderDetail retorna null para OS de outro cliente do mesmo tenant

## Aprovação/Recusa de Orçamento no Drawer do Portal Público

- [x] Backend: procedure `respondMyBudget` (approve/reject) — verifica que a OS pertence ao cliente e ao tenant
- [x] Backend: recusa com motivo opcional implementada na mesma procedure `respondMyBudget`
- [x] Frontend: banner de ação no OsDetailSheet quando status = aguardando_aprovacao
- [x] Frontend: botões "Aprovar" e "Recusar" com loading state e dialog de confirmação com campo de motivo
- [x] Frontend: invalidar cache de myOrders e myOrderDetail após ação
- [x] Testes Vitest: respondMyBudget retorna erro para OS de outro tenant
- [x] Testes Vitest: respondMyBudget retorna erro para OS de outro cliente

## Notificação ao Tenant — Aprovação/Recusa de Orçamento

- [x] Backend: chamar `notifyOwner` na procedure `respondMyBudget` após aprovação com título e detalhes da OS
- [x] Backend: chamar `notifyOwner` na procedure `respondMyBudget` após recusa com motivo do cliente
- [x] Backend: notificação fire-and-forget com .catch() — não bloqueia resposta ao cliente se falhar
- [x] Testes Vitest: 236 testes passando, TypeScript sem erros

## Notificação na Rota Pública de Resposta ao Orçamento (sem login)

- [x] Backend: adicionar `notifyOwner` fire-and-forget na procedure `budgets.respond` (token público) após aprovação
- [x] Backend: adicionar `notifyOwner` fire-and-forget na procedure `budgets.respond` (token público) após recusa com motivo

## Notificações Automáticas — Mudanças de Status Críticas

- [x] Mapear todos os pontos de mudança de status no backend (updateStatus, pickups, etc.)
- [x] Criar helper `notifyTenantStatusChange` centralizado em `statusNotification.ts`
- [x] Notificar ao marcar OS como "pronto" (pronto para retirada)
- [x] Notificar ao marcar OS como "saiu_para_entrega" (saiu para entrega)
- [x] Notificar ao marcar OS como "em_reparo" (reparo iniciado)
- [x] Notificar ao marcar OS como "cancelado" (OS cancelada)
- [x] Notificar ao marcar OS como "entregue" (OS entregue ao cliente)
- [x] Testes Vitest: 12 testes cobrindo todos os statuses críticos e casos de não-disparo (248 total passando)

## Histórico de Notificações no Painel do Tenant

- [x] Auditar tabela `osNotifications` no schema — verificar campos disponíveis
- [x] Estender tabela `osNotifications` com campos `eventType` e `actorName`
- [x] Migration SQL aplicada (ALTER TABLE os_notifications)
- [x] Backend: registrar eventos de aprovação/recusa de orçamento na tabela `osNotifications` (portal + link público)
- [x] Backend: `notifyTenantStatusChange` persiste eventos de status_change no banco
- [x] Backend: procedure `notifications.list` — lista paginada por tenant com filtros (eventType, search, since)
- [x] Backend: procedure `notifications.recentCount` — contagem das últimas 24h para badge
- [x] Frontend: nova página `/painel/notificacoes` com TenantLayout, tabela paginada, filtros e links para OS
- [x] Frontend: item "Notificações" adicionado ao sidebar do TenantLayout (roles: tenant_admin, admin, super_admin)
- [x] Testes Vitest: 255 passando — notifications.list e recentCount cobertos

## Fase 2 — Vinculação Automática de Cliente ao Usuário

- [x] Auditar schema: campo `userOpenId` já existia na tabela `customers`
- [x] Backend: `createBalcao` — após criar OS, verifica se customer não tem `userOpenId` e se e-mail bate com user cadastrado; vincula automaticamente (best-effort, não bloqueia criação)
- [x] Backend: `customers.linkUser` já existia e foi mantida para vinculação manual pelo atendente
- [x] Backend: `myOrders` — vinculação lazy: ao encontrar customers por e-mail sem `userOpenId`, atualiza o campo para futuras consultas por openId (best-effort)
- [x] Backend: retorna `lazyLinkedCount` no resultado de `myOrders` para o frontend exibir toast
- [x] Frontend: MinhaContaPortal — exibe toast "Histórico vinculado com sucesso!" quando `lazyLinkedCount > 0`
- [x] Testes Vitest: `resolveAutoLink` — vincula quando e-mail bate, não sobrescreve se já vinculado, case-insensitive
- [x] Testes Vitest: `resolveLazyLink` — retorna apenas customers sem `userOpenId`, ignora sem e-mail
- [x] Testes Vitest: isolamento de tenant — vinculação não vaza dados entre tenants
- [x] 269 testes passando, TypeScript sem erros

## Fase 3 — Login Local por CPF/Senha para Clientes

### Schema
- [x] Campos `passwordHash`, `passwordMustChange`, `localLoginEnabled`, `lastLoginAt` adicionados na tabela `customers`
- [x] Migration SQL aplicada (ALTER TABLE customers)

### Backend
- [x] Router `customerAuth` criado com procedures: `loginLocal`, `logoutLocal`, `meLocal`, `changePassword`, `generateProvisionalPassword`, `resendProvisionalPassword`
- [x] `loginLocal` — valida CPF/email + senha bcrypt, emite cookie `customer_session` com JWT `{ sub: customerId, tenantId, type: "customer_local" }`
- [x] `changePassword` — troca senha obrigatória, limpa `passwordMustChange` após troca
- [x] `generateProvisionalPassword` — gera senha aleatória, hash bcrypt, seta `passwordMustChange: true`, `localLoginEnabled: true`
- [x] `resendProvisionalPassword` — regenera senha provisória, invalida a anterior
- [x] JWT de cliente local com payload distinto: `{ sub: customerId, tenantId, type: "customer_local" }`
- [x] bcryptjs instalado e integrado

### Frontend
- [x] Página `/entrar` — formulário de login local (CPF ou e-mail + senha) com branding do tenant
- [x] Página `/trocar-senha` — troca obrigatória de senha, redireciona para `/minha-conta` após sucesso
- [x] Botão "Entrar" no PublicPortal navega para `/entrar`
- [x] Mensagem de erro amigável para credenciais inválidas

### Painel do Tenant
- [x] Seção "Acesso ao Portal" no CustomerDetail com botão "Gerar senha" (novo) ou "Reenviar senha" (já tem acesso)
- [x] Dialog de exibição da senha provisória com botões "Copiar" e "Enviar por WhatsApp"
- [x] Badge "Acesso local ativo" no card do cliente quando `localLoginEnabled = true`

### Testes Vitest
- [x] 12 testes cobrindo: loginLocal, changePassword, generateProvisionalPassword, isolamento de tenant
- [x] 281 testes passando no total, TypeScript sem erros

## Esqueci Minha Senha — Portal do Cliente

- [x] Backend: procedure pública `customerAuth.requestPasswordReset` — recebe CPF/email + tenantId, busca customer com `localLoginEnabled`, gera nova senha provisória, faz hash bcrypt, seta `passwordMustChange: true`, retorna link WhatsApp pré-preenchido
- [x] Backend: resposta sempre genérica — não revela se CPF existe (mesma resposta para não encontrado e sem acesso local)
- [x] Backend: isolamento de tenant — busca customer apenas dentro do tenant do host
- [x] Frontend: página `/esqueci-senha` com campo CPF/email, branding do tenant e mensagem de sucesso genérica
- [x] Frontend: link "Esqueci minha senha" ao lado do campo de senha na página `/entrar`
- [x] Frontend: após submit, exibe mensagem de sucesso com botão de abrir WhatsApp (quando whatsappUrl disponível)
- [x] Testes Vitest: 6 testes cobrindo geração de senha, whatsappUrl, isolamento e resposta genérica (288 total passando)

## Item 1 — Fix: CustomerLogin OAuth returnPath com ?tenant=slug

- [x] CustomerLogin.tsx: botão OAuth passa `/login?tenant=slug` como returnPath (em vez de `/login` sem tenant)
- [x] Após OAuth, o usuário retorna para /login?tenant=slug e o TenantHostContext resolve o tenant corretamente

## Item 2 — claimToken: Auto-vinculação do dono ao tenant após cadastro

### Schema
- [x] Campos `claimToken` (varchar 64) e `claimExpiresAt` (timestamp) adicionados à tabela `tenants`
- [x] Migration SQL aplicada (ALTER TABLE tenants ADD claimToken, ADD claimExpiresAt)

### Backend
- [x] `tenants.register`: gera `claimToken` (crypto.randomBytes(32).hex) + `claimExpiresAt` (now+72h), salva no tenant, retorna `claimToken` na resposta
- [x] `tenants.claimTenant` (protectedProcedure): aceita claimToken, valida expiração, vincula user.tenantId + role=tenant_admin, limpa claimToken do tenant

### Frontend
- [x] Cadastro.tsx: guarda `claimToken` no estado `result`; tela de sucesso exibe botão "Ativar minha conta" com link de ativação (`/login?tenant=slug&claim=TOKEN` em preview, `/login?claim=TOKEN` em produção)
- [x] CustomerLogin.tsx: detecta `?claim=TOKEN` na URL; quando usuário está autenticado, chama `claimTenant` automaticamente e redireciona para /painel/dashboard
- [x] CustomerLogin.tsx: botão OAuth preserva `?claim=TOKEN` no returnPath para que o claim funcione após OAuth
- [x] Tela de loading "Ativando sua conta..." exibida durante o processo de claim

### Testes
- [x] 17 novos testes Vitest cobrindo: geração de claimToken, validação de expiração, lógica de vinculação, conflito de tenant, idempotência, geração de activationUrl em preview e produção
- [x] 315 testes passando no total, TypeScript sem erros

## Melhoria: Formulário de Coleta — Endereço Completo com CEP

- [x] Substituir campo único pickupAddress por campos separados: CEP, rua, número, complemento, bairro, cidade, estado, ponto de referência
- [x] Busca automática de endereço via ViaCEP ao digitar CEP (8 dígitos)
- [x] Máscara de CEP (00000-000) no campo de entrada
- [x] Montar pickupAddress formatado para salvar no banco (concatenação dos campos)
- [x] Atualizar validação no handleSubmit para exigir CEP, rua e número

## Melhoria: Validação de Área de Cobertura por CEP

- [x] Adicionar campo `coverageZipPrefixes` (JSON text) na tabela `tenants` via migration
- [x] Expor `coverageZipPrefixes` no retorno de `getTenantByHost` e `getTenantInfo`
- [x] Criar procedure `tenants.updateCoverage` para salvar prefixos de CEP
- [x] Validar CEP no `Coleta.tsx`: alertar quando o CEP está fora da cobertura configurada
- [x] Bloquear envio do formulário de coleta quando há erro de cobertura
- [x] Adicionar seção "Área de Cobertura por CEP" no `Settings.tsx` do painel do tenant

## Melhoria: Estimativa de Tempo de Coleta por CEP

- [x] Adicionar campo `coverageDeadlines` (JSON text) na tabela `tenants` — mapa de prefixo → prazo em horas
- [x] Migration SQL aplicada
- [x] Procedure `tenants.updateCoverageDeadlines` para salvar prazos por prefixo
- [x] Expor `coverageDeadlines` no retorno de `getTenantByHost` e `getTenantInfo`
- [x] Settings.tsx: campo de prazo (horas) ao lado de cada prefixo de CEP configurado
- [x] Coleta.tsx: após busca do CEP, calcular e exibir estimativa de coleta com base no prefixo
- [x] Coleta.tsx: mostrar badge/card com "Coleta estimada em até Xh" ou "Coleta no mesmo dia"
- [x] Coleta.tsx: prazo padrão configurável (fallback quando prefixo não tem prazo específico)

## Refactor: Login Unificado por Role/Tenant

- [x] Remover rota duplicada `/login` que aponta para Login.tsx (super admin) no App.tsx
- [x] Adicionar rota `/superadmin/login` apontando para Login.tsx
- [x] CustomerLogin: exibir formulário mesmo sem tenant detectado (fallback genérico)
- [x] CustomerLogin: após login bem-sucedido, redirecionar por role (customer → /minha-conta, staff → /painel, super_admin → /superadmin)
- [x] Atualizar SmartRedirectAfterLogin para lidar com super_admin vindo de /superadmin/login
- [x] Atualizar todos os redirecionamentos para /login que eram do super admin para /superadmin/login
- [x] Atualizar TenantGuard e SuperAdminGuard para redirecionar para as rotas corretas

## Feature: Cadastro de Clientes no Portal do Tenant (/register)

- [x] Procedure `customerAuth.registerLocal` — cria customer vinculado ao tenant com nome, CPF, e-mail, telefone e senha
- [x] Validação de CPF único por tenant no backend
- [x] Validação de e-mail único por tenant no backend
- [x] Hash de senha com bcrypt antes de salvar
- [x] Página `Register.tsx` com formulário: nome completo, CPF, e-mail, telefone, senha, confirmar senha
- [x] Branding do tenant no header da página de cadastro (cor primária + logo)
- [x] Máscara de CPF (000.000.000-00) e telefone ((00) 00000-0000) no formulário
- [x] Após cadastro bem-sucedido: login automático e redirect para /minha-conta
- [x] Rota `/register` registrada no App.tsx
- [x] Link "Criar conta" na tela de login (/login) apontando para /register
- [x] Link "Já tenho conta" na tela de cadastro apontando para /login

## Melhoria: Validação Matemática de CPF

- [x] Função `isValidCpf(cpf)` com algoritmo de dígitos verificadores (shared/utils)
- [x] Validação client-side no Register.tsx com feedback inline
- [x] Validação server-side no customerAuth.registerLocal via Zod refine
- [x] Validação server-side no loginLocal (normalização já existente)

## Feature: Perfil do Cliente Logado

- [x] Procedure `customerAuth.getMyProfile` — retorna dados do customer autenticado
- [x] Procedure `customerAuth.updateMyProfile` — atualiza nome, telefone, e-mail, CPF e endereço
- [x] Coleta.tsx: pré-preencher nome, telefone e endereço com dados do perfil quando logado
- [x] Coleta.tsx: campos pré-preenchidos ficam editáveis (cliente pode ajustar para a coleta)
- [x] MinhaContaPortal.tsx: adicionar aba/seção "Meu Perfil" com formulário editável
- [x] MinhaContaPortal.tsx: exibir CTA "Solicitar coleta" quando não há OS abertas

## Refactor: Componente PasswordInput Reutilizável

- [x] Criar `client/src/components/ui/password-input.tsx` com: botão mostrar/ocultar, indicador de força (4 níveis), checklist de requisitos, validação de match
- [x] Exportar `PASSWORD_RULES` e `validatePassword()` de `shared/passwordRules.ts`
- [x] Aplicar PasswordInput no `Register.tsx` (substituir implementação local)
- [x] Aplicar PasswordInput no `CustomerLogin.tsx` (botão mostrar/ocultar)
- [x] Aplicar PasswordInput no `ChangePassword.tsx` (simplificar código local)

## Feature: Mapa Interativo na Landing Page do Tenant

- [x] Componente MapView (Map.tsx) integrado na landing page do portal público
- [x] Geocodificação automática do endereço do tenant via Google Maps Geocoder API
- [x] Marcador AdvancedMarkerElement com o nome da assistência no mapa
- [x] Seção "Onde nos encontrar" visível apenas quando tenant tem endereço ou cidade configurados
- [x] Campo `address` adicionado à interface TenantHostInfo (TenantHostContext.tsx)
- [x] Campo `address` exposto no retorno de `getTenantByHost` e `getTenantInfo` (public.ts)
- [x] Rodapé da seção de mapa exibe endereço formatado (rua, cidade/UF)

## Seed: Especialidades e Endereço — Rocha Celulares

- [x] deviceSpecialties populado no banco para o tenant Rocha Celulares (slug: rocha, id: 60001)
  - Smartphone: iPhone, Samsung, Motorola, Xiaomi, LG, Realme, POCO, OnePlus
  - Notebook: Dell, Lenovo, HP, Asus, Acer, Apple MacBook, Samsung, Positivo
  - Tablet: iPad, Samsung Galaxy Tab, Lenovo Tab, Amazon Fire
  - Smartwatch: Apple Watch, Samsung Galaxy Watch, Xiaomi Mi Band, Garmin
  - Fone de Ouvido: AirPods, Galaxy Buds, JBL, Sony, Bose
- [x] Campo address populado: "Rua das Flores, 123 - Centro, São Paulo - SP" (para geocodificação do mapa)

## Feature: Editor de Especialidades no Painel de Configurações

- [x] Redesenhar seção "Tipos de Aparelhos Atendidos" no Settings.tsx com UX aprimorada
- [x] Chips de marcas selecionadas visíveis inline por categoria (pré-visualização em tempo real)
- [x] Busca/filtro de marcas dentro de cada categoria expandida
- [x] Suporte a marcas personalizadas (input livre para adicionar marca não listada)
- [x] Botão para adicionar categoria personalizada (além das pré-definidas em DEVICE_TYPES)
- [x] Botão para remover categoria personalizada adicionada pelo tenant
- [x] Invalidar cache público (getTenantByHost/getTenantInfo) ao salvar especialidades
- [x] Testes Vitest: updateSpecialties salva corretamente; getSpecialties retorna dados do tenant

## Feature: Filtro de Tipos e Marcas por Especialidades nos Formulários de OS

- [x] Adicionar deviceSpecialties à interface TenantHostInfo no TenantHostContext.tsx
- [x] Criar hook useDeviceSpecialties para centralizar lógica de filtro de tipos/marcas
- [x] Integrar filtro no formulário público de Coleta (Coleta.tsx): Select de tipo + campo de marca filtrado
- [x] Integrar filtro no formulário de cadastro de aparelho em CustomerDetail.tsx
- [x] Testes Vitest: hook useDeviceSpecialties retorna tipos/marcas corretos com e sem especialidades

## Feature: Redesign Hero do Portal Público do Tenant

- [x] Hero com fundo dinâmico: gradiente angular + padrão de pontos SVG inline + formas geométricas flutuantes
- [x] Layout assimétrico: coluna de texto à esquerda + painel de ações flutuante à direita (desktop) / empilhado (mobile)
- [x] Elemento visual de destaque: ícone grande animado (Wrench/Zap) com halo pulsante na cor primária do tenant
- [x] Badge de status "Aberto agora / Fechado" integrado ao hero (não só na seção de horários)
- [x] Animação de entrada escalonada (fade-in + slide-up) para badge → título → subtítulo → CTAs
- [x] CTAs diretos no hero: "Solicitar Coleta" (primário) + "Rastrear OS" (secundário)
- [x] Manter responsividade mobile-first (max-w-xl) e acessibilidade (prefers-reduced-motion)

## Feature: Preview ao vivo do hero no painel

- [x] Substituir preview simples (apenas header) por preview fiel ao hero real do portal público
- [x] Preview mostra: header com logo/iniciais + cor primária, hero com gradiente + padrão de pontos SVG, badges "Aberto agora" e "Assistência Técnica", logo/nome do tenant, subtítulo, CTAs "Solicitar Coleta" (cor secundária) + "Rastrear OS" (glass), ícone Wrench com halo na cor secundária, onda SVG de transição, card CTA de conta com cor secundária
- [x] Preview atualiza em tempo real ao alterar cor primária, cor secundária ou nome do tenant
- [x] Corrigir acesso a secondaryColor no PublicPortal.tsx (remover cast `as any`)

## Auditoria: Fluxo de Coleta

- [x] ServiceOrderDetail.tsx: exibir endereço de coleta (pickupAddress) e horário preferido (preferredPickupTime) quando origin=coleta
- [x] Dashboard.tsx: adicionar card/alerta de coletas pendentes (aguardando_coleta) com contagem e link direto para a lista filtrada
- [x] metrics procedure: adicionar contagem de coletas pendentes (aguardando_coleta + coleta_agendada)

## Feature: Botão "Agendar Coleta" e Sidebar com Badge

- [x] ServiceOrderDetail.tsx: botão "Agendar Coleta" visível quando status=aguardando_coleta
- [x] ServiceOrderDetail.tsx: modal com seletor de data, turno e campo de observação
- [x] ServiceOrderDetail.tsx: ao confirmar, atualiza status para coleta_agendada via updateStatus
- [x] TenantLayout.tsx: item "Coletas" na sidebar com badge numérico de coletas pendentes
- [x] TenantLayout.tsx: badge usa metrics.pendingPickup da procedure serviceOrders.metrics
- [x] TenantLayout.tsx: link aponta para /painel/os?status=aguardando_coleta

## Feature: Confirmar Retirada e Aba Coletas

- [x] ServiceOrderDetail.tsx: botão "Confirmar Retirada" visível quando status=coleta_agendada
- [x] ServiceOrderDetail.tsx: ao clicar, atualiza status para em_reparo com nota automática na timeline
- [x] ServiceOrdersList.tsx: aba "Coletas" que filtra aguardando_coleta + coleta_agendada simultaneamente
- [x] ServiceOrdersList.tsx: aba "Coletas" exibe badge com contagem total dos dois status

## Feature: Confirmar Entrega e Filtro de Período

- [x] ServiceOrderDetail.tsx: botão "Confirmar Entrega" visível quando status=aguardando_entrega ou saiu_para_entrega
- [x] ServiceOrderDetail.tsx: ao clicar, atualiza status para entregue com nota automática na timeline
- [x] ServiceOrdersList.tsx: seletor de período (Hoje, Esta semana, Este mês, Personalizado) na toolbar
- [x] ServiceOrdersList.tsx: período Personalizado exibe dois inputs de data (de/até)
- [x] Backend: procedure list aceita dateFrom/dateTo para filtrar por createdAt

## Feature: Relatório de Produtividade no Dashboard

- [x] Backend: procedure productivity retorna contagem de OS por status nos últimos 30 dias
- [x] Backend: procedure productivity retorna série temporal (OS criadas por dia nos últimos 30 dias)
- [x] Dashboard.tsx: gráfico de barras horizontais com OS por status (usando recharts BarChart)
- [x] Dashboard.tsx: gráfico de área com OS criadas por dia nos últimos 30 dias
- [x] Dashboard.tsx: gráficos ocultados quando não há dados no período (estado vazio elegante)

## Bug Fix — CustomerGuard e MinhaContaPortal com Login Local

- [x] CustomerGuard no App.tsx: verificar sessão local do cliente via `trpc.customerAuth.meLocal` além do OAuth
- [x] MinhaContaPortal.tsx: suportar ambos os sistemas de auth (OAuth e customer_session cookie)
- [x] MinhaContaPortal.tsx: exibir nome/email do cliente local (via meLocal) quando não há sessão OAuth
- [x] MinhaContaPortal.tsx: logout unificado (logoutLocal para clientes locais, oauthLogout para OAuth)
- [x] MinhaContaPortal.tsx: queries de OS/aparelhos/coletas habilitadas para ambos os tipos de sessão
- [x] Testado no browser: login com cliente@rocha.com / Rocha@2025 → redireciona para /minha-conta ✓

## Exportação de OS — CSV e PDF

- [x] Backend: procedure `serviceOrders.exportList` — retorna todas as OS do tenant sem paginação, com filtros de status e busca
- [x] Backend: endpoint REST `GET /api/export/os.csv` — gera e retorna arquivo CSV com cabeçalho, dados das OS e BOM UTF-8
- [x] Backend: endpoint REST `GET /api/export/os.pdf` — gera PDF bem estruturado com cabeçalho da assistência, tabela de OS, totais e rodapé
- [x] Backend: PDF com logo/nome do tenant, data de geração, tabela com colunas (Nº OS, Cliente, Aparelho, Status, Data Abertura, Valor), linha de total e rodapé
- [x] Frontend: botão "Exportar CSV" na ServiceOrdersList.tsx com ícone Download
- [x] Frontend: botão "Exportar PDF" na ServiceOrdersList.tsx com ícone FileText
- [x] Frontend: passar filtros ativos (status, busca) para os endpoints de exportação
- [x] Frontend: feedback visual durante download (loading state nos botões)
- [x] Testes Vitest: exportList retorna todas as OS do tenant sem paginação
- [x] Testes Vitest: exportList filtra por status corretamente
- [x] Testes Vitest: exportList respeita isolamento de tenant

## Exportação de Clientes — CSV e PDF

- [x] Backend: função `getCustomersForExport` em db.ts (sem paginação, com filtros de busca)
- [x] Backend: endpoints REST `GET /api/export/clientes.csv` e `GET /api/export/clientes.pdf`
- [x] PDF de clientes: cabeçalho com nome da assistência, tabela com Nome, Telefone, CPF/CNPJ, Cidade, Total de OS, Data Cadastro
- [x] Frontend: botão "Exportar" com dropdown CSV/PDF na CustomersList.tsx
- [x] Frontend: filtros ativos passados para os endpoints de exportação

## Relatório Financeiro Mensal

- [x] Backend: procedure `serviceOrders.financialReport` — receita por mês (últimos 12 meses), top 5 defeitos, totais por status de pagamento
- [x] Frontend: página `/painel/relatorios` com gráfico de barras (receita mensal) e gráfico de pizza (top defeitos)
- [x] Frontend: rota registrada no App.tsx e link no menu lateral
- [x] Frontend: botão "Exportar PDF" na página de relatórios
- [x] Backend: endpoint `GET /api/export/relatorio-financeiro.pdf` com gráfico textual e tabelas

## Modal de Período na Exportação de OS

- [x] Frontend: substituir o download direto por um modal com seleção de período (hoje, esta semana, este mês, personalizado) antes de gerar CSV/PDF
- [x] Frontend: modal exibe filtros ativos atuais e permite sobrescrever apenas o período
- [x] Frontend: botões "Cancelar" e "Gerar [CSV/PDF]" no modal

## Notificações de Nova OS, Filtro de Relatórios e CSV Financeiro

### E-mail de Notificações Configurável no Tenant
- [x] Schema: adicionar campo `notificationEmail` na tabela tenants
- [x] Migration SQL aplicada via webdev_execute_sql
- [x] Backend: procedure `tenants.updateNotificationEmail` (protectedProcedure, role admin)
- [x] Frontend: seção "Notificações" na página Settings.tsx com campo de e-mail e botão salvar

### Notificação ao Tenant ao Criar OS via Portal Público
- [x] Backend: ao criar OS via `serviceOrders.createColeta` (coleta pública), enviar notificação ao tenant_admin
- [x] Backend: ao criar OS via `serviceOrders.createBalcao` (quando origin=portal), enviar notificação (não aplicável — balcão é criado pelo próprio tenant)
- [x] Notificação inclui: número da OS, nome do cliente, defeito relatado, data/hora
- [x] Usar `notifyOwner` para notificação interna + envio de e-mail para `notificationEmail` se configurado
- [x] Backend: helper `sendTenantEmail` em server/email.ts (via Resend, fallback silencioso)

### Filtro de Período na Página de Relatórios
- [x] Frontend: seletor de período em FinancialReports.tsx (últimos 3, 6, 12 meses ou personalizado)
- [x] Frontend: inputs de data para período personalizado
- [x] Backend: procedure `serviceOrders.financialReport` aceita parâmetros `months`, `startDate`, `endDate`
- [x] Frontend: gráficos e KPIs atualizam ao mudar o período

### Exportação do Relatório Financeiro em CSV
- [x] Backend: endpoint `GET /api/export/relatorio-financeiro.csv` com 4 seções (receita mensal, métodos, top defeitos, status)
- [x] Frontend: dropdown "Exportar" com opções CSV e PDF na página de relatórios
