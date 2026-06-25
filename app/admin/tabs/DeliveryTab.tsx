"use client";

import {
  AdminPedidosTicketClient,
  type AdminPedido,
} from "@/app/admin/pedidos/AdminPedidosTicketClient";
import {
  filterAdminQueuePedidos,
  sortPedidosByCreatedAtDesc,
} from "@/lib/adminPedidosQuery";

interface DeliveryTabProps {
  initialGenerations: AdminPedido[];
}

export function DeliveryTab({ initialGenerations }: DeliveryTabProps) {
  const pedidos = sortPedidosByCreatedAtDesc(
    filterAdminQueuePedidos(initialGenerations),
  );

  return <AdminPedidosTicketClient pedidos={pedidos} />;
}
