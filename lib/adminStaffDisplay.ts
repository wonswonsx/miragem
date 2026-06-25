import type { User } from "@supabase/supabase-js";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";

export type AdminAssignFilter = "all" | "mine" | "unassigned";

/** Rótulo legível do admin logado para gravar em `assigned_to`. */
export function getAdminDisplayLabel(user: User | null | undefined): string {
  if (!user) return "Admin";
  const meta = user.user_metadata as {
    display_name?: string;
    admin_label?: string;
    full_name?: string;
  };
  const fromMeta =
    meta.admin_label?.trim() ||
    meta.display_name?.trim() ||
    meta.full_name?.trim();
  if (fromMeta) return fromMeta;

  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? email;
    if (!local) return email;
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return "Admin";
}

export function normalizeAssignee(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isPedidoAssignedToMe(
  pedido: AdminPedido,
  myLabel: string,
): boolean {
  const mine = normalizeAssignee(myLabel);
  const theirs = normalizeAssignee(pedido.assigned_to);
  return Boolean(mine && theirs && mine === theirs);
}

export function filterPedidosByAssignment(
  pedidos: AdminPedido[],
  filter: AdminAssignFilter,
  myLabel: string,
): AdminPedido[] {
  if (filter === "all") return pedidos;
  if (filter === "unassigned") {
    return pedidos.filter((p) => !normalizeAssignee(p.assigned_to));
  }
  return pedidos.filter((p) => isPedidoAssignedToMe(p, myLabel));
}

export function getGenerationTypeLabel(
  type?: string | null,
  mode?: string | null,
): string {
  const value = (type ?? mode ?? "padrao").trim().toLowerCase();
  if (value === "estendido" || value === "extend" || value === "extended") {
    return "Estensão de Vídeo";
  }
  return "Imagem para Vídeo";
}

export function isExtendedGeneration(
  type?: string | null,
  mode?: string | null,
): boolean {
  const value = (type ?? mode ?? "").trim().toLowerCase();
  return value === "estendido" || value === "extend" || value === "extended";
}
