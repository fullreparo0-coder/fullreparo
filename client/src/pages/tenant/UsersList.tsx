import { useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Edit, Mail, Phone, Plus, Power, UserCog } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "tenant_admin", label: "Administrador" },
  { value: "atendente", label: "Atendente" },
  { value: "tecnico", label: "Técnico" },
  { value: "entregador", label: "Entregador" },
] as const;

type TeamRole = (typeof ROLE_OPTIONS)[number]["value"];

type UserForm = {
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
};

type TeamUser = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
};

const EMPTY_FORM: UserForm = { name: "", email: "", phone: "", role: "atendente" };

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Administrador",
  atendente: "Atendente",
  tecnico: "Técnico",
  entregador: "Entregador",
  super_admin: "Super Admin",
  admin: "Admin",
  user: "Usuário",
};

const ROLE_COLORS: Record<string, string> = {
  tenant_admin: "bg-purple-100 text-purple-800",
  atendente: "bg-blue-100 text-blue-800",
  tecnico: "bg-amber-100 text-amber-800",
  entregador: "bg-emerald-100 text-emerald-800",
};

function normalizeForm(form: UserForm) {
  return {
    name: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    role: form.role,
  };
}

export default function UsersList() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM);
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();
  const create = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso");
      setOpen(false);
      setForm(EMPTY_FORM);
      utils.users.list.invalidate();
    },
    onError: () => toast.error("Erro ao criar usuário"),
  });

  const update = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Membro atualizado com sucesso");
      setEditOpen(false);
      setEditingUser(null);
      setEditForm(EMPTY_FORM);
      utils.users.list.invalidate();
    },
    onError: () => toast.error("Erro ao atualizar membro"),
  });

  function openEdit(user: TeamUser) {
    setEditingUser(user);
    setEditForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: ROLE_OPTIONS.some((r) => r.value === user.role) ? (user.role as TeamRole) : "atendente",
    });
    setEditOpen(true);
  }

  function handleCreate() {
    const payload = normalizeForm(form);
    if (!payload.name) {
      toast.error("Informe o nome do membro");
      return;
    }
    create.mutate(payload);
  }

  function handleUpdate() {
    if (!editingUser) return;
    const payload = normalizeForm(editForm);
    if (!payload.name) {
      toast.error("Informe o nome do membro");
      return;
    }
    update.mutate({ id: editingUser.id, ...payload });
  }

  function toggleActive(user: TeamUser) {
    update.mutate({ id: user.id, isActive: !user.isActive });
  }

  const totalActive = users?.filter((u) => u.isActive).length ?? 0;
  const totalTechnicians = users?.filter((u) => u.role === "tecnico" && u.isActive).length ?? 0;
  const totalDeliverers = users?.filter((u) => u.role === "entregador" && u.isActive).length ?? 0;

  return (
    <TenantLayout title="Equipe">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Membros ativos</p>
              <p className="text-2xl font-bold">{totalActive}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Técnicos ativos</p>
              <p className="text-2xl font-bold">{totalTechnicians}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Entregadores ativos</p>
              <p className="text-2xl font-bold">{totalDeliverers}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Gestão da equipe</h2>
            <p className="text-sm text-muted-foreground">Cadastre, edite, altere o perfil e ative ou inative usuários do painel.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" /> Adicionar Membro</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Membro da Equipe</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome *</Label>
                  <Input className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" className="mt-1.5" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="mt-1.5" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Perfil</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as TeamRole }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={!form.name.trim() || create.isPending}>
                  {create.isPending ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : !users || users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <UserCog className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum membro na equipe</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione atendentes, técnicos e entregadores para organizar o atendimento.</p>
                <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar primeiro membro
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((u) => (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {(u.name ?? "U")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{u.name ?? "Sem nome"}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {u.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span> : null}
                          {u.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span> : null}
                          {!u.email && !u.phone ? <span>Sem contato cadastrado</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <Badge variant={u.isActive ? "default" : "secondary"} className="text-[10px]">
                        {u.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(u)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant={u.isActive ? "outline" : "default"}
                        className="h-8"
                        disabled={update.isPending}
                        onClick={() => toggleActive(u)}
                      >
                        <Power className="h-3.5 w-3.5 mr-1" /> {u.isActive ? "Inativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={(value) => { setEditOpen(value); if (!value) setEditingUser(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Membro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input className="mt-1.5" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" className="mt-1.5" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input className="mt-1.5" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as TeamRole }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={update.isPending}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleUpdate} disabled={!editForm.name.trim() || update.isPending}>
                  {update.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
}
