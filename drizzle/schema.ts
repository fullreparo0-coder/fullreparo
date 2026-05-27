import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

// ─── PLANS ────────────────────────────────────────────────────────────────────
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  maxUsers: int("maxUsers").notNull().default(3),
  maxOsPerMonth: int("maxOsPerMonth").notNull().default(50),
  hasPickupDelivery: boolean("hasPickupDelivery").notNull().default(false),
  hasOnlineBudget: boolean("hasOnlineBudget").notNull().default(false),
  hasWhatsapp: boolean("hasWhatsapp").notNull().default(false),
  hasClientPortal: boolean("hasClientPortal").notNull().default(false),
  hasStock: boolean("hasStock").notNull().default(false),
  hasFinancial: boolean("hasFinancial").notNull().default(false),
  hasReports: boolean("hasReports").notNull().default(false),
  hasAdvancedCustomization: boolean("hasAdvancedCustomization").notNull().default(false),
  isPublic: boolean("isPublic").notNull().default(true),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── TENANTS ──────────────────────────────────────────────────────────────────
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  document: varchar("document", { length: 20 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#1e3a5f"),
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#d4a017"),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  customDomain: varchar("customDomain", { length: 200 }),
  serviceTerms: text("serviceTerms"),
  warrantyTerms: text("warrantyTerms"), // Termos de garantia personalizados pelo tenant
  notifyStatuses: text("notifyStatuses"), // JSON: string[] — lista de status que disparam notificação ao cliente
  notifyMessages: text("notifyMessages"), // JSON: Record<string, string> — mensagens customizadas por status
  deviceSpecialties: text("deviceSpecialties"), // JSON: { [tipo: string]: string[] }
  businessHours: varchar("businessHours", { length: 100 }),
  planId: int("planId").notNull().default(1),
  status: mysqlEnum("status", ["active", "blocked", "suspended", "trial"]).notNull().default("trial"),
  trialEndsAt: timestamp("trialEndsAt"),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  claimToken: varchar("claimToken", { length: 64 }),       // Token de ativação gerado no cadastro
  claimExpiresAt: timestamp("claimExpiresAt"),              // Expiração do token (72h)
  coverageZipPrefixes: text("coverageZipPrefixes"),         // JSON: string[] — prefixos de CEP cobertos (ex: ["01","02","04"])
  coverageDeadlines: text("coverage_deadlines"),
  welcomeText: text("welcome_text"),             // JSON: Record<string, number> — prazo em horas por prefixo (ex: {"01":2,"04":4,"default":24})
  notificationEmail: varchar("notificationEmail", { length: 320 }), // E-mail para receber notificações de novas OS
  ownDeliveryEnabled: boolean("ownDeliveryEnabled").notNull().default(true),
  uberDirectEnabled: boolean("uberDirectEnabled").notNull().default(false),
  uberDirectEnvironment: varchar("uberDirectEnvironment", { length: 20 }).notNull().default("sandbox"),
  uberDirectCustomerId: varchar("uberDirectCustomerId", { length: 128 }),
  uberDirectClientId: varchar("uberDirectClientId", { length: 255 }),
  uberDirectClientSecret: text("uberDirectClientSecret"),
  pagarmeEnabled: boolean("pagarmeEnabled").notNull().default(false),
  pagarmeEnvironment: varchar("pagarmeEnvironment", { length: 20 }).notNull().default("sandbox"),
  pagarmePublicKey: varchar("pagarmePublicKey", { length: 255 }),
  pagarmeSecretKey: text("pagarmeSecretKey"),
  pagarmeWebhookSecret: varchar("pagarmeWebhookSecret", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  tenantId: int("tenantId"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", [
    "super_admin",
    "tenant_admin",
    "atendente",
    "tecnico",
    "entregador",
    "cliente",
    "user",
    "admin",
  ])
    .default("user")
    .notNull(),
  isActive: boolean("isActive").notNull().default(true),
  avatarUrl: text("avatarUrl"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  localLoginEnabled: boolean("localLoginEnabled").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  document: varchar("document", { length: 20 }),
  address: text("address"),
  addressNumber: varchar("addressNumber", { length: 20 }),
  addressReference: varchar("addressReference", { length: 200 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  notes: text("notes"),
  // Vínculo com o usuário autenticado (Manus OAuth openId) — permite que o cliente
  // veja suas OS em /minha-conta mesmo sem e-mail cadastrado
  userOpenId: varchar("userOpenId", { length: 64 }),
  // Autenticação local (Fase 3) — clientes sem conta Manus OAuth
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordMustChange: boolean("passwordMustChange").notNull().default(false),
  localLoginEnabled: boolean("localLoginEnabled").notNull().default(false),
  lastLocalLoginAt: timestamp("lastLocalLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
// ─── DEVICES ──────────────────────────────────────────────────────────────────
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  customerId: int("customerId").notNull(),
  brand: varchar("brand", { length: 100 }).notNull(),
  model: varchar("model", { length: 200 }).notNull(),
  type: varchar("type", { length: 100 }),
  imei: varchar("imei", { length: 50 }),
  serialNumber: varchar("serialNumber", { length: 100 }),
  color: varchar("color", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── SERVICE ORDERS ───────────────────────────────────────────────────────────
export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  osNumber: varchar("osNumber", { length: 20 }).notNull(),
  customerId: int("customerId").notNull(),
  deviceId: int("deviceId"),
  origin: mysqlEnum("origin", ["balcao", "coleta"]).notNull().default("balcao"),
  status: mysqlEnum("status", [
    "solicitado",
    "aguardando_coleta",
    "coleta_agendada",
    "coletado",
    "recebido_na_assistencia",
    "em_diagnostico",
    "aguardando_aprovacao",
    "aprovado",
    "recusado",
    "aguardando_peca",
    "em_reparo",
    "pronto",
    "aguardando_entrega",
    "saiu_para_entrega",
    "entregue",
    "finalizado",
    "encerrado_sem_reparo",
    "encerrado_condenado",
    "cancelado",
  ])
    .notNull()
    .default("recebido_na_assistencia"),
  reportedDefect: text("reportedDefect").notNull(),
  physicalCondition: text("physicalCondition"),
  accessories: text("accessories"),
  devicePassword: varchar("devicePassword", { length: 100 }),
  internalNotes: text("internalNotes"),
  technicianId: int("technicianId"),
  attendantId: int("attendantId"),
  estimatedDelivery: timestamp("estimatedDelivery"),
  deliveryAddress: text("deliveryAddress"),
  pickupAddress: text("pickupAddress"),
  preferredPickupTime: varchar("preferredPickupTime", { length: 100 }),
  pickupLatitude: decimal("pickupLatitude", { precision: 10, scale: 7 }),
  pickupLongitude: decimal("pickupLongitude", { precision: 10, scale: 7 }),
  pickupLocationAccuracy: int("pickupLocationAccuracy"),
  warrantyDays: int("warrantyDays").default(90),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00"),
    publicToken: varchar("publicToken", { length: 64 }),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  termsAcceptedIp: varchar("termsAcceptedIp", { length: 45 }),
  deliveryAuthorizedAt: timestamp("deliveryAuthorizedAt"),
  deliveryAuthorizedIp: varchar("deliveryAuthorizedIp", { length: 45 }),
  paymentRequestedAt: timestamp("paymentRequestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
// ─── OS STATUS HISTORY (TIMELINE) ─────────────────────────────────────────────
export const osStatusHistory = mysqlTable("os_status_history", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  notes: text("notes"),
  changedById: int("changedById"),
  changedByName: varchar("changedByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── OS CHECKLIST ─────────────────────────────────────────────────────────────
export const osChecklist = mysqlTable("os_checklist", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  item: varchar("item", { length: 200 }).notNull(),
  checked: boolean("checked").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── PHOTOS ───────────────────────────────────────────────────────────────────
export const photos = mysqlTable("photos", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  url: text("url").notNull(),
  fileKey: text("fileKey").notNull(),
  type: mysqlEnum("type", ["entrada", "coleta", "entrega", "diagnostico", "outro"]).notNull().default("entrada"),
  caption: varchar("caption", { length: 200 }),
  uploadedById: int("uploadedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── BUDGETS ──────────────────────────────────────────────────────────────────
export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  description: text("description"),
  laborCost: decimal("laborCost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  partsCost: decimal("partsCost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).notNull().default("pending"),
  validUntil: timestamp("validUntil"),
  approvedAt: timestamp("approvedAt"),
  rejectedAt: timestamp("rejectedAt"),
  rejectionReason: text("rejectionReason"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── BUDGET ITEMS ─────────────────────────────────────────────────────────────
export const budgetItems = mysqlTable("budget_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  budgetId: int("budgetId").notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["service", "part"]).notNull().default("service"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── PICKUPS ──────────────────────────────────────────────────────────────────
export const pickups = mysqlTable("pickups", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  delivererId: int("delivererId"),
  type: mysqlEnum("type", ["coleta", "entrega"]).notNull(),
  status: mysqlEnum("status", ["pending", "assigned", "in_progress", "completed", "failed"]).notNull().default("pending"),
  address: text("address").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  completedAt: timestamp("completedAt"),
  photoUrl: text("photoUrl"),
  photoKey: text("photoKey"),
  signatureUrl: text("signatureUrl"),
  signatureKey: text("signatureKey"),
  notes: text("notes"),
  recipientName: varchar("recipientName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── WARRANTIES ───────────────────────────────────────────────────────────────
export const warranties = mysqlTable("warranties", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull().unique(),
  warrantyCode: varchar("warrantyCode", { length: 50 }).notNull().unique(),
  description: text("description"),
  warrantyDays: int("warrantyDays").notNull().default(90),
  startsAt: timestamp("startsAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  conditions: text("conditions"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── STOCK ITEMS ──────────────────────────────────────────────────────────────
export const stockItems = mysqlTable("stock_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  category: varchar("category", { length: 100 }),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 200 }),
  quantity: int("quantity").notNull().default(0),
  minQuantity: int("minQuantity").notNull().default(1),
  costPrice: decimal("costPrice", { precision: 10, scale: 2 }).default("0.00"),
  salePrice: decimal("salePrice", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "paid", "failed", "refunded", "cancelled"]).notNull().default("pending"),
  paidAt: timestamp("paidAt"),
  gateway: varchar("gateway", { length: 50 }),
  gatewayPaymentId: varchar("gatewayPaymentId", { length: 120 }),
  gatewayOrderId: varchar("gatewayOrderId", { length: 120 }),
  gatewayChargeId: varchar("gatewayChargeId", { length: 120 }),
  gatewayStatus: varchar("gatewayStatus", { length: 80 }),
  pixQrCode: text("pixQrCode"),
  pixQrCodeUrl: text("pixQrCodeUrl"),
  pixExpiresAt: timestamp("pixExpiresAt"),
  cardLast4: varchar("cardLast4", { length: 4 }),
  installments: int("installments").default(1),
  metadata: json("metadata"),
  notes: text("notes"),
  receivedById: int("receivedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});


// ─── CHECKLIST TEMPLATES (global, gerenciado pelo super_admin) ───────────────
export const checklistTemplates = mysqlTable("checklist_templates", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 200 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  deviceType: varchar("deviceType", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── TENANT CHECKLIST OVERRIDES (personalização por tenant) ─────────────────
/**
 * Cada linha representa uma entrada no checklist do tenant:
 * - templateId != null: override de item global (pode desativar ou reordenar)
 * - templateId == null + isCustom == true: item exclusivo criado pelo tenant
 */
export const tenantChecklistOverrides = mysqlTable("tenant_checklist_overrides", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  templateId: int("templateId"),
  label: varchar("label", { length: 200 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  isCustom: boolean("isCustom").notNull().default(false),
  deviceType: varchar("deviceType", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
// ─── OS NOTIFICATIONS (histórico de notificações enviadas ao cliente) ──────────
export const osNotifications = mysqlTable("os_notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull().default("whatsapp"),
  message: text("message").notNull(),
  /** Tipo do evento: status_change | budget_approved | budget_rejected | whatsapp_* */
  eventType: varchar("eventType", { length: 50 }).notNull().default("status_change"),
  /** Nome de quem disparou o evento (cliente, técnico, atendente) */
  actorName: varchar("actorName", { length: 200 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

// ─── PUSH PWA SUBSCRIPTIONS (assinaturas Web Push por tenant/cliente) ─────────
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  targetType: mysqlEnum("targetType", ["tenant_user", "customer"]).notNull(),
  userId: int("userId"),
  customerId: int("customerId"),
  endpoint: text("endpoint").notNull(),
  endpointHash: varchar("endpointHash", { length: 64 }).notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── WHATSAPP META CLOUD API (configuração isolada por tenant) ────────────────
export const whatsappIntegrations = mysqlTable("whatsapp_integrations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  provider: varchar("provider", { length: 40 }).notNull().default("meta_cloud_api"),
  displayName: varchar("displayName", { length: 120 }),
  businessAccountId: varchar("businessAccountId", { length: 120 }),
  phoneNumberId: varchar("phoneNumberId", { length: 120 }),
  phoneNumber: varchar("phoneNumber", { length: 30 }),
  accessToken: text("accessToken"),
  graphApiVersion: varchar("graphApiVersion", { length: 20 }).notNull().default("v23.0"),
  budgetTemplateName: varchar("budgetTemplateName", { length: 120 }).notNull().default("fullreparo_orcamento_disponivel"),
  readyTemplateName: varchar("readyTemplateName", { length: 120 }).notNull().default("fullreparo_os_pronta"),
  templateLanguage: varchar("templateLanguage", { length: 20 }).notNull().default("pt_BR"),
  lastHealthStatus: varchar("lastHealthStatus", { length: 40 }).notNull().default("not_configured"),
  lastHealthMessage: text("lastHealthMessage"),
  lastCheckedAt: timestamp("lastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const whatsappMessageLogs = mysqlTable("whatsapp_message_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  serviceOrderId: int("serviceOrderId").notNull(),
  customerId: int("customerId"),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  templateName: varchar("templateName", { length: 120 }).notNull(),
  templateLanguage: varchar("templateLanguage", { length: 20 }).notNull().default("pt_BR"),
  toPhone: varchar("toPhone", { length: 30 }).notNull(),
  status: mysqlEnum("status", ["queued", "sent", "skipped", "failed"]).notNull().default("queued"),
  metaMessageId: varchar("metaMessageId", { length: 160 }),
  requestPayload: json("requestPayload"),
  responsePayload: json("responsePayload"),
  errorMessage: text("errorMessage"),
  estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── OS CHECKLIST STATE (estado do checklist por OS) ───────────────────────
export const osChecklistState = mysqlTable("os_checklist_state", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  isChecked: boolean("isChecked").notNull().default(false),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type WhatsappIntegration = typeof whatsappIntegrations.$inferSelect;
export type WhatsappMessageLog = typeof whatsappMessageLogs.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type OsStatusHistory = typeof osStatusHistory.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Pickup = typeof pickups.$inferSelect;
export type Warranty = typeof warranties.$inferSelect;
export type StockItem = typeof stockItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Photo = typeof photos.$inferSelect;
