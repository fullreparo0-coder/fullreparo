import { useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Truck, MapPin, CheckCircle2, Camera, Package } from "lucide-react";

export default function DelivererDashboard() {
  const [selectedPickup, setSelectedPickup] = useState<number | null>(null);
  const [photoBase64, setPhotoBase64] = useState("");
  const [signatureBase64, setSignatureBase64] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const utils = trpc.useUtils();

  const { data: myPickups, isLoading } = trpc.pickups.myPickupsDeliverer.useQuery();
  const complete = trpc.pickups.complete.useMutation({
    onSuccess: () => {
      toast.success("Confirmado com sucesso!");
      setSelectedPickup(null);
      setPhotoBase64("");
      setSignatureBase64("");
      setRecipientName("");
      utils.pickups.myPickupsDeliverer.invalidate();
    },
    onError: () => toast.error("Erro ao confirmar"),
  });

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoBase64(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (!selectedPickup || !photoBase64 || !signatureBase64) {
      toast.error("Foto e assinatura são obrigatórias");
      return;
    }
    complete.mutate({
      pickupId: selectedPickup,
      photoBase64,
      signatureBase64,
      recipientName,
    });
  };

  const pending = myPickups?.filter((p) => p.status !== "completed") ?? [];
  const completed = myPickups?.filter((p) => p.status === "completed") ?? [];

  return (
    <TenantLayout title="Minhas Entregas">
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Pendentes ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma entrega pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${p.type === "coleta" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {p.type === "coleta" ? "Coleta" : "Entrega"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">OS #{p.serviceOrderId}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{p.address}</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setSelectedPickup(p.id)}>
                      Confirmar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concluídas */}
        {completed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Concluídas ({completed.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {completed.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">
                        {p.type === "coleta" ? "Coleta" : "Entrega"} — OS #{p.serviceOrderId}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                    </div>
                    {p.completedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.completedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de confirmação */}
      <Dialog open={selectedPickup !== null} onOpenChange={(o) => !o && setSelectedPickup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Coleta/Entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do recebedor</Label>
              <Input
                className="mt-1.5"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nome de quem recebeu"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Camera className="h-4 w-4" /> Foto de confirmação *
              </Label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground cursor-pointer"
              />
              {photoBase64 && (
                <img src={photoBase64} alt="Preview" className="mt-2 h-24 w-full object-cover rounded-lg" />
              )}
            </div>
            <SignatureCanvas
              label="Assinatura do recebedor *"
              onSave={(sig) => setSignatureBase64(sig)}
            />
            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={!photoBase64 || !signatureBase64 || complete.isPending}
            >
              {complete.isPending ? "Confirmando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}
