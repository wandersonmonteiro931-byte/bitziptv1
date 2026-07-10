export type AccessProfileLike = {
  status?: string | null;
  iptv_status?: string | null;
};

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const DEACTIVATED_ACCOUNT_STATUSES = new Set([
  "disabled",
  "inactive",
  "deactivated",
  "desativado",
  "suspended",
  "suspenso",
]);

const ARCHIVED_ACCOUNT_STATUSES = new Set([
  "archived",
  "arquivado",
  "deleted",
  "removed",
  "excluded",
  "excluido",
]);

const DEACTIVATED_TV_STATUSES = new Set([
  "disabled",
  "inactive",
  "deactivated",
  "desativado",
]);

export const getUserAccessDeniedMessage = (profile: AccessProfileLike | null | undefined) => {
  if (!profile) return null;

  const accountStatus = normalize(profile.status);
  const tvStatus = normalize(profile.iptv_status);

  if (DEACTIVATED_ACCOUNT_STATUSES.has(accountStatus) || DEACTIVATED_TV_STATUSES.has(tvStatus)) {
    return "Usuário desativado.";
  }
  if (ARCHIVED_ACCOUNT_STATUSES.has(accountStatus)) {
    return "Seu acesso está arquivado. Entre em contato com o suporte.";
  }
  if (accountStatus === "blocked" || accountStatus === "bloqueado") {
    return "Seu acesso está bloqueado. Entre em contato com o suporte.";
  }
  if (accountStatus === "pending" || accountStatus === "pendente") {
    return "Seu pagamento foi identificado. Aguarde liberação do sistema.";
  }

  return null;
};

export const isUserAccessDisabled = (profile: AccessProfileLike | null | undefined) =>
  Boolean(getUserAccessDeniedMessage(profile));

export const AUTH_NOTICE_STORAGE_KEY = "wmcplayer_auth_notice";
