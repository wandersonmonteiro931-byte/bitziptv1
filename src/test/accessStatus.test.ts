import { describe, expect, it } from "vitest";
import { getUserAccessDeniedMessage, isUserAccessDisabled } from "@/lib/accessStatus";

describe("accessStatus", () => {
  it.each(["disabled", "inactive", "desativado", "suspended", "archived", "deleted"])(
    "bloqueia status de conta %s",
    (status) => expect(isUserAccessDisabled({ status, iptv_status: "active" })).toBe(true),
  );

  it("bloqueia status TV desativado", () => {
    expect(isUserAccessDisabled({ status: "active", iptv_status: "disabled" })).toBe(true);
    expect(getUserAccessDeniedMessage({ status: "active", iptv_status: "disabled" })).toBe("Usuário desativado.");
  });

  it("permite cliente bloqueado por pagamento acessar para renovar", () => {
    expect(isUserAccessDisabled({ status: "active", iptv_status: "blocked" })).toBe(false);
  });

  it("mantém o bloqueio antigo do status geral da conta", () => {
    expect(getUserAccessDeniedMessage({ status: "blocked", iptv_status: "active" })).toContain("bloqueado");
    expect(getUserAccessDeniedMessage({ status: "pending", iptv_status: "active" })).toContain("Aguarde");
  });
});
