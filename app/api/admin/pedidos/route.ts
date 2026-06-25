import { isStaff } from "@/lib/auth/staff";
import {
  ADMIN_PEDIDOS_FETCH_LIMIT,
  ADMIN_PEDIDOS_SELECT,
  filterAdminQueuePedidos,
  sortPedidosByCreatedAtDesc,
} from "@/lib/adminPedidosQuery";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json(
      { error: "Service role não configurada." },
      { status: 503 },
    );
  }

  // Busca recentes e filtra no app — evita perder pedidos por mismatch no `.or()`.
  const { data, error } = await service
    .from("generations" as never)
    .select(ADMIN_PEDIDOS_SELECT)
    .order("created_at", { ascending: false })
    .limit(ADMIN_PEDIDOS_FETCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pedidos = sortPedidosByCreatedAtDesc(
    filterAdminQueuePedidos((data ?? []) as unknown as AdminPedido[]),
  );

  return NextResponse.json({ pedidos });
}
