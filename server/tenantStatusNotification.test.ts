/**
 * Testes para o helper notifyTenantStatusChange
 * Verifica que statuses críticos disparam notificação e statuses não críticos são ignorados.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyTenantStatusChange } from "./_core/statusNotification";
import * as notification from "./_core/notification";

describe("notifyTenantStatusChange", () => {
  let notifyOwnerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifyOwnerSpy = vi.spyOn(notification, "notifyOwner").mockResolvedValue(true);
  });

  it("dispara notificação para status 'pronto'", () => {
    notifyTenantStatusChange({
      osRef: "OS #42 (OS-2024-042)",
      tenantName: "TechFix",
      status: "pronto",
      changedByName: "João",
    });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
    const call = notifyOwnerSpy.mock.calls[0][0];
    expect(call.title).toContain("Pronto para retirada");
    expect(call.title).toContain("OS #42");
    expect(call.content).toContain("TechFix");
    expect(call.content).toContain("João");
  });

  it("dispara notificação para status 'em_reparo'", () => {
    notifyTenantStatusChange({
      osRef: "OS #10",
      tenantName: "Rocha Store",
      status: "em_reparo",
    });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
    const call = notifyOwnerSpy.mock.calls[0][0];
    expect(call.title).toContain("Reparo iniciado");
    expect(call.title).toContain("🔧");
  });

  it("dispara notificação para status 'cancelado' com observação", () => {
    notifyTenantStatusChange({
      osRef: "OS #7",
      tenantName: "TechFix",
      status: "cancelado",
      notes: "Cliente desistiu do reparo",
    });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
    const call = notifyOwnerSpy.mock.calls[0][0];
    expect(call.title).toContain("OS cancelada");
    expect(call.content).toContain("Cliente desistiu do reparo");
  });

  it("dispara notificação para status 'finalizado'", () => {
    notifyTenantStatusChange({
      osRef: "OS #99",
      tenantName: "TechFix",
      status: "finalizado",
    });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
    const call = notifyOwnerSpy.mock.calls[0][0];
    expect(call.title).toContain("Serviço finalizado");
    expect(call.title).toContain("🎉");
  });

  it("dispara notificação para status 'entregue'", () => {
    notifyTenantStatusChange({
      osRef: "OS #5",
      tenantName: "TechFix",
      status: "entregue",
      notes: "Recebido por: Maria",
    });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
    const call = notifyOwnerSpy.mock.calls[0][0];
    expect(call.title).toContain("Entregue ao cliente");
    expect(call.content).toContain("Recebido por: Maria");
  });

  it("dispara notificação para status 'coletado'", () => {
    notifyTenantStatusChange({ osRef: "OS #3", tenantName: "TechFix", status: "coletado" });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
  });

  it("dispara notificação para status 'coleta_agendada'", () => {
    notifyTenantStatusChange({ osRef: "OS #3", tenantName: "TechFix", status: "coleta_agendada" });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
  });

  it("dispara notificação para status 'saiu_para_entrega'", () => {
    notifyTenantStatusChange({ osRef: "OS #3", tenantName: "TechFix", status: "saiu_para_entrega" });
    expect(notifyOwnerSpy).toHaveBeenCalledOnce();
  });

  it("NÃO dispara notificação para status 'aguardando_aprovacao' (não crítico para tenant)", () => {
    notifyTenantStatusChange({ osRef: "OS #1", tenantName: "TechFix", status: "aguardando_aprovacao" });
    expect(notifyOwnerSpy).not.toHaveBeenCalled();
  });

  it("NÃO dispara notificação para status 'em_diagnostico' (não crítico para tenant)", () => {
    notifyTenantStatusChange({ osRef: "OS #1", tenantName: "TechFix", status: "em_diagnostico" });
    expect(notifyOwnerSpy).not.toHaveBeenCalled();
  });

  it("NÃO dispara notificação para status desconhecido", () => {
    notifyTenantStatusChange({ osRef: "OS #1", tenantName: "TechFix", status: "status_inexistente" });
    expect(notifyOwnerSpy).not.toHaveBeenCalled();
  });

  it("NÃO bloqueia execução se notifyOwner rejeitar", async () => {
    notifyOwnerSpy.mockRejectedValue(new Error("Serviço indisponível"));
    // Não deve lançar exceção
    expect(() =>
      notifyTenantStatusChange({ osRef: "OS #1", tenantName: "TechFix", status: "pronto" })
    ).not.toThrow();
  });
});
