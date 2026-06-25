import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";

export const ADMIN_PEDIDOS_SELECT =
  "id, status, card_name, image_url, url_resultado, created_at, user_id, diamond_cost, type, mode, audio_enabled, assigned_to";

export const ADMIN_PEDIDOS_FETCH_LIMIT = 200;

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "pendente").trim().toLowerCase();
}

/** Status que aparecem na fila de pedidos do admin. */
export function isAdminQueueStatus(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return (
    s === "pendente" ||
    s === "pending" ||
    s === "processing" ||
    s === "processando" ||
    s === ""
  );
}

export function isTerminalGenerationStatus(
  status: string | null | undefined,
): boolean {
  const s = normalizeStatus(status);
  return (
    s === "concluido" ||
    s === "completed" ||
    s === "failed" ||
    s === "falhou"
  );
}

export function filterAdminQueuePedidos(rows: AdminPedido[]): AdminPedido[] {
  return rows.filter((p) => isAdminQueueStatus(p.status));
}

/** Mais recentes primeiro (topo da lista). */
export function sortPedidosByCreatedAtDesc<T extends { created_at?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime(),
  );
}

/** Mescla listas sem perder pedidos válidos que ainda não voltaram na API. */
export function mergeAdminPedidoLists(
  existing: AdminPedido[],
  incoming: AdminPedido[],
): AdminPedido[] {
  const map = new Map<string, AdminPedido>();

  for (const row of existing) {
    if (isAdminQueueStatus(row.status)) {
      map.set(row.id, row);
    }
  }

  for (const row of incoming) {
    if (isTerminalGenerationStatus(row.status)) {
      map.delete(row.id);
      continue;
    }
    if (isAdminQueueStatus(row.status)) {
      map.set(row.id, { ...map.get(row.id), ...row });
    }
  }

  return sortPedidosByCreatedAtDesc([...map.values()]);
}

export function mergePedidoIntoList(
  list: AdminPedido[],
  row: AdminPedido,
): AdminPedido[] {
  if (isTerminalGenerationStatus(row.status)) {
    return list.filter((p) => p.id !== row.id);
  }

  // UPDATE parcial ou status desconhecido: não remove o que já estava na fila.
  if (!isAdminQueueStatus(row.status)) {
    return list;
  }

  return mergeAdminPedidoLists(list, [row]);
}
