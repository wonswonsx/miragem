/** Linha mínima de um INSERT em `generations` para notificação admin. */
export type AdminGenerationNotifyRow = {
  card_name?: string | null;
  status?: string | null;
};

export function isPendingGenerationStatus(
  status: string | null | undefined,
): boolean {
  const s = (status ?? "pendente").toLowerCase();
  return (
    s === "pendente" ||
    s === "pending" ||
    s === "processing" ||
    s === "processando"
  );
}

/** Texto amigável para toast/banner quando chega pedido novo. */
export function formatAdminNewOrderMessage(
  row: AdminGenerationNotifyRow,
  options?: { clientLabel?: string | null },
): string {
  const card = row.card_name?.trim();
  const client = options?.clientLabel?.trim();

  if (card && client) {
    return `Novo pedido: ${card} · ${client}`;
  }
  if (card) {
    return `Novo pedido: ${card}`;
  }
  return "Novo pedido recebido!";
}
