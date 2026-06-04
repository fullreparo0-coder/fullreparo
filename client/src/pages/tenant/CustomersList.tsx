import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Pagination } from "@/components/Pagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCepLookup, formatCep } from "@/hooks/useCepLookup";
import { isValidDocument, detectDocumentType, onlyDigits } from "@shared/cpfCnpj";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  HelpCircle,
  ChevronRight,
  Loader2,
  Check,
  MessageSquare,
  Download,
  FileText,
} from "lucide-react";
import { useState as useExportState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;
type CustomerSourceFilter = "all" | "balcao" | "online";

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  document: "",
  zipCode: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  addressReference: "",
  notes: "",
};

export default function CustomersList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CustomerSourceFilter>("all");
  const [page, setPage] = useState(1);
  const [exportingCsv, setExportingCsv] = useExportState(false);
  const [exportingPdf, setExportingPdf] = useExportState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [docError, setDocError] = useState("");
  const utils = trpc.useUtils();

  useEffect(() => { setPage(1); }, [search, sourceFilter]);

  const { data, isLoading } = trpc.customers.list.useQuery({
    search: search || undefined,
    source: sourceFilter === "all" ? undefined : sourceFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const customers = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const counterLabel = totalCount === 1 ? "1 cliente" : `${totalCount} clientes`;

  const create = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso.");
      setOpen(false);
      setForm(EMPTY_FORM);
      setDocError("");
      utils.customers.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Erro ao cadastrar cliente."),
  });

  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // CEP lookup
  const { status: cepStatus, error: cepError } = useCepLookup(form.zipCode, {
    onFound: (r) =>
      setForm((f) => ({
        ...f,
        address: r.address || f.address,
        neighborhood: r.neighborhood || f.neighborhood,
        city: r.city || f.city,
        state: r.state || f.state,
      })),
  });

  // Validação inline de CPF/CNPJ
  const handleDocumentChange = (value: string) => {
    update("document", value);
    const digits = onlyDigits(value);
    if (digits.length === 11 || digits.length === 14) {
      if (!isValidDocument(digits)) {
        const type = detectDocumentType(digits);
        setDocError(type ? `${type} inválido.` : "Documento inválido.");
      } else {
        setDocError("");
      }
    } else {
      setDocError("");
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (!form.phone.trim()) return;
    if (docError) return;
    create.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      document: form.document.trim() || undefined,
      zipCode: onlyDigits(form.zipCode) || undefined,
      address: form.address.trim() || undefined,
      addressNumber: form.addressNumber.trim() || undefined,
      neighborhood: form.neighborhood.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      addressReference: form.addressReference.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const isValid = form.name.trim().length >= 2 && form.phone.trim().length >= 8 && !docError;

  return (
    <TenantLayout title="Clientes">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 pl-11 pr-11 text-base sm:h-10 sm:text-sm"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs">
                  <p className="font-semibold text-xs mb-1.5">Campos de busca:</p>
                  <ul className="space-y-1 text-xs">
                    <li><span className="font-medium">Nome</span> do cliente</li>
                    <li><span className="font-medium">CPF / CNPJ</span></li>
                    <li><span className="font-medium">Telefone</span></li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
              <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as CustomerSourceFilter)}>
                <SelectTrigger className="h-11 w-full bg-background text-sm sm:w-36 sm:h-10">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="balcao">Balcão</SelectItem>
                  <SelectItem value="online">On-line</SelectItem>
                </SelectContent>
              </Select>

              {/* Botões de exportação */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-1.5 bg-background sm:h-10">
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={exportingCsv}
                onClick={async () => {
                  setExportingCsv(true);
                  try {
                    const params = new URLSearchParams();
                    if (search) params.set("search", search);
                    if (sourceFilter !== "all") params.set("source", sourceFilter);
                    const a = document.createElement("a");
                    a.href = `/api/export/clientes.csv?${params.toString()}`;
                    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  } finally { setExportingCsv(false); }
                }}
              >
                <Download className="h-4 w-4 mr-2 text-green-600" />
                {exportingCsv ? "Gerando..." : "Exportar CSV"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exportingPdf}
                onClick={async () => {
                  setExportingPdf(true);
                  try {
                    const params = new URLSearchParams();
                    if (search) params.set("search", search);
                    if (sourceFilter !== "all") params.set("source", sourceFilter);
                    const a = document.createElement("a");
                    a.href = `/api/export/clientes.pdf?${params.toString()}`;
                    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.pdf`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  } finally { setExportingPdf(false); }
                }}
              >
                <FileText className="h-4 w-4 mr-2 text-red-600" />
                {exportingPdf ? "Gerando..." : "Exportar PDF"}
              </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium text-foreground/80">{counterLabel}</span>
            </p>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(EMPTY_FORM); setDocError(""); } }}>
              <DialogTrigger asChild>
                <Button className="h-10 px-4"><Plus className="h-4 w-4 mr-1.5" />Novo Cliente</Button>
              </DialogTrigger>

              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Cliente</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-1">
                {/* Dados pessoais */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Dados Pessoais
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-sm">Nome <span className="text-destructive">*</span></Label>
                      <Input
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Nome completo"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Telefone <span className="text-destructive">*</span></Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">E-mail</Label>
                      <Input
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="email@exemplo.com"
                        type="email"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-sm">CPF / CNPJ</Label>
                      <Input
                        value={form.document}
                        onChange={(e) => handleDocumentChange(e.target.value)}
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                        className={`h-9 ${docError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {docError && (
                        <p className="text-xs text-destructive">{docError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Endereço */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Endereço
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* CEP */}
                    <div className="space-y-1">
                      <Label className="text-sm">CEP</Label>
                      <div className="relative">
                        <Input
                          value={form.zipCode}
                          onChange={(e) => update("zipCode", formatCep(e.target.value))}
                          placeholder="00000-000"
                          maxLength={9}
                          className="h-9 pr-7"
                        />
                        {cepStatus === "loading" && (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                        {cepStatus === "found" && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
                        )}
                      </div>
                      {cepStatus === "error" && cepError && (
                        <p className="text-xs text-destructive">{cepError}</p>
                      )}
                      {cepStatus === "found" && (
                        <p className="text-xs text-green-600">Preenchido automaticamente.</p>
                      )}
                    </div>

                    {/* Bairro */}
                    <div className="space-y-1">
                      <Label className="text-sm">Bairro</Label>
                      <Input
                        value={form.neighborhood}
                        onChange={(e) => update("neighborhood", e.target.value)}
                        placeholder="Centro"
                        className="h-9"
                      />
                    </div>

                    {/* Logradouro */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-sm">Logradouro</Label>
                      <Input
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                        placeholder="Rua, Avenida, Travessa..."
                        className="h-9"
                      />
                    </div>

                    {/* Número + Cidade */}
                    <div className="space-y-1">
                      <Label className="text-sm">Número</Label>
                      <Input
                        value={form.addressNumber}
                        onChange={(e) => update("addressNumber", e.target.value)}
                        placeholder="123"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Cidade</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => update("city", e.target.value)}
                        placeholder="São Paulo"
                        className="h-9"
                      />
                    </div>

                    {/* Estado + Ponto de Referência */}
                    <div className="space-y-1">
                      <Label className="text-sm">Estado</Label>
                      <Input
                        value={form.state}
                        onChange={(e) => update("state", e.target.value.toUpperCase().slice(0, 2))}
                        placeholder="SP"
                        maxLength={2}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Ponto de Referência</Label>
                      <Input
                        value={form.addressReference}
                        onChange={(e) => update("addressReference", e.target.value)}
                        placeholder="Próx. ao mercado..."
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Observações */}
                <div className="space-y-1">
                  <Label className="text-sm">Observações</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Informações adicionais..."
                    className="h-9"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!isValid || create.isPending}
                >
                  {create.isPending ? "Cadastrando..." : "Cadastrar Cliente"}
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {search || sourceFilter !== "all" ? "Nenhum cliente encontrado para esses filtros" : "Nenhum cliente cadastrado"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {customers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => navigate(`/painel/clientes/${c.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/painel/clientes/${c.id}`)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                        {c.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {c.email}
                          </span>
                        )}
                        {c.document && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {c.document}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.phone && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center justify-center h-7 w-7 rounded-full bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 hover:text-green-800 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const phone = String(c.phone).replace(/\D/g, "");
                                window.open(`https://wa.me/55${phone}`, "_blank");
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">WhatsApp: {c.phone}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginação */}
        {totalCount > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>
    </TenantLayout>
  );
}
