"use client";

import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import { UserRound } from "lucide-react";

type Props = {
  pedido: AdminPedido;
  assigning: boolean;
  onAssign: (pedidoId: string) => void;
  compact?: boolean;
};

export function AssignedToCell({ pedido, assigning, onAssign, compact }: Props) {
  const assigned = pedido.assigned_to?.trim();

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Atendido por
      </p>
      {assigned ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-100">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          {assigned}
        </span>
      ) : (
        <button
          type="button"
          disabled={assigning}
          onClick={() => onAssign(pedido.id)}
          className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
        >
          {assigning ? "Assumindo…" : "Assumir Pedido"}
        </button>
      )}
    </div>
  );
}
