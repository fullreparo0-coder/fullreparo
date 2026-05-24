# Relatório do Sistema FullReparo
**Data:** 19 de maio de 2026 | **Status:** Em desenvolvimento ativo | **Testes:** 298 passando (14 arquivos)

---

## Visão Geral

O **FullReparo** é uma plataforma SaaS multi-tenant para assistências técnicas. Cada assistência opera em seu próprio subdomínio (`rochacell.fullreparo.com.br`), com isolamento completo de dados, branding próprio e portal público para clientes.

---

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Tailwind 4 + shadcn/ui |
| Backend | Express 4 + tRPC 11 |
| Banco de dados | MySQL/TiDB via Drizzle ORM |
| Autenticação | Manus OAuth (staff/dono) + Login local por CPF/senha (clientes) |
| Resolução de tenant | Por subdomínio (`slug.fullreparo.com.br`) com fallback `?tenant=slug` para dev/preview |

---

## Banco de Dados — 20 Tabelas

| Tabela | Descrição |
|---|---|
| `plans` | Planos de assinatura da plataforma (Basic, Pro, Enterprise) |
| `tenants` | Assistências técnicas cadastradas (multi-tenant) |
| `users` | Staff das assistências (admin, atendente, técnico, entregador) + super_admin |
| `customers` | Clientes das assistências com login local por CPF/senha |
| `devices` | Aparelhos vinculados a clientes |
| `serviceOrders` | Ordens de serviço (OS) — núcleo do sistema |
| `osStatusHistory` | Histórico de mudanças de status das OS (timeline) |
| `osChecklist` | Itens de checklist vinculados a cada OS |
| `photos` | Fotos de entrada/saída vinculadas às OS |
| `budgets` | Orçamentos vinculados às OS |
| `budgetItems` | Itens de cada orçamento |
| `pickups` | Solicitações de coleta (leva e traz) |
| `warranties` | Garantias digitais emitidas após conclusão da OS |
| `stockItems` | Estoque de peças e insumos por tenant |
| `payments` | Pagamentos registrados nas OS |
| `checklistTemplates` | Templates de checklist por categoria de aparelho |
| `tenantChecklistOverrides` | Personalizações de checklist por tenant |
| `osNotifications` | Notificações de eventos das OS |
| `osChecklistState` | Estado atual de cada item de checklist por OS |

---

## Módulos Construídos

### Plataforma FullReparo (Landing + Superadmin)

| Módulo | Status | Descrição |
|---|---|---|
| Landing page | **Pronto** | Hero, funcionalidades, planos, CTA, header com Login/Cadastrar |
| Login do dono | **Pronto** | OAuth Manus → redireciona para `/superadmin` |
| Painel superadmin | **Pronto** | Dashboard com métricas, lista de tenants, planos, checklist |
| Gestão de tenants | **Pronto** | Listar, criar, editar, suspender assistências |
| Gestão de planos | **Pronto** | CRUD de planos de assinatura |
| Proteção `/superadmin` | **Pronto** | Guard bloqueia acesso sem role `super_admin` |

---

### Portal Público do Tenant (`slug.fullreparo.com.br`)

| Módulo | Status | Descrição |
|---|---|---|
| Portal público | **Pronto** | Cards de ação: Solicitar Coleta, Rastrear OS, Verificar Garantia, Entrar |
| Branding por tenant | **Pronto** | Logo, cor primária, nome da assistência no header |
| Resolução por subdomínio | **Pronto** | `tenantResolver.ts` extrai slug do host automaticamente |
| Fallback `?tenant=slug` | **Pronto** | Para desenvolvimento e preview do Manus |
| Cadastro de assistência | **Pronto** | Formulário público de onboarding de novos tenants |

---

### Área do Cliente (`/minha-conta`)

| Módulo | Status | Descrição |
|---|---|---|
| Login por CPF/senha | **Pronto** | Login local com hash bcrypt, sem dependência de OAuth |
| Login via Manus OAuth | **Pronto** | Botão "Entrar com Google / e-mail" no CustomerLogin |
| Redirecionamento por role | **Pronto** | Cliente → `/minha-conta`, staff → `/painel`, super_admin → `/superadmin` |
| Proteção `/minha-conta` | **Pronto** | `CustomerGuard` bloqueia staff e não autenticados |
| Área do cliente | **Pronto** | Abas: Minhas OS, Meus Aparelhos, Minhas Coletas |
| Rastreamento de OS | **Pronto** | Página pública com token único, timeline de status |
| Solicitação de coleta | **Pronto** | Formulário multi-step com seletor de data e turno |
| Verificação de garantia | **Pronto** | Consulta por número de OS ou token |
| Esqueci minha senha | **Pronto** | Fluxo de recuperação de senha |
| Troca de senha obrigatória | **Pronto** | Redireciona para `/trocar-senha` no primeiro acesso |

---

### Painel Administrativo do Tenant (`/painel`)

| Módulo | Status | Descrição |
|---|---|---|
| Dashboard | **Pronto** | Métricas: OS abertas, em andamento, concluídas, faturamento |
| Proteção `/painel` | **Pronto** | `TenantGuard` bloqueia acesso sem role de staff |
| Lista de OS | **Pronto** | Tabela com filtros por status, busca, paginação |
| Detalhe da OS | **Pronto** | Timeline, checklist, fotos, orçamento, pagamentos, garantia |
| Nova OS | **Pronto** | Formulário de abertura de OS no balcão |
| Clientes | **Pronto** | Lista e detalhe de clientes com histórico de OS |
| Usuários | **Pronto** | Gestão de staff (criar, editar, definir role) |
| Estoque | **Pronto** | Controle de peças e insumos com alertas de estoque baixo |
| Configurações | **Pronto** | Branding, horários, WhatsApp, dados da assistência |
| Checklist | **Pronto** | Templates de checklist por categoria de aparelho |
| Notificações | **Pronto** | Central de notificações de eventos das OS |
| Painel do entregador | **Pronto** | Dashboard exclusivo para role `entregador` |

---

### Segurança e Controle de Acesso

| Proteção | Status | Comportamento |
|---|---|---|
| `SuperAdminGuard` | **Pronto** | Bloqueia `/superadmin` para não-owners |
| `TenantGuard` | **Pronto** | Bloqueia `/painel` para não-staff |
| `DelivererGuard` | **Pronto** | Restringe `/painel/entregador` ao role `entregador` |
| `CustomerGuard` | **Pronto** | Bloqueia `/minha-conta` para staff e não autenticados |
| `adminProcedure` | **Pronto** | Procedures backend bloqueadas para não-admin |
| Isolamento de tenant | **Pronto** | Cada query filtra por `tenantId` do usuário autenticado |

---

## Rotas do Sistema

### Plataforma (`fullreparo.com.br`)
- `/` — Landing page
- `/login` — OAuth do dono da plataforma
- `/cadastro` — Cadastro de nova assistência
- `/superadmin` — Painel do dono (protegido)
- `/superadmin/tenants` — Gestão de assistências
- `/superadmin/planos` — Gestão de planos
- `/superadmin/checklist` — Templates globais

### Tenant (`slug.fullreparo.com.br`)
- `/` — Portal público da assistência
- `/login` — Login do cliente (CPF/senha ou OAuth)
- `/coleta` — Solicitar coleta
- `/rastrear/:token` — Rastrear OS
- `/garantia` — Verificar garantia
- `/minha-conta` — Área do cliente (protegida)
- `/painel/dashboard` — Dashboard do tenant (protegido)
- `/painel/os` — Lista de OS
- `/painel/os/:id` — Detalhe da OS
- `/painel/os/nova` — Nova OS
- `/painel/clientes` — Lista de clientes
- `/painel/clientes/:id` — Detalhe do cliente
- `/painel/usuarios` — Gestão de usuários
- `/painel/estoque` — Estoque
- `/painel/configuracoes` — Configurações
- `/painel/checklist` — Checklist
- `/painel/entregador` — Dashboard do entregador

---

## O Que Ainda Falta Implementar

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Notificação em tempo real | Alta | Badge de nova OS no painel sem recarregar |
| Confirmação por e-mail | Alta | E-mail automático ao cliente após criar coleta |
| Redirecionamento `/coleta/:slug` → subdomínio | Média | SEO e canonicalização |
| Domínio personalizado por tenant | Média | `rochacell.com.br` apontando para o sistema |
| Integração de pagamento (Stripe/Pix) | Alta | Cobrança de assinatura dos tenants |
| App mobile (PWA) | Baixa | Instalável por tenant |
| Relatórios e exportação | Média | PDF de OS, relatório mensal de faturamento |
| Agendamento de coleta no calendário | Média | Visão do técnico com agenda de coletas |

---

## Dados de Teste Disponíveis

| Perfil | Acesso | Credenciais |
|---|---|---|
| Dono da plataforma | `fullreparo.com.br` → Login | Conta Manus (Luiz Rocha) |
| Cliente fictício | `/?tenant=techfix` → Entrar | CPF: `123.456.789-00` / Senha: `Teste@123` |
| Tenant de teste | `?tenant=techfix` | TechFix Assistência Técnica (slug: `techfix`) |
